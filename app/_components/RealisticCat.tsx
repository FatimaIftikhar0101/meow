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
 * Transparency:
 *   pass transparent="lighten" if the source video has a near-black background
 *   pass transparent="multiply" if the source has a near-white background
 *   pass transparent="none" (default) to render the video as-is
 *
 * For true alpha (works regardless of background colour) export a .webm from
 * unscreen.com / Runway, save it as /cats/default.webm — it'll just work.
 */
const VIDEO_EXTS = ['webm', 'mp4'] as const;
const IMAGE_EXTS = ['webp', 'gif', 'png', 'jpg', 'jpeg'] as const;

type Asset = { url: string; kind: 'video' | 'image' };
type Transparency = 'none' | 'alpha' | 'lighten' | 'multiply';

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
  const specific = await tryPath(status);
  if (specific) return specific;
  return await tryPath('default');
}

interface Props {
  status: Status;
  size?: number;
  transparent?: Transparency;
}

export function RealisticCat({ status, size = 80, transparent = 'none' }: Props) {
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

  // Style applied to media when we want to chroma-out the background via CSS.
  const blendStyle: React.CSSProperties =
    transparent === 'lighten'
      ? { mixBlendMode: 'lighten', filter: 'contrast(1.15) brightness(1.05)' }
      : transparent === 'multiply'
      ? { mixBlendMode: 'multiply', filter: 'contrast(1.05)' }
      : {};

  const showFrame = transparent === 'none';
  const radius = showFrame ? '1rem' : '0';

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
        className={showFrame ? 'object-cover bg-[var(--surface-elevated)]' : 'object-contain'}
        style={{ width: size, height: size, borderRadius: radius, ...blendStyle }}
      />
    );
  }

  if (asset?.kind === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local asset, tiny
      <img
        src={asset.url}
        alt={status}
        width={size}
        height={size}
        className={showFrame ? 'object-cover' : 'object-contain'}
        style={{ width: size, height: size, borderRadius: radius, ...blendStyle }}
      />
    );
  }

  if (!checked) {
    return <div style={{ width: size, height: size }} className="rounded-2xl bg-[var(--surface-elevated)] animate-pulse" />;
  }

  const Pose = POSES[status];
  return <Pose size={size} />;
}
