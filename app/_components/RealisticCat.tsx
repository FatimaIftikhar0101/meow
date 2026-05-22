'use client';
import { useEffect, useState } from 'react';
import { POSES } from './CatPoses';

type Status = keyof typeof POSES;

/**
 * Renders the most realistic asset available for a given transfer status:
 *
 *   /cats/{status}.mp4   ← best (real video clip, loops silently)
 *   /cats/{status}.webm
 *   /cats/{status}.webp
 *   /cats/{status}.gif
 *   /cats/{status}.png
 *   /cats/{status}.jpg / .jpeg
 *
 * Falls back to the elegant SVG pose if no asset is present.
 *
 * Drop a real cat-playing-with-yarn .mp4 at e.g.
 *   /home/pc/meow/public/cats/payout_processing.mp4
 * and the timeline instantly shows a real cat — no rebuild.
 */
const VIDEO_EXTS = ['mp4', 'webm'] as const;
const IMAGE_EXTS = ['webp', 'gif', 'png', 'jpg', 'jpeg'] as const;

const cache: Partial<Record<Status, { url: string; kind: 'video' | 'image' } | 'none'>> = {};

async function probe(status: Status): Promise<{ url: string; kind: 'video' | 'image' } | null> {
  const cached = cache[status];
  if (cached) return cached === 'none' ? null : cached;
  for (const ext of VIDEO_EXTS) {
    const url = `/cats/${status}.${ext}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        const hit = { url, kind: 'video' as const };
        cache[status] = hit;
        return hit;
      }
    } catch {
      /* ignore */
    }
  }
  for (const ext of IMAGE_EXTS) {
    const url = `/cats/${status}.${ext}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        const hit = { url, kind: 'image' as const };
        cache[status] = hit;
        return hit;
      }
    } catch {
      /* ignore */
    }
  }
  cache[status] = 'none';
  return null;
}

export function RealisticCat({ status, size = 80 }: { status: Status; size?: number }) {
  const initial = cache[status];
  const [asset, setAsset] = useState<{ url: string; kind: 'video' | 'image' } | null>(
    initial && initial !== 'none' ? initial : null,
  );
  const [checked, setChecked] = useState(initial === 'none');

  useEffect(() => {
    let cancelled = false;
    probe(status).then((found) => {
      if (cancelled) return;
      setAsset(found);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (asset?.kind === 'video') {
    return (
      <video
        src={asset.url}
        width={size}
        height={size}
        autoPlay
        loop
        muted
        playsInline
        className="rounded-2xl object-cover bg-[var(--surface-elevated)]"
        style={{ width: size, height: size }}
      />
    );
  }

  if (asset?.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local asset, tiny, no remote optimisation needed
      <img
        src={asset.url}
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
