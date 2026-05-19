'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { io } from 'socket.io-client';
import { getToken } from '@/lib/auth';
import { BrandWordmark } from '@/app/_components/Brand';
import { CatCoin } from '@/app/_components/CatCoin';

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
  { key: 'initiated', label: 'Transfer initiated', sub: 'We received your request' },
  { key: 'payment_received', label: 'Payment received', sub: 'Funds debited from your wallet' },
  { key: 'compliance_check', label: 'Identity verified', sub: 'Compliance check passed' },
  { key: 'fx_converted', label: 'Converted at rate', sub: 'Locked in the FX rate' },
  { key: 'payout_processing', label: 'Sending to bank', sub: 'Payout partner processing' },
  { key: 'delivered', label: 'Delivered', sub: 'Funds in recipient account' },
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
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Transfer not found.</p>
      </div>
    );
  }

  const currentStepIndex = stepOrder.indexOf(transfer.status);
  const isFailed = transfer.status === 'failed';
  const isCancelled = transfer.status === 'cancelled';
  const isDelivered = transfer.status === 'delivered';
  const progressPct = isDelivered
    ? 100
    : Math.max(0, Math.min(100, (currentStepIndex / (steps.length - 1)) * 100));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--brand)]">←</Link>
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Tracking</span>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Summary card */}
        <div className="bg-[var(--brand)] text-white rounded-3xl p-6 shadow-lg">
          <p className="text-white/70 text-xs uppercase tracking-wider font-semibold">
            {isDelivered ? 'Delivered' : isFailed ? 'Failed' : isCancelled ? 'Cancelled' : 'In progress'}
          </p>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-3xl font-bold">{parseFloat(transfer.amount).toFixed(2)} {transfer.sendCurrency}</p>
              {transfer.receiveAmount && (
                <p className="text-white/80 text-sm mt-1">
                  → {parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency} to {transfer.recipient?.name}
                </p>
              )}
            </div>
          </div>
          {transfer.fxRateApplied && (
            <p className="text-white/60 text-xs mt-3">
              1 {transfer.sendCurrency} = {parseFloat(transfer.fxRateApplied).toFixed(4)} {transfer.receiveCurrency}
            </p>
          )}
        </div>

        {(isFailed || isCancelled) ? (
          <div className={`rounded-3xl border p-6 text-center ${isFailed ? 'bg-red-50 border-red-200' : 'bg-[var(--muted)] border-[var(--border)]'}`}>
            <p className="text-3xl mb-2">{isFailed ? '😿' : '🚫'}</p>
            <p className={`font-semibold ${isFailed ? 'text-red-700' : 'text-[var(--foreground)]'}`}>
              Transfer {isFailed ? 'failed' : 'cancelled'}
            </p>
            {transfer.timeline.at(-1)?.message && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{transfer.timeline.at(-1)?.message}</p>
            )}
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-1">Where&apos;s your money?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              Our cat is taking your coin to the recipient.
            </p>

            {/* Track with the cat walking down it */}
            <div className="relative">
              {/* the track */}
              <div className="absolute left-7 top-3 bottom-3 w-1 bg-[var(--muted)] rounded-full" />
              {/* progress fill on the track */}
              <div
                className="absolute left-7 top-3 w-1 bg-gradient-to-b from-[var(--accent)] to-[var(--accent-deep)] rounded-full transition-all duration-700"
                style={{ height: `calc(${progressPct}% - 6px)` }}
              />
              {/* the cat walking */}
              <div
                className="absolute -left-1 transition-all duration-700"
                style={{
                  top: `calc(${progressPct}% - 32px)`,
                }}
              >
                <CatCoin size={56} playful={!isDelivered} />
              </div>

              <div className="space-y-5 pl-20">
                {steps.map((step, i) => {
                  const done = isDelivered ? true : i < currentStepIndex;
                  const active = i === currentStepIndex && !isDelivered;
                  const timeline = transfer.timeline.find((t) => t.status === step.key);
                  return (
                    <div
                      key={step.key}
                      className="relative"
                      style={{
                        animation: active ? 'float-up 300ms ease-out both' : undefined,
                      }}
                    >
                      {/* dot on the track */}
                      <div
                        className={`absolute -left-[52px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                          done
                            ? 'bg-[var(--accent)] border-[var(--accent)]'
                            : active
                            ? 'bg-white border-[var(--accent)]'
                            : 'bg-[var(--muted)] border-[var(--border)]'
                        }`}
                      />
                      <p className={`font-medium ${done || active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{step.sub}</p>
                      {timeline && (
                        <p className="text-[10px] text-[var(--muted-foreground)] mt-1 uppercase tracking-wider">
                          {new Date(timeline.createdAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Receipt — shown when delivered */}
        {isDelivered && (
          <div className="bg-gradient-to-br from-emerald-50 to-[var(--muted)] border border-emerald-200 rounded-3xl p-6">
            <h2 className="font-semibold text-emerald-800 mb-4 flex items-center gap-2">
              <span className="text-xl">🎉</span> Receipt
            </h2>
            <div className="space-y-2 text-sm">
              <Row label="Transfer ID" value={<span className="font-mono text-[var(--muted-foreground)] text-xs">{transfer.id}</span>} />
              <Row label="Recipient" value={transfer.recipient?.name} />
              <Row label="You sent" value={`${parseFloat(transfer.amount).toFixed(2)} ${transfer.sendCurrency}`} />
              <Row label="They received" value={<span className="text-emerald-700 font-semibold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>} />
              <Row label="Exchange rate" value={`1 ${transfer.sendCurrency} = ${parseFloat(transfer.fxRateApplied).toFixed(4)} ${transfer.receiveCurrency}`} />
              <Row label="Date" value={new Date(transfer.createdAt).toLocaleString()} />
            </div>
            <button
              onClick={() => window.print()}
              className="mt-4 w-full border border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-medium py-2.5 rounded-xl transition text-sm"
            >
              Print receipt
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
            className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-medium py-3 rounded-2xl transition text-sm"
          >
            Cancel transfer
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-[var(--foreground)] font-medium">{value}</span>
    </div>
  );
}
