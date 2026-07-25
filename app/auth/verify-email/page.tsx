'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

function VerifyEmailInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token');
      return;
    }

    api
      .get(`/auth/verify-email?token=${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message || 'Email verified successfully');
      })
      .catch((err) => {
        setStatus('error');
        const msg = err.response?.data?.message;
        setMessage(Array.isArray(msg) ? msg.join(', ') : msg || 'Verification failed');
      });
  }, [params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
      <BrandWordmark size={28} />

      <div className="mt-10 w-full max-w-sm text-center">
        {status === 'loading' && (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <p className="text-[var(--muted-foreground)] text-sm">Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--mint-soft)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12 L11 14 L15 10" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
              Email verified
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
            <Link
              href="/dashboard"
              className="inline-block mt-4 bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-[var(--ink)] font-bold py-3 px-8 rounded-xl transition shadow-lg shadow-[var(--accent)]/15"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--danger-soft)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M15 9 L9 15 M9 9 L15 15" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
              Verification failed
            </h1>
            <p className="text-sm text-[var(--danger)]">{message}</p>
            <Link
              href="/login"
              className="inline-block mt-4 bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/55 text-[var(--foreground)] font-semibold py-3 px-8 rounded-xl transition"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-6">
          <BrandWordmark size={28} />
          <div className="mt-10 w-full max-w-sm text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
            <p className="text-[var(--muted-foreground)] text-sm">Verifying your email...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
