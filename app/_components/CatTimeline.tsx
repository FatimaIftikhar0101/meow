'use client';
import { useRef, useState } from 'react';
import { RealisticCat } from './RealisticCat';

interface TimelineEntry {
  id: string;
  status: string;
  message: string;
  createdAt: string;
}

interface CatTimelineProps {
  currentStatus: string;
  timeline: TimelineEntry[];
  delivered?: boolean;
  failed?: boolean;
}

const STEPS = [
  { key: 'initiated', label: 'Initiated', sub: 'Request received' },
  { key: 'payment_received', label: 'Payment', sub: 'Funds debited' },
  { key: 'compliance_check', label: 'Compliance', sub: 'Identity verified' },
  { key: 'fx_converted', label: 'Converted', sub: 'FX rate locked' },
  { key: 'payout_processing', label: 'Payout', sub: 'Sending to bank' },
  { key: 'delivered', label: 'Delivered', sub: 'In recipient account' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const ORDER = STEPS.map((s) => s.key);

function poseFor(status: string, delivered: boolean): StepKey {
  if (delivered) return 'delivered';
  return (ORDER.includes(status as StepKey) ? (status as StepKey) : 'initiated');
}

export function CatTimeline({ currentStatus, timeline, delivered, failed }: CatTimelineProps) {
  const idx = ORDER.indexOf(currentStatus as StepKey);
  const progress = delivered ? 1 : Math.max(0, idx / (STEPS.length - 1));

  // Interactive cat — tracks pointer events so it feels alive.
  const [reacting, setReacting] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: drag?.x ?? 0, oy: drag?.y ?? 0 };
    setDragging(true);
    setReacting(true);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    // Cap so it springs back nicely.
    setDrag({
      x: dragStart.current.ox + Math.max(-40, Math.min(40, dx)),
      y: dragStart.current.oy + Math.max(-30, Math.min(30, dy)),
    });
  };
  const handlePointerUp = () => {
    dragStart.current = null;
    setDrag(null);
    setDragging(false);
    // Linger the reaction a moment so the bounce reads.
    setTimeout(() => setReacting(false), 500);
  };

  if (failed) {
    return (
      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--danger)]/30 p-6">
        <div className="flex items-center gap-4">
          <div className="opacity-60">
            <RealisticCat status="compliance_check" size={64} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--danger)] font-bold">Returned</p>
            <p className="text-[var(--foreground)] font-semibold mt-1">Funds returned to your wallet</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{timeline.at(-1)?.message ?? 'Transfer ended'}</p>
          </div>
        </div>
      </div>
    );
  }

  const pose = poseFor(currentStatus, !!delivered);
  const currentStep = STEPS.find((s) => s.key === pose);

  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-bold text-[var(--foreground)] text-lg">Live tracking</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">
          Step {Math.min(idx + 1, STEPS.length)} / {STEPS.length}
        </span>
      </div>

      {currentStep && (
        <p className="text-sm text-[var(--muted-foreground)] mb-6">
          <span className="text-[var(--accent)] font-semibold">{currentStep.label}</span>
          <span className="mx-2">·</span>
          {currentStep.sub}
        </p>
      )}

      {/* the track: cat walks across this */}
      <div className="relative h-32" ref={ref}>
        {/* track line */}
        <div className="absolute left-2 right-2 top-[68px] h-1 rounded-full bg-[var(--surface-elevated)]" />
        {/* progress fill */}
        <div
          className="absolute left-2 top-[68px] h-1 rounded-full transition-all duration-700"
          style={{
            width: `calc((100% - 16px) * ${progress})`,
            background: 'linear-gradient(90deg, var(--accent), var(--mint))',
            boxShadow: '0 0 10px rgba(224,178,89,0.5)',
          }}
        />

        {/* checkpoints */}
        <div className="absolute left-2 right-2 top-[64px] flex justify-between">
          {STEPS.map((step, i) => {
            const done = delivered ? true : i < idx;
            const active = i === idx && !delivered;
            return (
              <div key={step.key} className="flex flex-col items-center -translate-x-1/2 first:translate-x-0 last:-translate-x-full">
                <div
                  className={`w-3 h-3 rounded-full border-2 transition ${
                    done
                      ? 'bg-[var(--accent)] border-[var(--accent)]'
                      : active
                      ? 'bg-[var(--background)] border-[var(--accent)] ring-4 ring-[var(--accent-soft)]'
                      : 'bg-[var(--surface)] border-[var(--border-strong)]'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* the cat — positioned along the track */}
        <div
          className="absolute -translate-x-1/2 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${progress})`,
            top: '0px',
            transition: dragging
              ? undefined
              : 'left 900ms cubic-bezier(0.22, 1, 0.36, 1), transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: `translate(${drag?.x ?? 0}px, ${drag?.y ?? 0}px) scale(${reacting ? 1.1 : 1})`,
            filter: reacting
              ? 'drop-shadow(0 8px 18px rgba(224,178,89,0.55))'
              : 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseEnter={() => setReacting(true)}
          onMouseLeave={() => !dragging && setReacting(false)}
        >
          <RealisticCat status={pose} size={64} />
          {reacting && (
            <span
              className="absolute -top-2 left-full ml-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)] bg-[var(--surface-elevated)] border border-[var(--accent)]/40 rounded-full px-2 py-0.5 whitespace-nowrap pointer-events-none"
              style={{ animation: 'float-up 280ms ease-out both' }}
            >
              meow
            </span>
          )}
        </div>
      </div>

      {/* step captions */}
      <div className="grid grid-cols-6 gap-2 mt-2">
        {STEPS.map((step, i) => {
          const done = delivered ? true : i < idx;
          const active = i === idx && !delivered;
          return (
            <div key={step.key} className="text-center">
              <p
                className={`text-[10px] uppercase tracking-[0.15em] font-bold ${
                  active ? 'text-[var(--accent)]' : done ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] text-center mt-4">
        Try dragging the cat
      </p>
    </div>
  );
}
