'use client';

import { useEffect, useRef, useState } from 'react';

/* ─── prefers-reduced-motion ──────────────────────────────────────────── */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ─── useCountUp ──────────────────────────────────────────────────────── */
/** Eases from 0 to `value` over `duration` ms using easeOutQuart. Re-runs
 *  if `value` changes. Snaps instantly when prefers-reduced-motion. */
export function useCountUp(value: number, duration = 900): number {
  const [out, setOut] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion() || duration <= 0) {
      setOut(value);
      return;
    }
    fromRef.current = out;
    startRef.current = null;
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      // easeOutQuart — fast then settles
      const eased = 1 - Math.pow(1 - t, 4);
      const v = fromRef.current + (value - fromRef.current) * eased;
      setOut(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // out is intentionally excluded — we capture it as the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return out;
}

/* ─── Reveal ──────────────────────────────────────────────────────────── */
/** Wraps children in a div that fades + lifts in when it enters the
 *  viewport. Uses IntersectionObserver — fires once. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: As = 'div',
}: {
  children: React.ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  className?: string;
  as?: 'div' | 'li';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      // Syncs an external user preference (matchMedia) into state at mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <As
      ref={ref as unknown as React.Ref<HTMLDivElement & HTMLLIElement>}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity 580ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 580ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: shown ? 'auto' : 'transform, opacity',
      }}
    >
      {children}
    </As>
  );
}

/* ─── MagneticButton ──────────────────────────────────────────────────── */
/** A button-shaped wrapper that gets pulled toward the cursor within a
 *  small radius. Only active on fine pointers (desktop) — touch devices
 *  pass straight through to the wrapped element. */
export function MagneticButton({
  children,
  strength = 0.35,
  className,
  ...rest
}: {
  children: React.ReactNode;
  /** 0 = no pull, 1 = button follows cursor 1:1 inside its bounds. */
  strength?: number;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const finePointer = useRef(false);

  useEffect(() => {
    finePointer.current =
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia('(pointer: fine)').matches &&
      !prefersReducedMotion();
  }, []);

  const onMove = (e: React.PointerEvent) => {
    if (!finePointer.current || !ref.current || !innerRef.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;
    innerRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onLeave = () => {
    if (!innerRef.current) return;
    innerRef.current.style.transform = 'translate(0, 0)';
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={className}
      {...rest}
    >
      <div
        ref={innerRef}
        style={{
          display: 'inline-block',
          transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
