import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAge } from '../lib/transfers';
import { useAskReason } from '../components/ReasonDialog';

type KycStatus = 'pending' | 'passed' | 'failed';

interface KycRow {
  id: string;
  userId: string;
  status: KycStatus;
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
  ageMinutes: number;
  overdue: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    country: string | null;
    suspended: boolean;
    createdAt: string;
  };
}

const TONE: Record<KycStatus, 'success' | 'pending' | 'danger'> = {
  pending: 'pending',
  passed: 'success',
  failed: 'danger',
};

/**
 * The identity queue.
 *
 * Same shape as the transfer queue and for the same reason: a case sitting
 * unreviewed for four days is a problem, one sitting for four minutes is not,
 * and a plain list cannot tell them apart. Pending first, oldest first —
 * a KYC case is a customer who cannot send money until somebody looks.
 *
 * Deciding and overturning are different buttons because they are different
 * acts. Settling an open case is the job (`kyc.decide`); reversing one already
 * settled substitutes a human judgement for a recorded one (`kyc.override`),
 * which is rarer, more serious, and what a reviewer will come looking for.
 */
export default function Kyc() {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const { can } = useAuth();
  const [status, setStatus] = useState<KycStatus | 'all'>('pending');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kyc', status],
    queryFn: async () =>
      (
        await api.get<{ items: KycRow[]; total: number }>('/admin/kyc', {
          params: status === 'all' ? {} : { status },
        })
      ).data,
    refetchInterval: 30_000,
  });

  const act = useMutation({
    mutationFn: async (vars: {
      userId: string;
      path: 'decide' | 'override';
      status: 'passed' | 'failed';
      reason: string;
    }) =>
      api.post(`/admin/users/${vars.userId}/kyc/${vars.path}`, {
        status: vars.status,
        reason: vars.reason,
      }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['kyc'] });
    },
    onError: (e) => setError(errorMessage(e, 'That decision did not go through.')),
  });

  async function decide(row: KycRow, next: 'passed' | 'failed') {
    const settled = row.status !== 'pending';
    const reason = await askReason({
      question: settled
        ? `This case was already ${row.status}. Overturning it is an override and is recorded as one. Why?`
        : next === 'passed'
          ? 'Why are you passing this customer? Recorded against your name.'
          : 'Why are you failing this check? The customer cannot send money.',
      confirmLabel: next === 'passed' ? 'Pass' : 'Fail',
      destructive: next === 'failed',
    });
    if (!reason) return;
    act.mutate({
      userId: row.userId,
      path: settled ? 'override' : 'decide',
      status: next,
      reason,
    });
  }

  const TABS: Array<{ key: KycStatus | 'all'; label: string }> = [
    { key: 'pending', label: 'Awaiting review' },
    { key: 'passed', label: 'Passed' },
    { key: 'failed', label: 'Failed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <>
      <PageHeader
        title="Identity"
        subtitle={data ? `${data.total} case${data.total === 1 ? '' : 's'}` : undefined}
        action={
          <div className="flex items-center gap-1 rounded-lg border border-field-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setStatus(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  status === t.key
                    ? 'bg-accent text-on-accent'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.items.length ? (
          <Empty>
            {status === 'pending'
              ? 'Nothing is waiting for review.'
              : 'No cases here.'}
          </Empty>
        ) : (
          <ul>
            {data.items.map((row) => {
              const name =
                [row.user.firstName, row.user.lastName]
                  .filter(Boolean)
                  .join(' ') || null;
              return (
                <li key={row.id} className="border-b border-line p-5 last:border-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/customers/${row.userId}`}
                          className="font-medium text-ink underline decoration-line-strong underline-offset-2"
                        >
                          {name ?? row.user.email}
                        </Link>
                        <Pill tone={TONE[row.status]}>{row.status}</Pill>
                        {row.overdue && <Pill tone="danger">Overdue</Pill>}
                      </div>

                      <p className="mt-1 text-sm text-ink-muted">
                        {row.user.email}
                        {row.user.country && ` · ${row.user.country}`} ·{' '}
                        raised {formatAge(row.ageMinutes)} ago
                      </p>

                      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                        <Fact label="Checked by" value={row.provider} />
                        <Fact label="Verified as" value={row.verifiedName} />
                        <Fact
                          label="Document"
                          value={
                            row.documentType
                              ? `${row.documentType.replace(/_/g, ' ')}${
                                  row.documentLast4
                                    ? ` ····${row.documentLast4}`
                                    : ''
                                }`
                              : null
                          }
                        />
                        <Fact label="Method" value={row.method} />
                        <Fact
                          label="Expires"
                          value={
                            row.documentExpiry
                              ? new Date(row.documentExpiry).toLocaleDateString()
                              : null
                          }
                        />
                        <Fact label="Note" value={row.reason} />
                      </dl>

                      {row.reviewedAt && (
                        <p className="mt-2 text-xs text-ink-muted">
                          Reviewed by a person on{' '}
                          {new Date(row.reviewedAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {row.status === 'pending' && can('kyc.decide') && (
                        <>
                          <Button onClick={() => void decide(row, 'passed')} busy={act.isPending}>
                            Pass
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => void decide(row, 'failed')}
                            busy={act.isPending}
                          >
                            Fail
                          </Button>
                        </>
                      )}
                      {row.status !== 'pending' && can('kyc.override') && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            decide(row, row.status === 'passed' ? 'failed' : 'passed')
                          }
                          busy={act.isPending}
                        >
                          Overturn
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/**
 * One piece of identity evidence, or an honest gap.
 *
 * The current provider is a mock and supplies none of this, so most of these
 * are empty today. Showing the label with an em dash rather than hiding the
 * row is deliberate: "we did not record this" is the finding, and a field that
 * silently disappears cannot be noticed.
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-ink">{value ?? <span className="text-ink-faint">—</span>}</dd>
    </div>
  );
}
