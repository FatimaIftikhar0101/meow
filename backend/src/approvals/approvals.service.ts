import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { writeStaffAudit } from '../common/audit/audit';
import { TransfersService } from '../transfers/transfers.service';

/**
 * Four-eyes on the actions where one person can do irreversible harm.
 *
 * Operations can see a stuck transfer and knows when it needs killing, but
 * force-failing one refunds the sender and ends the attempt — so they may
 * *ask* for it (`approval.request`) and somebody else decides
 * (`approval.decide`). That split is already in the permission map; this is
 * what consumes it.
 *
 * ── Three properties make this an approval rather than a formality ───────────
 *
 * **The parties must differ.** Enforced in the service, and again as a CHECK
 * constraint, because a row naming the same person on both sides is not a
 * weaker approval — it is not one, and it must not be storable whatever a
 * future code path believes.
 *
 * **The payload is frozen.** The approver is agreeing to specific arguments.
 * Nothing updates `payload` after creation, so what executes is what was read.
 *
 * **Approval executes.** There is no approved-but-not-yet-done state for
 * somebody to act on later, or differently, or not at all.
 */
@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  /** How long a request stays actionable. Long enough to cross a shift
   *  handover, short enough that nobody approves a stale one. */
  static readonly TTL_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transfers: TransfersService,
  ) {}

  /**
   * The actions that can be requested, and what approving one does.
   *
   * A registry rather than a switch reached from the controller, so an action
   * name that is not in here cannot be requested at all — a request row is
   * an instruction to run code later, and the set of code it can name has to
   * be closed.
   *
   * The executor receives the **approver** as actor. They are the one
   * authorising it; the maker is recorded separately on the request and in the
   * audit entry, so the log answers both "who did this" and "who asked for it".
   */
  private executors(): Record<
    string,
    {
      entityType: string;
      describe: (payload: Record<string, unknown>) => string;
      run: (
        approver: AuthUser,
        entityId: string,
        payload: Record<string, unknown>,
      ) => Promise<unknown>;
    }
  > {
    return {
      'transfer.force_fail': {
        entityType: 'transfer',
        describe: () => 'Force-fail this transfer and refund the sender',
        run: (approver, entityId, payload) =>
          this.transfers.adminForceFail(
            approver,
            entityId,
            typeof payload.reason === 'string'
              ? payload.reason
              : 'Approved force-fail',
          ),
      },
    };
  }

  listActions() {
    return Object.entries(this.executors()).map(([action, spec]) => ({
      action,
      entityType: spec.entityType,
    }));
  }

  /**
   * Ask for a gated action.
   *
   * Refuses a second open request against the same entity and action. Two
   * operators queuing the same force-fail is not harmless: the first approval
   * executes it and the second becomes an approval to fail an already-failed
   * transfer, which the executor then refuses in a way that looks like a bug.
   */
  async request(
    actor: AuthUser,
    input: {
      action: string;
      entityId: string;
      reason: string;
      payload?: Record<string, unknown>;
    },
  ) {
    const spec = this.executors()[input.action];
    if (!spec) {
      throw new BadRequestException(`Unknown action: ${input.action}`);
    }

    const open = await this.prisma.approvalRequest.findFirst({
      where: {
        action: input.action,
        entityId: input.entityId,
        status: ApprovalStatus.pending,
      },
      select: { id: true },
    });
    if (open) {
      throw new BadRequestException(
        `A request for ${input.action} on this record is already awaiting a decision (${open.id})`,
      );
    }

    const created = await this.prisma.approvalRequest.create({
      data: {
        action: input.action,
        entityType: spec.entityType,
        entityId: input.entityId,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        reason: input.reason,
        requestedById: actor.id,
        expiresAt: new Date(
          Date.now() + ApprovalsService.TTL_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.approval.request',
      entityType: 'ApprovalRequest',
      entityId: created.id,
      reason: input.reason,
      before: null,
      after: { action: input.action, entityId: input.entityId },
    });

    return created;
  }

  /**
   * Approve or reject.
   *
   * The order here is the design. The request is claimed with a conditional
   * update first — `updateMany` filtered on `status: pending`, and a zero
   * count means somebody else decided it in the meantime — so two approvers
   * clicking at once cannot both execute the action. Only then does the
   * executor run.
   *
   * If the executor throws, the decision is rolled back to `pending` rather
   * than left as `approved`. An approval that records success for an action
   * that did not happen is the one outcome worse than no record at all.
   */
  async decide(
    actor: AuthUser,
    id: string,
    approve: boolean,
    decisionReason: string,
  ) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Approval request not found');
    if (req.status !== ApprovalStatus.pending) {
      throw new BadRequestException(`This request was already ${req.status}`);
    }
    // Four eyes. Checked here for a clear message; the database refuses it
    // too, because this is the whole point of the feature.
    if (req.requestedById === actor.id) {
      throw new ForbiddenException(
        'You cannot decide a request you made yourself',
      );
    }
    if (req.expiresAt < new Date()) {
      await this.prisma.approvalRequest.updateMany({
        where: { id, status: ApprovalStatus.pending },
        data: { status: ApprovalStatus.expired },
      });
      throw new BadRequestException(
        'This request has expired; raise a new one if it is still needed',
      );
    }

    const nextStatus = approve
      ? ApprovalStatus.approved
      : ApprovalStatus.rejected;

    // Claim it before doing anything irreversible.
    const claimed = await this.prisma.approvalRequest.updateMany({
      where: { id, status: ApprovalStatus.pending },
      data: {
        status: nextStatus,
        decidedById: actor.id,
        decisionReason,
        decidedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Someone else decided this first');
    }

    let executionError: Error | null = null;
    if (approve) {
      const spec = this.executors()[req.action];
      if (!spec) {
        executionError = new Error(`Unknown action: ${req.action}`);
      } else {
        try {
          await spec.run(
            actor,
            req.entityId,
            (req.payload ?? {}) as Record<string, unknown>,
          );
        } catch (err) {
          executionError = err as Error;
        }
      }

      if (executionError) {
        // Put it back. The action did not happen, so the record must not say
        // it did.
        await this.prisma.approvalRequest.updateMany({
          where: { id },
          data: {
            status: ApprovalStatus.pending,
            decidedById: null,
            decisionReason: null,
            decidedAt: null,
          },
        });
        this.logger.error(
          `Approval ${id} (${req.action}) failed to execute: ${executionError.message}`,
        );
      }
    }

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: executionError
        ? 'admin.approval.execute_failed'
        : approve
          ? 'admin.approval.approve'
          : 'admin.approval.reject',
      entityType: 'ApprovalRequest',
      entityId: id,
      reason: decisionReason,
      before: { status: 'pending', requestedById: req.requestedById },
      after: {
        status: executionError ? 'pending' : nextStatus,
        error: executionError?.message ?? null,
      },
    });

    if (executionError) {
      throw new BadRequestException(
        `Approved, but the action failed and has been returned to pending: ${executionError.message}`,
      );
    }

    return this.prisma.approvalRequest.findUnique({ where: { id } });
  }

  /** Withdraw your own request. Only the maker, and only while pending. */
  async cancel(actor: AuthUser, id: string, reason: string) {
    const req = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Approval request not found');
    if (req.requestedById !== actor.id) {
      throw new ForbiddenException('Only the requester can withdraw a request');
    }
    const claimed = await this.prisma.approvalRequest.updateMany({
      where: { id, status: ApprovalStatus.pending },
      data: { status: ApprovalStatus.cancelled, decisionReason: reason },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('This request is no longer pending');
    }

    await writeStaffAudit(this.prisma, {
      actor: { id: actor.id, email: actor.email },
      action: 'admin.approval.cancel',
      entityType: 'ApprovalRequest',
      entityId: id,
      reason,
      before: { status: 'pending' },
      after: { status: 'cancelled' },
    });

    return this.prisma.approvalRequest.findUnique({ where: { id } });
  }

  /**
   * The queue.
   *
   * Pending first and oldest first, because an approval request is somebody
   * waiting. Expired ones are marked as they are encountered rather than by a
   * scheduled job — there is no separate clock to go wrong, and a request
   * nobody has looked at has not harmed anyone by being stale.
   */
  async list(query: {
    status?: ApprovalStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

    await this.prisma.approvalRequest.updateMany({
      where: { status: ApprovalStatus.pending, expiresAt: { lt: new Date() } },
      data: { status: ApprovalStatus.expired },
    });

    const where: Prisma.ApprovalRequestWhereInput = query.status
      ? { status: query.status }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          requestedBy: { select: { id: true, email: true } },
          decidedBy: { select: { id: true, email: true } },
        },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
