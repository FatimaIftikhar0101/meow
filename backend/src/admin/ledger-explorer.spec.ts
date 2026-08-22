import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerExplorerService } from './ledger-explorer.service';

/**
 * Reading the books.
 *
 * The arithmetic is the whole product here, so that is what these check —
 * along with two decisions that are easy to reverse by accident.
 *
 * **Customer wallets are aggregated, not listed.** There is one per customer
 * per currency; listing them turns a chart of accounts into a customer list
 * and, at scale, into a very slow page.
 *
 * **`balanced` must be computed, never assumed.** A screen that displays a
 * hardcoded tick beside every posting is worse than no screen: it is a control
 * that reports success unconditionally.
 */

function createMockPrisma() {
  return {
    ledgerAccount: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [{ where: Record<string, unknown> }]
      >(),
      count: jest.fn(),
    },
    ledgerEntry: { groupBy: jest.fn() },
    ledgerPosting: {
      findMany: jest.fn<
        Promise<unknown[]>,
        [{ where: { entries?: { some: { account: { kind: string } } } } }]
      >(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
}

type MockPrisma = ReturnType<typeof createMockPrisma>;

const D = (n: string) => new Prisma.Decimal(n);

describe('LedgerExplorerService', () => {
  let service: LedgerExplorerService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerExplorerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(LedgerExplorerService);
  });

  describe('accounts', () => {
    beforeEach(() => {
      prisma.ledgerAccount.findMany.mockResolvedValue([
        { id: 'a-float', kind: 'float', currency: 'CAD', code: 'float.CAD' },
        {
          id: 'a-fee',
          kind: 'fee_revenue',
          currency: 'CAD',
          code: 'revenue.fees.CAD',
        },
      ]);
      prisma.ledgerEntry.groupBy.mockResolvedValue([
        {
          accountId: 'a-float',
          direction: 'debit',
          _sum: { amount: D('500.00') },
        },
        {
          accountId: 'a-fee',
          direction: 'credit',
          _sum: { amount: D('12.50') },
        },
      ]);
      prisma.$queryRaw.mockResolvedValue([]);
      prisma.ledgerAccount.count.mockResolvedValue(0);
    });

    it('excludes customer wallets from the account list', async () => {
      await service.accounts();
      const where = prisma.ledgerAccount.findMany.mock.calls[0][0].where;
      expect(where.kind).toEqual({ not: 'customer_wallet' });
    });

    it('reports credit minus debit for every account the same way', async () => {
      const result = await service.accounts();
      const float = result.accounts.find((a) => a.id === 'a-float');
      const fee = result.accounts.find((a) => a.id === 'a-fee');
      // An asset we hold reads negative under a uniform credit-minus-debit
      // convention. That is the point: the columns sum to zero, which is what
      // makes an imbalance visible.
      expect(float?.balance).toBe('-500.00');
      expect(fee?.balance).toBe('12.50');
    });

    it('leaves an account with no entries at zero rather than undefined', async () => {
      prisma.ledgerEntry.groupBy.mockResolvedValue([]);
      const result = await service.accounts();
      expect(result.accounts.map((a) => a.balance)).toEqual(['0.00', '0.00']);
    });

    it('rolls customer wallets up per currency', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { currency: 'CAD', direction: 'credit', total: D('900.00') },
        { currency: 'CAD', direction: 'debit', total: D('250.00') },
      ]);
      prisma.ledgerAccount.count.mockResolvedValue(3);

      const result = await service.accounts();
      expect(result.customerWallets).toEqual([
        {
          currency: 'CAD',
          accountCount: 3,
          debit: '250.00',
          credit: '900.00',
          // What the business owes its customers, which is the figure this
          // screen needs — not who is owed what.
          balance: '650.00',
        },
      ]);
    });
  });

  describe('trialBalance', () => {
    it('calls a currency balanced when debits and credits match', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { currency: 'CAD', debit: D('1000.00'), credit: D('1000.00') },
      ]);
      const [cad] = await service.trialBalance();
      expect(cad.balanced).toBe(true);
      expect(cad.difference).toBe('0.00');
    });

    it('reports an imbalance rather than rounding past it', async () => {
      // Money recorded as coming from nowhere. The single most useful number
      // on the screen, and it must not be smoothed away.
      prisma.$queryRaw.mockResolvedValue([
        { currency: 'PKR', debit: D('1000.00'), credit: D('1000.01') },
      ]);
      const [pkr] = await service.trialBalance();
      expect(pkr.balanced).toBe(false);
      expect(pkr.difference).toBe('0.01');
    });
  });

  describe('postings', () => {
    it('computes net per posting instead of trusting it', async () => {
      prisma.ledgerPosting.findMany.mockResolvedValue([
        {
          id: 'p-1',
          key: 'transfer:t-1:hold',
          currency: 'CAD',
          transferId: 't-1',
          createdAt: new Date(),
          entries: [
            {
              id: 'e-1',
              direction: 'debit',
              type: 'transfer_hold',
              amount: D('100.00'),
              currency: 'CAD',
              description: null,
              account: { id: 'w', kind: 'customer_wallet', code: 'wallet.x' },
            },
            {
              id: 'e-2',
              direction: 'credit',
              type: 'transfer_hold',
              amount: D('100.00'),
              currency: 'CAD',
              description: null,
              account: { id: 's', kind: 'transfer_suspense', code: 'susp.CAD' },
            },
          ],
        },
      ]);
      prisma.ledgerPosting.count.mockResolvedValue(1);

      const result = await service.postings({});
      expect(result.items[0].net).toBe('0.00');
      expect(result.items[0].balanced).toBe(true);
      expect(result.items[0].entries[0].amount).toBe('100.00');
    });

    it('marks a posting that does not balance', async () => {
      prisma.ledgerPosting.findMany.mockResolvedValue([
        {
          id: 'p-2',
          key: 'broken',
          currency: 'CAD',
          transferId: null,
          createdAt: new Date(),
          entries: [
            {
              id: 'e-3',
              direction: 'credit',
              type: 'wallet_fund',
              amount: D('50.00'),
              currency: 'CAD',
              description: null,
              account: { id: 'w', kind: 'customer_wallet', code: 'wallet.x' },
            },
          ],
        },
      ]);
      prisma.ledgerPosting.count.mockResolvedValue(1);

      const result = await service.postings({});
      // The database trigger should make this unreachable. The screen still
      // has to be able to say it, or it is a control that always reports
      // success.
      expect(result.items[0].balanced).toBe(false);
      expect(result.items[0].net).toBe('50.00');
    });

    it('filters by the account kind asked for', async () => {
      prisma.ledgerPosting.findMany.mockResolvedValue([]);
      prisma.ledgerPosting.count.mockResolvedValue(0);

      await service.postings({ kind: 'transfer_suspense' });

      const args = prisma.ledgerPosting.findMany.mock.calls[0][0];
      expect(args.where.entries?.some.account.kind).toBe('transfer_suspense');
    });

    it('caps the page size so one request cannot pull the whole ledger', async () => {
      prisma.ledgerPosting.findMany.mockResolvedValue([]);
      prisma.ledgerPosting.count.mockResolvedValue(0);

      const result = await service.postings({ pageSize: 100000 });
      expect(result.pageSize).toBe(100);
    });
  });
});
