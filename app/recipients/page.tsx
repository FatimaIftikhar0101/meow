'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

interface Recipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country: string;
  bankAccount: string;
  bankName?: string;
}

const COUNTRIES = [
  { code: 'PK', name: 'Pakistan' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Philippines' },
];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  country: 'PK',
  bankAccount: '',
  bankName: '',
};

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await api.get('/recipients');
    setRecipients(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (r: Recipient) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      email: r.email ?? '',
      phone: r.phone ?? '',
      country: r.country,
      bankAccount: r.bankAccount,
      bankName: r.bankName ?? '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload: Record<string, string> = {
      name: form.name.trim(),
      country: form.country,
      bankAccount: form.bankAccount.trim(),
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.bankName.trim()) payload.bankName = form.bankName.trim();

    try {
      if (editingId) {
        await api.patch(`/recipients/${editingId}`, payload);
      } else {
        await api.post('/recipients', payload);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to save recipient.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this recipient?')) return;
    try {
      await api.delete(`/recipients/${id}`);
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'Failed to delete recipient.');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--brand)]">←</Link>
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Recipients</span>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-10 space-y-4">
        {recipients.length === 0 && !showForm && (
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-10 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-[var(--foreground)] font-medium">No recipients yet</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Add someone you want to send money to.</p>
          </div>
        )}

        {recipients.map((r) => (
          <div key={r.id} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--brand)] font-semibold">
                  {r.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{r.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{r.country} · {r.bankAccount}</p>
                  {(r.email || r.phone) && (
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">{[r.email, r.phone].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(r)} className="text-sm text-[var(--brand)] hover:underline font-medium">Edit</button>
                <button onClick={() => handleDelete(r.id)} className="text-sm text-red-500 hover:text-red-700 font-medium">Remove</button>
              </div>
            </div>
          </div>
        ))}

        {showForm ? (
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-4">
              {editingId ? 'Edit recipient' : 'New recipient'}
            </h2>
            {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Full name">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </Field>
              <Field label="Country">
                <select
                  required
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </Field>
              <Field label="Bank account">
                <input
                  required
                  value={form.bankAccount}
                  onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                  placeholder="IBAN or local account number"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </Field>
              <Field label="Bank name" optional>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="HBL, ICICI, BPI, …"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </Field>
              <Field label="Email" optional>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="recipient@example.com"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </Field>
              <Field label="Phone" optional>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </Field>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50 text-sm shadow"
                >
                  {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add recipient'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-[var(--border)] text-[var(--muted-foreground)] font-medium py-2.5 rounded-xl hover:bg-[var(--muted)] transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="w-full border-2 border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent-deep)] font-medium py-4 rounded-2xl transition text-sm"
          >
            + Add recipient
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">
        {label}{optional && <span className="text-[var(--muted-foreground)] normal-case ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
