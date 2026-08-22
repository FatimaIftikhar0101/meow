import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertStatus, BlocklistKind, CaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeStaffAudit } from '../common/audit/audit';
import { ScreeningService } from './screening.service';

/**
 * The queue rules feed, the files it turns into, and the list that blocks.
 *
 * An alert is not a finding. Most are cleared, and the record of a cleared
 * alert — who looked, when, and what satisfied them — is as much of the
 * evidence as the ones that become cases. So clearing requires a reason, the
 * same as escalating does.
 */
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Alerts ────────────────────────────────────────────────────────────────

  /**
   * Open first, most severe first, oldest first.
   *
   * `severity: 'desc'` reads backwards but is right: the enum is declared
   * low, medium, high, so descending puts high at the top.
   */
  async listAlerts(query: {
    status?: AlertStatus;
    rule?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: Prisma.ComplianceAlertWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.rule ? { rule: query.rule } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.complianceAlert.findMany({
        where,
        orderBy: [
          { status: 'asc' },
          { severity: 'desc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true } },
          adjudicatedBy: { select: { id: true, email: true } },
          case: { select: { id: true, reference: true, status: true } },
        },
      }),
      this.prisma.complianceAlert.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Clear or escalate.
   *
   * The reason is required either way. An alert cleared without one records
   * that somebody made it disappear, which is not the same as recording that
   * somebody looked at it and was satisfied — and only the second is worth
   * anything when the file is read back.
   *
   * Claimed with a conditional update so two reviewers cannot both adjudicate
   * the same alert and leave the second decision silently overwriting the
   * first.
   */
  async adjudicate(
    actor: AuthUser,
    id: string,
    status: 'cleared' | 'escalated',
    reason: string,
    caseId?: string,
  ) {
    const alert = await this.prisma.complianceAlert.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true, rule: true },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    if (alert.status !== AlertStatus.open) {
      throw new BadRequestException(`This alert was already ${alert.status}`);
    }

    if (caseId) {
      const kase = await this.prisma.complianceCase.findUnique({
        where: { id: caseId },
        select: { id: true, userId: true, status: true },
      });
      if (!kase) throw new NotFoundException('Case not found');
      // Attaching an alert to a case about a different customer would make the
      // file say something untrue about who was investigated.
      if (kase.userId !== alert.userId) {
        throw new BadRequestException(
          'That case is about a different customer',
        );
      }
      if (kase.status !== CaseStatus.open) {
        throw new BadRequestException('That case is closed');
      }
    }

    const claimed = await this.prisma.complianceAlert.updateMany({
      where: { id, status: AlertStatus.open },
      data: {
        status,
        caseId: caseId ?? null,
        adjudicatedById: actor.id,
        adjudicationReason: reason,
        adjudicatedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Someone else adjudicated this first');
    }

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: `admin.alert.${status}`,
      entityType: 'ComplianceAlert',
      entityId: id,
      reason,
      before: { status: 'open', rule: alert.rule },
      after: { status, caseId: caseId ?? null },
    });

    return this.prisma.complianceAlert.findUnique({ where: { id } });
  }

  // ── Cases ─────────────────────────────────────────────────────────────────

  async listCases(query: {
    status?: CaseStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const where: Prisma.ComplianceCaseWhereInput = query.status
      ? { status: query.status }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.complianceCase.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, email: true } },
          openedBy: { select: { id: true, email: true } },
          closedBy: { select: { id: true, email: true } },
          _count: { select: { alerts: true } },
        },
      }),
      this.prisma.complianceCase.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getCase(id: string) {
    const kase = await this.prisma.complianceCase.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        openedBy: { select: { id: true, email: true } },
        closedBy: { select: { id: true, email: true } },
        alerts: {
          orderBy: { createdAt: 'desc' },
          include: { adjudicatedBy: { select: { id: true, email: true } } },
        },
      },
    });
    if (!kase) throw new NotFoundException('Case not found');
    return kase;
  }

  /**
   * Open a file on a customer.
   *
   * The reference is generated rather than supplied. Cases get quoted in email
   * and read down a phone, so they need something short and unambiguous, and
   * letting a person type it invites two files with the same name.
   */
  async openCase(actor: AuthUser, userId: string, summary: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const year = new Date().getFullYear();
    const countThisYear = await this.prisma.complianceCase.count({
      where: { createdAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
    });
    const reference = `CASE-${year}-${String(countThisYear + 1).padStart(4, '0')}`;

    const created = await this.prisma.complianceCase.create({
      data: { reference, userId, summary, openedById: actor.id },
    });

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.case.open',
      entityType: 'ComplianceCase',
      entityId: created.id,
      reason: summary,
      before: null,
      after: { reference, userId },
    });

    return created;
  }

  /**
   * Close a file.
   *
   * Refuses while any attached alert is still open. A closed case with live
   * alerts hanging off it says the investigation finished while the things
   * that prompted it were never looked at.
   */
  async closeCase(actor: AuthUser, id: string, reason: string) {
    const kase = await this.prisma.complianceCase.findUnique({
      where: { id },
      select: { id: true, status: true, reference: true },
    });
    if (!kase) throw new NotFoundException('Case not found');
    if (kase.status !== CaseStatus.open) {
      throw new BadRequestException('This case is already closed');
    }

    const openAlerts = await this.prisma.complianceAlert.count({
      where: { caseId: id, status: AlertStatus.open },
    });
    if (openAlerts > 0) {
      throw new BadRequestException(
        `${openAlerts} alert(s) on this case are still open`,
      );
    }

    const claimed = await this.prisma.complianceCase.updateMany({
      where: { id, status: CaseStatus.open },
      data: {
        status: CaseStatus.closed,
        closedById: actor.id,
        closedReason: reason,
        closedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Someone else closed this first');
    }

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.case.close',
      entityType: 'ComplianceCase',
      entityId: id,
      reason,
      before: { status: 'open' },
      after: { status: 'closed' },
    });

    return this.getCase(id);
  }

  // ── Blocklist ─────────────────────────────────────────────────────────────

  listBlocklist(includeInactive: boolean) {
    return this.prisma.blocklistEntry.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 500,
      include: {
        addedBy: { select: { id: true, email: true } },
        deactivatedBy: { select: { id: true, email: true } },
      },
    });
  }

  /**
   * Add an entry.
   *
   * The value is normalised here, through the same function screening uses.
   * That symmetry is the entire correctness argument for matching, so it must
   * not be two implementations that happen to agree today.
   *
   * Re-adding something previously removed reactivates it rather than failing
   * on the unique constraint — with a fresh reason and a fresh author, since
   * putting a name back is a new decision.
   */
  async addToBlocklist(
    actor: AuthUser,
    kind: BlocklistKind,
    display: string,
    reason: string,
  ) {
    const value = ScreeningService.normalise(display);
    if (!value) throw new BadRequestException('Nothing to block');

    const existing = await this.prisma.blocklistEntry.findUnique({
      where: { kind_value: { kind, value } },
    });

    if (existing?.active) {
      throw new BadRequestException('That is already on the blocklist');
    }

    const entry = existing
      ? await this.prisma.blocklistEntry.update({
          where: { id: existing.id },
          data: {
            active: true,
            reason,
            display,
            addedById: actor.id,
            deactivatedById: null,
            deactivatedAt: null,
          },
        })
      : await this.prisma.blocklistEntry.create({
          data: { kind, value, display, reason, addedById: actor.id },
        });

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.blocklist.add',
      entityType: 'BlocklistEntry',
      entityId: entry.id,
      reason,
      before: existing ? { active: false } : null,
      after: { kind, display, active: true },
    });

    return entry;
  }

  /**
   * Remove an entry — by deactivating it.
   *
   * Never deleted. "Was this name on the list on the day we screened that
   * payment?" is a question asked years later, and a deleted row answers it
   * with silence.
   */
  async removeFromBlocklist(actor: AuthUser, id: string, reason: string) {
    const entry = await this.prisma.blocklistEntry.findUnique({
      where: { id },
    });
    if (!entry) throw new NotFoundException('Blocklist entry not found');
    if (!entry.active) {
      throw new BadRequestException('That entry is already inactive');
    }
    if (entry.addedById === actor.id) {
      // Same reasoning as four-eyes on transfers: the person who put a name on
      // the list should not be the only person who can quietly take it off.
      throw new ForbiddenException(
        'Someone other than the person who added it must remove it',
      );
    }

    const updated = await this.prisma.blocklistEntry.update({
      where: { id },
      data: {
        active: false,
        deactivatedById: actor.id,
        deactivatedAt: new Date(),
      },
    });

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.blocklist.remove',
      entityType: 'BlocklistEntry',
      entityId: id,
      reason,
      before: { active: true, display: entry.display },
      after: { active: false },
    });

    return updated;
  }
}
