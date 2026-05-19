'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

interface Transfer {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveCurrency: string;
  receiveAmount: string;
  status: string;
  createdAt: string;
  recipient: { name: string; country: string };
}

const statusColors: Record<string, string> = {
  initiated: 'bg-slate-100 text-slate-600',
  payment_received: 'bg-blue-100 text-blue-700',
  compliance_check: 'bg-amber-100 text-amber-700',
  fx_converted: 'bg-purple-100 text-purple-700',
  payout_processing: 'bg-[var(--accent)]/15 text-[var(--accent-deep)]',
  delivered: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const statusLabels: Record<string, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance',
  fx_converted: 'Converted',
  payout_processing: 'Processing',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function DashboardPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<string>('0.00');
  const [currency, setCurrency] = useState('CAD');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [email, setEmail] = useState('');
  const [kycPassed, setKycPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [walletRes, transfersRes, profileRes, kycRes] = await Promise.all([
          api.get('/wallet/balance'),
          api.get('/transfers'),
          api.get('/auth/profile'),
          api.get('/compliance/status'),
        ]);
        setBalance(walletRes.data.balance);
        setCurrency(walletRes.data.currency);
        setTransfers(transfersRes.data);
        setEmail(profileRes.data.email ?? '');
        setKycPassed(kycRes.data.status === 'passed');
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <BrandWordmark />
        <div className="flex items-center gap-5">
          <Link href="/recipients" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--brand)]">Recipients</Link>
          <Link href="/wallet/transactions" className="text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--brand)]">History</Link>
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-sm font-bold hover:bg-[var(--brand-deep)] transition"
          >
            {email ? email[0].toUpperCase() : '·'}
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {kycPassed === false && (
          <Link
            href="/profile"
            className="block bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-5 py-4 hover:bg-amber-100 transition"
          >
            <p className="text-sm font-medium">Verify your identity to send money →</p>
          </Link>
        )}

        {/* Wallet card */}
        <div className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] text-white rounded-3xl p-7 shadow-lg relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-[var(--accent)]/20" />
          <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-[var(--accent)]/10" />
          <div className="relative">
            <p className="text-white/70 text-xs uppercase tracking-wider font-semibold">Your balance</p>
            <p className="text-4xl font-bold mt-2">
              {parseFloat(balance).toFixed(2)} <span className="text-white/80 text-2xl">{currency}</span>
            </p>
            <div className="mt-5 flex gap-3">
              <Link
                href="/wallet/fund"
                className="bg-white text-[var(--brand)] text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-white/90 transition"
              >
                + Add money
              </Link>
              <Link
                href="/send"
                className="bg-[var(--accent)] text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--accent-deep)] transition shadow"
              >
                Send money →
              </Link>
            </div>
          </div>
        </div>

        {/* Transfers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Recent transfers</h2>
            {transfers.length > 0 && (
              <Link href="/wallet/transactions" className="text-sm text-[var(--brand)] hover:underline">All activity →</Link>
            )}
          </div>
          {transfers.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-10 text-center">
              <p className="text-3xl mb-3">🐾</p>
              <p className="text-[var(--foreground)] font-medium">No transfers yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Send your first transfer to get started.</p>
              <Link href="/send" className="inline-block mt-4 bg-[var(--accent)] text-white text-sm font-semibold px-5 py-2 rounded-full hover:bg-[var(--accent-deep)] transition">
                Send money
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((t) => (
                <Link href={`/transfers/${t.id}`} key={t.id}>
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 flex items-center justify-between hover:border-[var(--accent)] hover:shadow-sm transition cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--brand)] font-semibold">
                        {t.recipient?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{t.recipient?.name || 'Unknown'}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {parseFloat(t.amount).toFixed(2)} {t.sendCurrency} → {t.receiveAmount ? parseFloat(t.receiveAmount).toFixed(2) : '—'} {t.receiveCurrency}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[t.status] || 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
