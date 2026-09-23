import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, Mono, PageHeader, Pill, Table, Td, Th, Toolbar, Tr } from '../components/ui';
import api from '../lib/api';

type TicketStatus = 'open' | 'in_progress' | 'resolved';

interface Category {
  id: string;
  name: string;
}

interface TicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  lastActivityAt: string;
  category: Category;
  customer: { id: string; email: string };
  assignee: { id: string; email: string } | null;
  transfer: { id: string; recipientName: string } | null;
  latestMessage: { sender: 'customer' | 'staff'; body: string; createdAt: string } | null;
}

interface TicketPage {
  items: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
}

const TONES: Record<TicketStatus, 'pending' | 'success' | 'neutral'> = {
  open: 'pending',
  in_progress: 'pending',
  resolved: 'success',
};

/** Shared queue, deliberately newest customer activity first. */
export default function Support() {
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [assignment, setAssignment] = useState<'' | 'mine' | 'unassigned'>('');
  const [categoryId, setCategoryId] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: help } = useQuery({
    queryKey: ['support-help-options'],
    queryFn: async () => (await api.get<Category[]>('/admin/support/help')).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', status, assignment, categoryId, search, page],
    queryFn: async () =>
      (
        await api.get<TicketPage>('/admin/support/tickets', {
          params: {
            ...(status ? { status } : {}),
            ...(assignment ? { assignment } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(search ? { search } : {}),
            page,
          },
        })
      ).data,
    refetchInterval: 15_000,
  });

  function reset(change: () => void) {
    change();
    setPage(1);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHeader
        title="Support requests"
        subtitle={data ? `${data.total} requests, newest customer activity first.` : 'Shared customer support queue.'}
      />
      <Toolbar>
        <form
          className="min-w-64 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            reset(() => setSearch(q.trim()));
          }}
        >
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            maxLength={120}
            placeholder="Customer, subject, recipient, or transfer ID"
            aria-label="Search support requests"
            className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
        </form>
        <select value={status} onChange={(event) => reset(() => setStatus(event.target.value as TicketStatus | ''))} aria-label="Filter by request status" className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={assignment} onChange={(event) => reset(() => setAssignment(event.target.value as '' | 'mine' | 'unassigned'))} aria-label="Filter by assignment" className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink">
          <option value="">All assignments</option>
          <option value="unassigned">Unassigned</option>
          <option value="mine">Mine</option>
        </select>
        <select value={categoryId} onChange={(event) => reset(() => setCategoryId(event.target.value))} aria-label="Filter by help category" className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink">
          <option value="">All categories</option>
          {help?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </Toolbar>

      <Card>
        {isLoading ? <Empty>Loading requests…</Empty> : !data?.items.length ? <Empty>No support requests match these filters.</Empty> : (
          <Table>
            <thead><tr><Th>Customer & request</Th><Th>Category</Th><Th>Status</Th><Th>Assigned to</Th><Th>Latest activity</Th></tr></thead>
            <tbody>
              {data.items.map((ticket) => (
                <Tr key={ticket.id} flagged={ticket.status === 'open' && !ticket.assignee}>
                  <Td>
                    <Link to={`/support/${ticket.id}`} className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                      {ticket.subject}
                    </Link>
                    <span className="mt-1 block text-xs text-ink-muted">{ticket.customer.email}</span>
                    <Mono className="mt-0.5 block text-ink-faint">{ticket.id.slice(0, 8).toUpperCase()}</Mono>
                  </Td>
                  <Td className="text-ink-muted">{ticket.category.name}</Td>
                  <Td><Pill tone={TONES[ticket.status]}>{ticket.status.replace('_', ' ')}</Pill></Td>
                  <Td className="text-ink-muted">{ticket.assignee?.email ?? 'Unassigned'}</Td>
                  <Td className="text-ink-muted"><span className="block">{new Date(ticket.lastActivityAt).toLocaleString()}</span>{ticket.transfer && <Link to={`/transfers/${ticket.transfer.id}`} className="mt-1 block text-xs underline">Transfer · {ticket.transfer.recipientName}</Link>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {pages > 1 && <nav className="mt-4 flex items-center justify-between text-sm"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-field-border bg-card px-3 py-1.5 text-ink disabled:opacity-40">Previous</button><span className="text-ink-muted">Page {page} of {pages}</span><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-field-border bg-card px-3 py-1.5 text-ink disabled:opacity-40">Next</button></nav>}
    </>
  );
}
