'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--background)]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[var(--accent)]/20" />
        <div className="absolute -right-10 bottom-0 w-60 h-60 rounded-full bg-[var(--accent)]/10" />
        <BrandWordmark size={32} />
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">
            Let&apos;s get you set up.
          </h2>
          <ul className="mt-6 space-y-3 text-white/80">
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-[var(--accent)]/30 grid place-items-center text-sm">1</span> Create your account</li>
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-[var(--accent)]/30 grid place-items-center text-sm">2</span> Verify your identity (takes a minute)</li>
            <li className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-[var(--accent)]/30 grid place-items-center text-sm">3</span> Add money & send to family</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/60">Regulated as a Canadian MSB · FINTRAC compliant</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <BrandWordmark />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Create your account</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Free, with no transfer commitment.</p>

          {error && (
            <div className="mt-6 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                minLength={10}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="Min 10 chars, with upper, lower, digit"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 uppercase tracking-wider">Country</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              >
                <option value="CA">Canada (CAD)</option>
                <option value="US">United States (USD)</option>
                <option value="GB">United Kingdom (GBP)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow"
            >
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            Already have one?{' '}
            <Link href="/login" className="text-[var(--brand)] hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
