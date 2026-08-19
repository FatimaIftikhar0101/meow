/**
 * Where the session token lives.
 *
 * Two layers, on purpose:
 *
 * An in-memory mirror, because the axios request interceptor is synchronous
 * and the durable store is not. Every read on the hot path hits the mirror.
 *
 * And a durable store behind it. Today that is `sessionStorage`, which is
 * cleared when the window closes and is not shared with other tabs — a
 * deliberately weaker choice than `localStorage`, because a back-office token
 * that survives on disk is one XSS away from being someone else's.
 *
 * Under Tauri this is replaced by the OS keychain, which is one of the three
 * reasons the panel is a desktop app at all. The swap is confined to the two
 * functions below: everything else already goes through them, so it does not
 * become a refactor. See README, "Why Tauri".
 */

const KEY = 'meow.staff.token';

let mirror: string | null = null;

/** Synchronous, for the request interceptor. */
export function getToken(): string | null {
  return mirror;
}

export function loadToken(): string | null {
  if (mirror === null) mirror = sessionStorage.getItem(KEY);
  return mirror;
}

export function setToken(token: string): void {
  mirror = token;
  sessionStorage.setItem(KEY, token);
}

export function clearToken(): void {
  mirror = null;
  sessionStorage.removeItem(KEY);
}
