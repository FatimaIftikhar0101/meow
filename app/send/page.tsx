'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

interface Recipient {
  id: string;
  name: string;
  country: string;
  bankAccount: string;
}

interface FxPreview {
  receiveAmount: number;
  rate: number;
}

export default function SendPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [form, setForm] = useState({
    recipientId: '',
    sendAmount: '',
    sendCurrency: 'USD',
    receiveCurrency: 'PHP',
  });
  const [preview, setPreview] = useState<FxPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/recipients').then((res) => setRecipients(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.sendAmount || !form.sendCurrency || !form.receiveCurrency) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get(
          `/corridors/convert?from=${form.sendCurrency}&to=${form.receiveCurrency}&amount=${form.sendAmount}`
        );
        setPreview(res.data);
      } catch {
        setPreview(null);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.sendAmount, form.sendCurrency, form.receiveCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/transfers', {
        recipientId: form.recipientId,
        sendAmount: parseFloat(form.sendAmount),
        sendCurrency: form.sendCurrency,
        receiveCurrency: form.receiveCurrency,
      });
      router.push(`/transfers/${res.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Transfer failed. Check your balance and try again.');
    } finally {
      setLoading(false);
    }
  };

  const currencies = ['USD', 'CAD', 'PHP', 'INR'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
            <h2 className="text-xl font-semibold text-gray-900">Send Money</h2>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
              <select
                required
                value={form.recipientId}
                onChange={(e) => setForm({ ...form, recipientId: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select recipient</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.country}
                  </option>
                ))}
              </select>
              {recipients.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  No recipients yet.{' '}
                  <Link href="/recipients" className="text-blue-500 hover:underline">Add one</Link>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">You send</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.sendAmount}
                  onChange={(e) => setForm({ ...form, sendAmount: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="100.00"
                />
                <select
                  value={form.sendCurrency}
                  onChange={(e) => setForm({ ...form, sendCurrency: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient gets</label>
              <div className="flex gap-2">
                <div className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-700">
                  {preview ? preview.receiveAmount.toFixed(2) : '—'}
                </div>
                <select
                  value={form.receiveCurrency}
                  onChange={(e) => setForm({ ...form, receiveCurrency: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {preview && (
                <p className="text-xs text-gray-400 mt-1">Rate: 1 {form.sendCurrency} = {preview.rate} {form.receiveCurrency}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Money'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
