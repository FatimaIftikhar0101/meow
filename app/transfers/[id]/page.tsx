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
  { key: 'initiated', label: 'Initiated', sub: 'We received your request' },
  { key: 'payment_received', label: 'Payment received', sub: 'Funds debited from wallet' },
  { key: 'compliance_check', label: 'Identity verified', sub: 'Compliance check passed' },
  { key: 'fx_converted', label: 'Converted', sub: 'Locked in FX rate' },
  { key: 'payout_processing', label: 'Processing', sub: 'Paying out to recipient bank' },
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
  const isTerminal = isDelivered || isFailed || isCancelled;
  const progressPct = isDelivered
    ? 100
    : Math.max(0, Math.min(100, (currentStepIndex / (steps.length - 1)) * 100));

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-[var(--muted-foreground)] hover:text-[var(--brand)] text-lg">←</Link>
          <BrandWordmark size={24} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Tracking</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Hero card */}
        <div className="relative bg-[var(--ink)] text-white rounded-3xl p-7 shadow-2xl overflow-hidden">
          <div
            className="absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-50"
            style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)', animation: 'aurora 6s ease-in-out infinite' }}
          />
          <div
            className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full opacity-40"
            style={{ background: 'radial-gradient(circle, var(--mint), transparent 70%)', animation: 'aurora 7s ease-in-out infinite 1s' }}
          />
          <div className="relative">
            <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] font-bold">
              {isDelivered ? 'Delivered' : isFailed ? 'Failed' : isCancelled ? 'Cancelled' : 'On its way'}
            </p>
            <p className="text-4xl font-extrabold mt-2 tracking-tight">
              {parseFloat(transfer.amount).toFixed(2)} <span className="text-white/70 text-2xl">{transfer.sendCurrency}</span>
            </p>
            {transfer.receiveAmount && (
              <p className="mt-1 text-white/80">
                <span className="text-[var(--gold)] font-semibold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>
                <span className="text-white/60"> → {transfer.recipient?.name}</span>
              </p>
            )}
            {transfer.fxRateApplied && (
              <p className="text-white/50 text-xs mt-3 font-mono">
                1 {transfer.sendCurrency} · {parseFloat(transfer.fxRateApplied).toFixed(4)} {transfer.receiveCurrency}
              </p>
            )}
          </div>
        </div>

        {(isFailed || isCancelled) ? (
          <div className={`rounded-3xl border p-7 text-center ${isFailed ? 'bg-red-50 border-red-200' : 'bg-[var(--muted)] border-[var(--border)]'}`}>
            <p className="text-4xl mb-2">{isFailed ? '😿' : '🚫'}</p>
            <p className={`font-bold text-lg ${isFailed ? 'text-red-700' : 'text-[var(--foreground)]'}`}>
              Transfer {isFailed ? 'failed' : 'cancelled'}
            </p>
            {transfer.timeline.at(-1)?.message && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{transfer.timeline.at(-1)?.message}</p>
            )}
          </div>
        ) : (
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 shadow-sm">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-bold text-[var(--foreground)] text-lg">
                {isDelivered ? 'Delivered!' : 'On its way home'}
              </h2>
              <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                Step {currentStepIndex + 1}/{steps.length}
              </span>
            </div>

            {/* Horizontal walking track */}
            <div className="relative pt-2 pb-20 mb-2">
              {/* track background */}
              <div className="absolute left-0 right-0 top-1/2 h-2 rounded-full bg-[var(--muted)]" />
              {/* progress fill */}
              <div
                className="absolute left-0 top-1/2 h-2 rounded-full transition-all duration-1000"
                style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--gold))',
                }}
              />
              {/* mile markers */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between px-1">
                {steps.map((step, i) => {
                  const done = isDelivered ? true : i < currentStepIndex;
                  const active = i === currentStepIndex && !isDelivered;
                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`w-4 h-4 rounded-full border-2 transition ${
                          done
                            ? 'bg-[var(--accent)] border-[var(--accent)]'
                            : active
                            ? 'bg-white border-[var(--accent)] ring-4 ring-[var(--accent-soft)]'
                            : 'bg-[var(--surface)] border-[var(--border-strong)]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              {/* the cat walking along the track */}
              <div
                className="absolute -translate-x-1/2 transition-all duration-1000 ease-out"
                style={{
                  left: `${progressPct}%`,
                  top: 'calc(50% - 4.5rem)',
                }}
              >
                <CatCoin size={72} playful={!isDelivered} />
              </div>
              {/* destination — home */}
              <div className="absolute right-0 bottom-0 translate-y-2 text-2xl">🏡</div>
              <div className="absolute left-0 bottom-0 translate-y-2 text-2xl">💸</div>
            </div>

            {/* Step labels below */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center mt-2">
              {steps.map((step, i) => {
                const done = isDelivered ? true : i < currentStepIndex;
                const active = i === currentStepIndex && !isDelivered;
                return (
                  <div key={step.key} className={`text-[10px] uppercase tracking-wider font-semibold ${done || active ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                    {step.label}
                  </div>
                );
              })}
            </div>

            {/* Detailed timeline below */}
            <div className="mt-7 border-t border-[var(--border)] pt-5 space-y-3">
              {steps.map((step, i) => {
                const done = isDelivered ? true : i < currentStepIndex;
                const active = i === currentStepIndex && !isDelivered;
                const event = transfer.timeline.find((t) => t.status === step.key);
                if (!done && !active) return null;
                return (
                  <div
                    key={step.key}
                    className="flex items-start gap-3"
                    style={{ animation: active ? 'float-up 380ms ease-out both' : undefined }}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--mint)]'}`} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{step.label}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{step.sub}</p>
                    </div>
                    {event && (
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">
                        {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Receipt — shown when delivered */}
        {isDelivered && (
          <div
            className="relative rounded-3xl p-6 overflow-hidden border"
            style={{
              background: 'linear-gradient(135deg, var(--mint-soft), var(--gold-soft))',
              borderColor: 'var(--mint)',
            }}
          >
            <h2 className="font-bold text-[var(--foreground)] mb-4 flex items-center gap-2 text-lg">
              <span className="text-2xl">🎉</span> Done! Here&apos;s your receipt
            </h2>
            <div className="space-y-2 text-sm">
              <Row label="Transfer ID" value={<span className="font-mono text-[var(--muted-foreground)] text-xs">{transfer.id}</span>} />
              <Row label="Recipient" value={transfer.recipient?.name} />
              <Row label="You sent" value={`${parseFloat(transfer.amount).toFixed(2)} ${transfer.sendCurrency}`} />
              <Row label="They received" value={<span className="text-[var(--mint)] font-bold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>} />
              <Row label="Exchange rate" value={`1 ${transfer.sendCurrency} = ${parseFloat(transfer.fxRateApplied).toFixed(4)} ${transfer.receiveCurrency}`} />
              <Row label="Date" value={new Date(transfer.createdAt).toLocaleString()} />
            </div>
            <button
              onClick={() => window.print()}
              className="mt-5 w-full bg-[var(--ink)] text-white hover:bg-[var(--brand-deep)] font-semibold py-2.5 rounded-full transition text-sm"
            >
              Print receipt
            </button>
          </div>
        )}

        {/* Cancel button */}
        {!isTerminal && transfer.status !== 'payout_processing' && (
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
            className="w-full border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-2xl transition text-sm"
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
      <span className="text-[var(--foreground)] font-semibold">{value}</span>
    </div>
  );
}
