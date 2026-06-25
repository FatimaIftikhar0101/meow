'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal, useCountUp } from '@/app/_components/motion';
import { MEOW_CORRIDORS } from '@/app/_components/Globe3D';

/* R3F touches `window` on mount, so the globe is client-only + lazy. The
 * compact tile and the fullscreen modal share the same dynamic import. */
const Globe3D = dynamic(() => import('@/app/_components/Globe3D'), {
  ssr: false,
  loading: () => <GlobeSkeleton />,
});

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

const IN_FLIGHT = new Set([
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
]);

const statusStyle: Record<string, string> = {
  initiated: 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]',
  payment_received: 'text-[var(--accent)] border-[var(--accent)]/30 pill-shimmer',
  compliance_check: 'text-[var(--accent)] border-[var(--accent)]/30 pill-shimmer',
  fx_converted: 'text-[var(--accent)] border-[var(--accent)]/30 pill-shimmer',
  payout_processing: 'text-[var(--accent)] border-[var(--accent)]/30 pill-shimmer',
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
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('CAD');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [email, setEmail] = useState('');
  const [kycPassed, setKycPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [globeOpen, setGlobeOpen] = useState(false);

  // Defer mounting the compact globe until after first paint so the dashboard's
  // initial render isn't blocked by ~600 kB of three.js (gzipped).
  const [globeReady, setGlobeReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setGlobeReady(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [walletRes, transfersRes, profileRes, kycRes] = await Promise.all([
          api.get('/wallet/balance'),
          api.get('/transfers'),
          api.get('/auth/profile'),
          api.get('/compliance/status'),
        ]);
        setBalance(parseFloat(walletRes.data.balance) || 0);
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

  // Lock body scroll while the fullscreen globe is open.
  useEffect(() => {
    if (!globeOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGlobeOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [globeOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)] text-sm tracking-widest uppercase">Loading</p>
      </div>
    );
  }

  const inFlightCount = transfers.filter((t) => IN_FLIGHT.has(t.status)).length;
  const deliveredCount = transfers.filter((t) => t.status === 'delivered').length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-20">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {kycPassed === false && (
          <Reveal>
            <Link
              href="/profile"
              className="flex items-center justify-between bg-[var(--accent-soft)] border border-[var(--accent)]/40 text-[var(--accent)] rounded-2xl px-5 py-3.5 hover:bg-[var(--accent)]/15 transition"
            >
              <span className="text-sm font-semibold">Verify your identity to send money</span>
              <span className="text-sm">→</span>
            </Link>
          </Reveal>
        )}

        {/* HERO — balance (left) + globe tile (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Balance */}
          <Reveal className="lg:col-span-3">
            <BalanceCard balance={balance} currency={currency} />
          </Reveal>

          {/* Compact globe */}
          <Reveal className="lg:col-span-2" delay={120}>
            <CompactGlobeTile ready={globeReady} onExpand={() => setGlobeOpen(true)} />
          </Reveal>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Reveal delay={0}>
            <Stat label="Transfers" value={transfers.length} />
          </Reveal>
          <Reveal delay={80}>
            <Stat label="In flight" value={inFlightCount} accent="accent" pulse={inFlightCount > 0} />
          </Reveal>
          <Reveal delay={160}>
            <Stat label="Delivered" value={deliveredCount} accent="mint" />
          </Reveal>
        </div>

        {/* Transfers */}
        <div>
          <Reveal>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-[var(--foreground)] tracking-tight">Recent transfers</h2>
              {transfers.length > 0 && (
                <Link
                  href="/wallet/transactions"
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-deep)] font-semibold uppercase tracking-wider"
                >
                  All activity →
                </Link>
              )}
            </div>
          </Reveal>

          {transfers.length === 0 ? (
            <Reveal>
              <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-12 text-center">
                <p className="text-[var(--foreground)] font-bold text-lg">No transfers yet</p>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  Send your first transfer to a recipient.
                </p>
                <Link
                  href="/send"
                  className="inline-block mt-5 bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-2.5 rounded-full hover:bg-[var(--accent-deep)] transition"
                >
                  Send money →
                </Link>
              </div>
            </Reveal>
          ) : (
            <div className="space-y-2">
              {transfers.map((t, i) => (
                <Reveal key={t.id} delay={Math.min(i, 8) * 60}>
                  <Link href={`/transfers/${t.id}`}>
                    <div className="group bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 flex items-center justify-between hover:border-[var(--accent)]/60 hover:bg-[var(--surface-elevated)] transition cursor-pointer">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--accent)] font-bold">
                          {t.recipient?.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{t.recipient?.name || 'Unknown'}</p>
                          <p className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono tabular">
                            {parseFloat(t.amount).toFixed(2)} {t.sendCurrency} →{' '}
                            {t.receiveAmount ? parseFloat(t.receiveAmount).toFixed(2) : '—'} {t.receiveCurrency}
                          </p>
                          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mt-0.5">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border ${
                          statusStyle[t.status] || 'bg-[var(--surface)] text-[var(--muted-foreground)] border-[var(--border)]'
                        }`}
                      >
                        {statusLabels[t.status] || t.status}
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen globe modal */}
      {globeOpen && <GlobeModal onClose={() => setGlobeOpen(false)} />}
    </div>
  );
}

/* ─── Balance card ────────────────────────────────────────────────────── */
function BalanceCard({ balance, currency }: { balance: number; currency: string }) {
  const live = useCountUp(balance, 1100);
  return (
    <div
      className="relative h-full rounded-3xl border border-[var(--border-strong)] p-8 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, var(--surface-elevated) 0%, var(--surface) 60%, var(--background) 100%)',
      }}
    >
      <div
        className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, var(--accent), transparent 70%)',
          animation: 'aurora 7s ease-in-out infinite',
        }}
      />
      <div className="relative flex flex-col h-full">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
            Available balance
          </p>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              style={{ animation: 'pulse-soft 1.8s ease-in-out infinite' }}
            />
            Live
          </span>
        </div>
        <p className="text-5xl sm:text-6xl font-extrabold tracking-tight tabular text-[var(--foreground)] mt-2 leading-none">
          {live.toFixed(2)}
          <span className="text-[var(--muted-foreground)] text-2xl ml-2 font-bold align-baseline">
            {currency}
          </span>
        </p>
        <div className="mt-auto pt-7 flex flex-wrap gap-3">
          <MagneticButton strength={0.32}>
            <Link
              href="/send"
              className="inline-block bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-3 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/20"
            >
              Send money →
            </Link>
          </MagneticButton>
          <MagneticButton strength={0.24}>
            <Link
              href="/wallet/fund"
              className="inline-block border border-[var(--border-strong)] text-[var(--foreground)] text-sm font-semibold px-6 py-3 rounded-full hover:border-[var(--accent)] hover:bg-[var(--surface)] transition"
            >
              + Add money
            </Link>
          </MagneticButton>
        </div>
      </div>
    </div>
  );
}

/* ─── Compact globe tile ──────────────────────────────────────────────── */
function CompactGlobeTile({ ready, onExpand }: { ready: boolean; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="group relative w-full h-full min-h-[260px] rounded-3xl border border-[var(--border-strong)] overflow-hidden text-left bg-[var(--surface)] hover:border-[var(--accent)]/60 transition"
      aria-label="Open world view"
    >
      <div className="absolute inset-0">
        {ready ? (
          <Globe3D
            mode="passive"
            height={320}
            samples={7000}
            autoRotateSpeed={0.28}
            arcs={MEOW_CORRIDORS}
          />
        ) : (
          <GlobeSkeleton />
        )}
      </div>

      {/* Soft top gradient + label */}
      <div className="absolute inset-x-0 top-0 p-5 flex items-baseline justify-between pointer-events-none">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold">
            Your corridors
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] mt-1">
            Canada → India · Pakistan
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold group-hover:text-[var(--accent)] transition">
          Expand ↗
        </span>
      </div>
    </button>
  );
}

function GlobeSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[var(--surface)]">
      <div
        className="w-40 h-40 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 35% 30%, #f4f7fc 0%, #e6ebf3 55%, #c8cfdb 100%)',
          animation: 'pulse-soft 2.2s ease-in-out infinite',
        }}
      />
    </div>
  );
}

/* ─── Fullscreen globe modal ──────────────────────────────────────────── */
function GlobeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 backdrop-blur-md"
      style={{ background: 'rgba(255, 255, 255, 0.88)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold">
              World view
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-0.5">
              Drag to spin · scroll the page to tilt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[var(--surface)] flex items-center justify-center text-[var(--foreground)] text-lg font-bold transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Globe3D mode="interactive" height="100%" samples={12000} arcs={MEOW_CORRIDORS} />
        </div>
      </div>
    </div>
  );
}

/* ─── Nav + stat helpers ──────────────────────────────────────────────── */
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

function Stat({
  label,
  value,
  accent,
  pulse,
}: {
  label: string;
  value: number;
  accent?: 'accent' | 'mint';
  pulse?: boolean;
}) {
  const color =
    accent === 'accent'
      ? 'text-[var(--accent)]'
      : accent === 'mint'
      ? 'text-[var(--mint)]'
      : 'text-[var(--foreground)]';
  const live = useCountUp(value, 700);
  return (
    <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 overflow-hidden">
      {pulse && (
        <span
          className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[var(--accent)]"
          style={{ animation: 'pulse-soft 1.6s ease-in-out infinite' }}
        />
      )}
      <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
        {label}
      </p>
      <p className={`text-3xl font-extrabold mt-1.5 tabular ${color}`}>
        {Math.round(live)}
      </p>
    </div>
  );
}
