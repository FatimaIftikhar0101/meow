'use client';
import { useEffect, useState } from 'react';
import { POSES } from './CatPoses';

type Status = keyof typeof POSES;

/**
 * Renders a real photo/GIF of a cat for the given status if you've dropped
 * one into /public/cats/. Falls back to the elegant SVG otherwise.
 *
 * Lookup order (per status, e.g. "delivered"):
 *   /cats/delivered.webp
 *   /cats/delivered.gif    ← animated photos work great here
 *   /cats/delivered.png
 *   /cats/delivered.jpg
 *   /cats/delivered.jpeg
 *
 * Drop any of these formats into /home/pc/meow/public/cats/{status}.gif (or
 * .webp, .png …) and the timeline switches to real cats instantly — no
 * code change, no rebuild.
 */
const EXTENSIONS = ['webp', 'gif', 'png', 'jpg', 'jpeg'] as const;

const cache: Partial<Record<Status, string | 'none'>> = {};

async function probe(status: Status): Promise<string | null> {
  if (cache[status]) {
    return cache[status] === 'none' ? null : (cache[status] as string);
  }
  for (const ext of EXTENSIONS) {
    const url = `/cats/${status}.${ext}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        cache[status] = url;
        return url;
      }
    } catch {
      // ignore
    }
  }
  cache[status] = 'none';
  return null;
}

export function RealisticCat({ status, size = 80 }: { status: Status; size?: number }) {
  const [src, setSrc] = useState<string | null>(
    cache[status] && cache[status] !== 'none' ? (cache[status] as string) : null,
  );
  const [checked, setChecked] = useState(cache[status] === 'none');

  useEffect(() => {
    let cancelled = false;
    probe(status).then((url) => {
      if (cancelled) return;
      setSrc(url);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local asset, tiny, no remote optimisation needed
      <img
        src={src}
        alt={status}
        width={size}
        height={size}
        className="rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  if (!checked) {
    return <div style={{ width: size, height: size }} className="rounded-2xl bg-[var(--surface-elevated)] animate-pulse" />;
  }

  const Pose = POSES[status];
  return <Pose size={size} />;
}
