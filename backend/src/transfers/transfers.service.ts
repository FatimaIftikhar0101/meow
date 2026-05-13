import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
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

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
    private readonly gateway: TransfersGateway,
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
    if (!recipient || recipient.userId !== userId) {
      throw new NotFoundException('Recipient not found');
    }

    const corridor = await this.prisma.corridor.findUnique({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: sendCurrency,
          toCurrency: receiveCurrency,
        },
      },
    });
    if (!corridor || !corridor.active) {
      throw new BadRequestException(
        `Corridor ${sendCurrency}->${receiveCurrency} not supported`,
      );
    }

    const sendAmount = new Prisma.Decimal(dto.sendAmount);
    if (
      sendAmount.lt(corridor.minSendAmount) ||
      sendAmount.gt(corridor.maxSendAmount)
    ) {
      throw new BadRequestException(
        `Amount must be between ${corridor.minSendAmount.toString()} and ${corridor.maxSendAmount.toString()} ${sendCurrency}`,
      );
    }

    const wallet = await this.wallets.findUserWallet(userId, sendCurrency);
    if (!wallet) {
      throw new BadRequestException(`No ${sendCurrency} wallet`);
    }

    const fee = new Prisma.Decimal(corridor.feeFlat).plus(
      sendAmount.times(corridor.feePercentBps).div(10000),
    );
    const totalDebit = sendAmount.plus(fee);
    const balance = await this.wallets.computeBalance(wallet.id);
    if (balance.lt(totalDebit)) {
      throw new BadRequestException('Insufficient balance');
    }

    // Apply our spread to the provider's base rate.
    const appliedRate = new Prisma.Decimal(corridor.baseRate).times(
      new Prisma.Decimal(10000 - corridor.marginBps).div(10000),
    );
    const receiveAmount = sendAmount.times(appliedRate);

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
          receiveAmount,
          receiveCurrency,
          fxRateApplied: appliedRate,
          feeAmount: fee,
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
      if (fee.gt(0)) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            transferId: created.id,
            txGroupId,
            direction: 'debit',
            type: 'fee',
            amount: fee,
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

    const wallet = await this.wallets.findUserWallet(
      userId,
      transfer.sendCurrency,
    );
    if (!wallet) {
      throw new BadRequestException(`No ${transfer.sendCurrency} wallet`);
    }
    const txGroupId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.transfer.update({
        where: { id },
        data: { status: 'cancelled', failureReason: 'cancelled_by_user' },
      });
      await tx.transferEvent.create({
        data: {
          transferId: id,
          status: 'cancelled',
          message: 'Cancelled by user',
        },
      });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transferId: id,
          txGroupId,
          direction: 'credit',
          type: 'transfer_refund',
          amount: transfer.sendAmount,
          currency: transfer.sendCurrency,
          description: `Refund cancelled transfer ${id}`,
        },
      });
      if (new Prisma.Decimal(transfer.feeAmount).gt(0)) {
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            transferId: id,
            txGroupId,
            direction: 'credit',
            type: 'transfer_refund',
            amount: transfer.feeAmount,
            currency: transfer.sendCurrency,
            description: `Refund fee for cancelled transfer ${id}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId,
          action: 'transfer.cancel',
          entityType: 'transfer',
          entityId: id,
        },
      });
    });

    this.gateway.emitStatus(userId, id, 'cancelled');

    return this.get(userId, id);
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
