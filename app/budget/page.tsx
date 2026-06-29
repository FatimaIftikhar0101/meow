'use client';

import Link from 'next/link';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal } from '@/app/_components/motion';

/**
 * Budget Friend — the AI money buddy preview page. Not a generic
 * ComingSoon teaser: shows a real mock dashboard of what the feature
 * looks like (insights, deltas, recurring detection) so the user can
 * see and feel what they're signing up for.
 */
export default function BudgetPage() {
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
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-[0.32em] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30">
                AI · Beta
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
                Budget Friend
              </span>
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              Your money learns you.
            </h1>
            <p className="mt-4 text-[var(--muted-foreground)] text-base leading-relaxed max-w-2xl">
              Meet Budget — your quiet AI friend who watches every transfer, learns the
              rhythm of your month, and tells you what changed. No setup, no spreadsheets,
              no judgment. She just notices.
            </p>
          </Reveal>

          {/* Preview cards — what the feature looks like */}
          <Reveal delay={120}>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                eyebrow="This month so far"
                value="$2,140"
                deltaLabel="vs $2,580 last month"
                deltaDirection="down"
                deltaAmount="−$440"
                accent="mint"
              />
              <SummaryCard
                eyebrow="Saved vs Sept"
                value="$420"
                deltaLabel="below your average"
                deltaDirection="down"
                deltaAmount="3 fewer sends"
                accent="accent"
              />
              <SummaryCard
                eyebrow="Next forecast"
                value="$2,820"
                deltaLabel="by end of Oct, based on the last 6 months"
                deltaDirection="flat"
              />
            </div>
          </Reveal>

          {/* Insight feed — what Budget Friend would actually tell you */}
          <Reveal delay={220}>
            <div className="mt-6 rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-elevated)]/85 backdrop-blur-md p-6">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold">
                What she noticed
              </p>
              <ul className="mt-4 space-y-3">
                <Insight
                  tag="recurring"
                  text="You send Aysha $400 around the 5th of every month. She picked it up after 3 months and now forecasts it automatically — no need to set up a standing order."
                />
                <Insight
                  tag="spike"
                  text="You spent $180 more on transfers to family this month — two extra sends to Mom on the 14th and the 22nd. Was it Eid? Tap to label it."
                  warm
                />
                <Insight
                  tag="saved"
                  text="You held off on a $200 transfer when the CAD→PKR rate dipped below 78. Smart — the rate recovered the next day."
                />
                <Insight
                  tag="tip"
                  text="Your sends always land 1–2 days before salary day. Want her to remind you the day before, so you can lock the rate earlier?"
                />
              </ul>
            </div>
          </Reveal>

          {/* CTA */}
          <Reveal delay={340}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticButton strength={0.26}>
                <button
                  type="button"
                  onClick={() => alert('Beta opens November — you’re on the list.')}
                  className="inline-block bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-3 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/20"
                >
                  Join the beta
                </button>
              </MagneticButton>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
              >
                Back to home
              </Link>
              <p className="text-xs text-[var(--muted-foreground)] basis-full sm:basis-auto">
                All insights stay on your device. We never sell your data.
              </p>
            </div>
          </Reveal>
        </main>
      </div>
    </div>
  );
}

function SummaryCard({
  eyebrow,
  value,
  deltaLabel,
  deltaAmount,
  deltaDirection,
  accent,
}: {
  eyebrow: string;
  value: string;
  deltaLabel: string;
  deltaAmount?: string;
  deltaDirection: 'up' | 'down' | 'flat';
  accent?: 'accent' | 'mint';
}) {
  const valColor =
    accent === 'mint' ? 'text-[var(--mint)]' : accent === 'accent' ? 'text-[var(--accent)]' : 'text-[var(--foreground)]';
  const arrow = deltaDirection === 'up' ? '↑' : deltaDirection === 'down' ? '↓' : '·';
  return (
    <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-elevated)]/85 backdrop-blur-md p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
        {eyebrow}
      </p>
      <p className={`mt-2 text-3xl font-extrabold tabular ${valColor}`}>{value}</p>
      <p className="mt-3 text-xs text-[var(--muted-foreground)] leading-snug">
        {deltaAmount && (
          <span className="font-bold text-[var(--foreground)] mr-1.5">
            {arrow} {deltaAmount}
          </span>
        )}
        {deltaLabel}
      </p>
    </div>
  );
}

function Insight({ tag, text, warm }: { tag: string; text: string; warm?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 text-[9px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full shrink-0 ${
          warm
            ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/30'
            : 'bg-[var(--mint-soft)] text-[var(--mint)] border border-[var(--mint)]/30'
        }`}
      >
        {tag}
      </span>
      <p className="text-sm text-[var(--foreground)] leading-relaxed">{text}</p>
    </li>
  );
}
