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
  return ORDER.includes(status as StepKey) ? (status as StepKey) : 'initiated';
}

const PURR_MESSAGES = ['purr', 'mrrrr', 'meow', 'more', '<3'];

interface FloatingMark {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

export function CatTimeline({ currentStatus, timeline, delivered, failed }: CatTimelineProps) {
  const idx = ORDER.indexOf(currentStatus as StepKey);
  const progress = delivered ? 1 : Math.max(0, idx / (STEPS.length - 1));

  // Pointer / play state
  const [reacting, setReacting] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [petCount, setPetCount] = useState(0);
  const [marks, setMarks] = useState<FloatingMark[]>([]);
  const markIdRef = useRef(0);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const trailLast = useRef<{ x: number; y: number } | null>(null);

  const spawnMark = (x: number, y: number, emoji?: string) => {
    const id = ++markIdRef.current;
    const e = emoji ?? '★';
    setMarks((prev) => [...prev, { id, x, y, emoji: e }]);
    setTimeout(() => setMarks((prev) => prev.filter((m) => m.id !== id)), 1100);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      px: e.clientX,
      py: e.clientY,
      ox: drag?.x ?? 0,
      oy: drag?.y ?? 0,
      moved: false,
    };
    setDragging(true);
    setReacting(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragStart.current.moved = true;
    setDrag({
      x: dragStart.current.ox + Math.max(-50, Math.min(50, dx)),
      y: dragStart.current.oy + Math.max(-30, Math.min(30, dy)),
    });
    // Sparkle trail while dragging
    const local = e.currentTarget.getBoundingClientRect();
    const lx = e.clientX - local.left;
    const ly = e.clientY - local.top;
    if (
      !trailLast.current ||
      Math.hypot(lx - trailLast.current.x, ly - trailLast.current.y) > 18
    ) {
      trailLast.current = { x: lx, y: ly };
      spawnMark(lx, ly, '✦');
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // Was it a tap (no drag movement)? If so, it's a pet.
    const wasTap = dragStart.current && !dragStart.current.moved;
    dragStart.current = null;
    trailLast.current = null;
    setDrag(null);
    setDragging(false);

    if (wasTap) {
      const local = e.currentTarget.getBoundingClientRect();
      const lx = e.clientX - local.left;
      const ly = e.clientY - local.top;
      setPetCount((c) => c + 1);
      // pet → spawn a gold star + small heart
      spawnMark(lx, ly - 8, '★');
      spawnMark(lx + 8, ly - 4, '♡');
    }
    setTimeout(() => setReacting(false), 450);
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
  const message = petCount > 0 ? PURR_MESSAGES[Math.min(petCount - 1, PURR_MESSAGES.length - 1)] : 'pet me';

  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 overflow-hidden">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-bold text-[var(--foreground)] text-lg">Live tracking</h2>
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold">
          Step {Math.min(idx + 1, STEPS.length)} / {STEPS.length}
        </span>
      </div>

      {currentStep && (
        <div className="flex items-baseline justify-between mb-6 text-sm">
          <p className="text-[var(--muted-foreground)]">
            <span className="text-[var(--accent)] font-semibold">{currentStep.label}</span>
            <span className="mx-2">·</span>
            {currentStep.sub}
          </p>
          {petCount > 0 && (
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[var(--accent)]">
              ★ {petCount} pets
            </p>
          )}
        </div>
      )}

      {/* the track — cat walks across this */}
      <div className="relative h-32">
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
        <div className="absolute left-2 right-2 top-[64px] flex justify-between pointer-events-none">
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

        {/* floating gold marks (stars / hearts / sparkles) */}
        {marks.map((m) => (
          <span
            key={m.id}
            className="absolute pointer-events-none font-bold"
            style={{
              left: m.x,
              top: m.y,
              color: m.emoji === '♡' ? '#ff6b8a' : '#e0b259',
              fontSize: m.emoji === '✦' ? 12 : 16,
              animation: 'mark-float 1.1s ease-out forwards',
              textShadow: '0 0 8px rgba(224,178,89,0.6)',
            }}
          >
            {m.emoji}
          </span>
        ))}

        {/* the cat — positioned along the track, interactive */}
        <div
          className="absolute -translate-x-1/2 select-none touch-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${progress})`,
            top: '0px',
            cursor: dragging ? 'grabbing' : 'grab',
            transition: dragging
              ? undefined
              : 'left 900ms cubic-bezier(0.22, 1, 0.36, 1), transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: `translate(${drag?.x ?? 0}px, ${drag?.y ?? 0}px) scale(${reacting ? 1.1 : hovering ? 1.04 : 1})`,
            filter: reacting
              ? 'drop-shadow(0 8px 18px rgba(224,178,89,0.55))'
              : hovering
              ? 'drop-shadow(0 6px 14px rgba(224,178,89,0.35))'
              : 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragStart.current = null;
            trailLast.current = null;
            setDrag(null);
            setDragging(false);
            setReacting(false);
          }}
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => {
            if (!dragging) setHovering(false);
          }}
        >
          <RealisticCat status={pose} size={64} />
          {(hovering || reacting) && (
            <span
              className="absolute -top-3 left-full ml-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)] bg-[var(--surface-elevated)] border border-[var(--accent)]/40 rounded-full px-2 py-0.5 whitespace-nowrap pointer-events-none"
              style={{ animation: 'float-up 280ms ease-out both' }}
            >
              {message}
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

      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] text-center mt-5">
        Tap to pet · drag to play · she&apos;ll find her way home
      </p>
    </div>
  );
}
