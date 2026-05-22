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
  const [kissing, setKissing] = useState(false);
  const [marks, setMarks] = useState<FloatingMark[]>([]);
  const [yarn, setYarn] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [yarnDragging, setYarnDragging] = useState(false);
  const markIdRef = useRef(0);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);
  const trailLast = useRef<{ x: number; y: number } | null>(null);
  const kissTimer = useRef<number | null>(null);
  const yarnStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const yarnNudge = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    yarnStart.current = { px: e.clientX, py: e.clientY, ox: yarn.x, oy: yarn.y };
    setYarnDragging(true);
  };
  const yarnMove = (e: React.PointerEvent) => {
    if (!yarnStart.current) return;
    const dx = e.clientX - yarnStart.current.px;
    const dy = e.clientY - yarnStart.current.py;
    setYarn({
      x: yarnStart.current.ox + Math.max(-80, Math.min(80, dx)),
      y: yarnStart.current.oy + Math.max(-50, Math.min(50, dy)),
    });
  };
  const yarnRelease = () => {
    yarnStart.current = null;
    setYarnDragging(false);
    setYarn({ x: 0, y: 0 });
  };

  const spawnMark = (x: number, y: number, emoji?: string) => {
    const id = ++markIdRef.current;
    const e = emoji ?? '★';
    setMarks((prev) => [...prev, { id, x, y, emoji: e }]);
    setTimeout(() => setMarks((prev) => prev.filter((m) => m.id !== id)), 1400);
  };

  const triggerKiss = (lx: number, ly: number) => {
    // Cat zooms big, fires a flurry of hearts + coin kisses outward.
    setKissing(true);
    spawnMark(lx, ly - 4, '♡');
    spawnMark(lx + 12, ly + 4, '★');
    spawnMark(lx - 10, ly, '✦');
    spawnMark(lx + 4, ly - 14, '😘');
    if (kissTimer.current) window.clearTimeout(kissTimer.current);
    kissTimer.current = window.setTimeout(() => setKissing(false), 1400);
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
      // pet → cat blows a kiss-coin in your direction (the big reaction)
      triggerKiss(lx, ly);
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
  const message = kissing
    ? 'mwah!'
    : petCount > 0
    ? PURR_MESSAGES[Math.min(petCount - 1, PURR_MESSAGES.length - 1)]
    : 'tap for a kiss';

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

        {/* floating gold marks (stars / hearts / sparkles / kisses) */}
        {marks.map((m) => {
          const isEmoji = m.emoji === '😘';
          const isHeart = m.emoji === '♡';
          return (
            <span
              key={m.id}
              className="absolute pointer-events-none font-bold"
              style={
                {
                  left: m.x,
                  top: m.y,
                  color: isHeart ? '#ff6b8a' : '#e0b259',
                  fontSize: isEmoji ? 26 : m.emoji === '✦' ? 12 : 18,
                  animation: isEmoji ? 'kiss-fly 1.4s ease-out forwards' : 'mark-float 1.2s ease-out forwards',
                  textShadow: '0 0 10px rgba(224,178,89,0.6)',
                  '--kiss-x': `${(m.id * 17) % 60 - 30}px`,
                } as React.CSSProperties
              }
            >
              {m.emoji}
            </span>
          );
        })}

        {/* the cat — positioned along the track, interactive */}
        <div
          className="absolute -translate-x-1/2 select-none touch-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${progress})`,
            top: kissing ? '-32px' : '0px',
            zIndex: kissing ? 20 : 5,
            cursor: dragging ? 'grabbing' : 'grab',
            transition: dragging
              ? 'top 400ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'left 900ms cubic-bezier(0.22, 1, 0.36, 1), top 400ms cubic-bezier(0.22, 1, 0.36, 1), transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: `translate(${drag?.x ?? 0}px, ${drag?.y ?? 0}px) scale(${
              kissing ? 2.4 : reacting ? 1.1 : hovering ? 1.04 : 1
            })`,
            transformOrigin: 'center bottom',
            filter: kissing
              ? 'drop-shadow(0 16px 32px rgba(224,178,89,0.7))'
              : reacting
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
          {/* idle breathing wrapper — always running for "video-like" casual motion */}
          <div style={{ animation: 'cat-breathe 3.6s ease-in-out infinite' }}>
            <RealisticCat status={pose} size={64} />
          </div>

          {kissing && (
            <span
              className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl pointer-events-none"
              style={{ animation: 'mark-float 1.3s ease-out forwards' }}
            >
              😘
            </span>
          )}

          {(hovering || reacting) && !kissing && (
            <span
              className="absolute -top-3 left-full ml-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)] bg-[var(--surface-elevated)] border border-[var(--accent)]/40 rounded-full px-2 py-0.5 whitespace-nowrap pointer-events-none"
              style={{ animation: 'float-up 280ms ease-out both' }}
            >
              {message}
            </span>
          )}
        </div>

        {/* Yarn ball — drag it around, lets go and it bounces back next to her. */}
        <div
          className="absolute -translate-x-1/2 cursor-grab active:cursor-grabbing select-none touch-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${progress} + 56px)`,
            top: '44px',
            transform: `translate(${yarn.x}px, ${yarn.y}px) rotate(${yarn.x * 1.5}deg)`,
            transition: yarnDragging
              ? 'transform 60ms linear, left 900ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1), left 900ms cubic-bezier(0.22, 1, 0.36, 1)',
            zIndex: 4,
          }}
          onPointerDown={yarnNudge}
          onPointerMove={yarnMove}
          onPointerUp={yarnRelease}
          onPointerCancel={yarnRelease}
          aria-label="Toy yarn ball"
        >
          <YarnBall size={28} />
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
        Tap for a kiss · drag the yarn · she&apos;ll find her way home
      </p>
    </div>
  );
}

function YarnBall({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id="yarnGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff7a8a" />
          <stop offset="55%" stopColor="#e0334d" />
          <stop offset="100%" stopColor="#7a1023" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="16" fill="url(#yarnGrad)" />
      {/* yarn strands */}
      <g stroke="#a51a30" strokeWidth="0.8" fill="none" opacity="0.7">
        <path d="M 6 18 Q 14 12 22 16 Q 30 20 34 14" />
        <path d="M 6 22 Q 16 18 24 22 Q 32 26 36 22" />
        <path d="M 8 28 Q 16 26 22 30 Q 28 34 34 30" />
        <path d="M 10 12 Q 18 10 24 14 Q 30 18 34 16" />
      </g>
      {/* dangling tail */}
      <path d="M 32 28 Q 38 32 36 38" stroke="#e0334d" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* highlight */}
      <circle cx="13" cy="14" r="3" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
