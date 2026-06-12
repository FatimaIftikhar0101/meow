'use client';
import { useEffect, useState } from 'react';
import { POSES } from './CatPoses';

type Status = keyof typeof POSES;

/**
 * Renders the most realistic asset available for a given transfer status.
 *
 * Lookup order:
 *   1. /cats/{status}.{mp4,webm,webp,gif,png,jpg,jpeg}   (per-status, wins)
 *   2. /cats/default.{mp4,webm,webp,gif,png,jpg,jpeg}    (single file → all statuses)
 *   3. Refined SVG pose (fallback)
 *
 * Drop one file at:
 *   /home/pc/meow/public/cats/default.mp4
 * and the same real cat clip is used for every status on the timeline.
 *
 * Drop per-status files (e.g. delivered.mp4) to override default on a step.
 */
const VIDEO_EXTS = ['mp4', 'webm'] as const;
const IMAGE_EXTS = ['webp', 'gif', 'png', 'jpg', 'jpeg'] as const;

type Asset = { url: string; kind: 'video' | 'image' };

const cache: Map<string, Asset | 'none'> = new Map();

async function tryPath(name: string): Promise<Asset | null> {
  if (cache.has(name)) {
    const c = cache.get(name);
    return c === 'none' ? null : (c as Asset);
  }
  for (const ext of VIDEO_EXTS) {
    const url = `/cats/${name}.${ext}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        const hit: Asset = { url, kind: 'video' };
        cache.set(name, hit);
        return hit;
      }
    } catch {
      /* ignore */
    }
  }
  for (const ext of IMAGE_EXTS) {
    const url = `/cats/${name}.${ext}`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        const hit: Asset = { url, kind: 'image' };
        cache.set(name, hit);
        return hit;
      }
    } catch {
      /* ignore */
    }
  }
  cache.set(name, 'none');
  return null;
}

async function probe(status: Status): Promise<Asset | null> {
  // 1. per-status file wins
  const specific = await tryPath(status);
  if (specific) return specific;
  // 2. fall back to the single shared file
  return await tryPath('default');
}

export function RealisticCat({ status, size = 80 }: { status: Status; size?: number }) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [checked, setChecked] = useState(false);

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
