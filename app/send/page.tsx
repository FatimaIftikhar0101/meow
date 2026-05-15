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
  fee: number;
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  PK: 'PKR',
  IN: 'INR',
  PH: 'PHP',
};

export default function SendPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sendCurrency, setSendCurrency] = useState('CAD');
  const [balance, setBalance] = useState('0.00');
  const [recipientId, setRecipientId] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [preview, setPreview] = useState<FxPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/recipients').then((res) => setRecipients(res.data)).catch(() => {});
    api.get('/wallet/balance').then((res) => {
      setSendCurrency(res.data.currency);
      setBalance(res.data.balance);
    }).catch(() => {});
  }, []);

  const selectedRecipient = recipients.find((r) => r.id === recipientId);
  const receiveCurrency = selectedRecipient
    ? COUNTRY_TO_CURRENCY[selectedRecipient.country] ?? selectedRecipient.country
    : '';

  useEffect(() => {
    if (!sendAmount || !sendCurrency || !receiveCurrency) {
      setPreview(null);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get(
          `/corridors/convert?from=${sendCurrency}&to=${receiveCurrency}&amount=${sendAmount}`,
        );
        setPreview(res.data);
        setError('');
      } catch {
        setPreview(null);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [sendAmount, sendCurrency, receiveCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveCurrency) {
      setError('Pick a recipient first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/transfers', {
        recipientId,
        sendAmount: parseFloat(sendAmount),
        sendCurrency,
        receiveCurrency,
      });
      router.push(`/transfers/${res.data.id}`);
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string | string[] } } };
      if (e.response?.status === 403) {
        setError('You must verify your identity before sending money. Visit your profile.');
        return;
      }
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Transfer failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
            <h2 className="text-xl font-semibold text-gray-900">Send Money</h2>
          </div>

          <div className="bg-blue-50 text-blue-700 text-sm px-4 py-2.5 rounded-lg mb-4">
            Balance: {parseFloat(balance).toFixed(2)} {sendCurrency}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipient</label>
              <select
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">You send ({sendCurrency})</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient gets {receiveCurrency && `(${receiveCurrency})`}
              </label>
              <div className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-4 py-2.5 text-sm text-gray-700">
                {preview ? preview.receiveAmount.toFixed(2) : '—'}
              </div>
              {preview && (
                <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p>Rate: 1 {sendCurrency} = {preview.rate.toFixed(4)} {receiveCurrency}</p>
                  <p>Fee: {preview.fee.toFixed(2)} {sendCurrency}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !preview}
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
