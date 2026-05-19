'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';
import { CatCoin } from '@/app/_components/CatCoin';

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
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-[var(--background)]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[var(--ink)] text-white relative overflow-hidden">
        <div
          className="absolute -right-24 -top-24 w-96 h-96 rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)', animation: 'aurora 7s ease-in-out infinite' }}
        />
        <div
          className="absolute -left-20 bottom-0 w-80 h-80 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, var(--mint), transparent 70%)', animation: 'aurora 9s ease-in-out infinite 1s' }}
        />
        <BrandWordmark size={32} />
        <div className="relative">
          <CatCoin size={120} />
          <h2 className="mt-6 text-5xl font-extrabold leading-tight tracking-tight">
            Three steps.<br/>
            <span className="text-[var(--accent)]">Then send.</span>
          </h2>
          <ul className="mt-7 space-y-4 text-white/90">
            <Step n={1} label="Create your account" />
            <Step n={2} label="Verify your identity in a minute" />
            <Step n={3} label="Add money & send to family" />
          </ul>
        </div>
        <p className="relative text-xs text-white/50">Regulated by FINTRAC · Canadian MSB</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <BrandWordmark />
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight">Create your account</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1.5">Free. No commitment. Cat included.</p>

          {error && (
            <div className="mt-6 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-[0.15em]">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-[0.15em]">Password</label>
              <input
                type="password"
                required
                minLength={10}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition"
                placeholder="10+ chars, upper, lower, digit"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[var(--ink-soft)] mb-1.5 uppercase tracking-[0.15em]">Country</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border-strong)] rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition"
              >
                <option value="CA">🇨🇦 Canada (CAD)</option>
                <option value="US">🇺🇸 United States (USD)</option>
                <option value="GB">🇬🇧 United Kingdom (GBP)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-bold py-3.5 rounded-2xl transition disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30 hover:shadow-xl hover:shadow-[var(--accent)]/40"
            >
              {loading ? 'Creating…' : 'Create account →'}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            Already have one?{' '}
            <Link href="/login" className="text-[var(--accent-deep)] hover:underline font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <li className="flex items-center gap-4">
      <span className="w-9 h-9 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/40 grid place-items-center text-sm font-bold text-[var(--accent)]">
        {n}
      </span>
      <span className="text-base">{label}</span>
    </li>
  );
}
