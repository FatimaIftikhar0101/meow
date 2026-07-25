'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      setToken(token);
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [params, router]);

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <Suspense>
        <CallbackHandler />
      </Suspense>
      <p className="text-[var(--muted-foreground)] text-sm tracking-widest uppercase">
        Signing you in...
      </p>
    </div>
  );
}
