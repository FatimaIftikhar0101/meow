'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal, useCountUp } from '@/app/_components/motion';
import { MEOW_CORRIDORS } from '@/app/_components/Globe3D';
import { CatSkull } from '@/app/_components/CatSkull';

/* The globe sits in the background — passive, slow, low-density. It's a
 * mood-setter, not an interactive object. Lazy-imported so the launcher
 * paints first; the three.js chunk arrives just after. */
const Globe3D = dynamic(() => import('@/app/_components/Globe3D'), {
  ssr: false,
  loading: () => null,
});

const IN_FLIGHT = new Set([
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
]);

export default function DashboardPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('CAD');
  const [inFlight, setInFlight] = useState(0);
  const [name, setName] = useState('');
  const [kycPassed, setKycPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [globeReady, setGlobeReady] = useState(false);

  // Defer mounting the globe past the launcher's first paint.
  useEffect(() => {
    const id = window.setTimeout(() => setGlobeReady(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [walletRes, transfersRes, profileRes, kycRes] = await Promise.all([
          api.get('/wallet/balance'),
          api.get('/transfers'),
          api.get('/auth/profile'),
          api.get('/compliance/status'),
        ]);
        setBalance(parseFloat(walletRes.data.balance) || 0);
        setCurrency(walletRes.data.currency);
        const first =
          profileRes.data.firstName ||
          profileRes.data.name ||
          (profileRes.data.email ? profileRes.data.email.split('@')[0] : '');
        setName(first);
        setKycPassed(kycRes.data.status === 'passed');
        setInFlight(
          (transfersRes.data as { status: string }[]).filter((t) => IN_FLIGHT.has(t.status)).length,
        );
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)] text-sm tracking-widest uppercase">Loading</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--background)] overflow-hidden">
      {/* ─── Background layers (globe + skull + warm wash) ─── */}
      <BackgroundMotif globeReady={globeReady} />

      {/* ─── Foreground (nav + greeting + tiles) ─── */}
      <div className="relative z-10">
        <nav className="px-6 py-5 flex items-center justify-between">
          <BrandWordmark />
          <Link
            href="/profile"
            className="w-10 h-10 rounded-full bg-[var(--surface-elevated)]/80 backdrop-blur-md border border-[var(--border-strong)] flex items-center justify-center text-[var(--foreground)] text-sm font-bold hover:border-[var(--accent)] transition"
          >
            {name ? name[0].toUpperCase() : '·'}
          </Link>
        </nav>

        <main className="max-w-5xl mx-auto px-5 sm:px-8 pt-6 pb-20">
          {/* Greeting strip */}
          <Reveal>
            <header className="text-center mb-12">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--accent)] font-bold">
                Meow ·  Welcome back
              </p>
              <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
                {name ? `Hi, ${cap(name)}.` : 'Hello.'}
              </h1>
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                <BalanceTicker amount={balance} currency={currency} />
                {inFlight > 0 && (
                  <>
                    {'  ·  '}
                    <span className="text-[var(--accent)] font-semibold">
                      {inFlight} in flight
                    </span>
                  </>
                )}
              </p>
            </header>
          </Reveal>

          {kycPassed === false && (
            <Reveal delay={80}>
              <Link
                href="/profile"
                className="flex items-center justify-between bg-[var(--surface-elevated)]/85 backdrop-blur-md border border-[var(--accent)]/40 text-[var(--accent)] rounded-2xl px-5 py-3.5 mb-8 hover:bg-[var(--accent-soft)] transition"
              >
                <span className="text-sm font-semibold">Verify your identity to send money</span>
                <span className="text-sm">→</span>
              </Link>
            </Reveal>
          )}

          {/* Destination tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {DESTINATIONS.map((d, i) => (
              <Reveal key={d.href} delay={120 + i * 70}>
                <Tile {...d} />
              </Reveal>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Background composition ──────────────────────────────────────────── */
function BackgroundMotif({ globeReady }: { globeReady: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* warm wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,234,178,0.55) 0%, rgba(255,255,255,0) 55%)',
        }}
      />
      {/* dynamic globe — large, soft, behind everything */}
      <div
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 'min(640px, 92vw)',
          height: 'min(640px, 92vw)',
          opacity: 0.55,
          filter: 'saturate(0.9)',
        }}
      >
        {globeReady && (
          <Globe3D
            mode="passive"
            height="100%"
            samples={6500}
            autoRotateSpeed={0.18}
            arcs={MEOW_CORRIDORS}
          />
        )}
      </div>
      {/* cat skull sketch overlaid in the middle */}
      <div
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 'min(440px, 70vw)',
          height: 'min(440px, 70vw)',
          opacity: 0.32,
          filter: 'drop-shadow(0 0 18px rgba(224,178,89,0.35))',
          animation: 'skull-drift 14s ease-in-out infinite',
        }}
      >
        <CatSkull size={440} stroke="var(--accent)" className="w-full h-full" />
      </div>
      {/* subtle vignette so tiles read clean over the motif */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.65) 78%, rgba(255,255,255,0.92) 100%)',
        }}
      />
    </div>
  );
}

/* ─── Balance ticker ──────────────────────────────────────────────────── */
function BalanceTicker({ amount, currency }: { amount: number; currency: string }) {
  const live = useCountUp(amount, 1000);
  return (
    <span className="font-mono tabular text-[var(--foreground)] font-semibold">
      {live.toFixed(2)} {currency}
    </span>
  );
}

/* ─── Destination tiles ───────────────────────────────────────────────── */
interface Destination {
  href: string;
  label: string;
  sub: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  highlight?: boolean;
}

const DESTINATIONS: Destination[] = [
  {
    href: '/send',
    label: 'Send money',
    sub: 'A new transfer — locked rate.',
    icon: PlaneIcon,
    highlight: true,
  },
  {
    href: '/wallet/fund',
    label: 'Top up wallet',
    sub: 'Add CAD so it’s ready to go.',
    icon: CoinIcon,
  },
  {
    href: '/recipients',
    label: 'Recipients',
    sub: 'The people you send to.',
    icon: HeartIcon,
  },
  {
    href: '/wallet/transactions',
    label: 'Activity',
    sub: 'Every transfer, every cent.',
    icon: PulseIcon,
  },
  {
    href: '/profile',
    label: 'Profile & ID',
    sub: 'Verification + settings.',
    icon: ShieldIcon,
  },
];

function Tile({ href, label, sub, icon: Icon, highlight }: Destination) {
  return (
    <MagneticButton strength={0.18} className="block h-full">
      <Link
        href={href}
        className={`group relative block h-full rounded-3xl border bg-[var(--surface-elevated)]/85 backdrop-blur-md p-6 transition will-change-transform hover:-translate-y-1 ${
          highlight
            ? 'border-[var(--accent)]/55 hover:border-[var(--accent)] shadow-lg shadow-[var(--accent)]/15'
            : 'border-[var(--border-strong)] hover:border-[var(--accent)]/55'
        }`}
      >
        {/* corner accent — slowly fills on hover */}
        <span
          className="absolute top-0 right-0 w-10 h-10 rounded-bl-3xl rounded-tr-3xl opacity-0 group-hover:opacity-100 transition"
          style={{
            background: 'radial-gradient(circle at top right, var(--accent-soft), transparent 70%)',
          }}
        />

        <div className="flex items-start justify-between">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition ${
              highlight
                ? 'bg-[var(--accent)] text-[var(--ink)] border-[var(--accent)]'
                : 'bg-[var(--background)] text-[var(--accent)] border-[var(--border-strong)] group-hover:border-[var(--accent)]'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <span
            className="text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition text-lg leading-none translate-x-0 group-hover:translate-x-1 transition-transform"
            aria-hidden="true"
          >
            →
          </span>
        </div>

        <p className="mt-6 text-lg font-bold tracking-tight text-[var(--foreground)]">{label}</p>
        <p className="mt-1 text-[13px] text-[var(--muted-foreground)] leading-snug">{sub}</p>
      </Link>
    </MagneticButton>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Inline line-art icons (match the cat skull's stroke vibe) ───────── */
function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12 L21 5 L14 12 L21 19 Z" />
      <path d="M14 12 L8 12" />
    </svg>
  );
}
function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7 V17 M9 9.5 H14 a1.8 1.8 0 0 1 0 3.6 H10 a1.8 1.8 0 0 0 0 3.6 H15" />
    </svg>
  );
}
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20 C 5 15, 3 11, 5 8 a 3.6 3.6 0 0 1 7 0 a 3.6 3.6 0 0 1 7 0 c 2 3, 0 7, -7 12 Z" />
    </svg>
  );
}
function PulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12 H7 L9 6 L12 18 L15 9 L17 12 H21" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 L20 6 V12 C20 17, 16 20, 12 21 C8 20, 4 17, 4 12 V6 Z" />
      <path d="M9 12 L11 14 L15 10" />
    </svg>
  );
}
