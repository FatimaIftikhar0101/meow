'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

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
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--brand)]">←</Link>
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Send money</span>
      </nav>

      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-7 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Send money</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Available balance: <span className="font-semibold text-[var(--foreground)]">{parseFloat(balance).toFixed(2)} {sendCurrency}</span>
          </p>

          {error && (
            <div className="mt-5 bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">Recipient</label>
              <select
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="">Select recipient</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.country}
                  </option>
                ))}
              </select>
              {recipients.length === 0 && (
                <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                  No recipients yet.{' '}
                  <Link href="/recipients" className="text-[var(--brand)] hover:underline">Add one</Link>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">You send ({sendCurrency})</label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="100.00"
              />
            </div>

            {preview && receiveCurrency && (
              <div className="bg-[var(--muted)] rounded-2xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--muted-foreground)]">Recipient gets</span>
                  <span className="font-semibold text-[var(--foreground)]">{preview.receiveAmount.toFixed(2)} {receiveCurrency}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Rate</span>
                  <span>1 {sendCurrency} = {preview.rate.toFixed(4)} {receiveCurrency}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                  <span>Fee</span>
                  <span>{preview.fee.toFixed(2)} {sendCurrency}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !preview}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow"
            >
              {loading ? 'Sending…' : 'Send money'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
