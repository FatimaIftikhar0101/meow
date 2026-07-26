'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

function TransferPageInner() {
  const id = useSearchParams().get('id') ?? '';
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/transfers/${id}`)
      .then((res) => setTransfer(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    const wsUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const socket = io(`${wsUrl}/transfers`, {
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
                /* visibility:hidden lets a child override with visibility:visible —
                   display:none on a parent cannot be overridden by children, which
                   is why the old body>*{display:none} trick produced a blank page. */
                body { visibility: hidden; }
                #meow-receipt {
                  visibility: visible;
                  position: fixed !important;
                  top: 0 !important; left: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  padding: 48px !important;
                  border: none !important;
                  border-radius: 0 !important;
                  box-shadow: none !important;
                }
                #meow-receipt-screen { display: none !important; }
                #meow-receipt-print  { display: block !important; }
              }
            `}</style>

            <div id="meow-receipt">
              {/* ── Screen card ───────────────────────────────────────────── */}
              <div
                id="meow-receipt-screen"
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
                  <Row label="Recipient"   value={transfer.recipient?.name} />
                  <Row label="Bank account" value={<span className="font-mono text-xs">{transfer.recipient?.bankAccount}</span>} />
                  <Row label="You sent"    value={`${parseFloat(transfer.amount).toFixed(2)} ${transfer.sendCurrency}`} />
                  <Row label="They received" value={<span className="text-[var(--mint)] font-bold">{parseFloat(transfer.receiveAmount).toFixed(2)} {transfer.receiveCurrency}</span>} />
                  <Row label="Exchange rate" value={`1 ${transfer.sendCurrency} = ${parseFloat(transfer.fxRateApplied).toFixed(4)} ${transfer.receiveCurrency}`} />
                  <Row label="Date"        value={new Date(transfer.createdAt).toLocaleString()} />
                </div>
                <button
                  onClick={() => window.print()}
                  className="mt-5 w-full bg-[var(--ink)] text-white hover:bg-[var(--brand-deep)] font-semibold py-2.5 rounded-full transition text-sm"
                >
                  Print / Save as PDF
                </button>
              </div>

              {/* ── Print-only professional receipt ───────────────────────── */}
              <div id="meow-receipt-print" style={{ display: 'none', fontFamily: 'Georgia, serif', color: '#111' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', paddingBottom: '20px', borderBottom: '2px solid #111' }}>
                  <div>
                    <div style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', fontFamily: 'Arial, sans-serif' }}>meow</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', fontFamily: 'Arial, sans-serif' }}>meow.finance · International money transfer</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.5px' }}>Transfer Receipt</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', fontFamily: 'monospace' }}>Ref: {transfer.id.slice(0, 12).toUpperCase()}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{new Date(transfer.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                {/* Status banner */}
                <div style={{ border: '1.5px solid #1a9e5c', borderRadius: '6px', padding: '10px 16px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px', background: '#f0faf5' }}>
                  <span style={{ fontSize: '18px', color: '#1a9e5c', fontWeight: 700 }}>✓</span>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a9e5c' }}>Delivered</span>
                    <span style={{ fontSize: '12px', color: '#444', marginLeft: '8px' }}>Funds successfully credited to recipient&apos;s bank account</span>
                  </div>
                </div>

                {/* Transaction summary */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{ background: '#f3f4f6', padding: '8px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#6b7280', fontFamily: 'Arial, sans-serif' }}>
                    Transaction Summary
                  </div>
                  <div style={{ padding: '16px' }}>
                    <PrintRow label="You sent"      value={`${parseFloat(transfer.amount).toFixed(2)} ${transfer.sendCurrency}`} large />
                    <PrintRow label="They received" value={`${parseFloat(transfer.receiveAmount).toFixed(2)} ${transfer.receiveCurrency}`} large accent />
                    <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }} />
                    <PrintRow label="Exchange rate" value={`1 ${transfer.sendCurrency} = ${parseFloat(transfer.fxRateApplied).toFixed(4)} ${transfer.receiveCurrency}`} />
                  </div>
                </div>

                {/* Recipient details */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{ background: '#f3f4f6', padding: '8px 16px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#6b7280', fontFamily: 'Arial, sans-serif' }}>
                    Recipient
                  </div>
                  <div style={{ padding: '16px' }}>
                    <PrintRow label="Full name"    value={transfer.recipient?.name} />
                    <PrintRow label="Bank account" value={transfer.recipient?.bankAccount} mono />
                    <PrintRow label="Country"      value={transfer.recipient?.country} />
                  </div>
                </div>

                {/* Reference */}
                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '12px 16px', marginBottom: '28px' }}>
                  <PrintRow label="Transfer ID" value={transfer.id} mono small />
                  <PrintRow label="Date &amp; time" value={new Date(transfer.createdAt).toLocaleString()} small />
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '16px', fontSize: '10px', color: '#9ca3af', lineHeight: '1.7', fontFamily: 'Arial, sans-serif' }}>
                  <p>This document confirms a transfer processed through meow.finance. Retain for your records.</p>
                  <p style={{ marginTop: '4px' }}>meow.finance · support@meow.finance · This is not a tax document. Issued {new Date().toLocaleDateString()}.</p>
                </div>
              </div>
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

function PrintRow({ label, value, large, mono, small, accent }: {
  label: string; value: React.ReactNode;
  large?: boolean; mono?: boolean; small?: boolean; accent?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0' }}>
      <span style={{ color: '#6b7280', fontSize: small ? '11px' : '13px', fontFamily: 'Arial, sans-serif' }}>{label}</span>
      <span style={{
        fontFamily: mono ? 'monospace' : 'Arial, sans-serif',
        fontSize: large ? '17px' : small ? '11px' : '13px',
        fontWeight: large ? 700 : 600,
        color: accent ? '#1a9e5c' : '#111827',
      }}>{value}</span>
    </div>
  );
}

// Reads the transfer id from ?id= rather than a [id] path segment: a static
// export has no server to resolve arbitrary path params, and the app is
// exported as static files for both the web build and the Capacitor shell.
// useSearchParams needs a Suspense boundary to prerender.
export default function TransferPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
          <p className="text-[var(--muted-foreground)]">Loading…</p>
        </div>
      }
    >
      <TransferPageInner />
    </Suspense>
  );
}
