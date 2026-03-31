'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { logout } from '@/lib/auth';

interface Transfer {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveCurrency: string;
  receiveAmount: string;
  status: string;
  createdAt: string;
  recipient: { name: string; country: string };
}

const statusColors: Record<string, string> = {
  initiated: 'bg-gray-100 text-gray-600',
  payment_received: 'bg-blue-100 text-blue-600',
  compliance_check: 'bg-yellow-100 text-yellow-600',
  fx_converted: 'bg-purple-100 text-purple-600',
  payout_processing: 'bg-orange-100 text-orange-600',
  delivered: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment Received',
  compliance_check: 'Compliance Check',
  fx_converted: 'FX Converted',
  payout_processing: 'Processing',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export default function DashboardPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<string>('0.00');
  const [currency, setCurrency] = useState('USD');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [walletRes, transfersRes] = await Promise.all([
          api.get('/wallet/balance'),
          api.get('/transfers'),
        ]);
        setBalance(walletRes.data.balance);
        setCurrency(walletRes.data.currency);
        setTransfers(transfersRes.data);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">🐱 Meow</h1>
        <div className="flex items-center gap-5">
          <Link href="/recipients" className="text-sm text-gray-600 hover:text-gray-900">Recipients</Link>
          <Link href="/wallet/transactions" className="text-sm text-gray-600 hover:text-gray-900">History</Link>
          <Link href="/profile" className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold hover:bg-blue-700 transition">
            P
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Wallet card */}
        <div className="bg-blue-600 text-white rounded-2xl p-6">
          <p className="text-blue-200 text-sm mb-1">Wallet Balance</p>
          <p className="text-4xl font-bold">{currency} {parseFloat(balance).toFixed(2)}</p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/wallet/fund"
              className="bg-white text-blue-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition"
            >
              + Add Money
            </Link>
            <Link
              href="/send"
              className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-400 transition"
            >
              Send Money →
            </Link>
          </div>
        </div>

        {/* Transfers */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Transfers</h2>
          {transfers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No transfers yet.</p>
              <Link href="/send" className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
                Send your first transfer →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((t) => (
                <Link href={`/transfers/${t.id}`} key={t.id}>
                  <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between hover:border-blue-300 transition cursor-pointer">
                    <div>
                      <p className="font-medium text-gray-900">{t.recipient?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {t.amount} {t.sendCurrency} → {t.receiveAmount || '—'} {t.receiveCurrency}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
