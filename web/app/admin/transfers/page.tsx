'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AdminShell from '../AdminShell';

interface Row {
  id: string;
  userEmail: string;
  recipient: { name: string; country: string } | null;
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  status: string;
  createdAt: string;
}

interface Page {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUSES = [
  '', 'initiated', 'payment_received', 'compliance_check',
  'fx_converted', 'payout_processing', 'delivered', 'failed', 'cancelled',
];

export default function AdminTransfersPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (status) params.set('status', status);
    api.get(`/admin/transfers?${params.toString()}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AdminShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Transfers</h1>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Recipient</th>
              <th className="text-right px-4 py-3 font-medium">Send</th>
              <th className="text-right px-4 py-3 font-medium">Receive</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
            ) : !data || data.items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No transfers</td></tr>
            ) : (
              data.items.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/transfers/detail?id=${t.id}`} className="text-blue-600 hover:underline">
                      {t.userEmail}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.recipient ? `${t.recipient.name} (${t.recipient.country})` : '—'}</td>
                  <td className="px-4 py-3 text-right">{parseFloat(t.sendAmount).toFixed(2)} {t.sendCurrency}</td>
                  <td className="px-4 py-3 text-right">
                    {t.receiveAmount ? `${parseFloat(t.receiveAmount).toFixed(2)} ${t.receiveCurrency}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
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
