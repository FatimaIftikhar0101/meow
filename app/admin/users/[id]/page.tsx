'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AdminShell from '../../AdminShell';

interface Wallet { currency: string; balance: string; }
interface KycRecord {
  id: string;
  status: 'pending' | 'passed' | 'failed';
  provider: string | null;
  reason: string | null;
  verifiedAt: string | null;
  createdAt: string;
}
interface UserDetail {
  id: string;
  email: string;
  country: string | null;
  role: 'customer' | 'admin';
  suspended: boolean;
  createdAt: string;
  balances: Wallet[];
  kycRecords: KycRecord[];
  transferCount: number;
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get(`/admin/users/${id}`)
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-900">← Users</Link>
      {loading ? (
        <p className="mt-4 text-slate-500">Loading…</p>
      ) : !user ? (
        <p className="mt-4 text-slate-500">User not found</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{user.email}</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {user.country ?? '—'} · joined {new Date(user.createdAt).toLocaleDateString()} · {user.transferCount} transfers
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${user.suspended ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {user.suspended ? 'Suspended' : 'Active'}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {user.role !== 'admin' && (
                user.suspended ? (
                  <button
                    disabled={busy}
                    onClick={() => act(() => api.post(`/admin/users/${id}/unsuspend`))}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >Unsuspend</button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (confirm('Suspend this user? They will be unable to log in or transact.')) {
                        act(() => api.post(`/admin/users/${id}/suspend`));
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
                  >Suspend</button>
                )
              )}
              <button
                disabled={busy}
                onClick={() => act(() => api.post(`/admin/users/${id}/kyc/override`, { status: 'passed', reason: 'Admin override' }))}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm disabled:opacity-50"
              >Force KYC pass</button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = prompt('Reason for KYC failure?');
                  if (!reason || reason.length < 3) return;
                  act(() => api.post(`/admin/users/${id}/kyc/override`, { status: 'failed', reason }));
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm disabled:opacity-50"
              >Force KYC fail</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Wallets</h2>
            <div className="space-y-2">
              {user.balances.map((b) => (
                <div key={b.currency} className="flex justify-between text-sm">
                  <span className="text-slate-600">{b.currency}</span>
                  <span className="font-medium">{b.balance}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-3">KYC history</h2>
            {user.kycRecords.length === 0 ? (
              <p className="text-sm text-slate-500">No KYC records.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {user.kycRecords.map((k) => (
                  <li key={k.id} className="flex justify-between items-start border-t border-slate-100 pt-2">
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full mr-2 ${
                        k.status === 'passed' ? 'bg-green-100 text-green-700' :
                        k.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{k.status}</span>
                      <span className="text-slate-600">{k.provider ?? '—'}</span>
                      {k.reason && <span className="text-slate-500"> — {k.reason}</span>}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(k.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-3">
            <Link
              href={`/admin/transfers?userEmail=${encodeURIComponent(user.email)}`}
              className="text-sm text-blue-600 hover:underline"
            >View their transfers →</Link>
            <Link
              href={`/admin/audit?userId=${user.id}`}
              className="text-sm text-blue-600 hover:underline"
            >View their audit log →</Link>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
