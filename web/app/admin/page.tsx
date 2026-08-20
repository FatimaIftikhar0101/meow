'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import AdminShell from './AdminShell';

interface Stats {
  users: number;
  transfers: number;
  inFlight: number;
  delivered: number;
  failed: number;
  totalDeliveredVolume: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Overview</h1>
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Customers" value={stats.users.toString()} />
          <StatCard label="Total transfers" value={stats.transfers.toString()} />
          <StatCard label="In flight" value={stats.inFlight.toString()} accent="blue" />
          <StatCard label="Delivered" value={stats.delivered.toString()} accent="green" />
          <StatCard label="Failed" value={stats.failed.toString()} accent="red" />
          <StatCard
            label="Volume delivered"
            value={parseFloat(stats.totalDeliveredVolume).toFixed(2)}
          />
        </div>
      ) : (
        <p className="text-slate-500">No data</p>
      )}
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'blue' | 'green' | 'red';
}) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
  } as const;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? colors[accent] : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}
