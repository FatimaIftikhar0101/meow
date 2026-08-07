import * as SecureStore from 'expo-secure-store';

const KEY = 'access_token';

/**
 * In-memory mirror of the persisted token.
 *
 * The axios request interceptor has to be synchronous, and SecureStore's read
 * is a native round-trip. Rather than making every request await the keychain,
 * the token is loaded once at boot into this module and kept in step on every
 * write. SecureStore remains the source of truth across app launches.
 */
let cached: string | null = null;

export async function loadToken(): Promise<string | null> {
  cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export function getToken(): string | null {
  return cached;
}

export async function setToken(token: string): Promise<void> {
  cached = token;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  cached = null;
  await SecureStore.deleteItemAsync(KEY);
}
