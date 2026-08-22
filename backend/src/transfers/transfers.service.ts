import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransferStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ComplianceService } from '../compliance/compliance.service';
import { CorridorsService } from '../corridors/corridors.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersGateway } from './transfers.gateway';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeAudit, writeStaffAudit } from '../common/audit/audit';
import { decryptField } from '../common/crypto/field-crypto';

const CANCELLABLE: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
];

export const NON_TERMINAL: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
];

export const NEXT_STATUS: Record<TransferStatus, TransferStatus | null> = {
  initiated: 'payment_received',
  payment_received: 'compliance_check',
  compliance_check: 'fx_converted',
  fx_converted: 'payout_processing',
  payout_processing: 'delivered',
  delivered: null,
  failed: null,
  cancelled: null,
};

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly ledger: LedgerService,
    private readonly corridors: CorridorsService,
    private readonly compliance: ComplianceService,
    private readonly gateway: TransfersGateway,
    private readonly notifications: NotificationsService,
    private readonly referrals: ReferralsService,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string, limit = 50) {
    // Capped to bound the worst-case row scan. The dashboard only renders the
    // recent slice; full history lives behind /wallet/transactions.
    const take = Math.min(Math.max(limit, 1), 100);
    const transfers = await this.prisma.transfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return transfers.map(serialiseSummary);
  }

  async get(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!transfer || transfer.userId !== userId) {
      throw new NotFoundException('Transfer not found');
    }
    return serialiseDetail(transfer);
  }

  async create(userId: string, dto: CreateTransferDto) {
    const sendCurrency = dto.sendCurrency.toUpperCase();
    const receiveCurrency = dto.receiveCurrency.toUpperCase();

    const recipient = await this.prisma.recipient.findUnique({
      where: { id: dto.recipientId },
    });
    if (!recipient || !recipient.active || recipient.userId !== userId) {
      throw new NotFoundException('Recipient not found');
    }

    if (!(await this.compliance.requirePassed(userId))) {
      throw new ForbiddenException(
        'Complete identity verification before sending money',
      );
    }

    const corridor = await this.corridors.findActive(
      sendCurrency,
      receiveCurrency,
    );
    if (recipient.country.toUpperCase() !== corridor.toCountry.toUpperCase()) {
      throw new BadRequestException(
        `Recipient country ${recipient.country} does not match corridor target ${corridor.toCountry}`,
      );
    }

    const sendAmount = new Prisma.Decimal(dto.sendAmount);
    const quote = this.corridors.computeQuote(corridor, sendAmount);

    const wallet = await this.wallets.findUserWallet(userId, sendCurrency);
    if (!wallet) {
      throw new BadRequestException(`No ${sendCurrency} wallet`);
    }

    const idempotencyKey = dto.idempotencyKey ?? randomUUID();
    const existing = await this.prisma.transfer.findUnique({
      where: { idempotencyKey },
      include: { timeline: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Idempotency key already used');
      }
      return serialiseDetail(existing);
    }

    const totalDebit = sendAmount.plus(quote.fee);

    // Resolved before the transaction opens: creating an account inside a
    // transaction that already holds a wallet lock is a deadlock waiting for
    // two customers to send at the same moment.
    const [suspenseAccount, feeAccount] = await Promise.all([
      this.ledger.systemAccountId('transfer_suspense', sendCurrency),
      this.ledger.systemAccountId('fee_revenue', sendCurrency),
    ]);

    const transfer = await this.prisma.$transaction(async (tx) => {
      // Hold a row lock on the wallet for the duration of this transaction.
      // Concurrent transfer creates against the same wallet serialise here,
      // closing the read-then-debit overdraft window.
      await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE id = ${wallet.id} FOR UPDATE`;

      const balance = await this.computeBalanceLocked(tx, wallet.id);
      if (balance.lt(totalDebit)) {
        throw new BadRequestException('Insufficient balance');
      }
      await this.assertDailyVelocityLocked(tx, userId, sendCurrency, sendAmount);

      const created = await tx.transfer.create({
        data: {
          userId,
          recipientId: recipient.id,
          // The beneficiary as it stands right now. Copied rather than joined,
          // because the recipient row can change and this record must not.
          //
          // bankAccount arrives already encrypted from the recipient row and is
          // stored that way — the snapshot must not be the one plaintext copy
          // of a number encrypted everywhere else.
          recipientName: recipient.name,
          recipientCountry: recipient.country,
          recipientBankAccount: recipient.bankAccount,
          recipientBankName: recipient.bankName,
          recipientBankCode: recipient.bankCode,
          sendAmount,
          sendCurrency,
          receiveAmount: quote.receiveAmount,
          receiveCurrency,
          fxRateApplied: quote.rate,
          feeAmount: quote.fee,
          status: 'initiated',
          idempotencyKey,
          providerName: 'mock',
        },
      });
      await tx.transferEvent.create({
        data: {
          transferId: created.id,
          status: 'initiated',
          message: 'Transfer initiated',
        },
      });
      // The hold: the customer's money stops being theirs and becomes money in
      // flight. Previously the debit was written alone, so the amount left the
      // wallet and was represented in no account at all.
      await this.ledger.post(tx, {
        key: `transfer:${created.id}:hold`,
        currency: sendCurrency,
        transferId: created.id,
        legs: [
          {
            accountId: wallet.id,
            direction: 'debit',
            type: 'transfer_hold',
            amount: sendAmount,
            description: `Hold for transfer ${created.id}`,
          },
          {
            accountId: suspenseAccount,
            direction: 'credit',
            type: 'transfer_hold',
            amount: sendAmount,
            description: `In flight: transfer ${created.id}`,
          },
        ],
      });

      // The fee is revenue, and until now it was revenue the business kept no
      // record of earning — taken from the wallet and credited nowhere.
      if (quote.fee.gt(0)) {
        await this.ledger.post(tx, {
          key: `transfer:${created.id}:fee`,
          currency: sendCurrency,
          transferId: created.id,
          legs: [
            {
              accountId: wallet.id,
              direction: 'debit',
              type: 'fee',
              amount: quote.fee,
              description: `Fee for transfer ${created.id}`,
            },
            {
              accountId: feeAccount,
              direction: 'credit',
              type: 'fee',
              amount: quote.fee,
              description: `Fee earned on transfer ${created.id}`,
            },
          ],
        });
      }
      // A creation has no prior state, so no `before`. The beneficiary is
      // recorded on the transfer itself; only the identifier goes here, never
      // the account number.
      await writeAudit(tx, {
        actor: { id: userId },
        action: 'transfer.create',
        entityType: 'transfer',
        entityId: created.id,
        after: {
          sendAmount: sendAmount.toString(),
          sendCurrency,
          receiveAmount: quote.receiveAmount.toString(),
          receiveCurrency,
          feeAmount: quote.fee.toString(),
          fxRateApplied: quote.rate.toString(),
          recipientId: recipient.id,
        },
      });
      return created;
    });

    this.gateway.emitStatus(userId, transfer.id, 'initiated');
    this.notifications.create(
      userId, 'transfer_status',
      'Transfer initiated',
      `Your ${sendCurrency} ${sendAmount} transfer to ${recipient.name} has been initiated.`,
      { transferId: transfer.id, status: 'initiated' },
    ).catch(() => {});
    return this.get(userId, transfer.id);
  }

  async cancel(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer || transfer.userId !== userId) {
      throw new NotFoundException('Transfer not found');
    }
    if (!CANCELLABLE.includes(transfer.status)) {
      throw new ForbiddenException(
        `Cannot cancel transfer in status ${transfer.status}`,
      );
    }
    await this.transitionWithRefund(
      transfer.id,
      transfer.status,
      'cancelled',
      'cancelled_by_user',
      'Cancelled by user',
    );
    return this.get(userId, id);
  }

  async adminForceFail(actor: AuthUser, transferId: string, reason: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    if (transfer.status === 'delivered' || transfer.status === 'failed' || transfer.status === 'cancelled') {
      throw new ForbiddenException(
        `Cannot force-fail transfer in status ${transfer.status}`,
      );
    }
    await this.transitionWithRefund(
      transfer.id,
      transfer.status,
      'failed',
      reason,
      `Force-failed by admin: ${reason}`,
    );
    await writeAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.transfer.force_fail',
      entityType: 'transfer',
      entityId: transferId,
      before: { status: transfer.status },
      after: { status: 'failed' },
      reason,
      metadata: { targetUserId: transfer.userId },
    });
    return this.get(transfer.userId, transferId);
  }

  /**
   * Push a stuck transfer along by hand.
   *
   * Until now the only write operations staff had on a transfer were force-fail
   * and nothing. That made "the payout is stuck" and "the payout is dead" the
   * same event from the customer's point of view: their money comes back and
   * they start again, having achieved nothing but a delay. Retry is the
   * remedy that was missing between the two.
   *
   * What it does is re-run the transition the scheduler would have run, now,
   * without waiting for the tick. Against the mock provider that is nearly
   * free; against a real payout partner it is a re-issued instruction, which is
   * why it is audited and why it takes a reason.
   *
   * **Non-terminal only, deliberately.** A `failed` transfer has already been
   * refunded — its money is back in the sender's wallet. Driving it forward
   * again would pay out funds that were credited back, so a second attempt at a
   * failed transfer is a *new* transfer, not a retry of this one. Allowing it
   * here would be a double-spend wearing a helpful label.
   *
   * The race with the scheduler is already handled: `advance` transitions with
   * a compare-and-set on the current status, so whichever of the two arrives
   * second finds the status changed and does nothing.
   */
  async adminRetry(actor: AuthUser, transferId: string, reason: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }
    if (!NON_TERMINAL.includes(transfer.status)) {
      throw new ForbiddenException(
        `Cannot retry a transfer in status ${transfer.status}. ` +
          'A refunded transfer has to be sent again, not retried.',
      );
    }

    // Recorded before the attempt, not after, and against the status it was
    // stuck in. If the retry then fails, the timeline still shows that somebody
    // intervened here — the useful half of the record is the attempt, not the
    // outcome.
    await this.prisma.transferEvent.create({
      data: {
        transferId,
        status: transfer.status,
        message: `Retried by ${actor.email}: ${reason}`,
        metadata: { retriedBy: actor.id, reason },
      },
    });
    // The audit entry is written in a `finally` so it survives the attempt
    // failing. A compliance review asks what staff did, not what worked; an
    // audit log that only records successful interventions is the one shape a
    // reviewer would find least useful.
    let resulting: TransferStatus = transfer.status;
    try {
      await this.advance(transferId);
      const after = await this.prisma.transfer.findUnique({
        where: { id: transferId },
        select: { status: true },
      });
      resulting = after?.status ?? transfer.status;
    } finally {
      await writeStaffAudit(this.prisma, {
        actor: { id: actor.id, email: actor.email },
        action: 'admin.transfer.retry',
        entityType: 'transfer',
        entityId: transferId,
        before: { status: transfer.status },
        after: { status: resulting },
        reason,
        metadata: { targetUserId: transfer.userId },
      });
    }

    this.logger.log(
      `transfer ${transferId}: retried by ${actor.email} (${transfer.status} -> ${resulting})`,
    );
    return this.get(transfer.userId, transferId);
  }

  /**
   * Transfers whose next transition is due.
   *
   * Oldest first, so a backlog drains in the order it built up rather than
   * starving whatever fell behind first. `take` is the scheduler's batch size
   * — it was hardcoded at 50, which capped the whole product at roughly two
   * transfers per second with nothing reporting the limit.
   *
   * Only the id is needed: `advance` re-reads the row anyway, and selecting
   * whole transfers to throw them away is bytes off the wire for nothing.
   */
  async findDueForTick(olderThanMs: number, take = 200) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return this.prisma.transfer.findMany({
      where: { status: { in: NON_TERMINAL }, updatedAt: { lt: cutoff } },
      orderBy: { updatedAt: 'asc' },
      take,
      select: { id: true },
    });
  }

  async advance(transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) return;
    const next = NEXT_STATUS[transfer.status];
    if (!next) return;

    if (transfer.status === 'payment_received' || transfer.status === 'fx_converted') {
      const passed = await this.compliance.requirePassed(transfer.userId);
      if (!passed) {
        await this.transitionWithRefund(
          transfer.id,
          transfer.status,
          'failed',
          'kyc_required',
          'KYC verification not on file',
        );
        return;
      }
    }

    // Delivery is where money in flight stops being in flight. Resolved before
    // the transaction for the usual reason: no account creation inside one.
    const settlement =
      next === 'delivered'
        ? await Promise.all([
            this.ledger.systemAccountId(
              'transfer_suspense',
              transfer.sendCurrency,
            ),
            this.ledger.systemAccountId(
              'payout_settlement',
              transfer.sendCurrency,
            ),
          ])
        : null;

    // The status change, its timeline entry and any posting now commit
    // together. They used to be three separate writes, so a crash between them
    // left a transfer whose status no event explained.
    const applied = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transfer.updateMany({
        where: { id: transfer.id, status: transfer.status },
        data: {
          status: next,
          providerRef:
            next === 'fx_converted'
              ? `mock-${randomUUID()}`
              : transfer.providerRef,
        },
      });
      // The compare-and-set that makes concurrent advances safe: whoever
      // arrives second finds the status already moved and does nothing.
      if (updated.count === 0) return false;

      await tx.transferEvent.create({
        data: {
          transferId: transfer.id,
          status: next,
          message: messageFor(next),
        },
      });

      if (settlement) {
        const [suspenseAccount, settlementAccount] = settlement;
        // Without this posting, suspense only ever grows: every transfer ever
        // sent would still be sitting in it, and "money in flight" would be a
        // running total of the product's whole history.
        await this.ledger.post(tx, {
          key: `transfer:${transfer.id}:settle`,
          currency: transfer.sendCurrency,
          transferId: transfer.id,
          legs: [
            {
              accountId: suspenseAccount,
              direction: 'debit',
              type: 'transfer_release',
              amount: transfer.sendAmount,
              description: `Delivered: transfer ${transfer.id}`,
            },
            {
              accountId: settlementAccount,
              direction: 'credit',
              type: 'transfer_release',
              amount: transfer.sendAmount,
              description: `Paid out for transfer ${transfer.id}`,
            },
          ],
        });
      }
      return true;
    });
    if (!applied) return;

    this.gateway.emitStatus(transfer.userId, transfer.id, next);
    this.notifications.create(
      transfer.userId, 'transfer_status',
      notificationTitle(next),
      `${messageFor(next)} — transfer ${transfer.id.slice(0, 8)}`,
      { transferId: transfer.id, status: next },
    ).catch(() => {});
    if (next === 'delivered') {
      this.referrals
        .onTransferDelivered(transfer.userId, transfer.id)
        .catch((err) => this.logger.error(`Referral reward failed: ${err.message}`));
    }
    this.logger.log(`transfer ${transfer.id}: ${transfer.status} -> ${next}`);
  }

  private async transitionWithRefund(
    transferId: string,
    fromStatus: TransferStatus,
    toStatus: 'failed' | 'cancelled',
    reason: string,
    message: string,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
    });
    if (!transfer) return;

    const wallet = await this.wallets.findUserWallet(
      transfer.userId,
      transfer.sendCurrency,
    );
    if (!wallet) {
      this.logger.error(`No wallet found for refund of transfer ${transferId}`);
      return;
    }

    const [suspenseAccount, feeAccount] = await Promise.all([
      this.ledger.systemAccountId('transfer_suspense', transfer.sendCurrency),
      this.ledger.systemAccountId('fee_revenue', transfer.sendCurrency),
    ]);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transfer.updateMany({
        where: { id: transferId, status: fromStatus },
        data: { status: toStatus, failureReason: reason },
      });
      if (updated.count === 0) return;

      await tx.transferEvent.create({
        data: { transferId, status: toStatus, message },
      });
      // Money in flight comes back out of flight. The mirror of the hold, and
      // the reason suspense trends to zero rather than accumulating forever.
      await this.ledger.post(tx, {
        key: `transfer:${transferId}:refund`,
        currency: transfer.sendCurrency,
        transferId,
        legs: [
          {
            accountId: suspenseAccount,
            direction: 'debit',
            type: 'transfer_refund',
            amount: transfer.sendAmount,
            description: `Released: ${toStatus} transfer ${transferId}`,
          },
          {
            accountId: wallet.id,
            direction: 'credit',
            type: 'transfer_refund',
            amount: transfer.sendAmount,
            description: `Refund ${toStatus} transfer ${transferId}`,
          },
        ],
      });

      // A fee on a transfer that never happened is not revenue. Giving it back
      // has to reduce the revenue account, not appear from nowhere.
      if (new Prisma.Decimal(transfer.feeAmount).gt(0)) {
        await this.ledger.post(tx, {
          key: `transfer:${transferId}:fee-refund`,
          currency: transfer.sendCurrency,
          transferId,
          legs: [
            {
              accountId: feeAccount,
              direction: 'debit',
              type: 'transfer_refund',
              amount: transfer.feeAmount,
              description: `Fee reversed: ${toStatus} transfer ${transferId}`,
            },
            {
              accountId: wallet.id,
              direction: 'credit',
              type: 'transfer_refund',
              amount: transfer.feeAmount,
              description: `Refund fee for ${toStatus} transfer ${transferId}`,
            },
          ],
        });
      }
      // A refunding transition moves real money back into a wallet, so the
      // status it came from is part of the justification for the credit.
      await writeAudit(tx, {
        actor: { id: transfer.userId },
        action: `transfer.${toStatus}`,
        entityType: 'transfer',
        entityId: transferId,
        before: { status: fromStatus },
        after: { status: toStatus },
        reason,
      });
    });
    this.gateway.emitStatus(transfer.userId, transferId, toStatus);
    this.notifications.create(
      transfer.userId, 'transfer_status',
      notificationTitle(toStatus),
      `${message} — transfer ${transferId.slice(0, 8)}`,
      { transferId, status: toStatus },
    ).catch(() => {});
    this.logger.log(
      `transfer ${transferId}: ${fromStatus} -> ${toStatus} (${reason})`,
    );
  }

  private async computeBalanceLocked(
    tx: Prisma.TransactionClient,
    walletId: string,
  ): Promise<Prisma.Decimal> {
    const [credits, debits] = await Promise.all([
      tx.ledgerEntry.aggregate({
        where: { accountId: walletId, direction: 'credit' },
        _sum: { amount: true },
      }),
      tx.ledgerEntry.aggregate({
        where: { accountId: walletId, direction: 'debit' },
        _sum: { amount: true },
      }),
    ]);
    const c = credits._sum.amount ?? new Prisma.Decimal(0);
    const d = debits._sum.amount ?? new Prisma.Decimal(0);
    return c.minus(d);
  }

  private async assertDailyVelocityLocked(
    tx: Prisma.TransactionClient,
    userId: string,
    currency: string,
    amount: Prisma.Decimal,
  ) {
    const limit = new Prisma.Decimal(
      this.config.get<number>('TRANSFER_DAILY_LIMIT') ?? 10000,
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agg = await tx.transfer.aggregate({
      where: {
        userId,
        sendCurrency: currency,
        createdAt: { gte: since },
        status: { notIn: ['failed', 'cancelled'] },
      },
      _sum: { sendAmount: true },
    });
    const used = agg._sum.sendAmount ?? new Prisma.Decimal(0);
    if (used.plus(amount).gt(limit)) {
      throw new ForbiddenException(
        `Daily send limit ${limit.toString()} ${currency} exceeded`,
      );
    }
  }
}

function messageFor(status: TransferStatus): string {
  switch (status) {
    case 'payment_received':
      return 'Payment received';
    case 'compliance_check':
      return 'Compliance check passed';
    case 'fx_converted':
      return 'Currency converted at applied rate';
    case 'payout_processing':
      return 'Payout submitted to local payout partner';
    case 'delivered':
      return 'Funds delivered to recipient bank';
    case 'failed':
      return 'Transfer failed';
    case 'cancelled':
      return 'Transfer cancelled';
    default:
      return status;
  }
}

type TransferSummary = Prisma.TransferGetPayload<object>;

type TransferDetail = Prisma.TransferGetPayload<{
  include: { timeline: true };
}>;

/**
 * The beneficiary, read from the transfer's own snapshot rather than from the
 * live recipient row.
 *
 * The response shape is unchanged, so clients keep working — but the values now
 * describe what the transfer actually did rather than what the recipient
 * happens to look like today.
 */
function beneficiaryOf(t: {
  recipientName: string;
  recipientCountry: string;
}): { name: string; country: string } {
  return { name: t.recipientName, country: t.recipientCountry };
}

function serialiseSummary(t: TransferSummary) {
  return {
    id: t.id,
    amount: t.sendAmount.toString(),
    sendCurrency: t.sendCurrency,
    receiveAmount: t.receiveAmount?.toString() ?? null,
    receiveCurrency: t.receiveCurrency,
    status: t.status,
    createdAt: t.createdAt,
    recipient: beneficiaryOf(t),
  };
}

function notificationTitle(status: TransferStatus): string {
  switch (status) {
    case 'delivered': return 'Transfer delivered';
    case 'failed': return 'Transfer failed';
    case 'cancelled': return 'Transfer cancelled';
    default: return 'Transfer update';
  }
}

function serialiseDetail(t: TransferDetail) {
  return {
    id: t.id,
    amount: t.sendAmount.toString(),
    sendCurrency: t.sendCurrency,
    receiveAmount: t.receiveAmount?.toString() ?? null,
    receiveCurrency: t.receiveCurrency,
    fxRateApplied: t.fxRateApplied?.toString() ?? null,
    feeAmount: t.feeAmount.toString(),
    status: t.status,
    failureReason: t.failureReason,
    createdAt: t.createdAt,
    recipient: {
      ...beneficiaryOf(t),
      // The customer's own transfer: they chose this beneficiary and the
      // receipt has to show where their money went.
      bankAccount: decryptField(t.recipientBankAccount),
      bankName: t.recipientBankName,
      bankCode: t.recipientBankCode,
    },
    timeline: t.timeline.map((e) => ({
      id: e.id,
      status: e.status,
      message: e.message ?? '',
      createdAt: e.createdAt,
    })),
  };
}
