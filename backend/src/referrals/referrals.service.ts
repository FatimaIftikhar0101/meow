import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { writeAudit } from '../common/audit/audit';
import { NotificationsService } from '../notifications/notifications.service';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const MAX_CODE_RETRIES = 5;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);
  private readonly rewardAmount: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly ledger: LedgerService,
  ) {
    this.rewardAmount = this.config.get<number>('REFERRAL_REWARD_AMOUNT') ?? 15;
  }

  async getOrCreateCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });
    if (user?.referralCode) return user.referralCode;

    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      const code = this.generateCode();
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
        });
        return code;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate unique referral code');
  }

  async getDashboard(userId: string) {
    const code = await this.getOrCreateCode(userId);
    const referrals = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referee: { select: { email: true, createdAt: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const stats = {
      invited: referrals.length,
      rewarded: referrals.filter((r) => r.status === 'rewarded').length,
      pending: referrals.filter((r) => r.status === 'pending').length,
      totalEarned: referrals
        .filter((r) => r.rewardAmount)
        .reduce((sum, r) => sum.plus(r.rewardAmount!), new Prisma.Decimal(0))
        .toString(),
      currency: 'CAD',
    };

    return {
      code,
      stats,
      referrals: referrals.map((r) => ({
        id: r.id,
        maskedEmail: this.maskEmail(r.referee.email),
        status: r.status,
        createdAt: r.createdAt,
        rewardedAt: r.rewardedAt,
      })),
    };
  }

  async checkCode(code: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { referralCode: code.toUpperCase().trim() },
      select: { id: true },
    });
    return !!user;
  }

  async attachReferral(refereeId: string, code: string) {
    const trimmed = code.toUpperCase().trim();
    const referrer = await this.prisma.user.findFirst({
      where: { referralCode: trimmed },
      select: { id: true },
    });
    if (!referrer) return;
    if (referrer.id === refereeId) return;

    const existing = await this.prisma.referral.findUnique({
      where: { refereeId },
    });
    if (existing) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId,
            code: trimmed,
          },
        });
        await writeAudit(tx, {
          actor: { id: refereeId },
          action: 'referral.signup',
          entityType: 'referral',
          after: { referrerId: referrer.id, code: trimmed },
        });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      throw err;
    }
  }

  async onTransferDelivered(refereeId: string, transferId: string) {
    const rewardAmount = new Prisma.Decimal(this.rewardAmount);

    // The bonus is paid into the referrer's own wallet, so the expense leg has
    // to be in that wallet's currency: a posting that mixes currencies cannot
    // balance and the database rejects it. Read here rather than inside the
    // transaction because resolving an account can create one, and creating a
    // shared row while holding a wallet lock is how deadlocks are made.
    //
    // Re-read inside the transaction for the actual posting; this is only to
    // learn which currency account to prepare.
    const referrerWallet = await this.prisma.referral.findUnique({
      where: { refereeId },
      select: {
        referrer: {
          select: {
            ledgerAccounts: {
              where: { kind: 'customer_wallet' },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { currency: true },
            },
          },
        },
      },
    });
    const rewardCurrency = referrerWallet?.referrer.ledgerAccounts[0]?.currency;
    if (!rewardCurrency) return;
    const marketingAccount = await this.ledger.systemAccountId(
      'marketing_expense',
      rewardCurrency,
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.referral.updateMany({
        where: { refereeId, status: 'pending' },
        data: {
          status: 'rewarded',
          rewardedAt: new Date(),
          qualifyingTransferId: transferId,
          rewardAmount,
          rewardCurrency,
        },
      });
      if (updated.count !== 1) return;

      const referral = await tx.referral.findUnique({
        where: { refereeId },
        include: { referrer: { select: { id: true, suspended: true } } },
      });
      if (!referral) return;
      if (referral.referrer.suspended) return;

      const wallet = await tx.ledgerAccount.findFirst({
        where: {
          kind: 'customer_wallet',
          ownerId: referral.referrerId,
          // Pinned to the currency whose expense account was prepared above.
          // Without this, a referrer who gained a second wallet between the
          // two reads could be paid into one currency and expensed in another.
          currency: rewardCurrency,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!wallet) return;

      await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${wallet.id} FOR UPDATE`;

      // A bonus is money the business spends to acquire a customer. Crediting
      // the wallet alone made it appear from nowhere; the debit is what makes
      // the cost of the referral programme a number somebody can look up.
      //
      // Keyed on the referral, not on a random id, so the unique constraint on
      // the posting key is a second guard against paying the same bonus twice.
      await this.ledger.post(tx, {
        key: `referral:${referral.id}:bonus`,
        currency: wallet.currency,
        legs: [
          {
            accountId: wallet.id,
            direction: 'credit',
            type: 'referral_bonus',
            amount: rewardAmount,
            description: `referral:${referral.id}`,
          },
          {
            accountId: marketingAccount,
            direction: 'debit',
            type: 'referral_bonus',
            amount: rewardAmount,
            description: `Referral bonus for ${referral.id}`,
          },
        ],
      });
      // A bonus credit hits the ledger, so this entry is the justification for
      // real money appearing in someone's wallet.
      await writeAudit(tx, {
        actor: { id: referral.referrerId },
        action: 'referral.rewarded',
        entityType: 'referral',
        entityId: referral.id,
        after: {
          amount: rewardAmount.toString(),
          currency: wallet.currency,
        },
        metadata: { refereeId, transferId },
      });
    });

    const referral = await this.prisma.referral.findUnique({
      where: { refereeId },
    });
    if (referral && referral.status === 'rewarded') {
      this.notifications
        .create(
          referral.referrerId,
          'system',
          `You earned $${this.rewardAmount}!`,
          "Your friend's first transfer just landed. The reward has been added to your wallet.",
          { referralId: referral.id },
        )
        .catch(() => {});
    }
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const masked =
      local.length <= 2
        ? '*'.repeat(local.length)
        : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${masked}@${domain}`;
  }
}
