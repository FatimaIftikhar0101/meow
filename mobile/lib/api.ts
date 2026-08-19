import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getToken } from './auth-store';

/**
 * EXPO_PUBLIC_* is inlined at bundle time, so this is fixed when the JS is
 * built — changing it means restarting Metro (dev) or rebuilding (APK).
 *
 * Defaults to the deployed backend so a fresh clone runs against something
 * real, and so the installed APK works on mobile data with no laptop involved.
 * Point it at a machine on the LAN (http://192.168.x.x:3000) to develop against
 * a local backend — `localhost` would resolve to the phone itself.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://backend-production-4cbe.up.railway.app';

/**
 * What this client calls itself.
 *
 * React Native's Android networking is OkHttp, and OkHttp's default
 * User-Agent is `okhttp/4.x` — no platform, no version, no device. The backend
 * stores whatever header it is handed, so every row in Devices & sessions read
 * "Unknown OS". Nothing was failing to parse; there was simply nothing to
 * parse, and the phone could not be told apart from any other session.
 *
 * `Platform.constants` carries the real values on Android with no extra native
 * dependency, which matters because adding one would force a new build just to
 * label a list. Shaped like a conventional UA so anything downstream that
 * expects that form still works.
 */
function userAgent(): string {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  if (Platform.OS === 'android') {
    const c = Platform.constants as Partial<{
      Release: string;
      Model: string;
      Manufacturer: string;
    }>;
    const release = c.Release ?? String(Platform.Version);
    const device = [c.Manufacturer, c.Model].filter(Boolean).join(' ');
    return `Meow/${version} (Android ${release}${device ? `; ${device}` : ''})`;
  }
  if (Platform.OS === 'ios') {
    return `Meow/${version} (iOS ${String(Platform.Version)})`;
  }
  return `Meow/${version} (${Platform.OS})`;
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: { 'User-Agent': userAgent() },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Set by AuthContext. Kept as a registered callback rather than importing the
 * router here, because this module is imported by the router's own layout —
 * calling into navigation from here would be a cycle.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    // Only a request that actually carried a token can have had a session to
    // lose. Without this check a wrong password on /auth/login — also a 401 —
    // would be reported as "your session expired", and would tear down the
    // Google sign-in state of a user who was never signed in to begin with.
    const sentToken = Boolean(err.config?.headers?.Authorization);
    if (err.response?.status === 401 && sentToken) {
      onUnauthorized?.();
    }
    return Promise.reject(err);
  },
);

/**
 * Nest's ValidationPipe returns `message` as an array of per-field strings;
 * everything else returns a single string. Callers should never render the raw
 * body, because both shapes reach the UI.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const e = err as AxiosError<{ message?: string | string[] }>;
  if (e?.code === 'ECONNABORTED') return 'The request timed out. Check your connection.';
  if (e?.response) {
    const msg = e.response.data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string' && msg) return msg;
    // The server failed but said nothing useful — a 500 from an unhandled
    // exception looks like this. Without the status it is indistinguishable
    // from a client-side failure, which cost real time debugging Google
    // sign-in: the same words appeared whether Play Services had refused or
    // the backend had thrown.
    return `${fallback} (server error ${e.response.status})`;
  }
  if (e?.request) return 'Cannot reach the server. Check your connection.';

  // Not an HTTP failure at all — a native module error, or one we threw
  // ourselves. Returning the generic fallback here hid the only useful part
  // of the message: a Google sign-in rejection reported as "Could not sign
  // in with Google" when the error itself said exactly what was wrong.
  const message = (err as Error | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message;

  return fallback;
}

export function statusOf(err: unknown): number | undefined {
  return (err as AxiosError)?.response?.status;
}

export default api;
