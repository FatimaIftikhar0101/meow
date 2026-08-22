import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { AccountKind, LedgerEntryType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The only thing that writes to the ledger.
 *
 * Every posting balances within one currency, and this is where that is
 * checked in application code. It is checked *again* by a constraint trigger in
 * the database, and the duplication is deliberate: this layer produces a clear
 * error at the call site during development, while the trigger is what actually
 * guarantees the property — it holds for a data-fix script, a future service,
 * and anyone with a psql prompt, none of which will call this method.
 */

/** A system account's code is derived from its kind. Stable and readable. */
const CODE_PREFIX: Record<AccountKind, string> = {
  customer_wallet: 'wallet',
  float: 'float',
  transfer_suspense: 'suspense.transfer',
  fee_revenue: 'revenue.fee',
  marketing_expense: 'expense.marketing',
  payout_settlement: 'settlement.payout',
  opening_balance: 'equity.opening',
};

export const SYSTEM_KINDS: AccountKind[] = [
  'float',
  'transfer_suspense',
  'fee_revenue',
  'marketing_expense',
  'payout_settlement',
  'opening_balance',
];

export interface PostingLeg {
  accountId: string;
  direction: 'debit' | 'credit';
  type: LedgerEntryType;
  amount: Prisma.Decimal;
  description?: string;
}

export interface Posting {
  /**
   * Derived from the event, never random: `transfer:<id>:hold`.
   *
   * It is unique, so replaying an operation cannot post the same movement
   * twice. The old `txGroupId` was a fresh `randomUUID()` per call and could
   * not prevent that — a retry simply generated a new group and posted again.
   */
  key: string;
  currency: string;
  transferId?: string;
  /**
   * The rate relating this posting to its counterpart, for one half of a
   * currency exchange. See `LedgerPosting.fxRate`.
   */
  fxRate?: Prisma.Decimal | null;
  legs: PostingLeg[];
}

@Injectable()
export class LedgerService implements OnModuleInit {
  private readonly logger = new Logger(LedgerService.name);
  /** code → account id. Accounts are never renamed or deleted. */
  private readonly cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create the system accounts for every currency the product deals in.
   *
   * Done at boot so the money paths never have to create an account inside
   * their own transaction. That matters more than it looks: an upsert on a
   * shared row, inside the transaction that also holds a wallet lock, is a
   * deadlock waiting for two customers to send money at the same moment.
   *
   * Best effort. A failure here is logged and does not stop the process —
   * `accountId` falls back to creating what it needs, outside any money
   * transaction. Refusing to boot because a currency nobody is using yet has
   * no fee account would be the wrong trade.
   */
  async onModuleInit(): Promise<void> {
    try {
      const corridors = await this.prisma.corridor.findMany({
        select: { fromCurrency: true, toCurrency: true },
      });
      const currencies = new Set<string>();
      for (const c of corridors) {
        currencies.add(c.fromCurrency);
        currencies.add(c.toCurrency);
      }
      for (const currency of currencies) {
        for (const kind of SYSTEM_KINDS) {
          await this.systemAccountId(kind, currency);
        }
      }
      this.logger.log(
        `Chart of accounts ready for ${[...currencies].join(', ') || 'no currencies'}`,
      );
    } catch (err) {
      this.logger.error(
        `Could not prepare the chart of accounts: ${
          err instanceof Error ? err.message : String(err)
        }. Accounts will be created on first use instead.`,
      );
    }
  }

  /**
   * The id of a system account, creating it if this is the first time.
   *
   * **Call this before opening a money transaction, never inside one.** It can
   * write, and a write to a shared row from inside a transaction holding other
   * locks is how deadlocks are made.
   */
  async systemAccountId(kind: AccountKind, currency: string): Promise<string> {
    const code = `${CODE_PREFIX[kind]}.${currency}`;
    const cached = this.cache.get(code);
    if (cached) return cached;

    const account = await this.prisma.ledgerAccount.upsert({
      where: { code },
      update: {},
      create: { kind, currency, code },
      select: { id: true },
    });
    this.cache.set(code, account.id);
    return account.id;
  }

  /**
   * The home currency for a country. One copy, because three code paths
   * decide it and two of them getting it right is not enough.
   */
  static homeCurrencyFor(country?: string | null): string {
    if (!country) return 'CAD';
    const c = country.trim().toLowerCase();
    if (c === 'ca' || c === 'canada') return 'CAD';
    if (c === 'us' || c === 'usa' || c === 'united states') return 'USD';
    if (c === 'gb' || c === 'uk' || c === 'united kingdom') return 'GBP';
    if (c === 'pk' || c === 'pakistan') return 'PKR';
    return 'CAD';
  }

  /**
   * A customer's wallet, created if it is not there.
   *
   * Registration and Google sign-up both create one, so most accounts have it.
   * The gap was the third path: signing in with Google against an address that
   * already had an account *links* the two and creates nothing — correct for a
   * customer who already has a wallet, and wrong for any account created some
   * other way. A staff member signing into the customer app with Google hit
   * exactly that and was told "Wallet not found", which is true and useless.
   *
   * An upsert on the composite key rather than a find-then-create: two requests
   * arriving together would otherwise both find nothing and both insert.
   */
  async ensureCustomerAccount(userId: string, currency: string) {
    const code = `wallet.${userId}.${currency}`;
    return this.prisma.ledgerAccount.upsert({
      where: {
        kind_ownerId_currency: {
          kind: 'customer_wallet',
          ownerId: userId,
          currency,
        },
      },
      update: {},
      create: { kind: 'customer_wallet', ownerId: userId, currency, code },
    });
  }

  /** A customer's wallet for one currency, or null. */
  customerAccount(userId: string, currency: string) {
    return this.prisma.ledgerAccount.findUnique({
      where: {
        kind_ownerId_currency: {
          kind: 'customer_wallet',
          ownerId: userId,
          currency,
        },
      },
    });
  }

  /**
   * Balance of one account: credits minus debits, never a stored number.
   *
   * For a **customer wallet** this is cheap and stays cheap.
   * `LedgerEntry_balance_idx` covers it, so Postgres answers from the index —
   * measured at 0.4 ms for a wallet inside a million-row table. A customer's
   * entry count grows with their own activity rather than the platform's, so
   * this does not degrade as the business grows. Deliberately not cached or
   * materialised: a stored balance can drift from the entries that justify it,
   * and that is a worse problem than any it would solve here.
   *
   * For a **system account** it is slow and gets slower. Float and suspense
   * carry a leg for every movement in the product, so they become a large
   * fraction of the table — at which point an index on `accountId` narrows
   * nothing and Postgres correctly switches to a sequential scan. Measured at
   * 720 ms for 500,000 entries.
   *
   * So: do not call this for a system account on a request path. Their
   * balances are reconciliation figures and belong behind a cache or a
   * snapshot. Backlog #44 has the numbers and the reasoning, including why
   * materialising float would be worse than the problem.
   */
  async balance(
    accountId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Prisma.Decimal> {
    const [credits, debits] = await Promise.all([
      client.ledgerEntry.aggregate({
        where: { accountId, direction: 'credit' },
        _sum: { amount: true },
      }),
      client.ledgerEntry.aggregate({
        where: { accountId, direction: 'debit' },
        _sum: { amount: true },
      }),
    ]);
    const c = credits._sum.amount ?? new Prisma.Decimal(0);
    const d = debits._sum.amount ?? new Prisma.Decimal(0);
    return c.minus(d);
  }

  /**
   * Write one balanced posting.
   *
   * Must be called inside a transaction — the caller's transaction, so the
   * posting commits with whatever else the operation changed. A ledger entry
   * that outlives a rolled-back status change, or vice versa, is the class of
   * bug this design exists to make impossible.
   */
  async post(tx: Prisma.TransactionClient, posting: Posting): Promise<string> {
    assertBalanced(posting);

    let created: { id: string };
    try {
      created = await tx.ledgerPosting.create({
        data: {
          key: posting.key,
          currency: posting.currency,
          transferId: posting.transferId,
          fxRate: posting.fxRate ?? null,
        },
        select: { id: true },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Surfaced rather than swallowed. Every caller already has its own
        // idempotency guard upstream, so reaching here means two code paths
        // believe they own the same movement — which is worth an error, not a
        // silent success that hides which one was wrong.
        throw new ConflictException(
          `Ledger posting ${posting.key} has already been written`,
        );
      }
      throw err;
    }

    await tx.ledgerEntry.createMany({
      data: posting.legs.map((leg) => ({
        accountId: leg.accountId,
        postingId: created.id,
        transferId: posting.transferId,
        direction: leg.direction,
        type: leg.type,
        amount: leg.amount,
        currency: posting.currency,
        description: leg.description,
      })),
    });

    return created.id;
  }
}

/**
 * Debits equal credits, every amount is positive, and there are at least two
 * legs.
 *
 * The positive-amount rule is not pedantry. A negative debit is a credit
 * wearing a disguise: it balances arithmetically while making every
 * `SUM(...) WHERE direction = 'debit'` in the system wrong, which is a far
 * worse failure than a rejected write. The database enforces it too.
 */
export function assertBalanced(posting: Posting): void {
  if (posting.legs.length < 2) {
    throw new InternalServerErrorException(
      `Ledger posting ${posting.key} has ${posting.legs.length} leg(s); ` +
        'a movement of money has at least two sides.',
    );
  }

  let debits = new Prisma.Decimal(0);
  let credits = new Prisma.Decimal(0);
  for (const leg of posting.legs) {
    if (leg.amount.lte(0)) {
      throw new InternalServerErrorException(
        `Ledger posting ${posting.key} has a non-positive amount ` +
          `${leg.amount.toString()}; use the direction to express the sign.`,
      );
    }
    if (leg.direction === 'debit') debits = debits.plus(leg.amount);
    else credits = credits.plus(leg.amount);
  }

  if (!debits.equals(credits)) {
    throw new InternalServerErrorException(
      `Ledger posting ${posting.key} does not balance: ` +
        `debits ${debits.toString()} vs credits ${credits.toString()}`,
    );
  }
}
