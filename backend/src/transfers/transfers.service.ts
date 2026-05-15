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
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersGateway } from './transfers.gateway';

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
    private readonly corridors: CorridorsService,
    private readonly compliance: ComplianceService,
    private readonly gateway: TransfersGateway,
    private readonly config: ConfigService,
  ) {}

  async list(userId: string) {
    const transfers = await this.prisma.transfer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { recipient: { select: { name: true, country: true } } },
    });
    return transfers.map(serialiseSummary);
  }

  async get(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        recipient: { select: { name: true, country: true, bankAccount: true } },
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

    await this.assertDailyVelocity(userId, sendCurrency, sendAmount);

    const wallet = await this.wallets.findUserWallet(userId, sendCurrency);
    if (!wallet) {
      throw new BadRequestException(`No ${sendCurrency} wallet`);
    }

    const totalDebit = sendAmount.plus(quote.fee);
    const balance = await this.wallets.computeBalance(wallet.id);
    if (balance.lt(totalDebit)) {
      throw new BadRequestException('Insufficient balance');
    }

    const idempotencyKey = dto.idempotencyKey ?? randomUUID();

    const existing = await this.prisma.transfer.findUnique({
      where: { idempotencyKey },
      include: {
        recipient: { select: { name: true, country: true, bankAccount: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConflictException('Idempotency key already used');
      }
      return serialiseDetail(existing);
    }

    const txGroupId = randomUUID();

    const transfer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          userId,
          recipientId: recipient.id,
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
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transferId: created.id,
          txGroupId,
          direction: 'debit',
          type: 'transfer_hold',
          amount: sendAmount,
          currency: sendCurrency,
          description: `Hold for transfer ${created.id}`,
        },
      });
      if (quote.fee.gt(0)) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            transferId: created.id,
            txGroupId,
            direction: 'debit',
            type: 'fee',
            amount: quote.fee,
            currency: sendCurrency,
            description: `Fee for transfer ${created.id}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transfer.create',
          entityType: 'transfer',
          entityId: created.id,
          metadata: {
            sendAmount: sendAmount.toString(),
            sendCurrency,
            receiveCurrency,
            recipientId: recipient.id,
          },
        },
      });
      return created;
    });

    this.gateway.emitStatus(userId, transfer.id, 'initiated');
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

  async findDueForTick(olderThanMs: number) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return this.prisma.transfer.findMany({
      where: { status: { in: NON_TERMINAL }, updatedAt: { lt: cutoff } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
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

    const updated = await this.prisma.transfer.updateMany({
      where: { id: transfer.id, status: transfer.status },
      data: {
        status: next,
        providerRef:
          next === 'fx_converted'
            ? `mock-${randomUUID()}`
            : transfer.providerRef,
      },
    });
    if (updated.count === 0) return;

    await this.prisma.transferEvent.create({
      data: {
        transferId: transfer.id,
        status: next,
        message: messageFor(next),
      },
    });
    this.gateway.emitStatus(transfer.userId, transfer.id, next);
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
    const txGroupId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.transfer.updateMany({
        where: { id: transferId, status: fromStatus },
        data: { status: toStatus, failureReason: reason },
      });
      if (updated.count === 0) return;

      await tx.transferEvent.create({
        data: { transferId, status: toStatus, message },
      });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transferId,
          txGroupId,
          direction: 'credit',
          type: 'transfer_refund',
          amount: transfer.sendAmount,
          currency: transfer.sendCurrency,
          description: `Refund ${toStatus} transfer ${transferId}`,
        },
      });
      if (new Prisma.Decimal(transfer.feeAmount).gt(0)) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            transferId,
            txGroupId,
            direction: 'credit',
            type: 'transfer_refund',
            amount: transfer.feeAmount,
            currency: transfer.sendCurrency,
            description: `Refund fee for ${toStatus} transfer ${transferId}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: transfer.userId,
          action: `transfer.${toStatus}`,
          entityType: 'transfer',
          entityId: transferId,
          metadata: { reason },
        },
      });
    });
    this.gateway.emitStatus(transfer.userId, transferId, toStatus);
    this.logger.log(
      `transfer ${transferId}: ${fromStatus} -> ${toStatus} (${reason})`,
    );
  }

  private async assertDailyVelocity(
    userId: string,
    currency: string,
    amount: Prisma.Decimal,
  ) {
    const limit = new Prisma.Decimal(
      this.config.get<number>('TRANSFER_DAILY_LIMIT') ?? 10000,
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agg = await this.prisma.transfer.aggregate({
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

type TransferSummary = Prisma.TransferGetPayload<{
  include: { recipient: { select: { name: true; country: true } } };
}>;

type TransferDetail = Prisma.TransferGetPayload<{
  include: {
    recipient: { select: { name: true; country: true; bankAccount: true } };
    timeline: true;
  };
}>;

function serialiseSummary(t: TransferSummary) {
  return {
    id: t.id,
    amount: t.sendAmount.toString(),
    sendCurrency: t.sendCurrency,
    receiveAmount: t.receiveAmount?.toString() ?? null,
    receiveCurrency: t.receiveCurrency,
    status: t.status,
    createdAt: t.createdAt,
    recipient: t.recipient,
  };
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
    recipient: t.recipient,
    timeline: t.timeline.map((e) => ({
      id: e.id,
      status: e.status,
      message: e.message ?? '',
      createdAt: e.createdAt,
    })),
  };
}
