import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAge } from '../lib/transfers';
import { useAskReason } from '../components/ReasonDialog';

type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

interface ApprovalRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  status: ApprovalStatus;
  decisionReason: string | null;
  decidedAt: string | null;
  expiresAt: string;
  createdAt: string;
  requestedBy: { id: string; email: string };
  decidedBy: { id: string; email: string } | null;
}

const TONE: Record<ApprovalStatus, 'success' | 'pending' | 'danger' | 'neutral'> =
  {
    pending: 'pending',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'neutral',
    expired: 'neutral',
  };

const ACTION_LABEL: Record<string, string> = {
  'transfer.force_fail': 'Force-fail and refund',
};

/**
 * The four-eyes queue.
 *
 * Operations can see a stuck transfer and knows when it needs killing, but
 * force-failing one refunds the sender and ends the attempt — so they ask, and
 * somebody else decides. Everyone with `approval.request` can read this page,
 * because the person who asked should be able to see what happened to their
 * request without going to a colleague for the answer.
 *
 * The Approve and Reject buttons render only for `approval.decide`, and the
 * server refuses a maker deciding their own request regardless of what this
 * page shows — the check is in the service and again as a database constraint.
 */
export default function Approvals() {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const { can, profile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [onlyPending, setOnlyPending] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', onlyPending],
    queryFn: async () =>
      (
        await api.get<{ items: ApprovalRow[]; total: number }>(
          '/admin/approvals',
          { params: onlyPending ? { status: 'pending' } : {} },
        )
      ).data,
    refetchInterval: 15_000,
  });

  const decide = useMutation({
    mutationFn: async (vars: {
      id: string;
      verb: 'approve' | 'reject' | 'cancel';
      reason: string;
    }) => api.post(`/admin/approvals/${vars.id}/${vars.verb}`, { reason: vars.reason }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['approvals'] });
      void qc.invalidateQueries({ queryKey: ['transfers'] });
    },
    onError: (e) => setError(errorMessage(e, 'That decision did not go through.')),
  });

  async function act(row: ApprovalRow, verb: 'approve' | 'reject' | 'cancel') {
    const questions: Record<typeof verb, string> = {
      approve:
        'Why are you approving this? The action runs immediately and is recorded against your name.',
      reject: 'Why are you rejecting this? The person who asked will read it.',
      cancel: 'Why are you withdrawing your request?',
    };
    const labels: Record<typeof verb, string> = {
      approve: 'Approve',
      reject: 'Reject',
      cancel: 'Withdraw',
    };
    const reason = await askReason({
      question: questions[verb],
      confirmLabel: labels[verb],
      destructive: verb === 'reject',
    });
    if (!reason) return;
    decide.mutate({ id: row.id, verb, reason });
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={
          data ? `${data.total} ${onlyPending ? 'awaiting a decision' : 'total'}` : undefined
        }
        action={
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
              className="size-4 accent-accent"
            />
            Pending only
          </label>
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
            {onlyPending ? 'Nothing is waiting for a decision.' : 'No requests yet.'}
          </Empty>
        ) : (
          <ul>
            {data.items.map((row) => {
              const mine = row.requestedBy.id === profile?.userId;
              const ageMins = Math.round(
                (Date.now() - new Date(row.createdAt).getTime()) / 60000,
              );
              return (
                <li
                  key={row.id}
                  className="border-b border-line p-5 last:border-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">
                          {ACTION_LABEL[row.action] ?? row.action}
                        </span>
                        <Pill tone={TONE[row.status]}>{row.status}</Pill>
                      </div>

                      <p className="mt-1 text-sm text-ink">{row.reason}</p>

                      <p className="mt-2 text-xs text-ink-muted">
                        Asked by {mine ? 'you' : row.requestedBy.email} ·{' '}
                        {formatAge(ageMins)} ago ·{' '}
                        {row.entityType === 'transfer' ? (
                          <Link
                            to={`/transfers/${row.entityId}`}
                            className="underline decoration-line-strong underline-offset-2"
                          >
                            view the transfer
                          </Link>
                        ) : (
                          `${row.entityType} ${row.entityId}`
                        )}
                      </p>

                      {row.status === 'pending' && (
                        <p className="mt-1 text-xs text-ink-faint">
                          Expires {new Date(row.expiresAt).toLocaleString()}
                        </p>
                      )}

                      {row.decidedBy && (
                        <p className="mt-2 text-xs text-ink-muted">
                          {row.status} by {row.decidedBy.email}
                          {row.decisionReason && ` — ${row.decisionReason}`}
                        </p>
                      )}
                    </div>

                    {row.status === 'pending' && (
                      <div className="flex shrink-0 items-center gap-2">
                        {/* A maker cannot decide their own request; offering
                            the button and having the server refuse it would be
                            a worse way to say so. */}
                        {can('approval.decide') && !mine && (
                          <>
                            <Button
                              onClick={() => void act(row, 'approve')}
                              busy={decide.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => void act(row, 'reject')}
                              busy={decide.isPending}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {mine && (
                          <Button
                            variant="secondary"
                            onClick={() => void act(row, 'cancel')}
                            busy={decide.isPending}
                          >
                            Withdraw
                          </Button>
                        )}
                      </div>
                    )}
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
