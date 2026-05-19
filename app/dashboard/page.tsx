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
  initiated: 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]',
  payment_received: 'bg-[var(--mint-soft)] text-[var(--mint)] border-[var(--mint)]/30',
  compliance_check: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30',
  fx_converted: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30',
  payout_processing: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30',
  delivered: 'bg-[var(--mint-soft)] text-[var(--mint)] border-[var(--mint)]/30',
  failed: 'bg-[var(--danger-soft)] text-[var(--danger)] border-[var(--danger)]/30',
  cancelled: 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]',
};

const statusLabels: Record<string, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance',
  fx_converted: 'Converted',
  payout_processing: 'In transit',
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
        <p className="text-[var(--muted-foreground)] text-sm tracking-widest uppercase">Loading</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <BrandWordmark />
        <div className="flex items-center gap-1 sm:gap-2">
          <NavLink href="/recipients">Recipients</NavLink>
          <NavLink href="/wallet/transactions">Activity</NavLink>
          <Link
            href="/profile"
            className="ml-2 w-9 h-9 rounded-full bg-[var(--surface-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--foreground)] text-sm font-bold hover:border-[var(--accent)] transition"
          >
            {email ? email[0].toUpperCase() : '·'}
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {kycPassed === false && (
          <Link
            href="/profile"
            className="flex items-center justify-between bg-[var(--accent-soft)] border border-[var(--accent)]/40 text-[var(--accent)] rounded-2xl px-5 py-3.5 hover:bg-[var(--accent)]/15 transition"
          >
            <span className="text-sm font-semibold">Verify your identity to send money</span>
            <span className="text-sm">→</span>
          </Link>
        )}

        {/* Balance card */}
        <div
          className="relative rounded-3xl border border-[var(--border-strong)] p-8 overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--surface-elevated) 0%, var(--surface) 60%, var(--background) 100%)',
          }}
        >
          <div
            className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)', animation: 'aurora 7s ease-in-out infinite' }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">Available balance</p>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> Live
              </span>
            </div>
            <p className="text-5xl font-extrabold tracking-tight tabular text-[var(--foreground)] mt-2">
              {parseFloat(balance).toFixed(2)}
              <span className="text-[var(--muted-foreground)] text-2xl ml-2 font-bold">{currency}</span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/send"
                className="bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-3 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/20"
              >
                Send money →
              </Link>
              <Link
                href="/wallet/fund"
                className="border border-[var(--border-strong)] text-[var(--foreground)] text-sm font-semibold px-6 py-3 rounded-full hover:border-[var(--accent)] hover:bg-[var(--surface)] transition"
              >
                + Add money
              </Link>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Transfers" value={transfers.length.toString()} />
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
              <Link href="/wallet/transactions" className="text-xs text-[var(--accent)] hover:text-[var(--accent-deep)] font-semibold uppercase tracking-wider">All activity →</Link>
            )}
          </div>
          {transfers.length === 0 ? (
            <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-12 text-center">
              <p className="text-[var(--foreground)] font-bold text-lg">No transfers yet</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">Send your first transfer to a recipient.</p>
              <Link href="/send" className="inline-block mt-5 bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-2.5 rounded-full hover:bg-[var(--accent-deep)] transition">
                Send money →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {transfers.map((t) => (
                <Link href={`/transfers/${t.id}`} key={t.id}>
                  <div className="group bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 flex items-center justify-between hover:border-[var(--accent)]/60 hover:bg-[var(--surface-elevated)] transition cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--accent)] font-bold">
                        {t.recipient?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{t.recipient?.name || 'Unknown'}</p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono tabular">
                          {parseFloat(t.amount).toFixed(2)} {t.sendCurrency} → {t.receiveAmount ? parseFloat(t.receiveAmount).toFixed(2) : '—'} {t.receiveCurrency}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border ${statusStyle[t.status] || 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]'}`}>
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
      className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
    >
      {children}
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'accent' | 'mint' }) {
  const color = accent === 'accent' ? 'text-[var(--accent)]' : accent === 'mint' ? 'text-[var(--mint)]' : 'text-[var(--foreground)]';
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4">
      <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">{label}</p>
      <p className={`text-3xl font-extrabold mt-1.5 tabular ${color}`}>{value}</p>
    </div>
  );
}
