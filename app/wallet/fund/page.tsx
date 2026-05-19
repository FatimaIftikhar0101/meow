'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

const QUICK_AMOUNTS = [100, 250, 500, 1000];

export default function FundWalletPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CAD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/wallet/balance').then((res) => setCurrency(res.data.currency)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/wallet/fund', { amount: parseFloat(amount) });
      router.push('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to fund wallet. Try again.');
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
        <span className="text-sm text-[var(--muted-foreground)]">Add money</span>
      </nav>

      <div className="max-w-md mx-auto px-4 py-10">
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-7 shadow-sm">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Add money</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Top up your {currency} wallet. Demo only — no real card is charged.</p>

          {error && (
            <div className="mt-5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">Amount ({currency})</label>
              <input
                type="number"
                required
                min="1"
                max="50000"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="100.00"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setAmount(String(a))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] transition"
                  >
                    {a} {currency}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-3">Daily limit: 20,000 {currency}</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow"
            >
              {loading ? 'Adding…' : 'Add money'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
