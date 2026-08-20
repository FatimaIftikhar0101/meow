import { invoke, isTauri } from '@tauri-apps/api/core';

/**
 * Where the session token lives.
 *
 * Two layers, on purpose.
 *
 * An in-memory mirror, because the axios request interceptor is synchronous
 * and neither durable store is. Every read on the hot path hits the mirror.
 *
 * And a durable store behind it, chosen by where the app is running:
 *
 * - **Under Tauri, the OS credential store** — Windows Credential Manager,
 *   macOS Keychain, the Secret Service on Linux. This is one of the three
 *   reasons the panel is a desktop app: the token belongs to someone who can
 *   move money and read customer PII, and no browser storage is a fit place
 *   for it.
 * - **In a browser, `sessionStorage`** — deliberately weaker than
 *   `localStorage`, because it is cleared when the window closes and is not
 *   shared between tabs. Development only; a browser build is not what staff
 *   are meant to run.
 *
 * `getToken` stays synchronous either way. The rest are async because the
 * keychain is, and pretending otherwise would mean a token written after the
 * request that needed it.
 */

const KEY = 'meow.staff.token';

let mirror: string | null = null;

/** Synchronous, for the request interceptor. */
export function getToken(): string | null {
  return mirror;
}

export async function loadToken(): Promise<string | null> {
  if (mirror !== null) return mirror;

  if (isTauri()) {
    try {
      mirror = await invoke<string | null>('load_token');
    } catch {
      // A keychain that cannot be read is not a reason to break sign-in: the
      // person can authenticate again, which is the same outcome as having no
      // stored token.
      mirror = null;
    }
  } else {
    mirror = sessionStorage.getItem(KEY);
  }
  return mirror;
}

export async function setToken(token: string): Promise<void> {
  mirror = token;
  if (isTauri()) {
    await invoke('save_token', { token });
  } else {
    sessionStorage.setItem(KEY, token);
  }
}

export async function clearToken(): Promise<void> {
  mirror = null;
  if (isTauri()) {
    // Signing out must not leave the credential behind. Failing quietly here
    // would mean the next person on this machine is still signed in.
    await invoke('delete_token');
  } else {
    sessionStorage.removeItem(KEY);
  }
}
