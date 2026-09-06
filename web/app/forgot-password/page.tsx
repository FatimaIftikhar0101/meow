'use client';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';
import { LIMITS } from '@/lib/limits';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <BrandWordmark size={28} />
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--mint-soft)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 4 12 13 2 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              If <span className="font-semibold text-[var(--foreground)]">{email}</span> is registered, we sent a link to reset your password. It expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 text-sm font-bold text-[var(--accent)] hover:text-[var(--accent-deep)]"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted-foreground)] font-bold">
              Password reset
            </p>
            <h1 className="text-3xl font-extrabold text-[var(--foreground)] tracking-tight mt-2">
              Forgot password?
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-3">
              Enter the email you registered with and we'll send you a reset link.
            </p>

            {error && (
              <div className="mt-6 bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl border border-[var(--danger)]/30">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-[0.18em]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  maxLength={LIMITS.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-[var(--accent)]/15"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-[var(--muted-foreground)] mt-6">
              Remember it?{' '}
              <Link href="/login" className="text-[var(--accent)] hover:text-[var(--accent-deep)] font-bold">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
