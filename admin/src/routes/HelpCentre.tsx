import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Alert, Button, Card, Empty, PageHeader, Pill } from '../components/ui';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

type FaqStatus = 'draft' | 'published' | 'archived';
interface Faq {
  id: string; categoryId: string; question: string; answer: string; sortOrder: number; status: FaqStatus; createdAt: string; updatedAt: string;
  createdBy: { id: string; email: string } | null; publishedBy: { id: string; email: string } | null; publishedAt: string | null;
}
interface Category { id: string; name: string; description: string; sortOrder: number; active: boolean; faqs: Faq[]; }

const tone: Record<FaqStatus, 'pending' | 'success' | 'neutral'> = { draft: 'pending', published: 'success', archived: 'neutral' };

/** A small CMS constrained to help content, not a generic page builder. */
export default function HelpCentre() {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState({ name: '', description: '', sortOrder: '0' });
  const [draft, setDraft] = useState({ categoryId: '', question: '', answer: '', sortOrder: '0' });
  const { data, isLoading } = useQuery({ queryKey: ['support-help-manager'], queryFn: async () => (await api.get<Category[]>('/admin/support/help')).data });
  const refresh = () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['support-help-manager'] }); void queryClient.invalidateQueries({ queryKey: ['support-help-options'] }); };
  const createCategory = useMutation({ mutationFn: async () => api.post('/admin/support/categories', { name: category.name.trim(), description: category.description.trim(), sortOrder: Number(category.sortOrder) || 0 }), onSuccess: () => { setCategory({ name: '', description: '', sortOrder: '0' }); refresh(); }, onError: (issue) => setError(errorMessage(issue, 'The category could not be created.')) });
  const createFaq = useMutation({ mutationFn: async () => api.post('/admin/support/faqs', { categoryId: draft.categoryId, question: draft.question.trim(), answer: draft.answer.trim(), sortOrder: Number(draft.sortOrder) || 0 }), onSuccess: () => { setDraft((current) => ({ ...current, question: '', answer: '', sortOrder: '0' })); refresh(); }, onError: (issue) => setError(errorMessage(issue, 'The FAQ draft could not be created.')) });
  const updateCategory = useMutation({ mutationFn: async (input: { id: string; body: unknown }) => api.patch(`/admin/support/categories/${input.id}`, input.body), onSuccess: refresh, onError: (issue) => setError(errorMessage(issue, 'The category could not be updated.')) });
  const updateFaq = useMutation({ mutationFn: async (input: { id: string; body: unknown; draft: boolean }) => api.patch(`/admin/support/faqs/${input.id}${input.draft ? '/draft' : ''}`, input.body), onSuccess: refresh, onError: (issue) => setError(errorMessage(issue, 'The FAQ could not be updated.')) });
  const publish = useMutation({ mutationFn: async (id: string) => api.post(`/admin/support/faqs/${id}/publish`), onSuccess: refresh, onError: (issue) => setError(errorMessage(issue, 'The FAQ could not be published.')) });
  const isAdmin = can('faq.manage');
  const canDraft = can('faq.draft');
  return <>
    <PageHeader title="Help centre" subtitle="Customers see active categories and published answers only. Support agents prepare drafts; administrators publish and organise them." />
    {error && <div className="mb-4"><Alert>{error}</Alert></div>}
    <div className="grid gap-4 xl:grid-cols-2">
      {isAdmin && <Card className="p-5"><h2 className="text-base font-medium text-ink">New category</h2><div className="mt-4 grid gap-3"><Input label="Name" value={category.name} onChange={(value) => setCategory((current) => ({ ...current, name: value }))} maxLength={80} /><TextArea label="Description" value={category.description} onChange={(value) => setCategory((current) => ({ ...current, description: value }))} maxLength={240} rows={2} /><Input label="Display order" type="number" min="0" value={category.sortOrder} onChange={(value) => setCategory((current) => ({ ...current, sortOrder: value }))} /><Button onClick={() => createCategory.mutate()} busy={createCategory.isPending} disabled={!category.name.trim() || !category.description.trim()}>Create category</Button></div></Card>}
      {canDraft && <Card className="p-5"><h2 className="text-base font-medium text-ink">New FAQ draft</h2><div className="mt-4 grid gap-3"><label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">Category</span><select value={draft.categoryId} onChange={(event) => setDraft((current) => ({ ...current, categoryId: event.target.value }))} className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink"><option value="">Select category</option>{data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Input label="Question" value={draft.question} onChange={(value) => setDraft((current) => ({ ...current, question: value }))} maxLength={180} /><TextArea label="Plain-text answer" value={draft.answer} onChange={(value) => setDraft((current) => ({ ...current, answer: value }))} maxLength={4000} rows={4} /><Input label="Display order" type="number" min="0" value={draft.sortOrder} onChange={(value) => setDraft((current) => ({ ...current, sortOrder: value }))} /><Button onClick={() => createFaq.mutate()} busy={createFaq.isPending} disabled={!draft.categoryId || !draft.question.trim() || !draft.answer.trim()}>Save draft</Button></div></Card>}
    </div>
    <div className="mt-6 space-y-4">
      {isLoading ? <Empty>Loading Help Centre…</Empty> : !data?.length ? <Empty>No help categories yet.</Empty> : data.map((item) => <CategoryCard key={item.id} category={item} isAdmin={isAdmin} canDraft={canDraft} busy={updateCategory.isPending || updateFaq.isPending || publish.isPending} onSaveCategory={(body) => updateCategory.mutate({ id: item.id, body })} onSaveFaq={(faq, body, asDraft) => updateFaq.mutate({ id: faq.id, body, draft: asDraft })} onPublish={(faq) => publish.mutate(faq.id)} />)}
    </div>
  </>;
}

function CategoryCard({ category, isAdmin, canDraft, busy, onSaveCategory, onSaveFaq, onPublish }: { category: Category; isAdmin: boolean; canDraft: boolean; busy: boolean; onSaveCategory: (body: unknown) => void; onSaveFaq: (faq: Faq, body: unknown, asDraft: boolean) => void; onPublish: (faq: Faq) => void }) {
  const [name, setName] = useState(category.name); const [description, setDescription] = useState(category.description); const [sortOrder, setSortOrder] = useState(String(category.sortOrder)); const [active, setActive] = useState(category.active);
  return <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-base font-medium text-ink">{category.name}</h2><p className="mt-1 text-sm text-ink-muted">{category.description}</p></div><Pill tone={category.active ? 'success' : 'neutral'}>{category.active ? 'active' : 'archived'}</Pill></div>{isAdmin && <div className="mt-4 grid gap-3 border-t border-line pt-4 md:grid-cols-2"><Input label="Category name" value={name} onChange={setName} maxLength={80} /><Input label="Display order" type="number" min="0" value={sortOrder} onChange={setSortOrder} /><div className="md:col-span-2"><TextArea label="Description" value={description} onChange={setDescription} maxLength={240} rows={2} /></div><label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="size-4 accent-accent" />Show this category to customers</label><div className="flex justify-end"><Button variant="secondary" onClick={() => onSaveCategory({ name: name.trim(), description: description.trim(), sortOrder: Number(sortOrder) || 0, active })} busy={busy}>Save category</Button></div></div>}
    <div className="mt-5 space-y-3">{category.faqs.length ? category.faqs.map((faq) => <FaqEditor key={faq.id} faq={faq} isAdmin={isAdmin} canDraft={canDraft} busy={busy} onSave={onSaveFaq} onPublish={onPublish} />) : <p className="text-sm text-ink-muted">No FAQs in this category yet.</p>}</div>
  </Card>;
}

function FaqEditor({ faq, isAdmin, canDraft, busy, onSave, onPublish }: { faq: Faq; isAdmin: boolean; canDraft: boolean; busy: boolean; onSave: (faq: Faq, body: unknown, asDraft: boolean) => void; onPublish: (faq: Faq) => void }) {
  const [question, setQuestion] = useState(faq.question); const [answer, setAnswer] = useState(faq.answer); const [sortOrder, setSortOrder] = useState(String(faq.sortOrder));
  const editable = isAdmin || (canDraft && faq.status === 'draft');
  return <section className="rounded-lg border border-line bg-inset p-4"><div className="flex flex-wrap items-center justify-between gap-2"><Pill tone={tone[faq.status]}>{faq.status}</Pill><span className="text-xs text-ink-faint">{faq.createdBy ? `Drafted by ${faq.createdBy.email}` : 'Seeded content'}{faq.publishedAt ? ` · published ${new Date(faq.publishedAt).toLocaleDateString()}` : ''}</span></div>{editable ? <div className="mt-3 grid gap-3"><Input label="Question" value={question} onChange={setQuestion} maxLength={180} /><TextArea label="Answer" value={answer} onChange={setAnswer} maxLength={4000} rows={4} /><div className="flex flex-wrap items-end justify-between gap-3"><div className="w-32"><Input label="Order" type="number" min="0" value={sortOrder} onChange={setSortOrder} /></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => onSave(faq, { question: question.trim(), answer: answer.trim(), sortOrder: Number(sortOrder) || 0 }, faq.status === 'draft')} busy={busy}>Save</Button>{isAdmin && faq.status !== 'published' && <Button onClick={() => onPublish(faq)} busy={busy}>Publish</Button>}{isAdmin && faq.status !== 'archived' && <Button variant="secondary" onClick={() => onSave(faq, { status: 'archived' }, false)} busy={busy}>Archive</Button>}</div></div></div> : <><h3 className="mt-3 text-sm font-medium text-ink">{faq.question}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-muted">{faq.answer}</p></>}</section>;
}

function Input({ label, onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{label}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" /></label>; }
function TextArea({ label, onChange, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{label}</span><textarea {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none" /></label>; }
