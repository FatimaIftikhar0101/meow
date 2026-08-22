import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeStaffAudit } from '../common/audit/audit';
import { isStaff } from '../auth/permissions';
import {
  decryptField,
  maskAccount,
} from '../common/crypto/field-crypto';
import { WalletService } from '../wallet/wallet.service';
import { UpdateCorridorDto } from './dto/update-corridor.dto';
import { ListTransfersDto } from './dto/list-transfers.dto';
import {
  agingCutoffs,
  minutesSince,
  thresholdFor,
  NON_TERMINAL,
} from './aging';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletService,
  ) {}

  async stats() {
    const [users, transfers, inFlight, overdue, delivered, failed, totalSent] =
      await Promise.all([
        this.prisma.user.count({ where: { role: 'customer' } }),
        this.prisma.transfer.count(),
        this.prisma.transfer.count({ where: { status: { in: NON_TERMINAL } } }),
        // In flight counts what is moving; this counts what has stopped moving
        // without finishing. They are different numbers and only one of them
        // is a reason to open the queue.
        this.prisma.transfer.count({
          where: {
            OR: agingCutoffs().map(({ status, before }) => ({
              status,
              updatedAt: { lt: before },
            })),
          },
        }),
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
      overdue,
      delivered,
      failed,
      totalDeliveredVolume: (
        totalSent._sum.sendAmount ?? new Prisma.Decimal(0)
      ).toString(),
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

  async suspend(
    actor: AuthUser,
    targetId: string,
    suspended: boolean,
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('User not found');
    // No staff account, not just no admin. Suspending a colleague is an
    // account-management action for the staff section, and routing it through
    // the customer endpoint would skip whatever controls that section carries.
    if (isStaff(user.role)) {
      throw new ForbiddenException('Cannot suspend a staff account');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: targetId }, data: { suspended } });
      // Cutting off someone's access to their own money is among the most
      // consequential things staff can do here. Prior state and a reason are
      // required by writeStaffAudit's type, so this cannot quietly regress to
      // the bare action name it used to record.
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: suspended ? 'admin.user.suspend' : 'admin.user.unsuspend',
        entityType: 'user',
        entityId: targetId,
        before: { suspended: user.suspended },
        after: { suspended },
        reason,
      });
    });
    return { id: targetId, suspended };
  }

  /**
   * The operations queue.
   *
   * Two things separate this from a list of transfers. It can be filtered to
   * only what is overdue for the status it is in, and it reports an age on
   * every row rather than only a creation timestamp — so the desk sees a
   * problem building before it crosses a threshold, not only after.
   *
   * Sort order follows the filter on purpose. The aging view is oldest first,
   * because the oldest thing is the one costing somebody the most; everything
   * else is newest first, because that is what a list is for.
   */
  async listTransfers(query: ListTransfersDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const now = Date.now();

    // Built as AND-of-ORs rather than one flat object: aging is an OR across
    // (status, cutoff) pairs and search is an OR across three columns, and
    // merging them into a single OR would return anything matching either.
    const and: Prisma.TransferWhereInput[] = [];

    if (query.status) and.push({ status: query.status });

    if (query.aging) {
      and.push({
        OR: agingCutoffs(query.olderThanMins, now).map(
          ({ status, before }) => ({
            status,
            updatedAt: { lt: before },
          }),
        ),
      });
    }

    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [
          { user: { email: { contains: q, mode: 'insensitive' } } },
          // The snapshot, not the live recipient row — searching the relation
          // would find transfers by who the beneficiary is called *today*.
          { recipientName: { contains: q, mode: 'insensitive' } },
          // Ids are uuids and nobody types a whole one. Support quotes the
          // first eight characters, which is what this matches.
          { id: { startsWith: q.toLowerCase() } },
        ],
      });
    }

    const where: Prisma.TransferWhereInput = and.length ? { AND: and } : {};
    const orderBy: Prisma.TransferOrderByWithRelationInput = query.aging
      ? { updatedAt: 'asc' }
      : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);

    return {
      items: items.map((t) => {
        const ageMinutes = minutesSince(t.updatedAt, now);
        const thresholdMinutes = thresholdFor(t.status);
        return {
          id: t.id,
          userId: t.user.id,
          userEmail: t.user.email,
          // Snapshot, not the live recipient row - see Transfer in schema.prisma.
          recipient: { name: t.recipientName, country: t.recipientCountry },
          sendAmount: t.sendAmount.toString(),
          sendCurrency: t.sendCurrency,
          receiveAmount: t.receiveAmount?.toString() ?? null,
          receiveCurrency: t.receiveCurrency,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          /** Minutes since anything last happened to this transfer. */
          ageMinutes,
          /** Null for terminal statuses: a delivered transfer cannot be late. */
          thresholdMinutes,
          overdue:
            thresholdMinutes !== null &&
            ageMinutes >= (query.olderThanMins ?? thresholdMinutes),
        };
      }),
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
        ledgerEntries: {
          orderBy: { createdAt: 'asc' },
          // Which wallet a leg landed in is the whole question. Without it the
          // ledger reads as a list of amounts with no direction of travel.
          include: {
            wallet: { select: { id: true, currency: true, userId: true } },
          },
        },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    const ageMinutes = minutesSince(transfer.updatedAt);
    const thresholdMinutes = thresholdFor(transfer.status);

    /**
     * The ledger, grouped the way it was written.
     *
     * Every entry carries a `txGroupId` identifying the posting it belongs to,
     * so a hold and the fee taken with it read as one movement rather than two
     * unrelated debits three milliseconds apart.
     *
     * A caveat this shape makes visible rather than hides: the schema describes
     * these groups as double-entry pairs, and they are not. Every posting in
     * the codebase writes a single leg against the customer's wallet — there is
     * no float or settlement account for the other side, because no such wallet
     * exists (`Wallet.userId` is required). So each group here sums to a net
     * movement on one wallet, and the money's counterparty is implied rather
     * than recorded. That is a real gap for a money business and it is backlog
     * item #39; presenting the groups honestly is what makes it visible to
     * whoever reads this screen.
     */
    const groups = new Map<string, typeof transfer.ledgerEntries>();
    for (const e of transfer.ledgerEntries) {
      const bucket = groups.get(e.txGroupId);
      if (bucket) bucket.push(e);
      else groups.set(e.txGroupId, [e]);
    }

    let walletNet = new Prisma.Decimal(0);
    const ledger = [...groups.entries()].map(([txGroupId, entries]) => {
      const net = entries.reduce(
        (acc, e) =>
          e.direction === 'credit' ? acc.plus(e.amount) : acc.minus(e.amount),
        new Prisma.Decimal(0),
      );
      walletNet = walletNet.plus(net);
      return {
        txGroupId,
        // Entries in a group are written inside one transaction, so the first
        // one's timestamp is the posting's timestamp.
        createdAt: entries[0].createdAt,
        /** Signed against the wallet: negative is money leaving the customer. */
        net: net.toString(),
        currency: entries[0].currency,
        entries: entries.map((e) => ({
          id: e.id,
          direction: e.direction,
          type: e.type,
          amount: e.amount.toString(),
          currency: e.currency,
          description: e.description,
          createdAt: e.createdAt,
          walletId: e.walletId,
          // Whether this leg touched the sender's own wallet or somebody
          // else's. Always the sender's today; stated rather than assumed, so
          // the day it is not, the screen says so.
          walletOwnerId: e.wallet.userId,
          isSenderWallet: e.wallet.userId === transfer.userId,
        })),
      };
    });

    return {
      id: transfer.id,
      user: transfer.user,
      // What the money was actually sent to, as recorded at the time.
      recipient: {
        name: transfer.recipientName,
        country: transfer.recipientCountry,
        // Staff see the last four, not the number. Full reveal belongs behind
        // an explicit, audited action in the back-office panel — a support
        // agent opening a ticket has no reason to read a whole account number,
        // and "it was on the screen" is how these end up in a chat message.
        bankAccountMasked: maskAccount(decryptField(transfer.recipientBankAccount)),
        bankName: transfer.recipientBankName,
        bankCode: transfer.recipientBankCode,
      },
      // The saved recipient as it stands today. Deliberately exposed alongside
      // the snapshot: if a customer edited the recipient after sending, an
      // operations analyst needs to see that the two differ rather than being
      // shown one and left to assume it was always so.
      savedRecipient: transfer.recipient && {
        ...transfer.recipient,
        bankAccount: undefined,
        bankAccountMasked: maskAccount(
          decryptField(transfer.recipient.bankAccount),
        ),
      },
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
      updatedAt: transfer.updatedAt,
      // The same aging signal the queue sorts on, so opening a row does not
      // lose the reason it was opened.
      ageMinutes,
      thresholdMinutes,
      overdue: thresholdMinutes !== null && ageMinutes >= thresholdMinutes,
      timeline: transfer.timeline.map((e) => ({
        id: e.id,
        status: e.status,
        message: e.message ?? '',
        createdAt: e.createdAt,
      })),
      ledger,
      /**
       * What this transfer did to the sender's wallet, in total.
       *
       * "Has my money actually left?" is the question support is asked, and a
       * status cannot answer it — a transfer can read `payout_processing` while
       * the debit sits in the ledger, and it can read `failed` with the refund
       * already back. This figure is the ledger's answer rather than the
       * status machine's, which is the point of keeping a ledger at all.
       */
      walletNet: walletNet.toString(),
      walletCurrency: transfer.sendCurrency,
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

  async updateCorridor(id: string, dto: UpdateCorridorDto, actor: AuthUser) {
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
      // Previously stored the incoming DTO alone: that recorded the new rate
      // and margin but not what they had been, leaving no way to see how far a
      // corridor had been moved or by how much.
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: 'admin.corridor.update',
        entityType: 'corridor',
        entityId: id,
        before: corridorState(corridor),
        after: corridorState(u),
        reason: dto.reason,
      });
      return u;
    });
    return updated;
  }
}

/**
 * A corridor's economically meaningful fields, as plain strings.
 *
 * Prisma Decimals do not survive JSON as themselves — a rate serialised as
 * {"s":1,"e":2,"d":[198]} is not something anyone can read back in three
 * years, which is roughly when someone will want to.
 */
function corridorState(c: {
  baseRate: Prisma.Decimal;
  marginBps: number;
  feeFlat: Prisma.Decimal;
  feePercentBps: number;
  minSendAmount: Prisma.Decimal;
  maxSendAmount: Prisma.Decimal;
  active: boolean;
}) {
  return {
    baseRate: c.baseRate.toString(),
    marginBps: c.marginBps,
    feeFlat: c.feeFlat.toString(),
    feePercentBps: c.feePercentBps,
    minSendAmount: c.minSendAmount.toString(),
    maxSendAmount: c.maxSendAmount.toString(),
    active: c.active,
  };
}
