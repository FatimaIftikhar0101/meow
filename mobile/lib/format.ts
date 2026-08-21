import type { DayPart } from '../theme/tokens';
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

/**
 * Names a session's device from its User-Agent.
 *
 * The mobile client announces itself precisely (see `userAgent()` in lib/api),
 * so that form is matched first and trusted rather than sniffed. Browsers get
 * the usual guesswork.
 *
 * When the OS genuinely cannot be determined the app name is returned on its
 * own. The old version appended "Unknown OS", which turned a gap in the data
 * into a statement about the device and made every native session look broken.
 */
export function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';

  // `Meow/1.0.0 (Android 14; Xiaomi M2101K6G)` → "Meow app · Android 14"
  const own = /^Meow\/[\d.]+\s*\(([^)]*)\)/.exec(ua);
  if (own) {
    const platform = own[1].split(';')[0]?.trim();
    return platform ? `Meow app · ${platform}` : 'Meow app';
  }

  const app =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : /okhttp|Expo|Meow/i.test(ua) ? 'Meow app'
    : 'Browser';

  const android = /Android\s+([\d.]+)/.exec(ua);
  const os =
    /Windows NT 10/.test(ua) ? 'Windows'
    : /Windows/.test(ua) ? 'Windows'
    : android ? `Android ${android[1]}`
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;

  return os ? `${app} · ${os}` : app;
}

/** The handset itself, when the client told us — "Xiaomi M2101K6G". */
export function deviceOf(ua: string | null): string | null {
  if (!ua) return null;
  const own = /^Meow\/[\d.]+\s*\(([^)]*)\)/.exec(ua);
  const device = own?.[1].split(';')[1]?.trim();
  return device || null;
}

// Defined next to the scenes it selects, so the two cannot drift apart.
export type { DayPart } from '../theme/tokens';

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
