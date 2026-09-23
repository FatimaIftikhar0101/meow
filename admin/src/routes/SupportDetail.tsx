import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

type TicketStatus = 'open' | 'in_progress' | 'resolved';
interface Ticket {
  id: string; subject: string; status: TicketStatus; createdAt: string; lastActivityAt: string; resolvedAt: string | null;
  category: { name: string }; customer: { id: string; email: string; createdAt: string }; assignee: { id: string; email: string } | null;
  transfer: { id: string; recipientName: string; recipientCountry: string; status: string } | null;
  messages: Array<{ id: string; sender: 'customer' | 'staff'; body: string; createdAt: string; author: { id: string; email: string } }>;
  events: Array<{ id: string; kind: string; createdAt: string; actor: { id: string; email: string } | null }>;
}

const tone: Record<TicketStatus, 'pending' | 'success' | 'neutral'> = { open: 'pending', in_progress: 'pending', resolved: 'success' };

export default function SupportDetail() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data: ticket, isLoading } = useQuery({ queryKey: ['support-ticket', id], queryFn: async () => (await api.get<Ticket>(`/admin/support/tickets/${id}`)).data, enabled: Boolean(id), refetchInterval: 15_000 });
  const action = useMutation({
    mutationFn: async (input: { kind: 'claim' | 'unclaim' | 'reply' | 'resolve'; body?: string }) => api.post(`/admin/support/tickets/${id}/${input.kind}`, input.body ? { body: input.body } : undefined),
    onSuccess: () => { setBody(''); setError(null); void queryClient.invalidateQueries({ queryKey: ['support-ticket', id] }); void queryClient.invalidateQueries({ queryKey: ['support-tickets'] }); },
    onError: (issue) => setError(errorMessage(issue, 'The support request could not be updated.')),
  });
  if (isLoading) return <Empty>Loading support request…</Empty>;
  if (!ticket) return <Empty>Support request not found.</Empty>;
  const mine = ticket.assignee?.id === profile?.userId;
  const claimedByAnother = ticket.status === 'in_progress' && !mine;
  const send = (kind: 'reply' | 'resolve') => { if (!body.trim()) { setError(kind === 'resolve' ? 'Write a final reply before resolving.' : 'Write a reply first.'); return; } action.mutate({ kind, body: body.trim() }); };
  return <>
    <PageHeader title={ticket.subject} subtitle={`${ticket.category.name} · opened ${new Date(ticket.createdAt).toLocaleString()}`} action={<Link to="/support" className="rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink">Back to requests</Link>} />
    {error && <div className="mb-4"><Alert>{error}</Alert></div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Card>
          <div className="border-b border-line px-5 py-3"><span className="text-sm font-medium text-ink">Conversation</span></div>
          <ol className="divide-y divide-line">
            {ticket.messages.map((message) => <li key={message.id} className="px-5 py-4"><div className="flex items-center justify-between gap-4"><span className="text-sm font-medium text-ink">{message.sender === 'customer' ? ticket.customer.email : message.author.email}</span><time className="shrink-0 text-xs text-ink-faint">{new Date(message.createdAt).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{message.body}</p></li>)}
          </ol>
        </Card>
        {ticket.status === 'resolved' ? <Card className="p-5 text-sm text-ink-muted">Resolved requests stay readable. A customer reply will reopen this request in the shared queue.</Card> : claimedByAnother ? <Card className="p-5 text-sm text-ink-muted">This request is currently being handled by {ticket.assignee?.email}.</Card> : mine ? <Card className="p-5"><label className="block text-sm font-medium text-ink">Reply to customer<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={5} className="mt-2 w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" placeholder="Write a clear, customer-safe reply." /></label><p className="mt-1 text-xs text-ink-muted">{body.length}/2,000</p><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => send('reply')} busy={action.isPending}>Send reply</Button><Button variant="secondary" onClick={() => send('resolve')} busy={action.isPending}>Send & resolve</Button></div></Card> : null}
      </div>
      <aside className="space-y-4">
        <Card className="p-5"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-ink">Status</span><Pill tone={tone[ticket.status]}>{ticket.status.replace('_', ' ')}</Pill></div><p className="mt-3 text-sm text-ink-muted">{ticket.assignee ? `Assigned to ${ticket.assignee.email}` : 'Unassigned'}</p><div className="mt-4 flex flex-wrap gap-2">{ticket.status === 'open' && !ticket.assignee && <Button onClick={() => action.mutate({ kind: 'claim' })} busy={action.isPending}>Claim request</Button>}{mine && ticket.status === 'in_progress' && <Button variant="secondary" onClick={() => action.mutate({ kind: 'unclaim' })} busy={action.isPending}>Release</Button>}</div></Card>
        <Card className="p-5"><h2 className="text-sm font-medium text-ink">Customer</h2><p className="mt-2 text-sm text-ink">{ticket.customer.email}</p>{ticket.transfer && <><h2 className="mt-4 text-sm font-medium text-ink">Linked transfer</h2><Link to={`/transfers/${ticket.transfer.id}`} className="mt-2 block text-sm text-ink underline">{ticket.transfer.recipientName} · {ticket.transfer.recipientCountry}</Link><p className="mt-1 text-xs text-ink-muted">{ticket.transfer.status}</p></>}</Card>
        <Card className="p-5"><h2 className="text-sm font-medium text-ink">Request history</h2><ol className="mt-3 space-y-3">{ticket.events.map((event) => <li key={event.id} className="text-xs text-ink-muted"><span className="block text-ink">{event.kind.replace('_', ' ')}</span>{event.actor?.email ?? 'Customer'} · {new Date(event.createdAt).toLocaleString()}</li>)}</ol></Card>
      </aside>
    </div>
  </>;
}
