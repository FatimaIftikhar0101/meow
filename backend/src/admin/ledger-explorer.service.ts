import { Injectable } from '@nestjs/common';
import { AccountKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListPostingsDto } from './dto/list-postings.dto';

/**
 * Reading the books.
 *
 * `LedgerService` writes; this reads, and the split is deliberate. Nothing here
 * can post an entry, so no future convenience on the explorer can turn into a
 * way to adjust the ledger from a screen.
 */
@Injectable()
export class LedgerExplorerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The chart of accounts, with a balance on each.
   *
   * Customer wallets are **excluded and counted instead**. There is one per
   * customer per currency, so at any real scale listing them turns a chart of
   * accounts into a customer list — and the balance a business needs from this
   * screen is the total it owes customers, not who is owed what. Individual
   * wallet balances are on the customer's own page, where the question is
   * about a person rather than about the books.
   *
   * Balances are summed in the database rather than by loading entries.
   * `groupBy` over direction is one round trip per account set; loading every
   * entry to add them up in Node would be fine today and would fall over on
   * the float account, which sees every transaction the business does.
   */
  async accounts(currency?: string) {
    const where: Prisma.LedgerAccountWhereInput = {
      kind: { not: AccountKind.customer_wallet },
      ...(currency ? { currency } : {}),
    };

    const accounts = await this.prisma.ledgerAccount.findMany({
      where,
      orderBy: [{ currency: 'asc' }, { kind: 'asc' }],
      select: { id: true, kind: true, currency: true, code: true },
    });

    const sums = await this.prisma.ledgerEntry.groupBy({
      by: ['accountId', 'direction'],
      where: { accountId: { in: accounts.map((a) => a.id) } },
      _sum: { amount: true },
    });

    const byAccount = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const a of accounts) {
      byAccount.set(a.id, {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      });
    }
    for (const s of sums) {
      const entry = byAccount.get(s.accountId);
      if (entry) entry[s.direction] = s._sum.amount ?? new Prisma.Decimal(0);
    }

    // Customer wallets as one line per currency, since that is the liability
    // the business actually carries.
    const walletSums = await this.prisma.$queryRaw<
      { currency: string; direction: string; total: Prisma.Decimal }[]
    >`
      SELECT e."currency", e."direction", SUM(e."amount") AS total
      FROM "LedgerEntry" e
      JOIN "LedgerAccount" a ON a."id" = e."accountId"
      WHERE a."kind" = 'customer_wallet'
      ${currency ? Prisma.sql`AND e."currency" = ${currency}` : Prisma.empty}
      GROUP BY e."currency", e."direction"
    `;

    const walletByCurrency = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();
    for (const row of walletSums) {
      const acc = walletByCurrency.get(row.currency) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      acc[row.direction === 'debit' ? 'debit' : 'credit'] = new Prisma.Decimal(
        row.total,
      );
      walletByCurrency.set(row.currency, acc);
    }

    const walletCount = await this.prisma.ledgerAccount.count({
      where: {
        kind: AccountKind.customer_wallet,
        ...(currency ? { currency } : {}),
      },
    });

    return {
      accounts: accounts.map((a) => {
        const s = byAccount.get(a.id)!;
        return {
          id: a.id,
          kind: a.kind,
          code: a.code,
          currency: a.currency,
          debit: s.debit.toFixed(2),
          credit: s.credit.toFixed(2),
          // Credit minus debit throughout, so every account is read the same
          // way. A liability reads positive when we owe; an asset reads
          // negative when we hold it. Signing each account by its natural
          // balance would be friendlier and would stop the columns summing to
          // zero, which is the property worth being able to see.
          balance: s.credit.minus(s.debit).toFixed(2),
        };
      }),
      customerWallets: [...walletByCurrency.entries()].map(([cur, s]) => ({
        currency: cur,
        accountCount: walletCount,
        debit: s.debit.toFixed(2),
        credit: s.credit.toFixed(2),
        balance: s.credit.minus(s.debit).toFixed(2),
      })),
    };
  }

  /**
   * Does the ledger balance, per currency?
   *
   * A posting cannot span currencies, and every posting sums to zero, so every
   * currency must sum to zero across all accounts. This is the check that
   * would catch a bug the per-posting trigger cannot: entries written outside
   * a posting, or a posting whose trigger was somehow not enforced.
   *
   * It reads the whole entry table by design. This is a report someone runs,
   * not something on a dashboard refresh loop.
   */
  async trialBalance() {
    const rows = await this.prisma.$queryRaw<
      { currency: string; debit: Prisma.Decimal; credit: Prisma.Decimal }[]
    >`
      SELECT
        "currency",
        COALESCE(SUM("amount") FILTER (WHERE "direction" = 'debit'), 0)  AS debit,
        COALESCE(SUM("amount") FILTER (WHERE "direction" = 'credit'), 0) AS credit
      FROM "LedgerEntry"
      GROUP BY "currency"
      ORDER BY "currency"
    `;

    return rows.map((r) => {
      const debit = new Prisma.Decimal(r.debit);
      const credit = new Prisma.Decimal(r.credit);
      const difference = credit.minus(debit);
      return {
        currency: r.currency,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        difference: difference.toFixed(2),
        /** The only value on this screen that should never be false. */
        balanced: difference.isZero(),
      };
    });
  }

  /**
   * Postings, newest first, each with all of its legs.
   *
   * A posting rather than an entry is the unit here. An entry on its own says
   * money moved and not where from, which is the exact deficiency the
   * double-entry work existed to fix — so listing entries would rebuild the
   * problem inside the screen meant to demonstrate it was solved.
   */
  async postings(query: ListPostingsDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));

    const where: Prisma.LedgerPostingWhereInput = {
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.transferId ? { transferId: query.transferId } : {}),
      ...(query.accountId
        ? { entries: { some: { accountId: query.accountId } } }
        : {}),
      ...(query.kind
        ? { entries: { some: { account: { kind: query.kind } } } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.ledgerPosting.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          key: true,
          currency: true,
          transferId: true,
          createdAt: true,
          entries: {
            select: {
              id: true,
              direction: true,
              type: true,
              amount: true,
              currency: true,
              description: true,
              account: { select: { id: true, kind: true, code: true } },
            },
          },
        },
      }),
      this.prisma.ledgerPosting.count({ where }),
    ]);

    return {
      items: items.map((p) => {
        const net = p.entries.reduce(
          (acc, e) =>
            e.direction === 'credit' ? acc.plus(e.amount) : acc.minus(e.amount),
          new Prisma.Decimal(0),
        );
        return {
          ...p,
          entries: p.entries.map((e) => ({
            ...e,
            amount: e.amount.toFixed(2),
          })),
          net: net.toFixed(2),
          /** Should always be true. Shown so that if it ever is not, the row
           *  says so rather than looking like every other row. */
          balanced: net.isZero(),
        };
      }),
      total,
      page,
      pageSize,
    };
  }
}
