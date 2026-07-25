'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandWordmark } from '@/app/_components/Brand';
import { MagneticButton, Reveal } from '@/app/_components/motion';

/**
 * Shared teaser page for destinations that are wired into the launcher
 * but not yet built end-to-end. Tells the user what it'll do, lets
 * them opt-in to a notification, leaves them with a way back.
 */
export function ComingSoon({
  eyebrow,
  title,
  blurb,
  bullets,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  bullets: string[];
}) {
  const [optedIn, setOptedIn] = useState(false);

  return (
    <div className="relative min-h-screen bg-[var(--background)] overflow-hidden">
      {/* warm wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 28%, var(--comingsoon-wash) 0%, transparent 60%)',
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

        <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-20 pb-20">
          <Reveal>
            <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--accent)] font-bold">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
              {title}
            </h1>
            <p className="mt-4 text-[var(--muted-foreground)] text-base leading-relaxed">
              {blurb}
            </p>
          </Reveal>

          <Reveal delay={120}>
            <ul className="mt-10 space-y-3">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 bg-[var(--surface-elevated)]/85 backdrop-blur-md border border-[var(--border)] rounded-2xl px-5 py-4"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                  <span className="text-sm text-[var(--foreground)] leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex items-center gap-4">
              <MagneticButton strength={0.28}>
                {optedIn ? (
                  <span className="inline-block bg-[var(--mint-soft)] border border-[var(--mint)]/40 text-[var(--mint)] text-sm font-bold px-6 py-3 rounded-full">
                    ✓ You’re on the list
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOptedIn(true)}
                    className="inline-block bg-[var(--accent)] text-[var(--ink)] text-sm font-bold px-6 py-3 rounded-full hover:bg-[var(--accent-deep)] transition shadow-lg shadow-[var(--accent)]/20"
                  >
                    Notify me when it’s live
                  </button>
                )}
              </MagneticButton>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
              >
                Back to home
              </Link>
            </div>
          </Reveal>
        </main>
      </div>
    </div>
  );
}

export default ComingSoon;
