import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api, { setUnauthorizedHandler, statusOf } from './api';
import { clearToken, loadToken, setToken } from './auth-store';
import type { Profile } from './types';

/**
 * The OAuth *web* client ID — not the Android one.
 *
 * The Android OAuth client exists so Play Services can check the app's package
 * name and signing fingerprint, but the ID token it mints carries the web
 * client as its `aud`. That is the value the backend verifies against, so both
 * ends must be configured with the same web client ID.
 */
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
export const googleEnabled = GOOGLE_WEB_CLIENT_ID.length > 0;

if (googleEnabled) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    // We only need identity. Requesting an offline refresh token would oblige
    // the backend to store and rotate it, which nothing here needs.
    offlineAccess: false,
    scopes: ['email', 'profile'],
  });
}

export interface RegisterInput {
  email: string;
  fullName: string;
  password: string;
  country?: string;
  referralCode?: string;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: Status;
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<'cancelled' | 'signedIn'>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Whether the person simply backed out of the account picker. */
function isCancellation(err: unknown): boolean {
  if (!isErrorWithCode(err)) return false;
  const code = String(err.code);
  return code === '12501' || code === String(statusCodes.SIGN_IN_CANCELLED);
}

/**
 * Turn a Play Services rejection into something a person can act on.
 *
 * These arrive as native module errors carrying only a numeric code, and the
 * generic handler reported every one of them as "Could not sign in with
 * Google" — true, useless, and indistinguishable from a network failure.
 *
 * The codes are Play Services' own (CommonStatusCodes and
 * GoogleSignInStatusCodes); the library only names a few of them, so the raw
 * numbers are handled too and the code is always included in the message.
 */
function describeGoogleError(err: unknown): string {
  const code = isErrorWithCode(err) ? String(err.code) : undefined;
  const detail = (err as Error | undefined)?.message ?? '';

  switch (code) {
    case '10':
    case 'DEVELOPER_ERROR':
      // The single most common cause, and it is always configuration rather
      // than anything in this app: Play Services checks the package name and
      // signing fingerprint against the Android OAuth client before it will
      // issue a token, and refuses outright when they do not match.
      return (
        'Google rejected this build (DEVELOPER_ERROR, code 10). An Android ' +
        'OAuth client for package com.meow.app with this build\u2019s SHA-1 ' +
        'fingerprint must exist in the same Google Cloud project as the web ' +
        'client ID.'
      );
    case '7':
    case 'NETWORK_ERROR':
      return 'Google could not be reached. Check the connection and try again.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services is unavailable or out of date on this device.';
    case statusCodes.IN_PROGRESS:
      return 'A Google sign-in is already in progress.';
    default:
      return code
        ? 'Google sign-in failed (code ' + code + ').' + (detail ? ' ' + detail : '')
        : detail || 'Google sign-in failed.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  // Read by the 401 handler, which is registered once and would otherwise
  // close over a stale `status`.
  const statusRef = useRef<Status>('loading');
  statusRef.current = status;

  const fetchProfile = useCallback(async () => {
    const { data } = await api.get<Profile>('/auth/profile');
    setProfile(data);
    setStatus('signedIn');
  }, []);

  const finishSignIn = useCallback(
    async (accessToken: string) => {
      await setToken(accessToken);
      await fetchProfile();
    },
    [fetchProfile],
  );

  const signOut = useCallback(async () => {
    await clearToken();
    setProfile(null);
    setStatus('signedOut');
    // Best-effort: clears the cached Google account so the picker reappears
    // next time rather than silently reusing the last account.
    if (googleEnabled) {
      await GoogleSignin.signOut().catch(() => {});
    }
  }, []);

  /* Boot: restore the persisted token and confirm it is still good. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await loadToken();
      if (cancelled) return;
      if (!token) {
        setStatus('signedOut');
        return;
      }
      try {
        await fetchProfile();
      } catch {
        // Expired, revoked, or the password was changed — all land here.
        await clearToken();
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  /*
   * A 401 on a request that carried a token means the session is gone —
   * expired, revoked from another device, or invalidated by a password change.
   * Boot handles its own failure, so only react once we are actually signed in.
   */
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current !== 'signedIn') return;
      void signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { data } = await api.post<{ access_token: string }>('/auth/login', {
          email,
          password,
        });
        await finishSignIn(data.access_token);
      } catch (err) {
        // /auth/login is customer-only and answers 403 "Use the admin portal"
        // for an admin account. Rather than making people know which door is
        // theirs, retry against the admin endpoint and let the role decide
        // what they see once inside.
        if (statusOf(err) === 403) {
          const { data } = await api.post<{ access_token: string }>('/auth/admin/login', {
            email,
            password,
          });
          await finishSignIn(data.access_token);
          return;
        }
        throw err;
      }
    },
    [finishSignIn],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api.post<{ access_token: string }>('/auth/register', {
        email: input.email,
        fullName: input.fullName,
        password: input.password,
        ...(input.country ? { country: input.country } : {}),
        ...(input.referralCode ? { referralCode: input.referralCode } : {}),
      });
      await finishSignIn(data.access_token);
    },
    [finishSignIn],
  );

  const signInWithGoogle = useCallback(async (): Promise<'cancelled' | 'signedIn'> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    let response;
    try {
      response = await GoogleSignin.signIn();
    } catch (err) {
      // Backing out of the account picker is a decision, not a failure: it
      // returns like any other cancellation rather than raising a dialog.
      if (isCancellation(err)) return 'cancelled';
      throw new Error(describeGoogleError(err));
    }
    if (!isSuccessResponse(response)) return 'cancelled';

    const idToken = response.data.idToken;
    if (!idToken) {
      // Happens when webClientId is missing or does not match the Android
      // OAuth client — Play Services then returns a user with no ID token
      // rather than failing outright, which is confusing to debug.
      throw new Error(
        'Google returned no ID token. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the Web client ID from the same Google Cloud project as the Android client.',
      );
    }
    const { data } = await api.post<{ access_token: string }>('/auth/google/native', {
      idToken,
    });
    await finishSignIn(data.access_token);
    return 'signedIn';
  }, [finishSignIn]);

  const refresh = useCallback(async () => {
    await fetchProfile().catch(() => {});
  }, [fetchProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      profile,
      isAdmin: profile?.role === 'admin',
      signIn,
      signInWithGoogle,
      register,
      signOut,
      refresh,
    }),
    [status, profile, signIn, signInWithGoogle, register, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
