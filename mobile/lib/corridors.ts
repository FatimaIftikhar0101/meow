import { useCallback, useEffect, useState } from 'react';
import api from './api';
import type { Corridor } from './types';

/**
 * Corridors change roughly never, so they are fetched once per app launch and
 * shared. The cache is module-level rather than context so any screen can ask
 * without threading a provider through.
 */
let cache: Corridor[] | null = null;
let inflight: Promise<Corridor[]> | null = null;

export async function loadCorridors(force = false): Promise<Corridor[]> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = api
    .get<Corridor[]>('/corridors')
    .then((res) => {
      cache = res.data;
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearCorridorCache() {
  cache = null;
}

/**
 * Which currency a recipient in `country` receives.
 *
 * Derived from the corridor table rather than a hardcoded country→currency
 * map (which is what the web client does), so adding a corridor on the backend
 * needs no client release.
 */
export function receiveCurrencyFor(
  corridors: Corridor[],
  country: string | null | undefined,
): string | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  const match = corridors.find((c) => c.toCountry.toUpperCase() === code && c.active);
  return match?.toCurrency ?? null;
}

export function corridorFor(
  corridors: Corridor[],
  from: string,
  to: string,
): Corridor | null {
  return (
    corridors.find(
      (c) => c.fromCurrency === from && c.toCurrency === to && c.active,
    ) ?? null
  );
}

/** Countries the app can currently send to, for the recipient form. */
export function destinationCountries(corridors: Corridor[]): string[] {
  return [...new Set(corridors.filter((c) => c.active).map((c) => c.toCountry.toUpperCase()))];
}

export function useCorridors() {
  const [corridors, setCorridors] = useState<Corridor[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCorridors(await loadCorridors(true));
    } catch {
      /* Screens degrade to "rates unavailable" rather than blocking. */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadCorridors()
      .then((list) => {
        if (!cancelled) setCorridors(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { corridors, loading, reload };
}
