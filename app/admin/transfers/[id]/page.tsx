'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import AdminShell from '../../AdminShell';

interface TimelineEntry { id: string; status: string; message: string; createdAt: string; }
interface LedgerEntry { id: string; direction: 'credit' | 'debit'; type: string; amount: string; currency: string; createdAt: string; }
interface TransferDetail {
  id: string;
  user: { id: string; email: string; country: string | null };
  recipient: { name: string; country: string; bankAccount: string; bankName: string | null };
  sendAmount: string;
  sendCurrency: string;
  receiveAmount: string | null;
  receiveCurrency: string;
  fxRateApplied: string | null;
  feeAmount: string;
  status: string;
  failureReason: string | null;
  providerName: string | null;
  providerRef: string | null;
  createdAt: string;
  timeline: TimelineEntry[];
  ledgerEntries: LedgerEntry[];
}

const TERMINAL = new Set(['delivered', 'failed', 'cancelled']);

export default function AdminTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get(`/admin/transfers/${id}`)
      .then((res) => setTransfer(res.data))
      .catch(() => setTransfer(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [id]);

  const forceFail = async () => {
    const reason = prompt('Reason for force-failing this transfer? (will be saved to audit)');
    if (!reason || reason.length < 3) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/transfers/${id}/force-fail`, { reason });
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Could not force-fail.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <Link href="/admin/transfers" className="text-sm text-slate-500 hover:text-slate-900">← Transfers</Link>
      {loading ? (
        <p className="mt-4 text-slate-500">Loading…</p>
      ) : !transfer ? (
        <p className="mt-4 text-slate-500">Transfer not found</p>
      ) : (
        <div className="mt-4 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-slate-400">{transfer.id}</p>
                <h1 className="text-xl font-semibold text-slate-900 mt-1">
                  {parseFloat(transfer.sendAmount).toFixed(2)} {transfer.sendCurrency}
                  {transfer.receiveAmount && (
                    <span className="text-slate-500"> → {parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>
                  )}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Fee {transfer.feeAmount} · Rate {transfer.fxRateApplied ?? '—'} · {transfer.providerName ?? 'no-provider'} {transfer.providerRef && `(${transfer.providerRef})`}
                </p>
                <p className="text-xs text-slate-400 mt-1">{new Date(transfer.createdAt).toLocaleString()}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{transfer.status}</span>
            </div>
            {transfer.failureReason && (
              <p className="mt-3 text-sm text-red-600">Failure: {transfer.failureReason}</p>
            )}
            {!TERMINAL.has(transfer.status) && (
              <div className="mt-5">
                <button
                  disabled={busy}
                  onClick={forceFail}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                >Force fail (refund user)</button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Customer</h2>
              <p className="text-sm">
                <Link href={`/admin/users/${transfer.user.id}`} className="text-blue-600 hover:underline">{transfer.user.email}</Link>
              </p>
              <p className="text-xs text-slate-500 mt-1">{transfer.user.country ?? '—'}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-3">Recipient</h2>
              <p className="text-sm font-medium">{transfer.recipient.name}</p>
              <p className="text-xs text-slate-500 mt-1">{transfer.recipient.country} · {transfer.recipient.bankAccount}</p>
              {transfer.recipient.bankName && <p className="text-xs text-slate-500">{transfer.recipient.bankName}</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Timeline</h2>
            <ol className="space-y-2 text-sm">
              {transfer.timeline.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span><span className="font-medium">{e.status}</span> — {e.message}</span>
                  <span className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-3">Ledger entries</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-600">
                <tr>
                  <th className="text-left py-1">Type</th>
                  <th className="text-left py-1">Direction</th>
                  <th className="text-right py-1">Amount</th>
                  <th className="text-left py-1">When</th>
                </tr>
              </thead>
              <tbody>
                {transfer.ledgerEntries.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-1.5">{l.type}</td>
                    <td className="py-1.5">{l.direction}</td>
                    <td className="py-1.5 text-right">{parseFloat(l.amount).toFixed(2)} {l.currency}</td>
                    <td className="py-1.5 text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
