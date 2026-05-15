'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { io } from 'socket.io-client';
import { getToken } from '@/lib/auth';

interface TimelineEntry {
  id: string;
  status: string;
  message: string;
  createdAt: string;
}

interface Transfer {
  id: string;
  amount: string;
  sendCurrency: string;
  receiveCurrency: string;
  receiveAmount: string;
  fxRateApplied: string;
  status: string;
  createdAt: string;
  recipient: { name: string; country: string; bankAccount: string };
  timeline: TimelineEntry[];
}

const steps = [
  { key: 'initiated', label: 'Transfer Initiated', icon: '📋' },
  { key: 'payment_received', label: 'Payment Received', icon: '💳' },
  { key: 'compliance_check', label: 'Identity Verified', icon: '✅' },
  { key: 'fx_converted', label: 'Currency Converted', icon: '💱' },
  { key: 'payout_processing', label: 'Payout Processing', icon: '🏦' },
  { key: 'delivered', label: 'Delivered', icon: '🎉' },
];

const stepOrder = steps.map((s) => s.key);

export default function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/transfers/${id}`)
      .then((res) => setTransfer(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = io('http://localhost:3000/transfers', {
      auth: { token: `Bearer ${getToken()}` },
    });

    socket.on('transfer:status', (data) => {
      if (data.transferId === id) {
        api.get(`/transfers/${id}`).then((res) => setTransfer(res.data)).catch(() => {});
      }
    });

    return () => { socket.disconnect(); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Transfer not found.</p>
      </div>
    );
  }

  const currentStepIndex = stepOrder.indexOf(transfer.status);
  const isFailed = transfer.status === 'failed';
  const isCancelled = transfer.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-semibold text-gray-900">Track Transfer</h1>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Summary card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Sending to</p>
              <p className="font-semibold text-gray-900 mt-0.5">{transfer.recipient?.name}</p>
              <p className="text-sm text-gray-500">{transfer.recipient?.country}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Amount</p>
              <p className="font-semibold text-gray-900">{transfer.amount} {transfer.sendCurrency}</p>
              {transfer.receiveAmount && (
                <p className="text-sm text-green-600">→ {transfer.receiveAmount} {transfer.receiveCurrency}</p>
              )}
            </div>
          </div>
          {transfer.fxRateApplied && (
            <p className="text-xs text-gray-400 mt-3">
              Rate: 1 {transfer.sendCurrency} = {parseFloat(transfer.fxRateApplied).toFixed(4)} {transfer.receiveCurrency}
            </p>
          )}
        </div>

        {/* Status */}
        {(isFailed || isCancelled) ? (
          <div className={`rounded-2xl border p-6 text-center ${isFailed ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-2xl mb-2">{isFailed ? '❌' : '🚫'}</p>
            <p className={`font-semibold ${isFailed ? 'text-red-600' : 'text-gray-600'}`}>
              Transfer {isFailed ? 'Failed' : 'Cancelled'}
            </p>
            {transfer.timeline.at(-1)?.message && (
              <p className="text-sm text-gray-500 mt-1">{transfer.timeline.at(-1)?.message}</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Transfer Progress</h2>
            <div className="space-y-4">
              {steps.map((step, i) => {
                const done = i < currentStepIndex || transfer.status === 'delivered';
                const active = i === currentStepIndex && transfer.status !== 'delivered';
                const timeline = transfer.timeline.find((t) => t.status === step.key);

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium
                        ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                        {done ? '✓' : step.icon}
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`w-0.5 h-6 mt-1 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pt-1.5">
                      <p className={`text-sm font-medium ${done || active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {timeline && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(timeline.createdAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Receipt — shown when delivered */}
        {transfer.status === 'delivered' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h2 className="font-semibold text-green-800 mb-4">Transfer Receipt</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Transfer ID</span>
                <span className="font-mono text-gray-700 text-xs">{transfer.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Recipient</span>
                <span className="font-medium text-gray-900">{transfer.recipient?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">You sent</span>
                <span className="font-medium text-gray-900">{transfer.amount} {transfer.sendCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">They received</span>
                <span className="font-medium text-green-700">{transfer.receiveAmount} {transfer.receiveCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exchange rate</span>
                <span className="text-gray-700">1 {transfer.sendCurrency} = {parseFloat(transfer.fxRateApplied).toFixed(4)} {transfer.receiveCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-700">{new Date(transfer.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="mt-4 w-full border border-green-300 text-green-700 hover:bg-green-100 font-medium py-2.5 rounded-lg transition text-sm"
            >
              Print Receipt
            </button>
          </div>
        )}

        {/* Cancel button */}
        {!['delivered', 'failed', 'cancelled', 'payout_processing'].includes(transfer.status) && (
          <button
            onClick={async () => {
              if (!confirm('Cancel this transfer? Funds will be refunded to your wallet.')) return;
              try {
                const res = await api.post(`/transfers/${id}/cancel`);
                setTransfer(res.data);
              } catch (err) {
                const e = err as { response?: { data?: { message?: string } } };
                alert(e.response?.data?.message || 'Could not cancel — the transfer may have already advanced.');
              }
            }}
            className="w-full border border-red-300 text-red-500 hover:bg-red-50 font-medium py-2.5 rounded-lg transition text-sm"
          >
            Cancel Transfer
          </button>
        )}
      </div>
    </div>
  );
}
