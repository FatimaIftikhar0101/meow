import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  STATUS_LABEL,
  formatAge,
  isTerminal,
  signOf,
  toneFor,
  type TransferStatus,
} from '../lib/transfers';

interface TimelineEvent {
  id: string;
  status: TransferStatus;
  message: string;
  createdAt: string;
}

interface LedgerLeg {
  id: string;
  direction: 'debit' | 'credit';
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  createdAt: string;
  accountId: string;
  accountKind: AccountKind;
  accountCode: string;
  isSenderWallet: boolean;
}

type AccountKind =
  | 'customer_wallet'
  | 'float'
  | 'transfer_suspense'
  | 'fee_revenue'
  | 'marketing_expense'
  | 'payout_settlement'
  | 'opening_balance';

interface LedgerPosting {
  postingId: string;
  key: string;
  createdAt: string;
  net: string;
  currency: string;
  entries: LedgerLeg[];
}

interface TransferDetailData {
  id: string;
  user: { id: string; email: string; country: string | null };
  recipient: {
    name: string;
    country: string;
    bankAccountMasked: string;
    bankName: string | null;
    bankCode: string | null;
  };
  savedRecipient: { name: string; bankAccountMasked: string } | null;
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  fxRateApplied: string | null;
  feeAmount: string;
  status: TransferStatus;
  failureReason: string | null;
  providerName: string | null;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  thresholdMinutes: number | null;
  overdue: boolean;
  timeline: TimelineEvent[];
  ledger: LedgerPosting[];
  walletNet: string;
  walletCurrency: string;
}

const LEDGER_TYPE_LABEL: Record<string, string> = {
  wallet_fund: 'Wallet funded',
  transfer_hold: 'Held for transfer',
  transfer_release: 'Released to payout',
  transfer_refund: 'Refunded',
  fee: 'Fee',
  fx_conversion: 'FX conversion',
  referral_bonus: 'Referral bonus',
};

/**
 * Where each leg landed, in words.
 *
 * The account codes are precise and unreadable at a glance — `suspense.transfer.CAD`
 * tells an accountant everything and a support agent nothing. These are for
 * the person on the phone to a customer; the code is still on screen for
 * anyone who needs it.
 */
const ACCOUNT_LABEL: Record<AccountKind, string> = {
  customer_wallet: 'Customer wallet',
  float: 'Our cash',
  transfer_suspense: 'In flight',
  fee_revenue: 'Fees earned',
  marketing_expense: 'Referral costs',
  payout_settlement: 'Paid to payout partner',
  opening_balance: 'Opening balance',
};

/**
 * One transfer, in enough detail to answer the question support is actually
 * asked: has the money left, and where is it now.
 *
 * A status alone cannot answer that. A transfer can read `payout_processing`
 * with the debit already posted, and it can read `failed` with the refund
 * already back in the wallet. The status describes the workflow; the ledger
 * describes the money. Both are on this page, next to each other, and where
 * they disagree that disagreement is the finding.
 */
export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transfer', id],
    queryFn: async () =>
      (await api.get<TransferDetailData>(`/admin/transfers/${id}`)).data,
    enabled: Boolean(id),
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['transfer', id] });
    void qc.invalidateQueries({ queryKey: ['transfers'] });
  };

  const retry = useMutation({
    mutationFn: async (reason: string) =>
      api.post(`/admin/transfers/${id}/retry`, { reason }),
    onSuccess: invalidate,
    onError: (e) => setError(errorMessage(e, 'Could not retry that transfer.')),
  });

  /**
   * Ask for a force-fail rather than perform one.
   *
   * Operations sees the stuck transfer and knows it needs killing, but killing
   * it refunds the sender and ends the attempt — so they hold `approval.request`
   * and not `transfer.force_fail`. Without this button the only thing they
   * could do with that knowledge was tell somebody in a chat message.
   */
  const requestFail = useMutation({
    mutationFn: async (reason: string) =>
      api.post('/admin/approvals', {
        action: 'transfer.force_fail',
        entityId: id,
        reason,
        payload: { reason },
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e) =>
      setError(errorMessage(e, 'Could not raise that request.')),
  });

  const forceFail = useMutation({
    mutationFn: async (reason: string) =>
      api.post(`/admin/transfers/${id}/force-fail`, { reason }),
    onSuccess: invalidate,
    onError: (e) => setError(errorMessage(e, 'Could not fail that transfer.')),
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (isError || !data) {
    return (
      <>
        <PageHeader title="Transfer" />
        <Alert>That transfer could not be loaded.</Alert>
      </>
    );
  }

  const live = !isTerminal(data.status);

  function onRetry() {
    const reason = window.prompt(
      'Why are you retrying this transfer? Recorded in the audit log.',
    );
    if (!reason) return;
    setError(null);
    retry.mutate(reason);
  }

  function onRequestFail() {
    const reason = window.prompt(
      'Why should this transfer be failed? A colleague with approval rights will read this and decide.',
    );
    if (!reason) return;
    setError(null);
    requestFail.mutate(reason);
  }

  function onForceFail() {
    const reason = window.prompt(
      'Why are you failing this transfer? The sender is refunded and this cannot be undone.',
    );
    if (!reason) return;
    setError(null);
    forceFail.mutate(reason);
  }

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-ink-muted underline hover:text-ink"
      >
        ← Back to transfers
      </button>

      <PageHeader
        title={`${data.sendAmount} ${data.sendCurrency} to ${data.recipient.name}`}
        subtitle={`Started ${new Date(data.createdAt).toLocaleString()} · ${data.id}`}
        action={
          <div className="flex items-center gap-2">
            {live && can('transfer.retry') && (
              <Button onClick={onRetry} busy={retry.isPending}>
                Retry
              </Button>
            )}
            {live && can('transfer.force_fail') && (
              <Button
                variant="danger"
                onClick={onForceFail}
                busy={forceFail.isPending}
              >
                Force fail
              </Button>
            )}
            {live &&
              !can('transfer.force_fail') &&
              can('approval.request') && (
                <Button
                  variant="secondary"
                  onClick={onRequestFail}
                  busy={requestFail.isPending}
                >
                  Request force-fail
                </Button>
              )}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {data.overdue && (
        <div className="mb-4">
          <Alert tone="pending">
            This has been in {STATUS_LABEL[data.status].toLowerCase()} for{' '}
            {formatAge(data.ageMinutes)}, past the{' '}
            {formatAge(data.thresholdMinutes ?? 0)} expected for that status.
          </Alert>
        </div>
      )}

      {data.failureReason && (
        <div className="mb-4">
          <Alert>Failure reason recorded: {data.failureReason}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">The transfer</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Status">
              <Pill tone={toneFor(data.status)}>
                {STATUS_LABEL[data.status]}
              </Pill>
              <span className="ml-2 text-ink-muted">
                for {formatAge(data.ageMinutes)}
              </span>
            </Row>
            <Row label="Sender">
              <Link
                to={`/customers/${data.user.id}`}
                className="text-ink underline decoration-line-strong underline-offset-2"
              >
                {data.user.email}
              </Link>
              {data.user.country && (
                <span className="ml-1.5 text-xs text-ink-faint">
                  {data.user.country}
                </span>
              )}
            </Row>
            <Row label="Sent">
              <span className="tabular">
                {data.sendAmount} {data.sendCurrency}
              </span>
            </Row>
            <Row label="Fee">
              <span className="tabular">
                {data.feeAmount} {data.sendCurrency}
              </span>
            </Row>
            <Row label="Rate">
              <span className="tabular">{data.fxRateApplied ?? '—'}</span>
            </Row>
            <Row label="Receives">
              <span className="tabular">
                {data.receiveAmount
                  ? `${data.receiveAmount} ${data.receiveCurrency}`
                  : '—'}
              </span>
            </Row>
            <Row label="Provider">
              {data.providerName ?? '—'}
              {data.providerRef && (
                <span className="ml-1.5 font-mono text-xs text-ink-faint">
                  {data.providerRef}
                </span>
              )}
            </Row>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Beneficiary</h2>
          <p className="mt-1 text-sm text-ink-muted">
            As recorded when the transfer was created — not the saved recipient
            as it stands today.
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Name">{data.recipient.name}</Row>
            <Row label="Country">{data.recipient.country}</Row>
            <Row label="Account">
              <span className="font-mono">
                {data.recipient.bankAccountMasked}
              </span>
            </Row>
            <Row label="Bank">
              {data.recipient.bankName ?? '—'}
              {data.recipient.bankCode && (
                <span className="ml-1.5 text-xs text-ink-faint">
                  {data.recipient.bankCode}
                </span>
              )}
            </Row>
          </dl>
          {data.savedRecipient &&
            data.savedRecipient.bankAccountMasked !==
              data.recipient.bankAccountMasked && (
              // Not a warning about this transfer — it went where it went. It
              // is a warning about the next one, and about anyone reading the
              // customer's recipient list to explain this transfer.
              <div className="mt-4">
                <Alert tone="pending">
                  The saved recipient has been edited since. It now reads{' '}
                  {data.savedRecipient.name} ·{' '}
                  {data.savedRecipient.bankAccountMasked}. This transfer went to
                  the account above.
                </Alert>
              </div>
            )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Timeline</h2>
          <p className="mt-1 text-sm text-ink-muted">
            What the workflow did, and when.
          </p>
          <ol className="mt-4 space-y-3">
            {data.timeline.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-line-strong"
                  aria-hidden
                />
                <div>
                  <div className="text-ink">{e.message}</div>
                  <div className="text-xs text-ink-faint">
                    {STATUS_LABEL[e.status]} ·{' '}
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">The money</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Every movement, both sides. Each posting balances: what left one
            account arrived in another.
          </p>

          <div className="mt-4 rounded-lg bg-inset px-4 py-3">
            <div className="text-xs text-ink-muted">
              Net effect on the sender&rsquo;s wallet
            </div>
            <div
              className={`tabular text-lg ${
                signOf(data.walletNet) < 0 ? 'text-ink' : 'text-success'
              }`}
            >
              {data.walletNet} {data.walletCurrency}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              {signOf(data.walletNet) < 0
                ? 'The money has left the wallet.'
                : signOf(data.walletNet) === 0
                  ? 'Everything taken has been returned.'
                  : 'More has been credited than debited.'}
            </div>
          </div>

          {!data.ledger.length ? (
            <Empty>No ledger postings.</Empty>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.ledger.map((posting) => (
                <li
                  key={posting.postingId}
                  className="rounded-lg border border-line p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-ink-faint">
                      {new Date(posting.createdAt).toLocaleString()}
                    </span>
                    <span className="tabular text-sm text-ink">
                      {signOf(posting.net) > 0 ? '+' : ''}
                      {posting.net} {posting.currency}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {posting.entries.map((leg) => (
                      <li
                        key={leg.id}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="text-ink-muted">
                          {LEDGER_TYPE_LABEL[leg.type] ?? leg.type}
                          <span
                            className="ml-1.5 text-xs text-ink-faint"
                            title={leg.accountCode}
                          >
                            {leg.isSenderWallet
                              ? 'sender'
                              : ACCOUNT_LABEL[leg.accountKind]}
                          </span>
                        </span>
                        <span className="tabular text-ink">
                          {leg.direction === 'debit' ? '−' : '+'}
                          {leg.amount} {leg.currency}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {/*
            The boundary is still worth stating on screen. Send-currency
            movements are fully double-entry; the receive-currency side of a
            transfer is recorded on the transfer itself and not in the ledger,
            because what that posting should look like depends on the payout
            partner's settlement model — whether we prefund a local float or
            they net against us. Guessing at it now would be worse than saying
            so. Backlog #45.
          */}
          <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">
            Both sides of every movement are shown, in{' '}
            {data.walletCurrency}. The {data.receiveCurrency} payout is recorded
            on the transfer above but not yet in the ledger — that arrives with
            the payout partner.
          </p>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
