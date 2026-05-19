'use client';
import { POSES } from './CatPoses';

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
  {
    key: 'initiated',
    label: 'Initiated',
    activity: 'Sitting, watching your coin',
  },
  {
    key: 'payment_received',
    label: 'Payment received',
    activity: 'Reaching out to grab it',
  },
  {
    key: 'compliance_check',
    label: 'Compliance check',
    activity: 'Inspecting the coin carefully',
  },
  {
    key: 'fx_converted',
    label: 'FX converted',
    activity: 'Tossing it into the new currency',
  },
  {
    key: 'payout_processing',
    label: 'In transit',
    activity: 'Walking it to the recipient',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    activity: 'Coin handed over · purrs',
  },
] as const;

const ORDER = STEPS.map((s) => s.key);

export function CatTimeline({ currentStatus, timeline, delivered, failed }: CatTimelineProps) {
  const idx = ORDER.indexOf(currentStatus as typeof ORDER[number]);

  if (failed) {
    const Pose = POSES.compliance_check;
    return (
      <div className="bg-[var(--surface)] rounded-3xl border border-[var(--danger)]/30 p-6">
        <div className="flex items-center gap-4">
          <div className="opacity-50">
            <Pose size={72} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--danger)] font-bold">Returned</p>
            <p className="text-[var(--foreground)] font-semibold mt-1">Coin came back home</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{timeline.at(-1)?.message ?? 'Transfer ended'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-bold text-[var(--foreground)] text-lg">Where&apos;s your coin?</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">
          {Math.min(idx + 1, STEPS.length)} / {STEPS.length}
        </span>
      </div>

      <ol className="space-y-3">
        {STEPS.map((step, i) => {
          const Pose = POSES[step.key];
          const done = delivered ? true : i < idx;
          const active = i === idx && !delivered;
          const event = timeline.find((t) => t.status === step.key);

          const state = active ? 'active' : done ? 'done' : 'future';

          return (
            <li
              key={step.key}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition ${
                state === 'active'
                  ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)]'
                  : state === 'done'
                  ? 'border-[var(--border)] bg-[var(--surface-elevated)]'
                  : 'border-[var(--border)] bg-[var(--surface)] opacity-50'
              }`}
              style={state === 'active' ? { animation: 'float-up 380ms ease-out both' } : undefined}
            >
              <div
                className={`shrink-0 ${state === 'active' ? '' : 'grayscale opacity-80'}`}
                style={{
                  filter: state === 'active' ? 'drop-shadow(0 6px 14px rgba(224,178,89,0.25))' : undefined,
                }}
              >
                <Pose size={64} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      state === 'active' ? 'bg-[var(--accent)] animate-pulse' : state === 'done' ? 'bg-[var(--mint)]' : 'bg-[var(--border-strong)]'
                    }`}
                  />
                  <p className={`text-sm font-bold ${state === 'future' ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>
                    {step.label}
                  </p>
                  {state === 'active' && (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-[var(--accent)] font-bold">Now</span>
                  )}
                  {state === 'done' && (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.15em] text-[var(--mint)] font-bold">✓ Done</span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">{step.activity}</p>
                {event && (
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1.5 font-mono">
                    {new Date(event.createdAt).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
