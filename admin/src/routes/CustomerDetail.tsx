import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STATUS_LABEL, formatAge, toneFor, type TransferStatus } from '../lib/transfers';

interface CustomerOverview {
  profile: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
    role: string;
    suspended: boolean;
    emailVerified: boolean;
    authProvider: string;
    referralCode: string | null;
    createdAt: string;
    transferCount: number;
    recipientCount: number;
    referralCount: number;
  };
  balances: Array<{ accountId: string; currency: string; balance: string }>;
  kyc: Array<{
    id: string;
    status: string;
    provider: string | null;
    reason: string | null;
    verifiedAt: string | null;
    createdAt: string;
    verifiedName: string | null;
    documentType: string | null;
    documentLast4: string | null;
    documentExpiry: string | null;
    method: string | null;
    reviewedById: string | null;
    reviewedAt: string | null;
  }>;
  transfers: Array<{
    id: string;
    status: TransferStatus;
    sendAmount: string;
    sendCurrency: string;
    receiveAmount: string | null;
    receiveCurrency: string;
    feeAmount: string;
    createdAt: string;
    updatedAt: string;
    failureReason: string | null;
    recipientName: string;
    recipientCountry: string;
    recipientBankName: string | null;
    recipientBankAccountMasked: string;
  }>;
  sessions: Array<{
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; email: string };
  }>;
  /** Sections the server could not read. Shown per card, because an empty
   *  card and an unreadable one are different answers to a support agent. */
  degraded: string[];
  referrals: {
    referredBy: {
      id: string;
      status: string;
      code: string;
      rewardAmount: string | null;
      rewardCurrency: string | null;
      referrer: { id: string; email: string };
    } | null;
    made: Array<{
      id: string;
      status: string;
      rewardAmount: string | null;
      rewardCurrency: string | null;
      createdAt: string;
      referee: { id: string; email: string };
    }>;
  };
}

const KYC_TONE: Record<string, 'success' | 'pending' | 'danger' | 'neutral'> = {
  verified: 'success',
  pending: 'pending',
  in_review: 'pending',
  rejected: 'danger',
};

/**
 * One customer, in enough detail that support does not have to go looking.
 *
 * The question this page exists for is the one support is actually asked —
 * "where is my money, and why is it taking so long" — and answering it used to
 * mean three screens and a customer id held in your head. Everything needed is
 * here in one request: who they are, what the ledger says they hold, every
 * transfer with the beneficiary it actually went to, and what the last agent
 * wrote down.
 *
 * ── Account numbers are masked, and lifting the mask is an event ─────────────
 *
 * Every account number on this page arrives masked from the server; the full
 * one is never in the payload. Compliance can request one, with a reason, and
 * that request is logged against the record it named. The revealed value lives
 * in component state and nowhere else — leave the page and it is gone, which is
 * the intended lifetime. It is a thing you looked at once, not a thing the
 * screen holds while you go to lunch.
 */
export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState('');
  // Keyed by the entity revealed, so two reveals on one page do not overwrite
  // each other. Never written to storage.
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () =>
      (await api.get<CustomerOverview>(`/admin/customers/${id}`)).data,
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['customer', id] });
  };

  const reveal = useMutation({
    mutationFn: async (vars: { transferId: string; reason: string }) =>
      (
        await api.post<{ entityId: string; bankAccount: string }>(
          `/admin/customers/${id}/reveal`,
          { transferId: vars.transferId, reason: vars.reason },
        )
      ).data,
    onSuccess: (d) =>
      setRevealed((prev) => ({ ...prev, [d.entityId]: d.bankAccount })),
    onError: (e) =>
      setError(errorMessage(e, 'Could not reveal that account number.')),
  });

  const addNote = useMutation({
    mutationFn: async (body: string) =>
      api.post(`/admin/customers/${id}/notes`, { body }),
    onSuccess: () => {
      setNoteBody('');
      invalidate();
    },
    onError: (e) => setError(errorMessage(e, 'Could not save that note.')),
  });

  const suspend = useMutation({
    mutationFn: async (vars: { suspend: boolean; reason: string }) =>
      api.post(
        `/admin/users/${id}/${vars.suspend ? 'suspend' : 'unsuspend'}`,
        { reason: vars.reason },
      ),
    onSuccess: invalidate,
    onError: (e) =>
      setError(errorMessage(e, 'Could not change that account.')),
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (isError || !data) {
    return (
      <>
        <PageHeader title="Customer" />
        <Alert>That customer could not be loaded.</Alert>
      </>
    );
  }

  const { profile } = data;
  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;
  const latestKyc = data.kyc[0];

  function onReveal(transferId: string) {
    const reason = window.prompt(
      'Why do you need the full account number? Recorded in the audit log against this transfer.',
    );
    if (!reason) return;
    setError(null);
    reveal.mutate({ transferId, reason });
  }

  function onSuspend(next: boolean) {
    const reason = window.prompt(
      next
        ? 'Why are you suspending this account? They will not be able to send money.'
        : 'Why are you restoring this account?',
    );
    if (!reason) return;
    setError(null);
    suspend.mutate({ suspend: next, reason });
  }

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-ink-muted underline hover:text-ink"
      >
        ← Back
      </button>

      <PageHeader
        title={name ?? profile.email}
        subtitle={`Joined ${new Date(profile.createdAt).toLocaleDateString()} · ${profile.id}`}
        action={
          <div className="flex items-center gap-2">
            {!profile.suspended && can('customer.suspend') && (
              <Button
                variant="danger"
                onClick={() => onSuspend(true)}
                busy={suspend.isPending}
              >
                Suspend
              </Button>
            )}
            {profile.suspended && can('customer.unsuspend') && (
              <Button onClick={() => onSuspend(false)} busy={suspend.isPending}>
                Restore
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

      {profile.suspended && (
        <div className="mb-4">
          <Alert>
            This account is suspended and cannot send money.
          </Alert>
        </div>
      )}

      {!profile.emailVerified && (
        <div className="mb-4">
          <Alert tone="pending">
            Email address has never been verified.
          </Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Who they are</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Email">{profile.email}</Row>
            <Row label="Name">{name ?? <Muted>Not given</Muted>}</Row>
            <Row label="Country">
              {profile.country ?? <Muted>Not given</Muted>}
            </Row>
            <Row label="Signs in with">
              {profile.authProvider === 'google' ? 'Google' : 'Password'}
            </Row>
            <Row label="Email verified">
              {profile.emailVerified ? (
                <Pill tone="success">Verified</Pill>
              ) : (
                <Pill tone="danger">No</Pill>
              )}
            </Row>
            <Row label="Referral code">
              {profile.referralCode ?? <Muted>None</Muted>}
            </Row>
            <Row label="Transfers">{profile.transferCount}</Row>
            <Row label="Saved recipients">{profile.recipientCount}</Row>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">What they hold</h2>
          {/* Derived from the ledger, not a stored figure — this is the sum of
              their entries, so it cannot drift from what the ledger says. */}
          {data.balances.length === 0 ? (
            <Empty>No wallet yet.</Empty>
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              {data.balances.map((b) => (
                <Row key={b.accountId} label={b.currency}>
                  <span className="tabular font-medium">{b.balance}</span>
                </Row>
              ))}
            </dl>
          )}

          <h3 className="mt-6 font-display text-base text-ink">Identity</h3>
          {!latestKyc ? (
            <Empty>No verification on file.</Empty>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Status">
                <Pill tone={KYC_TONE[latestKyc.status] ?? 'neutral'}>
                  {latestKyc.status.replace(/_/g, ' ')}
                </Pill>
              </Row>
              <Row label="Checked by">
                {latestKyc.provider ?? <Muted>—</Muted>}
              </Row>
              {latestKyc.verifiedName && (
                <Row label="Verified as">{latestKyc.verifiedName}</Row>
              )}
              {latestKyc.documentType && (
                <Row label="Document">
                  {latestKyc.documentType.replace(/_/g, ' ')}
                  {latestKyc.documentLast4 && ` ····${latestKyc.documentLast4}`}
                </Row>
              )}
              {latestKyc.reason && <Row label="Note">{latestKyc.reason}</Row>}
              <Row label="Verified">
                {latestKyc.verifiedAt ? (
                  new Date(latestKyc.verifiedAt).toLocaleString()
                ) : (
                  <Muted>Not yet</Muted>
                )}
              </Row>
            </dl>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-lg text-ink">Transfers</h2>
          <span className="text-xs text-ink-muted">
            {data.transfers.length === 20
              ? 'Most recent 20'
              : `${data.transfers.length} total`}
          </span>
        </div>
        {data.transfers.length === 0 ? (
          <Empty>This customer has never sent money.</Empty>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium">To</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {data.transfers.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <td className="tabular px-4 py-3 text-ink">
                    <Link
                      to={`/transfers/${t.id}`}
                      className="underline decoration-line-strong underline-offset-2"
                    >
                      {t.sendAmount} {t.sendCurrency}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {t.recipientName}
                    <span className="ml-1 text-ink-muted">
                      ({t.recipientCountry})
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-ink-muted">
                    {revealed[t.id] ? (
                      <span className="text-ink">{revealed[t.id]}</span>
                    ) : (
                      <>
                        {t.recipientBankAccountMasked}
                        {can('customer.pii_full') && (
                          <button
                            onClick={() => onReveal(t.id)}
                            disabled={reveal.isPending}
                            className="ml-2 text-xs underline hover:text-ink disabled:opacity-50"
                          >
                            reveal
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={toneFor(t.status)}>
                      {STATUS_LABEL[t.status]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatAge(
                      Math.round(
                        (Date.now() - new Date(t.createdAt).getTime()) / 60000,
                      ),
                    )}{' '}
                    ago
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-ink">Notes</h2>
          <p className="mt-1 text-sm text-ink-muted">
            What the last agent learned that no other table records.
          </p>

          {can('customer.note') && (
            <div className="mt-4">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What happened on this contact?"
                className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={() => addNote.mutate(noteBody.trim())}
                  busy={addNote.isPending}
                  disabled={noteBody.trim().length === 0}
                >
                  Add note
                </Button>
              </div>
            </div>
          )}

          {data.degraded.includes('notes') ? (
            <Unavailable what="notes" />
          ) : data.notes.length === 0 ? (
            <Empty>No notes yet.</Empty>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.notes.map((n) => (
                <li key={n.id} className="border-t border-line pt-3 text-sm">
                  <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {n.author.email} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-lg text-ink">Sessions</h2>
            {data.degraded.includes('sessions') ? (
              <Unavailable what="sessions" />
            ) : data.sessions.length === 0 ? (
              <Empty>Never signed in.</Empty>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {data.sessions.map((s) => (
                  <li key={s.id} className="border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-ink">
                        {s.userAgent ?? 'Unknown device'}
                      </span>
                      {s.revokedAt ? (
                        <Pill tone="neutral">Signed out</Pill>
                      ) : new Date(s.expiresAt) < new Date() ? (
                        <Pill tone="neutral">Expired</Pill>
                      ) : (
                        <Pill tone="success">Active</Pill>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {s.ipAddress ?? 'no IP'} · last seen{' '}
                      {new Date(s.lastSeenAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg text-ink">Referrals</h2>
            {data.degraded.includes('referrals') && (
              <Unavailable what="referrals" />
            )}
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Referred by">
                {data.referrals.referredBy ? (
                  <Link
                    to={`/customers/${data.referrals.referredBy.referrer.id}`}
                    className="underline decoration-line-strong underline-offset-2"
                  >
                    {data.referrals.referredBy.referrer.email}
                  </Link>
                ) : (
                  <Muted>Nobody</Muted>
                )}
              </Row>
              <Row label="Has referred">{profile.referralCount}</Row>
            </dl>
            {data.referrals.made.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {data.referrals.made.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-baseline justify-between gap-3 border-t border-line pt-2"
                  >
                    <Link
                      to={`/customers/${r.referee.id}`}
                      className="truncate text-ink underline decoration-line-strong underline-offset-2"
                    >
                      {r.referee.email}
                    </Link>
                    <span className="shrink-0 text-ink-muted">
                      {r.rewardAmount
                        ? `${r.rewardAmount} ${r.rewardCurrency ?? ''}`
                        : r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg text-ink">
              Recent notifications
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              What this customer has actually been told.
            </p>
            {data.degraded.includes('notifications') ? (
              <Unavailable what="notifications" />
            ) : data.notifications.length === 0 ? (
              <Empty>Nothing sent yet.</Empty>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {data.notifications.map((n) => (
                  <li key={n.id} className="border-t border-line pt-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-ink">{n.title}</span>
                      {!n.read && <Pill tone="pending">Unread</Pill>}
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
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

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

/**
 * Shown in place of a card's contents when the server could not read it.
 *
 * Not an empty state. "Nothing here" and "we could not look" are different
 * answers, and an agent shown the first while the second is true will tell a
 * customer something untrue and mean it.
 */
function Unavailable({ what }: { what: string }) {
  return (
    <div className="mt-4">
      <Alert tone="pending">
        Could not load {what}. This card is empty because the request failed,
        not because there is nothing to show.
      </Alert>
    </div>
  );
}
