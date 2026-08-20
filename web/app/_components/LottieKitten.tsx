'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { CatCoin } from './CatCoin';

/**
 * Wraps a Lottie animation if /cat.lottie.json exists, else falls back to the
 * SVG <CatCoin/>. To use a real Lottie file:
 *
 *   1. Download any white-cat-walking Lottie JSON (e.g. from lottiefiles.com).
 *   2. Save it as /home/user/meow/public/cat.lottie.json
 *   3. Hard-refresh the browser. The kitten on the map and on the auth heroes
 *      will switch to the Lottie animation automatically.
 */

const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => null,
});

let cached: unknown | null | 'miss' = null;

export function LottieKitten({
  size,
  playful = true,
}: {
  size: number;
  playful?: boolean;
}) {
  const [animationData, setAnimationData] = useState<unknown | null>(
    cached && cached !== 'miss' ? cached : null,
  );
  const [failed, setFailed] = useState(cached === 'miss');

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    fetch('/cat.lottie.json')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        cached = data;
        setAnimationData(data);
      })
      .catch(() => {
        cached = 'miss';
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !animationData) {
    return <CatCoin size={size} playful={playful} />;
  }
  return (
    <Lottie
      animationData={animationData}
      loop
      autoplay={playful}
      style={{ width: size * 1.5, height: size }}
    />
  );
}
