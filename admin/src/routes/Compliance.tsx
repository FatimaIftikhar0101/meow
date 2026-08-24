import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatAge } from '../lib/transfers';
import { useAskReason } from '../components/ReasonDialog';
import { LIMITS } from '../lib/limits';

type AlertSeverity = 'low' | 'medium' | 'high';
type AlertStatus = 'open' | 'cleared' | 'escalated';
type BlocklistKind = 'name' | 'account' | 'country' | 'email';

interface AlertRow {
  id: string;
  rule: string;
  severity: AlertSeverity;
  status: AlertStatus;
  detail: Record<string, unknown>;
  createdAt: string;
  transferId: string | null;
  adjudicationReason: string | null;
  user: { id: string; email: string };
  adjudicatedBy: { id: string; email: string } | null;
  case: { id: string; reference: string; status: string } | null;
}

interface CaseRow {
  id: string;
  reference: string;
  status: 'open' | 'closed';
  summary: string;
  createdAt: string;
  closedReason: string | null;
  user: { id: string; email: string };
  openedBy: { id: string; email: string };
  closedBy: { id: string; email: string } | null;
  _count: { alerts: number };
}

interface BlocklistRow {
  id: string;
  kind: BlocklistKind;
  display: string;
  reason: string;
  active: boolean;
  createdAt: string;
  addedBy: { id: string; email: string };
  deactivatedBy: { id: string; email: string } | null;
}

const RULE_LABEL: Record<string, string> = {
  large_amount: 'Large payment',
  velocity: 'Many payments in a day',
  structuring: 'Payments kept under the threshold',
  unknown_corridor: 'Destination with no corridor',
};

const RULE_NOTE: Record<string, string> = {
  large_amount: 'One payment big enough to be worth a look.',
  velocity: 'More payments in 24 hours than is ordinary for one customer.',
  structuring:
    'Several payments that each stay under the reporting threshold and together cross it. A single payment over the line is declared and unremarkable; this is a decision somebody made.',
  unknown_corridor:
    'Sent somewhere the business has no configured corridor for.',
};

const SEVERITY_TONE: Record<AlertSeverity, 'danger' | 'pending' | 'neutral'> = {
  high: 'danger',
  medium: 'pending',
  low: 'neutral',
};

/**
 * Financial crime: the queue, the files, and the list that refuses.
 *
 * Three tabs rather than three pages, because the work moves between them
 * constantly — an alert becomes a case, a case ends with a name going on the
 * blocklist — and making that three navigations would make it feel like three
 * jobs.
 *
 * An alert is not a finding. Most are cleared, and the record of a cleared
 * alert (who looked, when, what satisfied them) is as much of the evidence as
 * the ones that become cases. That is why clearing asks for a reason too.
 */
export default function Compliance() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'alerts' | 'cases' | 'blocklist'>('alerts');
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { key: 'alerts' as const, label: 'Alerts', permission: 'alert.read' as const },
    { key: 'cases' as const, label: 'Cases', permission: 'case.manage' as const },
    {
      key: 'blocklist' as const,
      label: 'Blocklist',
      permission: 'blocklist.read' as const,
    },
  ].filter((t) => can(t.permission));

  return (
    <>
      <PageHeader
        title="Compliance"
        action={
          <div className="flex items-center gap-1 rounded-lg border border-field-border bg-card p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  tab === t.key
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

      {tab === 'alerts' && <Alerts onError={setError} />}
      {tab === 'cases' && <Cases onError={setError} />}
      {tab === 'blocklist' && <Blocklist onError={setError} />}
    </>
  );
}

function Alerts({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const { can } = useAuth();
  const [openOnly, setOpenOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', openOnly],
    queryFn: async () =>
      (
        await api.get<{ items: AlertRow[]; total: number }>('/admin/alerts', {
          params: openOnly ? { status: 'open' } : {},
        })
      ).data,
    refetchInterval: 30_000,
  });

  const adjudicate = useMutation({
    mutationFn: async (vars: {
      id: string;
      status: 'cleared' | 'escalated';
      reason: string;
    }) => api.post(`/admin/alerts/${vars.id}/adjudicate`, vars),
    onSuccess: () => {
      onError(null);
      void qc.invalidateQueries({ queryKey: ['alerts'] });
      void qc.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (e) => onError(errorMessage(e, 'That decision did not go through.')),
  });

  async function act(row: AlertRow, status: 'cleared' | 'escalated') {
    const reason = await askReason({
      question:
      status === 'cleared'
        ? 'What satisfied you that this is fine? Recorded against your name — an alert cleared without a reason records only that it disappeared.'
        : 'Why are you escalating this?',
      confirmLabel: status === 'cleared' ? 'Clear alert' : 'Escalate',
      destructive: status === 'escalated',
      maxLength: LIMITS.reasonLong,
    });
    if (!reason) return;
    adjudicate.mutate({ id: row.id, status, reason });
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-5 pt-5">
        <p className="text-sm text-ink-muted">
          {data ? `${data.total} alert${data.total === 1 ? '' : 's'}` : ' '}
        </p>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => setOpenOnly(e.target.checked)}
            className="size-4 accent-accent"
          />
          Open only
        </label>
      </div>

      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !data?.items.length ? (
        <Empty>{openOnly ? 'Nothing to review.' : 'No alerts yet.'}</Empty>
      ) : (
        <ul className="mt-3">
          {data.items.map((row) => (
            <li key={row.id} className="border-b border-line p-5 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">
                      {RULE_LABEL[row.rule] ?? row.rule}
                    </span>
                    <Pill tone={SEVERITY_TONE[row.severity]}>{row.severity}</Pill>
                    {row.status !== 'open' && (
                      <Pill tone="neutral">{row.status}</Pill>
                    )}
                    {row.case && (
                      <Pill tone="pending">{row.case.reference}</Pill>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-ink-muted">
                    {RULE_NOTE[row.rule] ?? 'A rule fired on this payment.'}
                  </p>

                  <p className="mt-2 text-xs text-ink-muted">
                    <Link
                      to={`/customers/${row.user.id}`}
                      className="underline decoration-line-strong underline-offset-2"
                    >
                      {row.user.email}
                    </Link>
                    {row.transferId && (
                      <>
                        {' · '}
                        <Link
                          to={`/transfers/${row.transferId}`}
                          className="underline decoration-line-strong underline-offset-2"
                        >
                          the payment
                        </Link>
                      </>
                    )}
                    {' · '}
                    {formatAge(
                      Math.round(
                        (Date.now() - new Date(row.createdAt).getTime()) / 60000,
                      ),
                    )}{' '}
                    ago
                  </p>

                  {/* What the rule saw, so a reviewer does not have to
                      re-derive it from data that may since have changed. */}
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-inset px-3 py-2 font-mono text-xs text-ink-muted">
                    {JSON.stringify(row.detail, null, 2)}
                  </pre>

                  {row.adjudicatedBy && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {row.status} by {row.adjudicatedBy.email}
                      {row.adjudicationReason && ` — ${row.adjudicationReason}`}
                    </p>
                  )}
                </div>

                {row.status === 'open' && can('alert.adjudicate') && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void act(row, 'cleared')}
                      busy={adjudicate.isPending}
                    >
                      Clear
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void act(row, 'escalated')}
                      busy={adjudicate.isPending}
                    >
                      Escalate
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Cases({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const { data, isLoading } = useQuery({
    queryKey: ['cases'],
    queryFn: async () =>
      (await api.get<{ items: CaseRow[]; total: number }>('/admin/cases')).data,
  });

  const close = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) =>
      api.post(`/admin/cases/${vars.id}/close`, { reason: vars.reason }),
    onSuccess: () => {
      onError(null);
      void qc.invalidateQueries({ queryKey: ['cases'] });
    },
    onError: (e) => onError(errorMessage(e, 'Could not close that case.')),
  });

  return (
    <Card>
      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !data?.items.length ? (
        <Empty>No cases have been opened.</Empty>
      ) : (
        <ul>
          {data.items.map((c) => (
            <li key={c.id} className="border-b border-line p-5 last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-ink">
                      {c.reference}
                    </span>
                    <Pill tone={c.status === 'open' ? 'pending' : 'neutral'}>
                      {c.status}
                    </Pill>
                    <span className="text-xs text-ink-muted">
                      {c._count.alerts} alert
                      {c._count.alerts === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{c.summary}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    <Link
                      to={`/customers/${c.user.id}`}
                      className="underline decoration-line-strong underline-offset-2"
                    >
                      {c.user.email}
                    </Link>{' '}
                    · opened by {c.openedBy.email} on{' '}
                    {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                  {c.closedBy && (
                    <p className="mt-1 text-xs text-ink-muted">
                      Closed by {c.closedBy.email}
                      {c.closedReason && ` — ${c.closedReason}`}
                    </p>
                  )}
                </div>

                {c.status === 'open' && (
                  <Button
                    variant="secondary"
                    busy={close.isPending}
                    onClick={() => {
                      void (async () => {
                        const reason = await askReason({
                          question:
                            'How was this case resolved? Every alert attached to it must be adjudicated first.',
                          confirmLabel: 'Close case',
                          maxLength: LIMITS.reasonLong,
                        });
                        if (!reason) return;
                        close.mutate({ id: c.id, reason });
                      })();
                    }}
                  >
                    Close
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Blocklist({ onError }: { onError: (m: string | null) => void }) {
  const qc = useQueryClient();
  const askReason = useAskReason();
  const { can } = useAuth();
  const [showInactive, setShowInactive] = useState(false);
  const [kind, setKind] = useState<BlocklistKind>('name');
  const [display, setDisplay] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['blocklist', showInactive],
    queryFn: async () =>
      (
        await api.get<BlocklistRow[]>('/admin/blocklist', {
          params: showInactive ? { includeInactive: 'true' } : {},
        })
      ).data,
  });

  const invalidate = () => {
    onError(null);
    setDisplay('');
    void qc.invalidateQueries({ queryKey: ['blocklist'] });
  };

  const add = useMutation({
    mutationFn: async (vars: {
      kind: BlocklistKind;
      display: string;
      reason: string;
    }) => api.post('/admin/blocklist', vars),
    onSuccess: invalidate,
    onError: (e) => onError(errorMessage(e, 'Could not add that entry.')),
  });

  const remove = useMutation({
    mutationFn: async (vars: { id: string; reason: string }) =>
      api.post(`/admin/blocklist/${vars.id}/remove`, { reason: vars.reason }),
    onSuccess: invalidate,
    onError: (e) => onError(errorMessage(e, 'Could not remove that entry.')),
  });

  return (
    <Card className="p-5">
      <p className="text-sm text-ink-muted">
        Payments to anything on this list are refused outright — before the
        transfer exists, so nothing is written and nothing needs unwinding. The
        sender is not told which detail matched.
      </p>

      {can('blocklist.write') && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BlocklistKind)}
            className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="name">Beneficiary name</option>
            <option value="account">Account number</option>
            <option value="country">Country</option>
            <option value="email">Email</option>
          </select>
          <input
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
            maxLength={LIMITS.blocklistValue}
            placeholder="Value to block"
            className="w-64 rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Button
            busy={add.isPending}
            disabled={!display.trim()}
            onClick={() => {
              void (async () => {
                const reason = await askReason({
                  question: 'Why is this being blocked?',
                  confirmLabel: 'Block',
                  destructive: true,
                  maxLength: LIMITS.reasonLong,
                });
                if (!reason) return;
                add.mutate({ kind, display: display.trim(), reason });
              })();
            }}
          >
            Add
          </Button>
          <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="size-4 accent-accent"
            />
            Show removed
          </label>
        </div>
      )}

      {isLoading ? (
        <Empty>Loading…</Empty>
      ) : !data?.length ? (
        <Empty>Nothing is blocked.</Empty>
      ) : (
        <ul className="mt-4">
          {data.map((b) => (
            <li
              key={b.id}
              className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink">{b.display}</span>
                  <Pill tone="neutral">{b.kind}</Pill>
                  {!b.active && <Pill tone="neutral">removed</Pill>}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {b.reason} · added by {b.addedBy.email} on{' '}
                  {new Date(b.createdAt).toLocaleDateString()}
                  {b.deactivatedBy && ` · removed by ${b.deactivatedBy.email}`}
                </p>
              </div>
              {b.active && can('blocklist.write') && (
                <Button
                  variant="secondary"
                  busy={remove.isPending}
                  onClick={() => {
                    void (async () => {
                      const reason = await askReason({
                        question:
                          'Why is this being taken off the list? Somebody other than whoever added it must do this.',
                        confirmLabel: 'Remove',
                        maxLength: LIMITS.reasonLong,
                      });
                      if (!reason) return;
                      remove.mutate({ id: b.id, reason });
                    })();
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
