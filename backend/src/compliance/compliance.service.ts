import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KycStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeAudit, writeStaffAudit } from '../common/audit/audit';

const HIGH_RISK_COUNTRIES = new Set(['KP', 'IR', 'SY', 'CU']);

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string) {
    const record = await this.prisma.kycRecord.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      status: record?.status ?? 'pending',
      provider: record?.provider ?? null,
      verifiedAt: record?.verifiedAt ?? null,
      reason: record?.reason ?? null,
    };
  }

  async verify(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const high =
      user.country &&
      HIGH_RISK_COUNTRIES.has(user.country.trim().toUpperCase());
    const result: KycStatus = high ? 'failed' : 'passed';
    const reason = high ? 'High-risk jurisdiction' : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.kycRecord.findFirst({
        where: { userId, status: 'passed' },
      });
      if (existing) return false;
      await tx.kycRecord.create({
        data: {
          userId,
          status: result,
          provider: 'mock',
          providerRef: `mock-${Date.now()}`,
          reason,
          verifiedAt: result === 'passed' ? new Date() : null,
        },
      });
      await writeAudit(tx, {
        actor: { id: userId },
        action: `kyc.${result}`,
        entityType: 'user',
        entityId: userId,
        after: { status: result, provider: 'mock' },
        reason,
      });
      return true;
    });

    if (created) this.logger.log(`KYC ${result} for user ${userId}`);
    return this.status(userId);
  }

  async requirePassed(userId: string): Promise<boolean> {
    const record = await this.prisma.kycRecord.findFirst({
      where: { userId, status: 'passed' },
    });
    return record !== null;
  }

  async adminOverride(
    actor: AuthUser,
    targetUserId: string,
    status: 'passed' | 'failed',
    reason: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!user) throw new BadRequestException('User not found');

    // The most recent decision, so the audit entry can say what was overridden
    // rather than only what it became.
    const previous = await this.prisma.kycRecord.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.kycRecord.create({
        data: {
          userId: targetUserId,
          status,
          provider: 'admin_override',
          providerRef: `admin-${Date.now()}`,
          reason,
          verifiedAt: status === 'passed' ? new Date() : null,
        },
      });
      // An override substitutes a human judgement for the provider's. The
      // prior status is what makes it legible later: "passed -> failed" and
      // "failed -> passed" are very different decisions to review.
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: `admin.kyc.${status}`,
        entityType: 'user',
        entityId: targetUserId,
        before: { status: previous?.status ?? null },
        after: { status },
        reason,
      });
    });
    this.logger.log(
      `Admin ${actor.email} overrode KYC to ${status} for ${targetUserId}`,
    );
    return this.status(targetUserId);
  }
  /**
   * The identity queue.
   *
   * The same shape as the transfer queue and for the same reason: a case
   * sitting unreviewed for four days is a problem and one sitting for four
   * minutes is not, and nothing on a plain list tells them apart. Pending
   * first, oldest first, because a KYC case is a customer who cannot send
   * money until somebody looks.
   *
   * Only the latest record per customer is a live case. Earlier ones are
   * history — a customer who failed and later passed is not still pending, and
   * showing the superseded row would put a decided case back in the queue.
   */
  async listForReview(query: {
    status?: KycStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

    // The latest record id per user, which is what "the current case" means.
    const latest = await this.prisma.kycRecord.groupBy({
      by: ['userId'],
      _max: { createdAt: true },
    });
    if (latest.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }

    const where: Prisma.KycRecordWhereInput = {
      OR: latest.map((l) => ({
        userId: l.userId,
        createdAt: l._max.createdAt as Date,
      })),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.kycRecord.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          status: true,
          provider: true,
          reason: true,
          verifiedAt: true,
          createdAt: true,
          verifiedName: true,
          documentType: true,
          documentLast4: true,
          documentExpiry: true,
          method: true,
          reviewedById: true,
          reviewedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              country: true,
              suspended: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.kycRecord.count({ where }),
    ]);

    const now = Date.now();
    return {
      items: rows.map((r) => ({
        ...r,
        ageMinutes: Math.round((now - r.createdAt.getTime()) / 60000),
        /** A pending case older than a working day. Not a hard rule — the
         *  point is to make the old ones findable, not to raise an alarm. */
        overdue:
          r.status === 'pending' &&
          now - r.createdAt.getTime() > 24 * 60 * 60 * 1000,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Decide a case that nobody has decided yet.
   *
   * Split from `adminOverride` deliberately, and the permissions differ:
   * `kyc.decide` settles an open case, `kyc.override` overturns a settled one.
   * Those are different acts. The first is the job; the second is substituting
   * a human judgement for one already recorded, which is rarer, more serious,
   * and the thing a reviewer will want to find. Collapsing them would make the
   * audit log unable to tell them apart.
   */
  async decide(
    actor: AuthUser,
    targetUserId: string,
    status: 'passed' | 'failed',
    reason: string,
  ) {
    const latest = await this.prisma.kycRecord.findFirst({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (!latest) {
      throw new BadRequestException('This customer has no identity check yet');
    }
    if (latest.status !== 'pending') {
      throw new BadRequestException(
        `This case was already ${latest.status}. Overturning a decided case is an override, not a decision.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Update the open case rather than stacking a new row on top of it. A
      // decision resolves the case that was raised; a new row would leave the
      // original looking permanently unreviewed.
      await tx.kycRecord.update({
        where: { id: latest.id },
        data: {
          status,
          reason,
          verifiedAt: status === 'passed' ? new Date() : null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      await writeStaffAudit(tx, {
        actor: { id: actor.id, email: actor.email },
        action: `admin.kyc.decide.${status}`,
        entityType: 'user',
        entityId: targetUserId,
        before: { status: 'pending' },
        after: { status },
        reason,
      });
    });

    this.logger.log(`${actor.email} decided KYC ${status} for ${targetUserId}`);
    return this.status(targetUserId);
  }
}
