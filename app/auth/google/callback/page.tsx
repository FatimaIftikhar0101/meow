'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth';

export default function GoogleCallbackPage() {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <p className="text-[var(--muted-foreground)] text-sm tracking-widest uppercase">
        Signing you in...
      </p>
    </div>
  );
}
