'use client';
import { useEffect, useRef, useState } from 'react';
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

/**
 * Cache-bust query appended to every /cats/* URL. Bump this whenever the
 * webm files are swapped in place — browsers happily serve stale bytes
 * from cache when the URL is unchanged, even after a hard refresh in
 * some cases (service worker, CDN, intermediate proxy). Increment to
 * force every client to re-download.
 */
const CATS_VERSION = '3';

type Asset = { url: string; kind: 'video' | 'image' };
type Transparency = 'none' | 'alpha' | 'lighten' | 'multiply';

const cache: Map<string, Asset | 'none'> = new Map();

async function tryPath(name: string): Promise<Asset | null> {
  if (cache.has(name)) {
    const c = cache.get(name);
    return c === 'none' ? null : (c as Asset);
  }
  for (const ext of VIDEO_EXTS) {
    const url = `/cats/${name}.${ext}?v=${CATS_VERSION}`;
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
    const url = `/cats/${name}.${ext}?v=${CATS_VERSION}`;
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
  /** Visual height of the cat. Width is inferred from aspect (portrait for alpha video). */
  size?: number;
  transparent?: Transparency;
  /**
   * The source clips are 360x452 (portrait, ~0.8 ratio). In alpha mode we
   * use that ratio so the cat fills the container with no empty space.
   * Override if you supply a square clip later.
   */
  aspect?: number;
}

const CROSSFADE_MS = 480;

export function RealisticCat({
  status,
  size = 80,
  transparent = 'none',
  aspect = transparent === 'alpha' ? 0.8 : 1,
}: Props) {
  // `asset` is the clip we're transitioning TO. `previous` is the clip
  // we're fading OUT during a swap — both render simultaneously for
  // CROSSFADE_MS so the cat dissolves between states instead of cutting.
  const [asset, setAsset] = useState<Asset | null>(null);
  const [previous, setPrevious] = useState<Asset | null>(null);
  const [checked, setChecked] = useState(false);
  // Track current via ref so the probe effect doesn't take `asset` as a dep
  // (would cause a render loop).
  const currentRef = useRef<Asset | null>(null);

  useEffect(() => {
    let cancelled = false;
    let prevTimer: ReturnType<typeof setTimeout> | undefined;
    probe(status).then((found) => {
      if (cancelled) {
        return;
      }
      // Same asset already on screen → nothing to do.
      if (found && currentRef.current?.url === found.url) {
        setChecked(true);
        return;
      }
      // Start a crossfade: snapshot the outgoing asset, swap in the new one,
      // then drop the snapshot once the fade has completed.
      setPrevious(currentRef.current);
      setAsset(found);
      currentRef.current = found;
      setChecked(true);
      prevTimer = setTimeout(() => {
        if (!cancelled) setPrevious(null);
      }, CROSSFADE_MS);
    });
    return () => {
      cancelled = true;
      if (prevTimer) clearTimeout(prevTimer);
    };
  }, [status]);

  // Style applied to media when we want to chroma-out the background via CSS.
  // In alpha mode we stack two warm drop-shadows around the silhouette so
  // the edge always reads as a soft gold rim, even where the aura sits
  // behind a transparent pixel.
  const blendStyle: React.CSSProperties =
    transparent === 'lighten'
      ? { mixBlendMode: 'lighten', filter: 'contrast(1.15) brightness(1.05)' }
      : transparent === 'multiply'
      ? { mixBlendMode: 'multiply', filter: 'contrast(1.05)' }
      : transparent === 'alpha'
      ? {
          filter:
            'drop-shadow(0 0 6px rgba(255,217,128,0.85)) drop-shadow(0 0 14px rgba(224,178,89,0.55))',
        }
      : {};

  const showFrame = transparent === 'none';
  const radius = showFrame ? '1rem' : '0';
  const width = Math.round(size * aspect);
  const height = size;
  const dims = { width, height };

  // Cat clip wrapped in a pulsing golden aura (hides rough alpha edges from
  // background removal, gives a premium "popping out" feel) plus a soft
  // elliptical ground-shadow so she reads as standing on the page surface,
  // not floating in a rectangle.
  const auraSize = Math.round(size * 1.18);
  const grounded = (media: React.ReactNode) =>
    transparent === 'alpha' ? (
      <div className="relative inline-block" style={dims}>
        {/* outer warm aura — soft + wide */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: auraSize,
            height: auraSize,
            background:
              'radial-gradient(circle, rgba(255,217,128,0.55) 0%, rgba(224,178,89,0.32) 35%, rgba(224,178,89,0) 70%)',
            filter: 'blur(6px)',
            animation: 'cat-aura 2.6s ease-in-out infinite',
            zIndex: 0,
          }}
        />
        {/* inner bright rim — tight to the silhouette, sells the edge */}
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
          style={{
            width: Math.round(size * 0.95),
            height: Math.round(size * 0.95),
            background:
              'radial-gradient(circle, rgba(255,243,200,0.7) 0%, rgba(255,217,128,0.35) 50%, rgba(255,217,128,0) 75%)',
            filter: 'blur(2px)',
            mixBlendMode: 'screen',
            animation: 'cat-aura-spark 1.4s ease-in-out infinite',
            zIndex: 0,
          }}
        />
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            bottom: -4,
            width: width * 0.7,
            height: 6,
            background:
              'radial-gradient(ellipse, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 70%)',
            filter: 'blur(1px)',
            zIndex: 0,
          }}
        />
        <span className="relative" style={{ zIndex: 1, display: 'inline-block' }}>
          {media}
        </span>
      </div>
    ) : (
      media
    );

  // The new asset fades in over CROSSFADE_MS; the previous (if any) fades
  // out simultaneously underneath. Both elements keep playing while they
  // overlap so neither one freezes or restarts mid-swap.
  const baseMediaStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: radius,
    objectFit: 'cover',
    ...blendStyle,
  };
  const renderMedia = (a: Asset, phase: 'enter' | 'leave', stackable: boolean): React.ReactNode => {
    const animation =
      phase === 'enter'
        ? `cat-fade-in ${CROSSFADE_MS}ms ease-out both`
        : `cat-fade-out ${CROSSFADE_MS}ms ease-out both`;
    const positioning: React.CSSProperties = stackable
      ? { position: 'absolute', inset: 0 }
      : { position: 'relative' };
    if (a.kind === 'video') {
      return (
        <video
          key={a.url}
          src={a.url}
          width={width}
          height={height}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={showFrame ? 'bg-[var(--surface-elevated)]' : undefined}
          style={{ ...baseMediaStyle, ...positioning, animation }}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local asset, tiny
      <img
        key={a.url}
        src={a.url}
        alt={status}
        width={width}
        height={height}
        style={{ ...baseMediaStyle, ...positioning, animation }}
      />
    );
  };

  if (asset) {
    return grounded(
      <div style={{ position: 'relative', width, height, display: 'inline-block' }}>
        {previous && renderMedia(previous, 'leave', true)}
        {renderMedia(asset, 'enter', false)}
      </div>,
    );
  }

  if (!checked) {
    return <div style={dims} className="rounded-2xl bg-[var(--surface-elevated)] animate-pulse" />;
  }

  const Pose = POSES[status];
  return <Pose size={size} />;
}
