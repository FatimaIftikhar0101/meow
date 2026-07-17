'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { io } from 'socket.io-client';
import { getToken } from '@/lib/auth';
import { BrandWordmark, BackLink } from '@/app/_components/Brand';
import { WorldMap } from '@/app/_components/WorldMap';
import { CatTimeline } from '@/app/_components/CatTimeline';

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
  const progress = isDelivered ? 1 : currentStepIndex / (steps.length - 1);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="bg-[var(--surface)]/80 backdrop-blur border-b border-[var(--border)] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <BackLink />
          <BrandWordmark size={24} />
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Tracking</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* The world map — kitten flying from sender to recipient */}
        <WorldMap
          sendCurrency={transfer.sendCurrency}
          receiveCurrency={transfer.receiveCurrency}
          recipientName={transfer.recipient?.name}
          progress={progress}
          delivered={isDelivered}
          failed={isFailed || isCancelled}
        />

        {/* Amount card */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 shadow-sm">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">
              {isDelivered ? 'Delivered' : isFailed ? 'Failed' : isCancelled ? 'Cancelled' : 'On its way'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">{transfer.id.slice(0, 8)}…</p>
          </div>
          <p className="text-4xl font-extrabold mt-2 tracking-tight text-[var(--foreground)]">
            {parseFloat(transfer.amount).toFixed(2)} <span className="text-[var(--muted-foreground)] text-2xl">{transfer.sendCurrency}</span>
          </p>
          {transfer.receiveAmount && (
            <p className="mt-1 text-[var(--foreground)]">
              <span className="text-[var(--mint)] font-bold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>
              <span className="text-[var(--muted-foreground)]"> → {transfer.recipient?.name}</span>
            </p>
          )}
          {transfer.fxRateApplied && (
            <p className="text-xs text-[var(--muted-foreground)] mt-3 font-mono">
              1 {transfer.sendCurrency} = {parseFloat(transfer.fxRateApplied).toFixed(4)} {transfer.receiveCurrency}
            </p>
          )}
        </div>

        <CatTimeline
          currentStatus={transfer.status}
          timeline={transfer.timeline}
          delivered={isDelivered}
          failed={isFailed || isCancelled}
        />

        {/* Receipt — shown when delivered */}
        {isDelivered && (
          <>
            <style>{`
              @media print {
                body > * { display: none !important; }
                #meow-receipt { display: block !important; position: static !important; width: 100% !important; }
                #meow-receipt-print-hide { display: none !important; }
              }
            `}</style>
            <div
              id="meow-receipt"
              className="relative rounded-3xl p-6 overflow-hidden border"
              style={{
                background: 'linear-gradient(135deg, var(--mint-soft), var(--gold-soft))',
                borderColor: 'var(--mint)',
              }}
            >
              <h2 className="font-bold text-[var(--foreground)] mb-4 flex items-center gap-2 text-lg">
                <span className="text-2xl">🎉</span> Done! Here&apos;s your receipt
              </h2>
              <div className="mb-2 text-center print:block hidden">
                <p className="text-xs text-[var(--muted-foreground)] font-semibold tracking-widest uppercase">Meow · Official Transfer Receipt</p>
              </div>
              <div className="space-y-2 text-sm">
                <Row label="Transfer ID" value={<span className="font-mono text-[var(--muted-foreground)] text-xs">{transfer.id}</span>} />
                <Row label="Recipient" value={transfer.recipient?.name} />
                <Row label="Bank account" value={<span className="font-mono text-xs">{transfer.recipient?.bankAccount}</span>} />
                <Row label="You sent" value={`${parseFloat(transfer.amount).toFixed(2)} ${transfer.sendCurrency}`} />
                <Row label="They received" value={<span className="text-[var(--mint)] font-bold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>} />
                <Row label="Exchange rate" value={`1 ${transfer.sendCurrency} = ${parseFloat(transfer.fxRateApplied).toFixed(4)} ${transfer.receiveCurrency}`} />
                <Row label="Date" value={new Date(transfer.createdAt).toLocaleString()} />
              </div>
              <button
                id="meow-receipt-print-hide"
                onClick={() => window.print()}
                className="mt-5 w-full bg-[var(--ink)] text-white hover:bg-[var(--brand-deep)] font-semibold py-2.5 rounded-full transition text-sm"
              >
                Print / Save as PDF
              </button>
            </div>
          </>
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
            className="w-full border-2 border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger-soft)] font-semibold py-3 rounded-2xl transition text-sm"
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
