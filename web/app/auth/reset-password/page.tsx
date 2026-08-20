'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [error, setError] = useState('');

  if (!token && status === 'form') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
        <BrandWordmark size={28} />
        <div className="mt-10 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M15 9 L9 15 M9 9 L15 15" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">Invalid link</h1>
          <p className="text-sm text-[var(--muted-foreground)]">This reset link is missing a token.</p>
          <Link
            href="/forgot-password"
            className="inline-block mt-4 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3 px-8 rounded-xl transition"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('loading');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setStatus('success');
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })
        .response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Reset failed');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
        <BrandWordmark size={28} />
        <div className="mt-10 w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--mint-soft)] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12 L11 14 L15 10" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
            Password reset
          </h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3 px-8 rounded-xl transition shadow-lg shadow-[var(--accent)]/15"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <BrandWordmark size={28} />
        </div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
          Password reset
        </p>
        <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight mt-2">
          Choose a new password.
        </h1>

        {error && (
          <div className="mt-6 bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl border border-[var(--danger)]/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-[0.18em]">
              New password
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
              placeholder="10+ chars, upper, lower, digit"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-[var(--accent)]/15"
          >
            {status === 'loading' ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
          <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-deep)] font-bold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
          <div className="w-12 h-12 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
