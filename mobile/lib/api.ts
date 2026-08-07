import axios, { AxiosError } from 'axios';
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

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
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
    return fallback;
  }
  if (e?.request) return 'Cannot reach the server. Check your connection.';
  return fallback;
}

export function statusOf(err: unknown): number | undefined {
  return (err as AxiosError)?.response?.status;
}

export default api;
