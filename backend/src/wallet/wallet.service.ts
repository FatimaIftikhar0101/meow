import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { writeAudit } from '../common/audit/audit';
import { FundWalletDto } from './dto/fund-wallet.dto';

const FUND_LIMIT_PER_DAY = new Prisma.Decimal(20000);

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    const wallet = await this.primaryWallet(userId);
    return {
      balance: (await this.computeBalance(wallet.id)).toFixed(2),
      currency: wallet.currency,
    };
  }

  async computeBalance(walletId: string): Promise<Prisma.Decimal> {
    const [credits, debits] = await Promise.all([
      this.prisma.ledgerEntry.aggregate({
        where: { walletId, direction: 'credit' },
        _sum: { amount: true },
      }),
      this.prisma.ledgerEntry.aggregate({
        where: { walletId, direction: 'debit' },
        _sum: { amount: true },
      }),
    ]);
    const c = credits._sum.amount ?? new Prisma.Decimal(0);
    const d = debits._sum.amount ?? new Prisma.Decimal(0);
    return c.minus(d);
  }

  findUserWallet(userId: string, currency: string) {
    return this.prisma.wallet.findUnique({
      where: { userId_currency: { userId, currency } },
    });
  }

  async fund(userId: string, dto: FundWalletDto) {
    const primary = await this.primaryWallet(userId);
    const currency = (dto.currency ?? primary.currency).toUpperCase();
    const wallet = await this.findUserWallet(userId, currency);
    if (!wallet) {
      throw new BadRequestException(`No ${currency} wallet`);
    }

    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    const amount = new Prisma.Decimal(dto.amount);
    const txGroupId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      // Lock the wallet so two concurrent funds can't both pass the daily
      // limit check and over-fund the account.
      await tx.$queryRaw`SELECT id FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;

      const existing = await tx.ledgerEntry.findFirst({
        where: {
          walletId: wallet.id,
          type: 'wallet_fund',
          description: `idempotency:${idempotencyKey}`,
        },
      });
      if (existing) {
        throw new ConflictException('Funding already processed');
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sum = await tx.ledgerEntry.aggregate({
        where: { walletId: wallet.id, type: 'wallet_fund', createdAt: { gte: since } },
        _sum: { amount: true },
      });
      const used = sum._sum.amount ?? new Prisma.Decimal(0);
      if (used.plus(amount).gt(FUND_LIMIT_PER_DAY)) {
        throw new BadRequestException(
          `Daily funding limit ${FUND_LIMIT_PER_DAY.toString()} exceeded`,
        );
      }

      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          txGroupId,
          direction: 'credit',
          type: 'wallet_fund',
          amount,
          currency,
          description: `idempotency:${idempotencyKey}`,
        },
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
      where: { walletId: wallet.id },
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

  private async primaryWallet(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }
}
