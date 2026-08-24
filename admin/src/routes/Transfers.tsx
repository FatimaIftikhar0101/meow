import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { StageRail } from '../components/StageRail';
import {
  Card,
  Empty,
  Mono,
  PageHeader,
  Table,
  Td,
  Th,
  Toolbar,
  Tr,
} from '../components/ui';
import api from '../lib/api';
import { LIMITS } from '../lib/limits';
import {
  STATUS_LABEL,
  formatAge,
  stageIndexOf,
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
  // Today's worklist links straight to the overdue view, so the filter has to
  // be expressible in the URL — a link that lands on the unfiltered queue and
  // makes you re-apply the filter is a link that did not arrive.
  const [params] = useSearchParams();
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [aging, setAging] = useState(params.get('aging') === '1');
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
      />

      <Toolbar>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reset(() => setSubmittedQ(q.trim()));
          }}
          className="min-w-64 flex-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={LIMITS.search}
            placeholder="Sender email, beneficiary name, or the start of a transfer id"
            aria-label="Search transfers"
            className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </form>
        <select
          value={status}
          onChange={(e) =>
            reset(() => setStatus(e.target.value as TransferStatus | ''))
          }
          aria-label="Filter by status"
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
      </Toolbar>

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
          <Table>
            <thead>
              <tr>
                <Th>Sender</Th>
                <Th>Recipient</Th>
                <Th align="right">Sent</Th>
                <Th align="right">Received</Th>
                <Th>Stage</Th>
                <Th align="right">Age</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <Tr key={t.id} flagged={t.overdue}>
                  <Td>
                    {/* The link carries the text rather than the row carrying
                        an onClick: a div that navigates is unreachable by
                        keyboard, and this panel is used by people who type. */}
                    <Link
                      to={`/transfers/${t.id}`}
                      className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {t.userEmail}
                    </Link>
                    <Mono className="mt-0.5 block text-ink-faint">
                      {t.id.slice(0, 8).toUpperCase()}
                    </Mono>
                  </Td>
                  <Td className="text-ink">
                    {t.recipient.name}
                    <span className="ml-1.5 text-xs text-ink-faint">
                      {t.recipient.country}
                    </span>
                  </Td>
                  <Td align="right" className="text-ink">
                    <Mono>
                      {t.sendAmount} {t.sendCurrency}
                    </Mono>
                  </Td>
                  <Td align="right" className="text-ink-muted">
                    <Mono>
                      {t.receiveAmount
                        ? `${t.receiveAmount} ${t.receiveCurrency ?? ''}`
                        : '—'}
                    </Mono>
                  </Td>
                  <Td>
                    {/* Rail first, label second. The shape is what gets scanned
                        down the column; the words are for the row you stop on. */}
                    <span className="flex flex-col gap-1">
                      <StageRail
                        status={t.status}
                        reachedIndex={stageIndexOf(t.status)}
                        overdue={t.overdue}
                      />
                      <span className="text-xs text-ink-muted">
                        {STATUS_LABEL[t.status]}
                      </span>
                    </span>
                  </Td>
                  <Td align="right">
                    <Mono>
                      <AgeCell row={t} />
                    </Mono>
                  </Td>
                  <Td className="text-ink-muted">
                    <Mono className="text-ink-muted">
                      {new Date(t.createdAt).toLocaleString()}
                    </Mono>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
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
