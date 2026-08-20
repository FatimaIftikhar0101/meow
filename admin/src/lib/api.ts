import axios, { AxiosError } from 'axios';
import { getToken } from './token-store';

/**
 * Where the back office talks to.
 *
 * In development this is `/api`, which Vite proxies to the real backend — so
 * the browser only ever sees its own origin and CORS never enters into it. The
 * alternative was adding localhost to the deployed CORS allowlist, which would
 * leave a production API answering a development origin permanently.
 *
 * In a build it is the absolute URL, inlined by Vite.
 *
 * **Decided:** the packaged app keeps using this ordinary browser request path,
 * and its origin is allowed by the backend. The alternative — Tauri's HTTP
 * plugin, which issues requests from Rust where CORS does not apply — was
 * rejected because it would give the desktop build a different network stack
 * from the browser build. Everything I test in a browser would then be a
 * different code path from what ships, which is exactly the coupling the "plain
 * web SPA, wrapped" approach exists to avoid.
 *
 * Allowing the origin costs nothing real. CORS is a browser policy protecting
 * users from cross-origin reads that carry ambient credentials; this API
 * authenticates with a bearer token in a header, not a cookie, so CORS was
 * never what protects it. `backend/src/main.ts` says the same at the allowlist.
 *
 * `useHttpsScheme` is set in tauri.conf.json so the Windows origin is
 * deterministic. CORS_ORIGINS therefore needs:
 *
 *   https://tauri.localhost   Windows (and Android)
 *   tauri://localhost         macOS and Linux
 */
export const API_URL = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_URL ??
    'https://backend-production-4cbe.up.railway.app');

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Set by the auth provider. A registered callback rather than an import of the
 * router, because the router's own layout imports this module — reaching into
 * navigation from here would be a cycle.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    // Only a request that actually carried a token can have had a session to
    // lose. Without this check a wrong password on /auth/admin/login — also a
    // 401 — would be reported as "your session expired" to someone who was
    // never signed in.
    const sentToken = Boolean(err.config?.headers?.Authorization);
    if (err.response?.status === 401 && sentToken) onUnauthorized?.();
    return Promise.reject(err);
  },
);

/**
 * Nest's ValidationPipe returns `message` as an array of per-field strings;
 * everything else returns a single string. Callers must never render the raw
 * body, because both shapes reach the UI.
 *
 * Ported from mobile/lib/api.ts including the status suffix, which exists
 * because a 500 with no message and a client-side failure otherwise produce
 * identical text — that cost real time debugging Google sign-in.
 */
export function errorMessage(
  err: unknown,
  fallback = 'Something went wrong.',
): string {
  const e = err as AxiosError<{ message?: string | string[] }>;
  if (e?.code === 'ECONNABORTED') return 'The request timed out.';
  if (e?.response) {
    const msg = e.response.data?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    if (typeof msg === 'string' && msg) return msg;
    return `${fallback} (server error ${e.response.status})`;
  }
  if (e?.request) return 'Cannot reach the server. Check your connection.';

  const message = (err as Error | undefined)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

export function statusOf(err: unknown): number | undefined {
  return (err as AxiosError)?.response?.status;
}

export default api;
