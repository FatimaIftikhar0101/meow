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
