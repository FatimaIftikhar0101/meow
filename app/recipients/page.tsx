'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Recipient {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  bankAccount: string;
}

const emptyForm = { name: '', email: '', phone: '', country: '', bankAccount: '' };

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

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (r: Recipient) => {
    setEditingId(r.id);
    setForm({ name: r.name, email: r.email, phone: r.phone, country: r.country, bankAccount: r.bankAccount });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editingId) {
        await api.patch(`/recipients/${editingId}`, form);
      } else {
        await api.post('/recipients', form);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      load();
    } catch {
      setError('Failed to save recipient.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this recipient?')) return;
    await api.delete(`/recipients/${id}`);
    load();
  };

  const fields = [
    { label: 'Full Name', key: 'name', placeholder: 'John Doe' },
    { label: 'Email', key: 'email', placeholder: 'john@example.com' },
    { label: 'Phone', key: 'phone', placeholder: '+639123456789' },
    { label: 'Country', key: 'country', placeholder: 'Philippines' },
    { label: 'Bank Account', key: 'bankAccount', placeholder: '1234567890' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-semibold text-gray-900">Recipients</h1>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {recipients.length === 0 && !showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-600 font-medium">No recipients yet</p>
            <p className="text-sm text-gray-400 mt-1">Add someone you want to send money to</p>
          </div>
        )}

        {recipients.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  {r.name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{r.name}</p>
                  <p className="text-sm text-gray-500">{r.country} · {r.bankAccount}</p>
                  <p className="text-xs text-gray-400">{r.email} · {r.phone}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(r)}
                  className="text-sm text-blue-500 hover:text-blue-700 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-sm text-red-400 hover:text-red-600 font-medium"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        {showForm ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              {editingId ? 'Edit Recipient' : 'New Recipient'}
            </h2>
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    required
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
                >
                  {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Recipient'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={openAdd}
            className="w-full border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 font-medium py-3 rounded-2xl transition text-sm"
          >
            + Add Recipient
          </button>
        )}
      </div>
    </div>
  );
}
