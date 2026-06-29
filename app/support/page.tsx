'use client';

import Link from 'next/link';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal } from '@/app/_components/motion';

/**
 * Real support page (not a teaser) — every channel a remittance app
 * needs to surface, in priority of how fast you get a human. Live chat
 * first, callback next, email + phone, then self-serve (status + FAQ).
 */

interface Channel {
  eyebrow: string;
  title: string;
  blurb: string;
  cta: string;
  href?: string;
  onClick?: () => void;
  highlight?: boolean;
  meta?: string;
  icon: (props: { className?: string }) => React.JSX.Element;
}

export default function SupportPage() {
  const channels: Channel[] = [
    {
      eyebrow: 'Fastest',
      title: 'Live chat',
      blurb: 'Tap to message a human. Median reply under 90 seconds, 24 / 7.',
      cta: 'Start chat',
      onClick: () => {
        if (typeof window !== 'undefined') alert('Chat widget coming soon — meanwhile email support@meow.app');
      },
      highlight: true,
      meta: 'Online now',
      icon: ChatIcon,
    },
    {
      eyebrow: 'Talk to a person',
      title: 'Call us toll-free',
      blurb: 'Canada: 1-800-MEOW-NOW · Mon–Sun, 7 am – midnight ET.',
      cta: 'Call now',
      href: 'tel:+18006369669',
      meta: '< 3 min average wait',
      icon: PhoneIcon,
    },
    {
      eyebrow: 'For the long ones',
      title: 'Email support',
      blurb: 'Best for receipts, disputes, KYC questions. We reply within 4 hours.',
      cta: 'support@meow.app',
      href: 'mailto:support@meow.app',
      icon: MailIcon,
    },
    {
      eyebrow: 'Self-serve',
      title: 'Help centre',
      blurb: 'Step-by-step guides for KYC, sending, recipients, and rate-locking.',
      cta: 'Browse articles →',
      href: '/help',
      icon: BookIcon,
    },
    {
      eyebrow: 'Live status',
      title: 'System status',
      blurb: 'See whether deposits, FX, or payouts to any corridor are running normally right now.',
      cta: 'View status page →',
      href: '/status',
      icon: PulseIcon,
    },
    {
      eyebrow: 'Stuck on a transfer?',
      title: 'Track or cancel',
      blurb: 'Most in-flight transfers can be cancelled in the first 30 minutes — straight from your activity.',
      cta: 'Go to Activity',
      href: '/wallet/transactions',
      icon: TrackIcon,
    },
  ];

  return (
    <div className="relative min-h-screen bg-[var(--background)] overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-[40vh] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,232,176,0.45) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      <div className="relative z-10">
        <nav className="px-6 py-5 flex items-center justify-between">
          <BrandWordmark />
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)] hover:text-[var(--foreground)] font-semibold transition"
          >
            ← Back
          </Link>
        </nav>

        <main className="max-w-4xl mx-auto px-5 sm:px-8 pt-6 sm:pt-12 pb-20">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--accent)] font-bold">
              We&apos;re here
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              How can we help?
            </h1>
            <p className="mt-4 text-[var(--muted-foreground)] text-base leading-relaxed max-w-2xl">
              Real money matters. Pick the channel that fits — live chat is the fastest, the help centre is the most thorough, and a phone line is open if it&apos;s urgent.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {channels.map((c, i) => (
              <Reveal key={c.title} delay={80 + i * 60}>
                <ChannelCard {...c} />
              </Reveal>
            ))}
          </div>

          <Reveal delay={520}>
            <p className="mt-12 text-xs text-[var(--muted-foreground)] text-center">
              Lost access to your account? Email{' '}
              <a href="mailto:recover@meow.app" className="text-[var(--accent)] font-semibold hover:underline">
                recover@meow.app
              </a>{' '}
              from the address on file.
            </p>
          </Reveal>
        </main>
      </div>
    </div>
  );
}

function ChannelCard({ eyebrow, title, blurb, cta, href, onClick, highlight, meta, icon: Icon }: Channel) {
  const inner = (
    <div
      className={`group relative h-full rounded-3xl border bg-[var(--surface-elevated)]/85 backdrop-blur-md p-6 transition hover:-translate-y-1 ${
        highlight
          ? 'border-[var(--accent)]/55 hover:border-[var(--accent)] shadow-lg shadow-[var(--accent)]/15'
          : 'border-[var(--border-strong)] hover:border-[var(--accent)]/55'
      }`}
    >
      {meta && (
        <span className="absolute top-3 right-3 text-[9px] uppercase tracking-[0.2em] font-bold flex items-center gap-1.5 text-[var(--mint)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--mint)]" style={{ animation: 'pulse-soft 1.8s ease-in-out infinite' }} />
          {meta}
        </span>
      )}
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
          highlight
            ? 'bg-[var(--accent)] text-[var(--ink)] border-[var(--accent)]'
            : 'bg-[var(--background)] text-[var(--accent)] border-[var(--border-strong)]'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">{eyebrow}</p>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-[13px] text-[var(--muted-foreground)] leading-snug">{blurb}</p>
      <p className="mt-5 text-sm font-semibold text-[var(--accent)] group-hover:text-[var(--accent-deep)] transition">
        {cta}
      </p>
    </div>
  );

  if (href) {
    return (
      <MagneticButton strength={0.16} className="block h-full">
        <Link href={href} className="block h-full">
          {inner}
        </Link>
      </MagneticButton>
    );
  }
  return (
    <MagneticButton strength={0.16} className="block h-full">
      <button type="button" onClick={onClick} className="block h-full text-left w-full">
        {inner}
      </button>
    </MagneticButton>
  );
}

/* ─── line-art icons ─────────────────────────────────────────────────── */
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11c0 4 -4 7 -9 7 -1.5 0 -2.9 -0.3 -4 -0.8 L3 19 L4 15.5 C3.4 14.2 3 12.7 3 11 3 7 7 4 12 4 s9 3 9 7 Z" />
      <path d="M8 11 H8.01 M12 11 H12.01 M16 11 H16.01" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4 L9 4 L11 9 L8.5 10.5 a11 11 0 0 0 5 5 L15 13 L20 15 V19 a2 2 0 0 1 -2 2 C10 21 3 14 3 6 a2 2 0 0 1 2 -2 Z" />
    </svg>
  );
}
function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.4" />
      <path d="M3 7 L12 13 L21 7" />
    </svg>
  );
}
function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5 a2 2 0 0 1 2 -2 H20 V19 H6 a2 2 0 0 0 -2 2 Z" />
      <path d="M4 19 a2 2 0 0 1 2 -2 H20" />
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
function TrackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="11" r="3" />
      <path d="M12 21 C7 15 4 12 4 8 a8 8 0 0 1 16 0 c0 4 -3 7 -8 13 Z" />
    </svg>
  );
}
