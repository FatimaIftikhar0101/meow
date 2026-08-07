import type { TransferStatus } from './types';

/** "2026-08-07T11:38:00Z" → "11:38" in the device's timezone. */
export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "7 Aug" for this year, "7 Aug 2025" otherwise. */
export function dateOf(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function dateTimeOf(iso: string): string {
  return `${dateOf(iso)} · ${timeOf(iso)}`;
}

/** "just now", "4 min ago", "3 h ago", then falls back to a date. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return dateOf(iso);
}

/** What the user is told a status means. Deliberately not the raw enum. */
export const STATUS_LABEL: Record<TransferStatus, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance check',
  fx_converted: 'Converted',
  payout_processing: 'Paying out',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

/** Ordered stages for the tracking timeline — the terminal ones are not here. */
export const STATUS_STEPS: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
  'delivered',
];

export function stageIndex(status: TransferStatus): number {
  const i = STATUS_STEPS.indexOf(status);
  return i === -1 ? STATUS_STEPS.length - 1 : i;
}

/**
 * Progress along the corridor arc, 0–1. Drives the cat's position on the
 * tracking screen: the same fraction of the journey as of the state machine.
 */
export function progressOf(status: TransferStatus): number {
  if (status === 'delivered') return 1;
  if (status === 'failed' || status === 'cancelled') return 0;
  return stageIndex(status) / (STATUS_STEPS.length - 1);
}

/** Turns "Mozilla/5.0 (Windows NT 10.0…) Chrome/…" into "Chrome · Windows". */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : /okhttp|Expo|Meow/i.test(ua) ? 'Meow app'
    : 'Browser';
  const os =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  return `${browser} · ${os}`;
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Boundaries match the four greeting scenes in the design artifact:
 * morning 5:00–11:59, afternoon 12:00–16:59, evening 17:00–20:59,
 * night 21:00–4:59.
 */
export function dayPartFor(date = new Date()): DayPart {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export const GREETING: Record<DayPart, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
};
