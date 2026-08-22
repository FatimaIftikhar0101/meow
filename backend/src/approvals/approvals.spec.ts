import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { ApprovalsService } from './approvals.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

/**
 * Four-eyes, and the ways a four-eyes control quietly stops being one.
 *
 * The happy path is not where the risk is. These cover the four failures that
 * would leave the feature looking like a control while providing none:
 *
 *  - the same person on both sides;
 *  - two approvers deciding at once, so the action runs twice;
 *  - the action failing while the record says it succeeded;
 *  - a stale request still being actionable days later.
 */

const MAKER: AuthUser = { id: 'ops-1', email: 'ops@meow.test' } as AuthUser;
const CHECKER: AuthUser = {
  id: 'comp-1',
  email: 'compliance@meow.test',
} as AuthUser;

function pendingRequest(over: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    action: 'transfer.force_fail',
    entityType: 'transfer',
    entityId: 't-1',
    payload: { reason: 'Beneficiary bank rejected it twice' },
    reason: 'Stuck for six hours, bank will not take it',
    status: 'pending',
    requestedById: MAKER.id,
    decidedById: null,
    decisionReason: null,
    decidedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    ...over,
  };
}

/** Prisma call arguments, typed so the assertions below read against a shape
 *  rather than `any` off a jest mock. */
type Row = Record<string, unknown>;
type WriteArgs = { data: Row; where?: Row };
type ReadArgs = { where?: Row; orderBy?: Array<Record<string, string>> };

function createMockPrisma() {
  return {
    approvalRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn() as jest.Mock<Promise<unknown>, [WriteArgs]>,
      updateMany: jest
        .fn<Promise<{ count: number }>, [WriteArgs]>()
        .mockResolvedValue({ count: 1 }),
      findMany: jest.fn() as jest.Mock<Promise<unknown[]>, [ReadArgs]>,
      count: jest.fn(),
    },
    auditLog: { create: jest.fn() as jest.Mock<Promise<unknown>, [WriteArgs]> },
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let prisma: MockPrisma;
  let forceFail: jest.Mock;

  beforeEach(async () => {
    prisma = createMockPrisma();
    forceFail = jest.fn().mockResolvedValue(undefined);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransfersService, useValue: { adminForceFail: forceFail } },
      ],
    }).compile();
    service = moduleRef.get(ApprovalsService);
  });

  describe('requesting', () => {
    it('refuses an action that is not in the registry', async () => {
      // A request row is an instruction to run code later, so the set of code
      // it can name has to be closed.
      await expect(
        service.request(MAKER, {
          action: 'database.drop',
          entityId: 't-1',
          reason: 'no thank you',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it('refuses a second open request for the same action on the same record', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue({
        id: 'req-existing',
      });
      await expect(
        service.request(MAKER, {
          action: 'transfer.force_fail',
          entityId: 't-1',
          reason: 'duplicate',
        }),
      ).rejects.toThrow(/already awaiting a decision/);
    });

    it('records the maker and an expiry', async () => {
      prisma.approvalRequest.findFirst.mockResolvedValue(null);
      prisma.approvalRequest.create.mockResolvedValue(pendingRequest());

      await service.request(MAKER, {
        action: 'transfer.force_fail',
        entityId: 't-1',
        reason: 'Stuck for six hours',
        payload: { reason: 'Bank rejected' },
      });

      const data = prisma.approvalRequest.create.mock.calls[0][0].data;
      expect(data.requestedById).toBe(MAKER.id);
      expect(data.status).toBeUndefined(); // schema default
      expect(new Date(data.expiresAt as Date).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });
  });

  describe('deciding', () => {
    it('refuses to let the maker approve their own request', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      await expect(
        service.decide(MAKER, 'req-1', true, 'looks fine to me'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(forceFail).not.toHaveBeenCalled();
    });

    it('runs the action once the parties differ', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      await service.decide(
        CHECKER,
        'req-1',
        true,
        'Agreed, bank will not take it',
      );

      expect(forceFail).toHaveBeenCalledWith(
        CHECKER,
        't-1',
        'Beneficiary bank rejected it twice',
      );
      // The frozen payload, not anything supplied at decision time.
    });

    it('does not run the action when rejected', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      await service.decide(CHECKER, 'req-1', false, 'Try the retry path first');
      expect(forceFail).not.toHaveBeenCalled();
    });

    it('lets only one of two simultaneous approvers execute', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      // The conditional claim found the row already decided.
      prisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.decide(CHECKER, 'req-1', true, 'approving'),
      ).rejects.toThrow(/Someone else decided this first/);
      expect(forceFail).not.toHaveBeenCalled();
    });

    it('returns the request to pending if the action fails', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      forceFail.mockRejectedValue(new Error('transfer already delivered'));

      await expect(
        service.decide(CHECKER, 'req-1', true, 'approving'),
      ).rejects.toThrow(/returned to pending/);

      // An approval that records success for something that did not happen is
      // worse than no record at all.
      const rollback =
        prisma.approvalRequest.updateMany.mock.calls.at(-1)?.[0].data;
      expect(rollback).toBeDefined();
      expect(rollback?.status).toBe('pending');
      expect(rollback?.decidedById).toBeNull();

      const audit = prisma.auditLog.create.mock.calls[0][0].data;
      expect(audit.action).toBe('admin.approval.execute_failed');
    });

    it('refuses a request that has expired, and marks it', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(
        pendingRequest({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.decide(CHECKER, 'req-1', true, 'late'),
      ).rejects.toThrow(/expired/);
      expect(forceFail).not.toHaveBeenCalled();
    });

    it('refuses one that was already decided', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(
        pendingRequest({ status: 'approved' }),
      );
      await expect(
        service.decide(CHECKER, 'req-1', true, 'again'),
      ).rejects.toThrow(/already approved/);
    });

    it('404s an unknown request', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(null);
      await expect(
        service.decide(CHECKER, 'req-nope', true, 'x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('cancelling', () => {
    it('lets the maker withdraw their own request', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      await service.cancel(MAKER, 'req-1', 'Resolved itself');
      const data = prisma.approvalRequest.updateMany.mock.calls[0][0].data;
      expect(data.status).toBe('cancelled');
    });

    it('refuses to let anyone else withdraw it', async () => {
      prisma.approvalRequest.findUnique.mockResolvedValue(pendingRequest());
      await expect(
        service.cancel(CHECKER, 'req-1', 'not mine'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('the queue', () => {
    it('expires stale requests as it reads them', async () => {
      prisma.approvalRequest.findMany.mockResolvedValue([]);
      prisma.approvalRequest.count.mockResolvedValue(0);

      await service.list({});

      const sweep = prisma.approvalRequest.updateMany.mock.calls[0][0];
      expect(sweep.where?.status).toBe('pending');
      expect(sweep.data.status).toBe('expired');
    });

    it('puts pending first and oldest first within it', async () => {
      prisma.approvalRequest.findMany.mockResolvedValue([]);
      prisma.approvalRequest.count.mockResolvedValue(0);

      await service.list({});

      const args = prisma.approvalRequest.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual([{ status: 'asc' }, { createdAt: 'asc' }]);
    });
  });
});
