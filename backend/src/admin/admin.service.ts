import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransferStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { UpdateCorridorDto } from './dto/update-corridor.dto';

const NON_TERMINAL: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  async stats() {
    const [users, transfers, inFlight, delivered, failed, totalSent] = await Promise.all([
      this.prisma.user.count({ where: { role: 'customer' } }),
      this.prisma.transfer.count(),
      this.prisma.transfer.count({ where: { status: { in: NON_TERMINAL } } }),
      this.prisma.transfer.count({ where: { status: 'delivered' } }),
      this.prisma.transfer.count({ where: { status: 'failed' } }),
      this.prisma.transfer.aggregate({
        where: { status: 'delivered' },
        _sum: { sendAmount: true },
      }),
    ]);
    return {
      users,
      transfers,
      inFlight,
      delivered,
      failed,
      totalDeliveredVolume: (totalSent._sum.sendAmount ?? new Prisma.Decimal(0)).toString(),
    };
  }

  async listUsers(search: string | undefined, page: number, pageSize: number) {
    const where: Prisma.UserWhereInput = search
      ? { email: { contains: search.toLowerCase(), mode: 'insensitive' } }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          country: true,
          role: true,
          suspended: true,
          createdAt: true,
          _count: { select: { transfers: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        country: u.country,
        role: u.role,
        suspended: u.suspended,
        createdAt: u.createdAt,
        transferCount: u._count.transfers,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        country: true,
        role: true,
        suspended: true,
        createdAt: true,
        wallets: { select: { id: true, currency: true } },
        kycRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            provider: true,
            reason: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const balances = await Promise.all(
      user.wallets.map(async (w) => ({
        currency: w.currency,
        balance: (await this.wallets.computeBalance(w.id)).toFixed(2),
      })),
    );
    const transferCount = await this.prisma.transfer.count({ where: { userId: id } });
    return { ...user, balances, transferCount };
  }

  async suspend(targetId: string, suspended: boolean, adminUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'admin') {
      throw new ForbiddenException('Cannot suspend an admin account');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { suspended } });
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: suspended ? 'admin.user.suspend' : 'admin.user.unsuspend',
          entityType: 'user',
          entityId: targetId,
        },
      });
    });
    return { id: targetId, suspended };
  }

  async listTransfers(
    status: TransferStatus | undefined,
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.TransferWhereInput = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          recipient: { select: { name: true, country: true } },
          user: { select: { email: true } },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return {
      items: items.map((t) => ({
        id: t.id,
        userEmail: t.user.email,
        recipient: t.recipient,
        sendAmount: t.sendAmount.toString(),
        sendCurrency: t.sendCurrency,
        receiveAmount: t.receiveAmount?.toString() ?? null,
        receiveCurrency: t.receiveCurrency,
        status: t.status,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getTransfer(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, country: true } },
        recipient: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        ledgerEntries: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return {
      id: transfer.id,
      user: transfer.user,
      recipient: transfer.recipient,
      sendAmount: transfer.sendAmount.toString(),
      sendCurrency: transfer.sendCurrency,
      receiveAmount: transfer.receiveAmount?.toString() ?? null,
      receiveCurrency: transfer.receiveCurrency,
      fxRateApplied: transfer.fxRateApplied?.toString() ?? null,
      feeAmount: transfer.feeAmount.toString(),
      status: transfer.status,
      failureReason: transfer.failureReason,
      providerName: transfer.providerName,
      providerRef: transfer.providerRef,
      createdAt: transfer.createdAt,
      timeline: transfer.timeline.map((e) => ({
        id: e.id,
        status: e.status,
        message: e.message ?? '',
        createdAt: e.createdAt,
      })),
      ledgerEntries: transfer.ledgerEntries.map((e) => ({
        id: e.id,
        direction: e.direction,
        type: e.type,
        amount: e.amount.toString(),
        currency: e.currency,
        createdAt: e.createdAt,
      })),
    };
  }

  async listAudit(
    filters: {
      userId?: string;
      action?: string;
      entityType?: string;
      entityId?: string;
    },
    page: number,
    pageSize: number,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  listCorridors() {
    return this.prisma.corridor.findMany({
      orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });
  }

  async updateCorridor(id: string, dto: UpdateCorridorDto, adminUserId: string) {
    const corridor = await this.prisma.corridor.findUnique({ where: { id } });
    if (!corridor) throw new NotFoundException('Corridor not found');
    const data: Prisma.CorridorUpdateInput = {};
    if (dto.baseRate !== undefined) data.baseRate = new Prisma.Decimal(dto.baseRate);
    if (dto.marginBps !== undefined) data.marginBps = dto.marginBps;
    if (dto.feeFlat !== undefined) data.feeFlat = new Prisma.Decimal(dto.feeFlat);
    if (dto.feePercentBps !== undefined) data.feePercentBps = dto.feePercentBps;
    if (dto.minSendAmount !== undefined) data.minSendAmount = new Prisma.Decimal(dto.minSendAmount);
    if (dto.maxSendAmount !== undefined) data.maxSendAmount = new Prisma.Decimal(dto.maxSendAmount);
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.corridor.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'admin.corridor.update',
          entityType: 'corridor',
          entityId: id,
          metadata: dto as unknown as Prisma.InputJsonValue,
        },
      });
      return u;
    });
    return updated;
  }
}
