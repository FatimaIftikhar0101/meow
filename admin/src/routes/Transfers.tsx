import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, PageHeader, Pill } from '../components/ui';
import api from '../lib/api';
import {
  STATUS_LABEL,
  formatAge,
  toneFor,
  type TransferStatus,
} from '../lib/transfers';

interface TransferRow {
  id: string;
  userId: string;
  userEmail: string;
  recipient: { name: string; country: string };
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string | null;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  thresholdMinutes: number | null;
  overdue: boolean;
}

interface Page {
  items: TransferRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The operations queue.
 *
 * This screen used to be a list of transfers newest first, which is the wrong
 * shape for the job done on it. An operations desk is not browsing; it is
 * looking for the transfers that have stopped moving. Newest first buries those
 * at the bottom by construction — the longer something has been wrong, the
 * further down it sits.
 *
 * So: an age on every row, an overdue filter that sorts oldest first, and a
 * search that takes the eight characters of a transfer id support quotes down
 * the phone.
 */
export default function Transfers() {
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [aging, setAging] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // Debouncing this would mean a keystroke's worth of state machinery for a
  // list of a few hundred rows on an office connection. Submitting on Enter
  // gets the same result with none of it.
  const [submittedQ, setSubmittedQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', status, aging, submittedQ, page],
    queryFn: async () =>
      (
        await api.get<Page>('/admin/transfers', {
          params: {
            ...(status ? { status } : {}),
            ...(aging ? { aging: true } : {}),
            ...(submittedQ ? { q: submittedQ } : {}),
            page,
          },
        })
      ).data,
    // In-flight transfers move on a timer server-side, so a stale board is
    // worse than a slightly chatty one.
    refetchInterval: 15_000,
  });

  function reset(fn: () => void) {
    fn();
    setPage(1);
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Transfers"
        subtitle={
          aging
            ? 'Past the threshold for the status they are in, longest first.'
            : data
              ? `${data.total} total`
              : 'Every transfer, newest first.'
        }
        action={
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as TransferStatus | ''))
              }
              className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink"
            >
              <option value="">All statuses</option>
              {(Object.keys(STATUS_LABEL) as TransferStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-pressed={aging}
              onClick={() => reset(() => setAging((v) => !v))}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                aging
                  ? 'border-danger bg-danger text-on-danger'
                  : 'border-field-border bg-card text-ink hover:bg-inset'
              }`}
            >
              Overdue only
            </button>
          </div>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset(() => setSubmittedQ(q.trim()));
        }}
        className="mb-4"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sender email, beneficiary name, or the start of a transfer id"
          aria-label="Search transfers"
          className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </form>

      <Card>
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : !data?.items.length ? (
          <Empty>
            {aging
              ? // The empty state that means everything is fine. Worth saying
                // out loud rather than showing the same shrug as a failed search.
                'Nothing is overdue. Every transfer in flight is inside the time expected for the status it is in.'
              : 'Nothing here.'}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-4 py-3 font-medium">Sender</th>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 text-right font-medium">Sent</th>
                  <th className="px-4 py-3 text-right font-medium">Received</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Age</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-line last:border-0 hover:bg-inset"
                  >
                    <td className="px-4 py-3">
                      {/* The whole row is the target, but the link carries the
                          text — a div with an onClick is not reachable by
                          keyboard and this panel is used by people who type. */}
                      <Link
                        to={`/transfers/${t.id}`}
                        className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"
                      >
                        {t.userEmail}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {t.recipient.name}
                      <span className="ml-1.5 text-xs text-ink-faint">
                        {t.recipient.country}
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ink">
                      {t.sendAmount} {t.sendCurrency}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ink-muted">
                      {t.receiveAmount
                        ? `${t.receiveAmount} ${t.receiveCurrency ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Pill tone={toneFor(t.status)}>
                        {STATUS_LABEL[t.status]}
                      </Pill>
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      <AgeCell row={t} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-field-border bg-card px-3 py-1.5 text-ink disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-ink-muted">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            className="rounded-lg border border-field-border bg-card px-3 py-1.5 text-ink disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}

/**
 * How long it has been sitting, and whether that is a problem.
 *
 * Terminal transfers get a muted age — "delivered four hours ago" is context,
 * not an alarm. Only a transfer still in flight past its threshold is marked,
 * and the threshold is named in the tooltip so nobody has to guess what the
 * screen thinks "late" means.
 */
function AgeCell({
  row,
}: {
  row: { ageMinutes: number; thresholdMinutes: number | null; overdue: boolean };
}) {
  const label = formatAge(row.ageMinutes);
  if (!row.overdue) {
    return <span className="text-ink-muted">{label}</span>;
  }
  return (
    <span
      className="font-medium text-danger"
      title={`Expected to clear this status within ${formatAge(
        row.thresholdMinutes ?? 0,
      )}.`}
    >
      {label}
    </span>
  );
}
