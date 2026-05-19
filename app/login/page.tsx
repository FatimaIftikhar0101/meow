'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';
import { WorldMap } from '@/app/_components/WorldMap';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      setToken(res.data.access_token);
      router.push('/dashboard');
    } catch (err) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      if (e.response?.status === 403) {
        setError(e.response?.data?.message || 'Use the admin portal');
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.2fr_1fr] bg-[var(--background)]">
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden border-r border-[var(--border)]">
        <BrandWordmark size={28} />
        <div className="relative">
          {/* preview map — uses a delivered transfer aesthetic for the hero */}
          <div className="mb-10">
            <WorldMap
              sendCurrency="CAD"
              receiveCurrency="PKR"
              recipientName="Ayesha"
              progress={0.55}
            />
          </div>
          <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--foreground)]">
            Move money <span className="text-[var(--accent)]">precisely.</span><br/>
            Track every step.
          </h2>
          <p className="mt-4 text-[var(--muted-foreground)] text-base max-w-md">
            Regulated cross-border transfers from Canada. Real-time settlement visibility, bank-grade controls, transparent rates.
          </p>
        </div>
        <div className="relative flex items-center gap-5 text-[var(--muted-foreground)] text-[11px] uppercase tracking-[0.2em] font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--mint)]" /> FINTRAC</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> AES-256</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[var(--foreground)]" /> Audit-logged</span>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10 text-center">
            <BrandWordmark size={24} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">Sign in</p>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight mt-2">Welcome back.</h1>

          {error && (
            <div className="mt-6 bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl border border-[var(--danger)]/30">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
                placeholder="••••••••"
              />
            </Field>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-[var(--accent)]/15"
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            New here?{' '}
            <Link href="/register" className="text-[var(--accent)] hover:text-[var(--accent-deep)] font-bold">
              Create account
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
