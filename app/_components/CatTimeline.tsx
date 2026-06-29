'use client';
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

export function CatTimeline({ currentStatus, timeline, delivered, failed }: CatTimelineProps) {
  const idx = ORDER.indexOf(currentStatus as StepKey);
  const progress = delivered ? 1 : Math.max(0, idx / (STEPS.length - 1));

  if (failed) {
    return (
      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--danger)]/30 p-6">
        <div className="flex items-center gap-4">
          <div className="opacity-80">
            <RealisticCat status="failed" size={72} transparent="alpha" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--danger)] font-bold">Returned</p>
            <p className="text-[var(--foreground)] font-semibold mt-1">Funds returned to your wallet</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              {timeline.at(-1)?.message ?? 'Transfer ended'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cat plays only TWO clips on this view: payout_processing (running) the whole
  // time the money is in motion, then delivered (dancing) when it lands. Status
  // names don't swap the asset mid-flight — that's what made the cat look broken.
  const catStatus: StepKey = delivered ? 'delivered' : 'payout_processing';
  const currentStep = STEPS.find((s) => s.key === ORDER[Math.max(0, Math.min(idx, STEPS.length - 1))]);

  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 overflow-hidden">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-bold text-[var(--foreground)] text-lg">Live tracking</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">
          Step {Math.min(idx + 1, STEPS.length)} / {STEPS.length}
        </span>
      </div>

      {currentStep && (
        <div className="mb-6 text-sm">
          <p className="text-[var(--muted-foreground)]">
            <span className="text-[var(--accent)] font-semibold">{currentStep.label}</span>
            <span className="mx-2">·</span>
            {currentStep.sub}
          </p>
        </div>
      )}

      {/* The track — cat walks from left to right along it. */}
      <div className="relative h-32">
        {/* track line */}
        <div className="absolute left-2 right-2 top-[68px] h-1 rounded-full bg-[var(--surface-elevated)]" />
        {/* progress fill */}
        <div
          className="absolute left-2 top-[68px] h-1 rounded-full"
          style={{
            width: `calc((100% - 16px) * ${progress})`,
            background: 'linear-gradient(90deg, var(--accent), var(--mint))',
            boxShadow: '0 0 10px rgba(224,178,89,0.5)',
            // Smooth, slow ease for the progress fill so it glides instead of snapping.
            transition: 'width 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        {/* checkpoints */}
        <div className="absolute left-2 right-2 top-[64px] flex justify-between pointer-events-none">
          {STEPS.map((step, i) => {
            const done = delivered ? true : i < idx;
            const active = i === idx && !delivered;
            return (
              <div
                key={step.key}
                className="flex flex-col items-center -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-colors duration-500 ${
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

        {/* The cat — glides along the track. No interactivity, no scale bounces,
            no yarn — just smooth left-to-right motion with the running clip. */}
        <div
          className="absolute -translate-x-1/2 pointer-events-none select-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${progress})`,
            top: '0px',
            zIndex: 5,
            // Long, gentle ease for the position so the cat glides between
            // checkpoints rather than snapping.
            transition: 'left 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
          }}
        >
          <div style={{ animation: 'cat-breathe 3.6s ease-in-out infinite' }}>
            <RealisticCat status={catStatus} size={80} transparent="alpha" />
          </div>
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
                className={`text-[10px] uppercase tracking-[0.15em] font-bold transition-colors ${
                  active
                    ? 'text-[var(--accent)]'
                    : done
                    ? 'text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)]'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
