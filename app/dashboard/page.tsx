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

const statusStyle: Record<string, string> = {
  initiated: 'bg-[var(--muted)] text-[var(--ink-soft)]',
  payment_received: 'bg-[var(--mint-soft)] text-[var(--mint)]',
  compliance_check: 'bg-[var(--gold-soft)] text-amber-800',
  fx_converted: 'bg-[var(--accent-soft)] text-[var(--accent-deep)]',
  payout_processing: 'bg-[var(--accent-soft)] text-[var(--accent-deep)]',
  delivered: 'bg-[var(--mint-soft)] text-[var(--mint)]',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
};

const statusLabels: Record<string, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance',
  fx_converted: 'Converted',
  payout_processing: 'On its way',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function DashboardPage() {
  const router = useRouter();
  const [balance, setBalance] = useState('0.00');
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
      <nav className="bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <BrandWordmark />
        <div className="flex items-center gap-1 sm:gap-3">
          <NavLink href="/recipients">Recipients</NavLink>
          <NavLink href="/wallet/transactions">Activity</NavLink>
          <Link
            href="/profile"
            className="ml-2 w-9 h-9 rounded-full bg-[var(--ink)] flex items-center justify-center text-white text-sm font-bold hover:bg-[var(--brand-deep)] transition"
          >
            {email ? email[0].toUpperCase() : '·'}
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-7">
        {kycPassed === false && (
          <Link
            href="/profile"
            className="flex items-center justify-between bg-[var(--gold-soft)] border border-amber-200 text-amber-900 rounded-2xl px-5 py-4 hover:bg-amber-100 transition"
          >
            <span className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🪪</span> Verify your identity to send money
            </span>
            <span className="text-sm">→</span>
          </Link>
        )}

        {/* Hero wallet card */}
        <div className="relative bg-[var(--ink)] text-white rounded-[2rem] p-8 shadow-2xl overflow-hidden">
          <div
            className="absolute -right-20 -top-20 w-72 h-72 rounded-full opacity-50"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)', animation: 'aurora 6s ease-in-out infinite' }}
          />
          <div
            className="absolute -left-12 -bottom-16 w-56 h-56 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, var(--mint), transparent 70%)', animation: 'aurora 8s ease-in-out infinite 1s' }}
          />
          <div className="relative">
            <p className="text-white/60 text-[11px] uppercase tracking-[0.2em] font-bold">Available balance</p>
            <p className="text-5xl font-extrabold mt-2 tracking-tight">
              {parseFloat(balance).toFixed(2)}
              <span className="text-white/70 text-2xl ml-2">{currency}</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/send"
                className="bg-[var(--accent)] text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/30"
              >
                Send money →
              </Link>
              <Link
                href="/wallet/fund"
                className="bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-white/20 transition"
              >
                + Add money
              </Link>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Transfers"
            value={transfers.length.toString()}
          />
          <Stat
            label="In flight"
            value={transfers.filter((t) => !['delivered', 'failed', 'cancelled'].includes(t.status)).length.toString()}
            accent="accent"
          />
          <Stat
            label="Delivered"
            value={transfers.filter((t) => t.status === 'delivered').length.toString()}
            accent="mint"
          />
        </div>

        {/* Transfers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">Recent transfers</h2>
            {transfers.length > 0 && (
              <Link href="/wallet/transactions" className="text-sm text-[var(--accent)] hover:text-[var(--accent-deep)] font-semibold">All activity →</Link>
            )}
          </div>
          {transfers.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-12 text-center">
              <p className="text-5xl mb-4">🐾</p>
              <p className="text-[var(--foreground)] font-bold text-lg">Let&apos;s send your first transfer</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Our kitten will carry your money home.</p>
              <Link href="/send" className="inline-block mt-5 bg-[var(--accent)] text-white text-sm font-bold px-6 py-2.5 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/30">
                Send money →
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {transfers.map((t) => (
                <Link href={`/transfers/${t.id}`} key={t.id}>
                  <div className="group bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 flex items-center justify-between hover:border-[var(--accent)] hover:shadow-lg hover:shadow-[var(--accent)]/5 transition cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold)] flex items-center justify-center text-white font-bold">
                        {t.recipient?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-deep)] transition">{t.recipient?.name || 'Unknown'}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
                          {parseFloat(t.amount).toFixed(2)} {t.sendCurrency} → {t.receiveAmount ? parseFloat(t.receiveAmount).toFixed(2) : '—'} {t.receiveCurrency}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${statusStyle[t.status] || 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm font-semibold text-[var(--ink-soft)] hover:text-[var(--accent-deep)] hover:bg-[var(--accent-soft)] rounded-full transition"
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'accent' | 'mint' }) {
  const color = accent === 'accent' ? 'text-[var(--accent-deep)]' : accent === 'mint' ? 'text-[var(--mint)]' : 'text-[var(--foreground)]';
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-bold">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
