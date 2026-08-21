import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, PageHeader } from '../components/ui';
import api from '../lib/api';

interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Page {
  items: AuditRow[];
  total: number;
}

/**
 * The record of who did what.
 *
 * Before and after are shown side by side rather than as one merged blob: the
 * question this screen exists to answer is "what changed", and a reader should
 * not have to diff two JSON dumps in their head to see it.
 */
export default function Audit() {
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', action],
    queryFn: async () =>
      (await api.get<Page>('/admin/audit', { params: action ? { action } : {} }))
        .data,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={data ? `${data.total} entries` : undefined}
        action={
          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter by action, e.g. staff.role.assign"
            className="w-72 rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        }
      />

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.items.length ? (
          <Empty>No entries match.</Empty>
        ) : (
          <ul>
            {data.items.map((row) => (
              <li key={row.id} className="border-b border-line p-4 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-ink">{row.action}</span>
                  <span className="text-xs text-ink-muted">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {row.actorEmail ?? 'system'}
                  {row.entityType && (
                    <>
                      {' · '}
                      {row.entityType}
                      {row.entityId ? ` ${row.entityId.slice(0, 8)}` : ''}
                    </>
                  )}
                </p>
                {row.reason && (
                  <p className="mt-1.5 text-sm text-ink">“{row.reason}”</p>
                )}
                {(row.beforeValue !== null || row.afterValue !== null) && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <ValueBlock label="Before" value={row.beforeValue} />
                    <ValueBlock label="After" value={row.afterValue} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function ValueBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg bg-inset p-2.5">
      <p className="mb-1 text-ink-faint">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-ink-muted">
        {value === null || value === undefined
          ? '—'
          : JSON.stringify(value, null, 1)}
      </pre>
    </div>
  );
}
