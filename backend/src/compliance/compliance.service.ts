import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
      await tx.auditLog.create({
        data: {
          userId,
          action: `kyc.${result}`,
          entityType: 'user',
          entityId: userId,
        },
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
}
