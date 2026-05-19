'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark } from '@/app/_components/Brand';

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
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--brand)]">←</Link>
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Activity</span>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-10 space-y-3">
        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-3">Transaction history</h1>
        {loading ? (
          <p className="text-center text-[var(--muted-foreground)] py-10">Loading…</p>
        ) : transactions.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-10 text-center">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-[var(--foreground)] font-medium">No transactions yet</p>
            <Link href="/wallet/fund" className="text-[var(--brand)] text-sm font-semibold mt-2 inline-block hover:underline">
              Add money to your wallet →
            </Link>
          </div>
        ) : (
          transactions.map((tx) => {
            const isCredit = tx.direction === 'credit';
            return (
              <div key={tx.id} className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--accent)]/15 text-[var(--accent-deep)]'}`}>
                    {isCredit ? '↓' : '↑'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{labelFor(tx)}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <p className={`font-semibold text-sm ${isCredit ? 'text-emerald-700' : 'text-[var(--accent-deep)]'}`}>
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
