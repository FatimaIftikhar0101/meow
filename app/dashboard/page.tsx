'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal, useCountUp } from '@/app/_components/motion';
import { MEOW_CORRIDORS } from '@/app/_components/Globe3D';
import { CatConstellation } from '@/app/_components/CatConstellation';

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

interface Corridor {
  fromCurrency: string;
  toCurrency: string;
  baseRate: string;   // Decimal serialised as string
  marginBps: number;
}

/** Apply the FX margin to a raw base rate to get the customer-facing one. */
function appliedRate(c: Corridor): number {
  const raw = parseFloat(c.baseRate);
  return raw * (1 - c.marginBps / 10000);
}

export default function DashboardPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState('CAD');
  const [inFlight, setInFlight] = useState(0);
  const [name, setName] = useState('');
  const [kycPassed, setKycPassed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [globeReady, setGlobeReady] = useState(false);
  const [corridors, setCorridors] = useState<Corridor[]>([]);

  // Defer mounting the globe past the launcher's first paint.
  useEffect(() => {
    const id = window.setTimeout(() => setGlobeReady(true), 80);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [walletRes, transfersRes, profileRes, kycRes, corridorsRes] = await Promise.all([
          api.get('/wallet/balance'),
          api.get('/transfers'),
          api.get('/auth/profile'),
          api.get('/compliance/status'),
          api.get('/corridors'),
        ]);
        setCorridors(corridorsRes.data);
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
              {corridors.length > 0 && <RatesStrip corridors={corridors} />}
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
      {/* Warm wash — top band only, kept clear of the globe centre so
          the white globe circle blends seamlessly with the page. */}
      <div
        className="absolute inset-x-0 top-0 h-[40vh]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,232,176,0.45) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Dynamic globe — the rounded-full clip alone leaves a faint band
          at the perimeter from the contact shadow + scene clearColor.
          A radial mask fades the canvas to transparent past the
          sphere silhouette, so the page bleeds through smoothly. */}
      <div
        className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden"
        style={{
          width: 'min(580px, 86vw)',
          height: 'min(580px, 86vw)',
          filter: 'saturate(0.92)',
          maskImage:
            'radial-gradient(circle at 50% 50%, black 56%, rgba(0,0,0,0.6) 68%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 50%, black 56%, rgba(0,0,0,0.6) 68%, transparent 78%)',
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

      {/* Constellation cat — celestial accent on top of the globe.
          Sized smaller (the globe's the hero) and centered on the
          same point so it reads as a mark on the planet, not a
          separate object floating beside it. */}
      <div
        className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 'min(360px, 60vw)',
          height: 'min(360px, 60vw)',
          filter: 'drop-shadow(0 0 12px rgba(224,178,89,0.3))',
          animation: 'motif-drift 18s ease-in-out infinite',
        }}
      >
        <CatConstellation size={360} stroke="var(--accent)" className="w-full h-full" />
      </div>

      {/* Soft outer vignette — fades the page edges so the tiles read
          clean and the centre stays bright on the globe + constellation. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 54%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.55) 78%, rgba(255,255,255,0.85) 100%)',
        }}
      />
    </div>
  );
}

/* ─── Live rates strip ───────────────────────────────────────────────── */
function RatesStrip({ corridors }: { corridors: Corridor[] }) {
  // Show only CAD → PKR and CAD → INR (the launch corridors).
  const launch = corridors
    .filter((c) => c.fromCurrency === 'CAD' && (c.toCurrency === 'PKR' || c.toCurrency === 'INR'))
    .sort((a, b) => a.toCurrency.localeCompare(b.toCurrency));
  if (!launch.length) return null;
  return (
    <div className="mt-5 inline-flex items-center gap-2 sm:gap-3 px-4 py-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)]/70 backdrop-blur-md">
      <span className="text-[9px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-[var(--mint)]"
          style={{ animation: 'pulse-soft 1.8s ease-in-out infinite' }}
        />
        Live
      </span>
      {launch.map((c, i) => (
        <span key={`${c.fromCurrency}-${c.toCurrency}`} className="flex items-center gap-2 text-xs">
          {i > 0 && <span className="text-[var(--border-strong)]">·</span>}
          <span className="text-[var(--muted-foreground)] font-semibold">
            1 {c.fromCurrency}
          </span>
          <span className="text-[var(--foreground)] font-mono tabular font-bold">
            {appliedRate(c).toFixed(2)}
          </span>
          <span className="text-[var(--accent)] font-semibold">{c.toCurrency}</span>
        </span>
      ))}
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
  soon?: boolean;
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
    href: '/send/recurring',
    label: 'Recurring',
    sub: 'Same family, every month.',
    icon: RepeatIcon,
    soon: true,
  },
  {
    href: '/rate-alerts',
    label: 'Rate alerts',
    sub: 'Notify when CAD → PKR hits your target.',
    icon: BellIcon,
    soon: true,
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
    href: '/bill-pay',
    label: 'Bill pay abroad',
    sub: 'Pay PK / IN utilities directly.',
    icon: ReceiptIcon,
    soon: true,
  },
  {
    href: '/mobile-recharge',
    label: 'Mobile recharge',
    sub: 'Top up their phone, instantly.',
    icon: PhoneIcon,
    soon: true,
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
  {
    href: '/refer',
    label: 'Refer & earn',
    sub: 'Get $15 in credit when a friend sends.',
    icon: GiftIcon,
    soon: true,
  },
  {
    href: '/support',
    label: 'Help & support',
    sub: 'Live chat, phone, email — 24 / 7.',
    icon: SupportIcon,
  },
];

function Tile({ href, label, sub, icon: Icon, highlight, soon }: Destination) {
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

        {soon && (
          <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
            Soon
          </span>
        )}

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
          {!soon && (
            <span
              className="text-[var(--muted-foreground)] group-hover:text-[var(--accent)] transition text-lg leading-none translate-x-0 group-hover:translate-x-1 transition-transform"
              aria-hidden="true"
            >
              →
            </span>
          )}
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
function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9 H17 L14 6 M4 9 L7 12" />
      <path d="M20 15 H7 L10 18 M20 15 L17 12" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 16 V11 a6 6 0 0 1 12 0 V16 L20 18 H4 Z" />
      <path d="M10 21 a2 2 0 0 0 4 0" />
    </svg>
  );
}
function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3 H18 V21 L15.5 19 L13 21 L10.5 19 L8 21 L6 19 Z" />
      <path d="M9 8 H15 M9 12 H15 M9 16 H13" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M11 18 H13" />
    </svg>
  );
}
function GiftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M3 13 H21 M12 9 V20" />
      <path d="M12 9 C 9 9, 7 7, 8 5 a 2 2 0 0 1 4 0 a 2 2 0 0 1 4 0 c 1 2 -1 4 -4 4 Z" />
    </svg>
  );
}
function SupportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9 a 3 3 0 0 1 6 0 c 0 2 -3 2 -3 4" />
      <path d="M12 17 H12.01" />
    </svg>
  );
}
