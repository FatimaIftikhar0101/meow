import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
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
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
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
    this.logger.log(`Admin ${actor.email} overrode KYC to ${status} for ${targetUserId}`);
    return this.status(targetUserId);
  }
}
