'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { logout } from '@/lib/auth';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/transfers', label: 'Transfers' },
  { href: '/admin/corridors', label: 'Corridors' },
  { href: '/admin/audit', label: 'Audit log' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/auth/profile')
      .then((res) => {
        if (res.data.role !== 'admin') {
          router.replace('/admin/login');
          return;
        }
        setEmail(res.data.email);
        setChecking(false);
      })
      .catch(() => router.replace('/admin/login'));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 bg-slate-900 text-slate-200 p-5 space-y-6">
        <Link href="/admin" className="block">
          <h1 className="text-lg font-semibold text-white">🐱 Meow Admin</h1>
        </Link>
        <nav className="space-y-1">
          {navItems.map((n) => {
            const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block px-3 py-2 rounded text-sm transition ${
                  active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="pt-6 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-400">{email}</p>
          <button
            onClick={logout}
            className="text-xs text-slate-300 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 max-w-6xl">{children}</main>
    </div>
  );
}
