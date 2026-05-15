'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Transaction {
  id: string;
  direction: 'credit' | 'debit';
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  createdAt: string;
  transfer?: {
    id: string;
    recipient?: { name: string; country: string };
  } | null;
}

const TYPE_LABEL: Record<string, string> = {
  wallet_fund: 'Wallet funded',
  transfer_hold: 'Transfer hold',
  transfer_release: 'Transfer released',
  transfer_refund: 'Transfer refunded',
  fee: 'Transfer fee',
  fx_conversion: 'FX conversion',
};

function labelFor(tx: Transaction): string {
  if (tx.type === 'transfer_hold' && tx.transfer?.recipient) {
    return `Sent to ${tx.transfer.recipient.name}`;
  }
  if (tx.type === 'transfer_refund' && tx.transfer?.recipient) {
    return `Refund from ${tx.transfer.recipient.name}`;
  }
  return TYPE_LABEL[tx.type] ?? tx.type;
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
          transactions.map((tx) => {
            const isCredit = tx.direction === 'credit';
            return (
              <div key={tx.id} className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                    ${isCredit ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isCredit ? '↓' : '↑'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{labelFor(tx)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold text-sm ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                  {isCredit ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)} {tx.currency}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
