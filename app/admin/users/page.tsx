'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AdminShell from '../AdminShell';

interface UserRow {
  id: string;
  email: string;
  country: string | null;
  role: 'customer' | 'admin';
  suspended: boolean;
  createdAt: string;
  transferCount: number;
}

interface Page {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (debounced) params.set('search', debounced);
    api.get(`/admin/users?${params.toString()}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by email"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-72"
        />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Country</th>
              <th className="text-left px-4 py-3 font-medium">Role</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Transfers</th>
              <th className="text-left px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No users</td></tr>
            ) : (
              data.items.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="text-blue-600 hover:underline">
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{u.country ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.suspended ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Suspended</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{u.transferCount}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
          <span>Page {data.page} of {totalPages} ({data.total} total)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50"
            >Prev</button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
