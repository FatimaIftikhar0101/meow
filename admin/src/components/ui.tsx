import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

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
