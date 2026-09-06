import type { ReactNode } from 'react';

/**
 * The frame around every screen you can reach without being signed in.
 *
 * Sign-in, claiming an invitation, and enrolling in two-factor were three
 * identical white cards floating on grey. That is not wrong, but it is the
 * first thing a colleague sees every morning and the only screen in the panel
 * with room to spare — everything past this point is a table earning its
 * pixels.
 *
 * So it is the one place the panel spends any. The left panel is `slab`, the
 * role the design system describes as "the one large colour object per screen"
 * and which this app had defined, measured — `on-slab` clears 11.54:1 — and
 * then never used. Nothing new was invented for this screen; the colour was
 * already sitting in index.css waiting for something to be large.
 *
 * The shape is borrowed from the split card the brief pointed at: a coloured
 * panel with a deep curve where it meets the form. What is deliberately not
 * borrowed is the rest of that pattern. No social sign-in buttons — staff
 * accounts arrive by invitation and there is no Google path to offer, so those
 * buttons would be decoration that lies. No glass, no floating 3D props: the
 * audience is a compliance officer at nine in the morning, and the screen
 * should feel like the door to a records room rather than a product launch.
 *
 * The left panel carries three facts rather than a slogan. "Welcome back" with
 * filler underneath is the templated answer; what a staff member actually
 * benefits from knowing on this screen is that the second factor is not
 * optional, that nobody self-registers, and that their name is attached to
 * whatever they open next.
 */

const FACTS = [
  'Two-factor is required on every staff account.',
  'Accounts are created by invitation, never self-registered.',
  'What you open here is recorded against your name.',
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  /**
   * Omitted by screens that title themselves. Enrolment is three steps behind
   * one route — scan, confirm, save your recovery codes — and each carries its
   * own heading, so a fixed one here would either contradict the step or make
   * a second <h1> that the document outline has to explain.
   */
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-inset px-4 py-10">
      {/* `overflow-hidden` is load-bearing: it is what clips the slab's curve
          to the card instead of letting it bleed past the corner. */}
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* ── The slab ──────────────────────────────────────────────────
              Hidden below md, not lg. The split originally turned on at
              1024px, which sounds like a safe desktop threshold and is not:
              the machines this panel is deployed to have a 1366x768 working
              area, so any window that is not maximised sits under 1024 and the
              whole left panel silently disappears. The card is 896px at its
              widest, so 768 is the width where the two columns genuinely stop
              fitting — that is the honest place to put the break.

              Below it the slab really is dropped rather than stacked: it would
              be a band of colour above the form with the facts squeezed to
              three lines of nothing, which is worse than not showing it. The
              mark moves into the form panel and the colour steps aside. */}
          <div className="relative hidden bg-gradient-to-b from-slab to-slab-deep p-10 md:flex md:flex-col md:justify-between md:rounded-r-[3.5rem] lg:rounded-r-[4.5rem]">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="" width={36} height={36} className="size-9 shrink-0" />
              <span className="font-display text-base text-on-slab">Meow</span>
            </div>

            <div className="py-10">
              <h2 className="font-display text-3xl leading-tight text-on-slab">
                Welcome back.
              </h2>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-on-slab-muted">
                The desk where transfers are watched, identities are checked and
                the books are read.
              </p>
            </div>

            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.09em] text-on-slab-muted uppercase">
                Before you sign in
              </p>
              <ul className="mt-3 space-y-2.5">
                {FACTS.map((fact) => (
                  <li
                    key={fact}
                    className="border-t border-slab-line pt-2.5 text-xs leading-relaxed text-on-slab-muted"
                  >
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── The form ─────────────────────────────────────────────────── */}
          <div className="flex flex-col justify-center p-8 sm:p-12">
            {/* Only when the slab is not there to carry it. */}
            <img
              src="/logo.png"
              alt=""
              width={40}
              height={40}
              className="mb-6 size-10 md:hidden"
            />

            {title && (
              <header className="mb-6">
                <h1 className="font-display text-2xl text-ink">{title}</h1>
                {subtitle && (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                    {subtitle}
                  </p>
                )}
              </header>
            )}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
