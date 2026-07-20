'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';
import { WorldMap } from '@/app/_components/WorldMap';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', country: 'CA' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      setToken(res.data.access_token);
      router.push('/dashboard');
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.2fr_1fr] bg-[var(--background)]">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-r border-[var(--border)]">
        <BrandWordmark size={28} />
        <div className="relative">
          <div className="mb-10">
            <WorldMap
              sendCurrency="CAD"
              receiveCurrency="INR"
              recipientName="Family"
              progress={0.85}
            />
          </div>
          <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--foreground)]">
            One account.<br/>
            <span className="text-[var(--accent)]">Six destinations.</span>
          </h2>
          <ul className="mt-7 space-y-3 text-[var(--ink-soft)] text-sm">
            <Bullet>Open a CAD wallet in minutes</Bullet>
            <Bullet>Verify identity with auto-KYC</Bullet>
            <Bullet>Send to PK, IN, PH and growing</Bullet>
          </ul>
        </div>
        <p className="relative text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">Regulated MSB · FINTRAC compliant</p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-center">
            <BrandWordmark size={24} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">Create account</p>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight mt-2">Get started.</h1>

          {error && (
            <div className="mt-6 bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl border border-[var(--danger)]/30">{error}</div>
          )}

          <div className="mt-7">
            <a
              href="http://localhost:3000/auth/google"
              className="w-full flex items-center justify-center gap-3 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/55 text-[var(--foreground)] font-semibold py-3.5 rounded-xl transition hover:bg-[var(--surface-elevated)]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
          </div>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">or</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={10}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
                placeholder="10+ chars, upper, lower, digit"
              />
            </Field>
            <Field label="Country of residence">
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
              >
                <option value="CA">Canada · CAD</option>
                <option value="US">United States · USD</option>
                <option value="GB">United Kingdom · GBP</option>
              </select>
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-[var(--accent)]/15"
            >
              {loading ? 'Creating…' : 'Create account →'}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            Already have one?{' '}
            <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-deep)] font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-[0.18em]">{label}</label>
      {children}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-1 h-1 rounded-full bg-[var(--accent)]" />
      {children}
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.97-6.19a24.01 24.01 0 0 0 0 21.56l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
