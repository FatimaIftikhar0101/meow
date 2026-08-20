/**
 * Google sign-in feature flag and entry URL.
 *
 * Opt-in rather than opt-out. The backend only registers its Google OAuth
 * strategy when GOOGLE_CLIENT_ID/SECRET are set and answers 501 otherwise, so
 * showing the button unconditionally gives users a control that always fails.
 * Set NEXT_PUBLIC_GOOGLE_ENABLED=true once the backend has real credentials.
 *
 * Note this is a *build-time* flag — NEXT_PUBLIC_* values are inlined into the
 * bundle, so flipping it means rebuilding.
 *
 * Note for the native app: Google rejects OAuth attempted inside an embedded
 * WebView (`disallowed_useragent`). The native client must use the system
 * browser or Google's native sign-in SDK, with a deep link back into the app —
 * this plain link is web-only.
 */
export const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';

/** Absolute URL — this leaves the SPA and hits the backend directly. */
export const GOOGLE_AUTH_URL = `${
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
}/auth/google`;
