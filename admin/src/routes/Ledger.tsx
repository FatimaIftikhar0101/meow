import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Card, Empty, PageHeader, Pill } from '../components/ui';
import api from '../lib/api';

type AccountKind =
  | 'customer_wallet'
  | 'float'
  | 'transfer_suspense'
  | 'fee_revenue'
  | 'marketing_expense'
  | 'payout_settlement'
  | 'opening_balance';

interface AccountRow {
  id: string;
  kind: AccountKind;
  code: string;
  currency: string;
  debit: string;
  credit: string;
  balance: string;
}

interface AccountsResponse {
  accounts: AccountRow[];
  customerWallets: Array<{
    currency: string;
    accountCount: number;
    debit: string;
    credit: string;
    balance: string;
  }>;
}

interface TrialRow {
  currency: string;
  debit: string;
  credit: string;
  difference: string;
  balanced: boolean;
}

interface PostingRow {
  id: string;
  key: string;
  currency: string;
  transferId: string | null;
  createdAt: string;
  net: string;
  balanced: boolean;
  entries: Array<{
    id: string;
    direction: 'debit' | 'credit';
    type: string;
    amount: string;
    currency: string;
    description: string | null;
    account: { id: string; kind: AccountKind; code: string };
  }>;
}

const ACCOUNT_LABEL: Record<AccountKind, string> = {
  customer_wallet: 'Customer wallets',
  float: 'Our cash',
  transfer_suspense: 'In flight',
  fee_revenue: 'Fees earned',
  marketing_expense: 'Referral costs',
  payout_settlement: 'Paid to payout partner',
  opening_balance: 'Opening balance',
};

const KIND_NOTE: Record<AccountKind, string> = {
  customer_wallet: 'What we owe customers',
  float: 'Our own money',
  transfer_suspense: 'Committed but not delivered — should trend to zero',
  fee_revenue: 'What the business has earned',
  marketing_expense: 'Referral bonuses paid out',
  payout_settlement: 'Delivered to the payout side',
  opening_balance: 'History whose other side predates double-entry',
};

/**
 * The books.
 *
 * The transfer detail page answers "what happened to this payment". It cannot
 * answer "what do we hold", "what is in flight", or "what have we earned" —
 * and those are the questions somebody asks before signing anything.
 *
 * Read-only, deliberately. Corrections to a ledger are reversing entries posted
 * by the operation that got it wrong, never an edit from a screen.
 */
export default function Ledger() {
  const [kind, setKind] = useState<AccountKind | 'all'>('all');

  const trial = useQuery({
    queryKey: ['ledger', 'trial'],
    queryFn: async () =>
      (await api.get<TrialRow[]>('/admin/ledger/trial-balance')).data,
  });

  const accounts = useQuery({
    queryKey: ['ledger', 'accounts'],
    queryFn: async () =>
      (await api.get<AccountsResponse>('/admin/ledger/accounts')).data,
  });

  const postings = useQuery({
    queryKey: ['ledger', 'postings', kind],
    queryFn: async () =>
      (
        await api.get<{ items: PostingRow[]; total: number }>(
          '/admin/ledger/postings',
          { params: kind === 'all' ? {} : { kind } },
        )
      ).data,
  });

  const unbalanced = trial.data?.filter((t) => !t.balanced) ?? [];

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle="Every movement, and both sides of it"
      />

      {/* The one number on this screen that should never be false. If a
          currency does not balance, money has been recorded as coming from
          nowhere, and nothing else here matters until that is explained. */}
      {unbalanced.length > 0 && (
        <div className="mb-4">
          <Alert>
            {unbalanced.length === 1
              ? `${unbalanced[0].currency} does not balance — a difference of ${unbalanced[0].difference}.`
              : `${unbalanced.length} currencies do not balance.`}{' '}
            Money has been recorded as coming from nowhere. Nothing else on this
            page can be relied on until this is explained.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Trial balance</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Debits and credits per currency. A posting cannot span currencies, so
            each of these must come to zero.
          </p>
          {trial.isLoading ? (
            <Empty>Loading…</Empty>
          ) : !trial.data?.length ? (
            <Empty>Nothing posted yet.</Empty>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="py-2 font-medium">Currency</th>
                  <th className="py-2 text-right font-medium">Debits</th>
                  <th className="py-2 text-right font-medium">Credits</th>
                  <th className="py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {trial.data.map((t) => (
                  <tr key={t.currency} className="border-b border-line last:border-0">
                    <td className="py-2 text-ink">{t.currency}</td>
                    <td className="tabular py-2 text-right text-ink-muted">
                      {t.debit}
                    </td>
                    <td className="tabular py-2 text-right text-ink-muted">
                      {t.credit}
                    </td>
                    <td className="py-2 text-right">
                      {t.balanced ? (
                        <Pill tone="success">balanced</Pill>
                      ) : (
                        <Pill tone="danger">{t.difference}</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Chart of accounts</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Credit minus debit throughout, so the column sums to zero. Money we
            hold reads negative; money we owe reads positive.
          </p>
          {accounts.isLoading ? (
            <Empty>Loading…</Empty>
          ) : (
            <div className="mt-4 space-y-1">
              {accounts.data?.customerWallets.map((w) => (
                <AccountLine
                  key={`wallets-${w.currency}`}
                  label={`${ACCOUNT_LABEL.customer_wallet} (${w.accountCount})`}
                  note={KIND_NOTE.customer_wallet}
                  currency={w.currency}
                  balance={w.balance}
                />
              ))}
              {accounts.data?.accounts
                .filter((a) => a.balance !== '0.00')
                .map((a) => (
                  <AccountLine
                    key={a.id}
                    label={ACCOUNT_LABEL[a.kind]}
                    note={KIND_NOTE[a.kind]}
                    currency={a.currency}
                    balance={a.balance}
                    code={a.code}
                  />
                ))}
              {accounts.data &&
                accounts.data.accounts.every((a) => a.balance === '0.00') &&
                accounts.data.customerWallets.length === 0 && (
                  <Empty>No movements yet.</Empty>
                )}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="font-display text-lg text-ink">Postings</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Grouped, never as loose entries — an entry on its own says money
              moved and not where from.
            </p>
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as AccountKind | 'all')}
            className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="all">Every account</option>
            {(Object.keys(ACCOUNT_LABEL) as AccountKind[]).map((k) => (
              <option key={k} value={k}>
                {ACCOUNT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        {postings.isLoading ? (
          <Empty>Loading…</Empty>
        ) : !postings.data?.items.length ? (
          <Empty>Nothing posted here yet.</Empty>
        ) : (
          <ul className="mt-4">
            {postings.data.items.map((p) => (
              <li key={p.id} className="border-b border-line px-5 py-4 last:border-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-xs text-ink-muted">{p.key}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    {!p.balanced && <Pill tone="danger">does not balance</Pill>}
                    {p.transferId && (
                      <Link
                        to={`/transfers/${p.transferId}`}
                        className="underline decoration-line-strong underline-offset-2"
                      >
                        transfer
                      </Link>
                    )}
                    {new Date(p.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {p.entries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-ink">
                        {e.direction === 'debit' ? 'Dr' : 'Cr'}{' '}
                        {ACCOUNT_LABEL[e.account.kind]}
                        <span className="ml-2 font-mono text-xs text-ink-faint">
                          {e.account.code}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-ink">
                        {e.direction === 'debit' ? '−' : '+'}
                        {e.amount} {e.currency}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AccountLine({
  label,
  note,
  currency,
  balance,
  code,
}: {
  label: string;
  note: string;
  currency: string;
  balance: string;
  code?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-ink">
          {label}
          <span className="ml-2 text-xs text-ink-muted">{currency}</span>
        </p>
        <p className="text-xs text-ink-faint">
          {note}
          {code && ` · ${code}`}
        </p>
      </div>
      <span className="tabular shrink-0 text-sm font-medium text-ink">
        {balance}
      </span>
    </div>
  );
}
