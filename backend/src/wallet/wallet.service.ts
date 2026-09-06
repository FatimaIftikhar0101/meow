import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { writeAudit } from '../common/audit/audit';
import { FundWalletDto } from './dto/fund-wallet.dto';

const FUND_LIMIT_PER_DAY = new Prisma.Decimal(20000);

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async getBalance(userId: string) {
    const wallet = await this.primaryWallet(userId);
    return {
      balance: (await this.computeBalance(wallet.id)).toFixed(2),
      currency: wallet.currency,
    };
  }

  /** Credits minus debits, from the covering index. See LedgerService. */
  computeBalance(walletId: string): Promise<Prisma.Decimal> {
    return this.ledger.balance(walletId);
  }

  findUserWallet(userId: string, currency: string) {
    return this.ledger.customerAccount(userId, currency);
  }

  /**
   * ── [LICENSED-INTEGRATION] Payment acquiring ──────────────────────────────
   *
   * Money in. Today this credits the wallet against the house float on the
   * customer's say-so — there is no card, no bank debit, and nothing that can
   * fail or be charged back. It is the single largest gap between this build
   * and a real one, and it is deliberately the *only* place that gap exists:
   * everything downstream already moves value through the double-entry ledger,
   * so funding becomes real without the rest of the system changing.
   *
   * Under a licence the flow inverts. The client asks the server to create a
   * payment intent, the customer authorises it with the acquirer (Stripe,
   * Moneris, or an EFT/Interac provider for Canada), and the wallet is credited
   * only when the acquirer's webhook confirms settlement — never in the request
   * that starts the payment.
   *
   * Three things this method already has are what make that swap small:
   * `idempotencyKey`, which becomes the acquirer's payment id; the `FOR UPDATE`
   * lock, which keeps concurrent credits honest; and the float account, which
   * becomes the real settlement account the acquirer pays into.
   *
   * What has to be added is the reverse direction. A card payment can be pulled
   * back weeks later, so a chargeback needs a compensating ledger entry and a
   * decision about a wallet that has already been spent down. There is no
   * refund path in the ledger today because nothing can yet be refunded.
   */
  async fund(userId: string, dto: FundWalletDto) {
    const primary = await this.primaryWallet(userId);
    const currency = (dto.currency ?? primary.currency).toUpperCase();
    const wallet = await this.findUserWallet(userId, currency);
    if (!wallet) {
      throw new BadRequestException(`No ${currency} wallet`);
    }

    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    const amount = new Prisma.Decimal(dto.amount);

    // Resolved before the transaction opens. `systemAccountId` can write, and
    // a write to a shared row from inside a transaction already holding a
    // wallet lock is a deadlock waiting for two customers to fund at once.
    const floatAccount = await this.ledger.systemAccountId('float', currency);

    await this.prisma.$transaction(async (tx) => {
      // Lock the wallet so two concurrent funds can't both pass the daily
      // limit check and over-fund the account.
      await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${wallet.id} FOR UPDATE`;

      const existing = await tx.ledgerEntry.findFirst({
        where: {
          accountId: wallet.id,
          type: 'wallet_fund',
          description: `idempotency:${idempotencyKey}`,
        },
      });
      if (existing) {
        throw new ConflictException('Funding already processed');
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sum = await tx.ledgerEntry.aggregate({
        where: {
          accountId: wallet.id,
          type: 'wallet_fund',
          createdAt: { gte: since },
        },
        _sum: { amount: true },
      });
      const used = sum._sum.amount ?? new Prisma.Decimal(0);
      if (used.plus(amount).gt(FUND_LIMIT_PER_DAY)) {
        throw new BadRequestException(
          `Daily funding limit ${FUND_LIMIT_PER_DAY.toString()} exceeded`,
        );
      }

      // Money arriving from outside: our cash goes up (debit an asset) and
      // what we owe the customer goes up with it (credit a liability). The
      // credit alone used to be the whole posting, which is why the business
      // had no record of holding the money it had just been given.
      await this.ledger.post(tx, {
        key: `wallet-fund:${idempotencyKey}`,
        currency,
        legs: [
          {
            accountId: wallet.id,
            direction: 'credit',
            type: 'wallet_fund',
            amount,
            description: `idempotency:${idempotencyKey}`,
          },
          {
            accountId: floatAccount,
            direction: 'debit',
            type: 'wallet_fund',
            amount,
            description: `Funding received for ${wallet.id}`,
          },
        ],
      });
      await writeAudit(tx, {
        actor: { id: userId },
        action: 'wallet.fund',
        entityType: 'wallet',
        entityId: wallet.id,
        after: { amount: amount.toString(), currency },
        metadata: { idempotencyKey },
      });
    });

    return {
      balance: (await this.computeBalance(wallet.id)).toFixed(2),
      currency,
    };
  }

  async transactions(userId: string, limit = 50) {
    const wallet = await this.primaryWallet(userId);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      include: {
        transfer: {
          select: {
            id: true,
            // Snapshot, not the live recipient row — see Transfer in
            // schema.prisma. A statement line must not change meaning because
            // the customer later edited a saved recipient.
            recipientName: true,
            recipientCountry: true,
          },
        },
      },
    });
    return entries.map((e) => ({
      id: e.id,
      direction: e.direction,
      type: e.type,
      amount: e.amount.toString(),
      currency: e.currency,
      description: e.description,
      createdAt: e.createdAt,
      transfer: e.transfer
        ? {
            id: e.transfer.id,
            recipient: {
              name: e.transfer.recipientName,
              country: e.transfer.recipientCountry,
            },
          }
        : null,
    }));
  }

  /**
   * The customer's main wallet, created on first use if it is missing.
   *
   * This used to throw `Wallet not found`, which is what a real customer was
   * shown when they tried to add money: a true statement about our data and no
   * help at all. An account can reach here without a wallet — signing in with
   * Google against an address that already has an account links the two and
   * creates nothing — and there is no case where the right answer is to refuse.
   * A wallet is an empty ledger account; making one is free and idempotent.
   */
  private async primaryWallet(userId: string) {
    const existing = await this.prisma.ledgerAccount.findFirst({
      where: { kind: 'customer_wallet', ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, country: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const currency = LedgerService.homeCurrencyFor(user.country);
    this.logger.log(
      `Creating missing ${currency} wallet for user ${userId} on first use`,
    );
    return this.ledger.ensureCustomerAccount(userId, currency);
  }
}
