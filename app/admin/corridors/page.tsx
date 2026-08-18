'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import AdminShell from '../AdminShell';

interface Corridor {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromCountry: string;
  toCountry: string;
  baseRate: string;
  marginBps: number;
  feeFlat: string;
  feePercentBps: number;
  minSendAmount: string;
  maxSendAmount: string;
  active: boolean;
}

export default function AdminCorridorsPage() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Corridor>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.get('/admin/corridors').then((r) => setCorridors(r.data));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (c: Corridor) => {
    setEditing(c.id);
    setForm({
      baseRate: c.baseRate,
      marginBps: c.marginBps,
      feeFlat: c.feeFlat,
      feePercentBps: c.feePercentBps,
      minSendAmount: c.minSendAmount,
      maxSendAmount: c.maxSendAmount,
      active: c.active,
    });
    setError('');
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const reason = prompt('Why is this corridor being repriced?');
      if (!reason || reason.trim().length < 3) {
        setBusy(false);
        return;
      }
      await api.patch(`/admin/corridors/${editing}`, {
        reason: reason.trim(),
        baseRate: form.baseRate !== undefined ? Number(form.baseRate) : undefined,
        marginBps: form.marginBps,
        feeFlat: form.feeFlat !== undefined ? Number(form.feeFlat) : undefined,
        feePercentBps: form.feePercentBps,
        minSendAmount: form.minSendAmount !== undefined ? Number(form.minSendAmount) : undefined,
        maxSendAmount: form.maxSendAmount !== undefined ? Number(form.maxSendAmount) : undefined,
        active: form.active,
      });
      setEditing(null);
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Corridors</h1>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Pair</th>
              <th className="text-right px-3 py-2 font-medium">Base rate</th>
              <th className="text-right px-3 py-2 font-medium">Margin bps</th>
              <th className="text-right px-3 py-2 font-medium">Fee flat</th>
              <th className="text-right px-3 py-2 font-medium">Fee bps</th>
              <th className="text-right px-3 py-2 font-medium">Min</th>
              <th className="text-right px-3 py-2 font-medium">Max</th>
              <th className="text-left px-3 py-2 font-medium">Active</th>
              <th className="text-right px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {corridors.map((c) => {
              const isEdit = editing === c.id;
              const v = (k: keyof Corridor): string =>
                isEdit ? String(form[k] ?? '') : String(c[k]);
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{c.fromCurrency} → {c.toCurrency}</td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        value={v('baseRate')}
                        onChange={(e) => setForm({ ...form, baseRate: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-24"
                      />
                    ) : c.baseRate}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        type="number"
                        value={form.marginBps ?? 0}
                        onChange={(e) => setForm({ ...form, marginBps: Number(e.target.value) })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20"
                      />
                    ) : c.marginBps}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        value={v('feeFlat')}
                        onChange={(e) => setForm({ ...form, feeFlat: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20"
                      />
                    ) : c.feeFlat}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        type="number"
                        value={form.feePercentBps ?? 0}
                        onChange={(e) => setForm({ ...form, feePercentBps: Number(e.target.value) })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20"
                      />
                    ) : c.feePercentBps}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        value={v('minSendAmount')}
                        onChange={(e) => setForm({ ...form, minSendAmount: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20"
                      />
                    ) : c.minSendAmount}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <input
                        value={v('maxSendAmount')}
                        onChange={(e) => setForm({ ...form, maxSendAmount: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-24"
                      />
                    ) : c.maxSendAmount}
                  </td>
                  <td className="px-3 py-2">
                    {isEdit ? (
                      <input
                        type="checkbox"
                        checked={form.active ?? false}
                        onChange={(e) => setForm({ ...form, active: e.target.checked })}
                      />
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.active ? 'on' : 'off'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEdit ? (
                      <div className="flex gap-2 justify-end">
                        <button disabled={busy} onClick={save} className="text-blue-600 text-sm font-medium disabled:opacity-50">Save</button>
                        <button onClick={() => setEditing(null)} className="text-slate-500 text-sm">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(c)} className="text-blue-600 text-sm font-medium">Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="mt-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}
    </AdminShell>
  );
}
