import { useQuery } from '@tanstack/react-query';
import { Card, Empty, PageHeader, WorkRow } from '../components/ui';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

/**
 * The first thing a shift sees.
 *
 * Deliberately a worklist and not a dashboard. A dashboard answers "how are we
 * doing" — customers, lifetime volume, a chart trending up. Nobody signing
 * into a back office at nine in the morning needs that; they need to know what
 * has stopped moving overnight and who is waiting on a person. So the numbers
 * on this page are all counts of work, every one of them is a link into the
 * queue that holds it, and the good value for all of them is zero.
 *
 * The business figures still exist, at the bottom, small. Management asks for
 * them and they are worth having — they are just not what this screen is for,
 * and putting them at the top would make the page lie about its job.
 *
 * Each section is asked for separately and each is allowed to fail alone. A
 * compliance officer with no `transfer.read` sees the alerts they own rather
 * than an error, and one dead endpoint does not blank the page — the same
 * reasoning as `degraded` on the customer aggregate.
 */

interface Stats {
  users: number;
  transfers: number;
  inFlight: number;
  overdue: number;
  delivered: number;
  failed: number;
  totalDeliveredVolume: string;
}

/** A count from a paginated list endpoint, without pulling the rows. */
function useCount(
  key: string,
  url: string,
  params: Record<string, string>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [key, params],
    queryFn: async () =>
      (
        await api.get<{ total: number }>(url, {
          // pageSize 1: this screen wants the total, not the page. Asking for
          // the default 25 rows to read one number off them is work the
          // database does not need to do every 30 seconds on every desk.
          params: { ...params, pageSize: 1 },
        })
      ).data.total,
    enabled,
    refetchInterval: 30_000,
  });
}

export default function Overview() {
  const { profile, can } = useAuth();

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<Stats>('/admin/stats')).data,
    enabled: can('transfer.read'),
    refetchInterval: 30_000,
  });

  const alerts = useCount(
    'overview-alerts',
    '/admin/alerts',
    { status: 'open' },
    can('alert.read'),
  );
  const kyc = useCount(
    'overview-kyc',
    '/admin/kyc',
    { status: 'pending' },
    can('kyc.read'),
  );
  const approvals = useCount(
    'overview-approvals',
    '/admin/approvals',
    { status: 'pending' },
    can('approval.request'),
  );

  const firstName = profile?.email?.split('@')[0] ?? '';

  const rows = [
    can('transfer.read') && stats.data
      ? {
          count: stats.data.overdue,
          label: 'Transfers past their expected time',
          detail:
            'Still in a non-final status for longer than that status should take.',
          tone: 'danger' as const,
          to: '/transfers?aging=1',
        }
      : null,
    can('alert.read') && alerts.data !== undefined
      ? {
          count: alerts.data,
          label: 'Compliance alerts waiting on a decision',
          detail: 'Each needs clearing or escalating, with a reason either way.',
          tone: 'pending' as const,
          to: '/compliance',
        }
      : null,
    can('kyc.read') && kyc.data !== undefined
      ? {
          count: kyc.data,
          label: 'Identity checks to review',
          detail: 'Customers who cannot send until somebody looks.',
          tone: 'pending' as const,
          to: '/kyc',
        }
      : null,
    can('approval.request') && approvals.data !== undefined
      ? {
          count: approvals.data,
          label: 'Actions waiting on a second pair of eyes',
          detail: 'Requested by a colleague; somebody else has to decide.',
          tone: 'pending' as const,
          to: '/approvals',
        }
      : null,
  ].filter((r) => r !== null);

  const outstanding = rows.reduce((n, r) => n + r.count, 0);
  const loading =
    stats.isLoading || alerts.isLoading || kyc.isLoading || approvals.isLoading;

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={
          loading
            ? 'Checking the queues…'
            : rows.length === 0
              ? 'Nothing on this desk needs your attention.'
              : outstanding === 0
                ? 'Every queue is clear.'
                : `${outstanding} ${outstanding === 1 ? 'thing needs' : 'things need'} a person${firstName ? `, ${firstName}` : ''}.`
        }
      />

      <Card>
        {loading ? (
          <Empty>Loading…</Empty>
        ) : rows.length === 0 ? (
          <Empty>
            Your role does not open any of the queues this page watches.
          </Empty>
        ) : (
          rows.map((r) => (
            <WorkRow
              key={r.label}
              count={r.count}
              label={r.label}
              detail={r.detail}
              tone={r.tone}
              to={r.to}
            />
          ))
        )}
      </Card>

      {can('transfer.read') && stats.data && (
        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.04em] text-ink-faint uppercase">
            The business, for the record
          </h2>
          <dl className="flex flex-wrap gap-x-10 gap-y-4">
            <Figure label="Customers" value={String(stats.data.users)} />
            <Figure label="Transfers" value={String(stats.data.transfers)} />
            <Figure label="In flight" value={String(stats.data.inFlight)} />
            <Figure label="Delivered" value={String(stats.data.delivered)} />
            <Figure label="Failed" value={String(stats.data.failed)} />
            <Figure
              label="Delivered volume"
              value={stats.data.totalDeliveredVolume}
            />
          </dl>
        </section>
      )}
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="tabular mt-0.5 font-display text-xl text-ink">{value}</dd>
    </div>
  );
}
