/**
 * Money formatting.
 *
 * The backend serialises every stored amount from a Prisma.Decimal to a
 * *string* (`"1234.5600"`), precisely so no float ever touches a balance. This
 * module keeps that promise on the client: it formats for display and compares
 * digit-by-digit, and never runs arithmetic on a parsed float.
 *
 * The one place a float is legitimate is the send flow, where the amount the
 * user types is sent to /corridors/convert and /transfers as a JSON number —
 * that is the API's own contract (CreateTransferDto.sendAmount is @IsNumber).
 */

/** Split "1234.5600" into ["1234", "56"], tolerating a missing fraction. */
function split(value: string): { neg: boolean; whole: string; frac: string } {
  const neg = value.trim().startsWith('-');
  const abs = neg ? value.trim().slice(1) : value.trim();
  const [whole = '0', frac = ''] = abs.split('.');
  return { neg, whole: whole || '0', frac };
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "1234.5600" → "1,234.56". Rounds half-up to `dp` without going through a
 * float, so the displayed cent always matches the ledger's cent.
 */
export function formatAmount(value: string | number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw = typeof value === 'number' ? value.toFixed(dp) : value;
  const { neg, whole, frac } = split(raw);

  let w = whole;
  let f = frac.padEnd(dp, '0').slice(0, dp);

  // Round half-up on the first dropped digit.
  const next = frac[dp];
  if (next !== undefined && Number(next) >= 5) {
    const bumped = (BigInt(w + f) + 1n).toString().padStart(w.length + dp, '0');
    w = bumped.slice(0, bumped.length - dp) || '0';
    f = bumped.slice(bumped.length - dp);
  }

  const body = dp > 0 ? `${group(w)}.${f}` : group(w);
  return neg ? `-${body}` : body;
}

/** "1234.56" + "CAD" → "1,234.56 CAD". */
export function formatMoney(
  value: string | number | null | undefined,
  currency: string,
  dp = 2,
): string {
  return `${formatAmount(value, dp)} ${currency}`;
}

/** Exchange rates need more precision than money — 202.4231, not 202.42. */
export function formatRate(value: string | number | null | undefined, dp = 4): string {
  return formatAmount(value, dp);
}

/** Compare two decimal strings without parsing. Returns -1 | 0 | 1. */
export function compareAmount(a: string, b: string): number {
  const x = split(a);
  const y = split(b);
  if (x.neg !== y.neg) return x.neg ? -1 : 1;

  const dp = Math.max(x.frac.length, y.frac.length);
  const xi = BigInt(x.whole + x.frac.padEnd(dp, '0'));
  const yi = BigInt(y.whole + y.frac.padEnd(dp, '0'));
  const cmp = xi === yi ? 0 : xi > yi ? 1 : -1;
  return x.neg ? -cmp : cmp;
}

export function isZero(value: string): boolean {
  return compareAmount(value, '0') === 0;
}

/** Two-letter country code → flag emoji, via the regional-indicator block. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
