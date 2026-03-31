'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Transaction {
  id: string;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/wallet/transactions')
      .then((res) => setTransactions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-semibold text-gray-900">Transaction History</h1>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-3">
        {loading ? (
          <p className="text-center text-gray-500 py-10">Loading...</p>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No transactions yet.</p>
            <Link href="/wallet/fund" className="text-blue-600 text-sm font-medium mt-2 inline-block hover:underline">
              Add money to your wallet →
            </Link>
          </div>
        ) : (
          transactions.map((tx) => (
            <div key={tx.id} className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${tx.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'credit' ? '↓' : '↑'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {tx.description || (tx.type === 'credit' ? 'Wallet funded' : 'Payment sent')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
              <p className={`font-semibold text-sm ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                {tx.type === 'credit' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
