'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RealisticCat } from './RealisticCat';

/**
 * Floating guide cat — bottom-right on every customer-facing page.
 * Tap her to toggle the speech bubble. Copy adapts to the page.
 *
 * Hidden on /admin/*, /login, /register, and /transfers/:id (the latter
 * already shows the cat prominently on its timeline).
 */

const HIDE_ON: (string | RegExp)[] = [
  /^\/admin/,
  /^\/transfers\//,
];

const COPY: { match: RegExp; title: string; body: string }[] = [
  {
    match: /^\/dashboard/,
    title: 'Welcome back',
    body: 'Tap Send Money to start a new transfer, or Add Money to top up your wallet.',
  },
  {
    match: /^\/send/,
    title: 'Send money',
    body: 'Pick a recipient, enter the amount. I lock the rate the moment you tap Send.',
  },
  {
    match: /^\/recipients/,
    title: 'Recipients',
    body: 'Add the family members you send to. The bank account is what gets paid.',
  },
  {
    match: /^\/profile/,
    title: 'Your profile',
    body: 'Verify your identity here — Canada requires it before I can carry your money.',
  },
  {
    match: /^\/wallet\/fund/,
    title: 'Top up',
    body: 'Add money so I have something to carry. Daily limit is 20,000.',
  },
  {
    match: /^\/wallet\/transactions/,
    title: 'Activity',
    body: 'Everything that went in and out of your wallet, newest first.',
  },
  {
    match: /.*/,
    title: 'Hi!',
    body: "I'm Meow, your guide. Tap me anytime for help.",
  },
];

const STORAGE_KEY = 'meow.catguide.dismissed';

export function CatGuide() {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const [introShown, setIntroShown] = useState(false);

  const shouldHide = HIDE_ON.some((m) =>
    typeof m === 'string' ? pathname === m : m.test(pathname),
  );

  useEffect(() => {
    if (shouldHide) return;
    // Show the bubble briefly on the first visit per session.
    if (typeof window !== 'undefined' && !sessionStorage.getItem(STORAGE_KEY)) {
      if (!introShown) {
        setOpen(true); // eslint-disable-line react-hooks/set-state-in-effect
        setIntroShown(true);
        const t = setTimeout(() => setOpen(false), 5000);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, shouldHide, introShown]);

  if (shouldHide) return null;

  const copy = COPY.find((c) => c.match.test(pathname)) ?? COPY[COPY.length - 1];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-end gap-3 pointer-events-none">
      {open && (
        <div
          className="pointer-events-auto bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-2xl shadow-xl max-w-[260px] p-4 mb-1"
          style={{ animation: 'float-up 240ms ease-out both' }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">
              {copy.title}
            </p>
            <button
              onClick={() => {
                setOpen(false);
                if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, '1');
              }}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-[var(--foreground)] mt-1.5 leading-snug">{copy.body}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto relative hover:scale-105 active:scale-95 transition"
        style={{
          width: 96,
          height: 96,
          filter: 'drop-shadow(0 12px 24px rgba(224,178,89,0.4))',
        }}
        aria-label="Meow guide"
      >
        <RealisticCat status="payout_processing" size={96} transparent="alpha" />
        {!open && (
          <span
            className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[var(--accent)] border-2 border-[var(--background)]"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}
