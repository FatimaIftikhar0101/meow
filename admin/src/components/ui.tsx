import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The small shared vocabulary the panel is built from.
 *
 * Every colour here is a semantic token from index.css. A literal hex in this
 * file would be a bug: it means a role is missing, and the fix is to add one.
 */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
};

export function Button({
  variant = 'primary',
  busy,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
  const variants = {
    primary: 'bg-accent text-on-accent hover:bg-accent-deep',
    secondary:
      'bg-card text-ink border border-field-border hover:bg-inset',
    danger: 'bg-danger text-on-danger hover:opacity-90',
  } as const;

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || busy}
      {...rest}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function Field({
  label,
  hint,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        className="w-full rounded-lg border border-field-border bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        {...rest}
      />
      {hint && !error && (
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      )}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  // Separated from canvas by a hairline, never by tint — both are #FFFFFF.
  return (
    <div className={`rounded-xl border border-line bg-card ${className}`}>
      {children}
    </div>
  );
}

/**
 * Status as a solid fill with light text.
 *
 * Pale chips disappear against a white canvas, which matters more here than in
 * the app: this panel is read at a glance, all day, by someone scanning for
 * the one row that is wrong.
 */
export function Pill({
  tone,
  children,
}: {
  tone: 'success' | 'pending' | 'danger' | 'neutral';
  children: ReactNode;
}) {
  const tones = {
    success: 'bg-success text-on-success',
    pending: 'bg-pending text-on-pending',
    danger: 'bg-danger text-on-danger',
    neutral: 'bg-inset text-ink-muted',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'pending' | 'success';
  children: ReactNode;
}) {
  const tones = {
    danger: 'bg-danger-soft text-danger',
    pending: 'bg-pending-soft text-pending',
    success: 'bg-success-soft text-success',
  } as const;
  return (
    <div className={`rounded-lg px-3 py-2 text-sm ${tones[tone]}`} role="alert">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-ink-muted">{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* ── Working surfaces ─────────────────────────────────────────────────────
 *
 * The panel is read for a whole shift, on a large screen, by someone looking
 * for the one row that is wrong. These exist so every screen agrees about
 * density, alignment and where the controls live — and so the sticky header
 * below is written once rather than in each of the eight tables.
 */

/**
 * A page's controls, pinned under the header.
 *
 * Filters that scroll away are filters you have to scroll back for, and on a
 * long queue that is every time you want to change one.
 */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-8 mb-4 flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-8 pt-1 pb-3">
      {children}
    </div>
  );
}

/**
 * A quiet label above a group. Sentence case, wide tracking, never a heading —
 * it names a region, and using an <h*> here would put rungs in the document
 * outline that the page does not actually have.
 */
export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10.5px] font-semibold tracking-[0.09em] text-ink-faint uppercase">
      {children}
    </p>
  );
}

/**
 * A table that keeps its column names while you scroll.
 *
 * Forty rows is more than a screen, and a money column with no header is a
 * column of numbers you have to scroll up to identify. `Table` owns the
 * scroll container so the sticky offset has something to stick to.
 */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`sticky top-0 z-10 border-b border-line bg-inset px-4 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-ink-muted uppercase ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`border-b border-line px-4 py-2.5 ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * A row that carries a mark down its leading edge when it needs attention.
 *
 * The overdue transfer was distinguishable only by the contents of its Age
 * cell, which is the last column read and the whole reason the screen exists.
 * A rule against the row's edge is visible in peripheral vision, survives the
 * table being scrolled sideways, and does not tint a row that people need to
 * read amounts off.
 */
export function Tr({
  children,
  flagged = false,
  className = '',
}: {
  children: ReactNode;
  flagged?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={`group transition-colors hover:bg-inset ${
        flagged
          ? // An inset shadow on the leading cell, not a border: `border-separate`
            // puts a gap between cells, so a left border would float away from
            // the row's edge. And not a background tint — a solid token is what
            // `check:contrast` can measure, and Tailwind's `/40` modifier
            // compiles to an `oklab()` blend that no audit of this codebase can
            // see. A colour nothing can check is a colour nobody re-measures.
            '[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-danger)]'
          : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
}

/** An identifier: monospace, and never wrapped mid-token. */
export function Mono({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono text-[12.5px] whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

/**
 * One line of a worklist: a count, what it means, and the way in.
 *
 * Deliberately not a metric tile. A tile answers "how are we doing"; the
 * question on this desk is "what needs me", and the difference shows in what
 * the number is allowed to be. Zero is the good answer here, so zero is
 * rendered calmly rather than as a dead card.
 */
export function WorkRow({
  count,
  label,
  detail,
  tone = 'neutral',
  to,
}: {
  count: number;
  label: string;
  detail: string;
  tone?: 'danger' | 'pending' | 'neutral';
  to: string;
}) {
  const clear = count === 0;
  const accentTone = clear
    ? 'text-ink-faint'
    : tone === 'danger'
      ? 'text-danger'
      : tone === 'pending'
        ? 'text-pending'
        : 'text-ink';

  return (
    <Link
      to={to}
      className="flex items-baseline gap-4 border-b border-line px-5 py-4 transition-colors last:border-0 hover:bg-inset focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span
        className={`tabular w-14 shrink-0 text-right font-display text-3xl leading-none ${accentTone}`}
      >
        {count}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{detail}</span>
      </span>
    </Link>
  );
}
