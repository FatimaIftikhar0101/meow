'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-[var(--background)]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] text-white relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[var(--accent)]/20" />
        <div className="absolute -right-10 bottom-0 w-60 h-60 rounded-full bg-[var(--accent)]/10" />
        <BrandWordmark size={32} />
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">
            Send money home.<br/>Built for Canadians.
          </h2>
          <p className="mt-4 text-white/80 max-w-md">
            Fast, transparent and built around your family. We watch every coin from your wallet to theirs.
          </p>
        </div>
        <p className="relative text-xs text-white/60">© Meow Transfer · Canada</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <BrandWordmark />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Welcome back</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Sign in to your account to send money.</p>

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
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
            New here?{' '}
            <Link href="/register" className="text-[var(--brand)] hover:underline font-semibold">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
