'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import AdminShell from '../AdminShell';

interface Entry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface PageData {
  items: Entry[];
  total: number;
  page: number;
  pageSize: number;
}

function AuditInner() {
  const search = useSearchParams();
  const initialUser = search.get('userId') ?? '';
  const initialEntityId = search.get('entityId') ?? '';

  const [filters, setFilters] = useState({
    userId: initialUser,
    action: '',
    entityType: '',
    entityId: initialEntityId,
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.entityId) params.set('entityId', filters.entityId);
    api.get(`/admin/audit?${params.toString()}`)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Audit log</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4 grid grid-cols-4 gap-3 text-sm">
        <input
          placeholder="userId"
          value={filters.userId}
          onChange={(e) => { setFilters({ ...filters, userId: e.target.value }); setPage(1); }}
          className="border border-slate-300 rounded px-3 py-2"
        />
        <input
          placeholder="action (e.g. transfer.create)"
          value={filters.action}
          onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}
          className="border border-slate-300 rounded px-3 py-2"
        />
        <input
          placeholder="entityType"
          value={filters.entityType}
          onChange={(e) => { setFilters({ ...filters, entityType: e.target.value }); setPage(1); }}
          className="border border-slate-300 rounded px-3 py-2"
        />
        <input
          placeholder="entityId"
          value={filters.entityId}
          onChange={(e) => { setFilters({ ...filters, entityId: e.target.value }); setPage(1); }}
          className="border border-slate-300 rounded px-3 py-2"
        />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">Entity</th>
              <th className="text-left px-3 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No entries</td></tr>
            ) : (
              data.items.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.userId?.slice(0, 8) ?? '—'}</td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {e.entityType ? `${e.entityType}/${e.entityId?.slice(0, 8) ?? '—'}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                    {e.metadata ? JSON.stringify(e.metadata) : ''}
                  </td>
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
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50">Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 border border-slate-300 rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminAuditPage() {
  return (
    <AdminShell>
      <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
        <AuditInner />
      </Suspense>
    </AdminShell>
  );
}
