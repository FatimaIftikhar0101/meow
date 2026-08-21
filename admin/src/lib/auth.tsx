import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import api, { setUnauthorizedHandler } from './api';
import type { Permission, StaffRole } from './permissions';
import { clearToken, loadToken, setToken } from './token-store';

export interface StaffProfile {
  userId: string;
  email: string;
  fullName: string | null;
  role: StaffRole;
  /** Sent by the server. The panel never derives this from the role. */
  permissions: Permission[];
  emailVerified: boolean;
}

type Status = 'loading' | 'signedOut' | 'mfaRequired' | 'signedIn';

interface AuthValue {
  status: Status;
  profile: StaffProfile | null;
  /** True once signed in but before two-factor enrolment is finished. The only
   *  route reachable in this state is enrolment. */
  needsEnrolment: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  submitMfaCode: (code: string) => Promise<void>;
  cancelMfa: () => void;
  refresh: () => Promise<void>;
  /** Call after finishing two-factor enrolment. Re-asks the server whether
   *  this session is enrolled, which is what releases the gate. */
  completeEnrolment: () => Promise<void>;
  signOut: (reason?: string) => void;
  signOutWarning: string | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [needsEnrolment, setNeedsEnrolment] = useState(false);
  /** Set only when sign-out could not finish cleanly. Shown on the sign-in
   *  screen, since by then there is nowhere else to put it. */
  const [signOutWarning, setSignOutWarning] = useState<string | null>(null);
  const signingOut = useRef(false);

  /**
   * End the session, in the order that matters if a step fails.
   *
   * The server is told first, because that is the step which makes every other
   * copy of the token worthless. If the credential store then refuses to erase
   * its copy, what is stranded is already a dead token rather than a live one.
   *
   * The UI is dropped regardless. Someone who clicked sign out must not still
   * be looking at customer data because a keychain was slow.
   */
  const signOut = useCallback((reason?: string) => {
    // Re-entry guard, and not a theoretical one. Signing out calls /auth/logout
    // with the very token being discarded; if that returns 401 — an expired
    // session, which is one of the ways we get here in the first place — the
    // interceptor calls this again, which calls /auth/logout again, forever.
    if (signingOut.current) return;
    signingOut.current = true;

    setProfile(null);
    setMfaToken(null);
    setNeedsEnrolment(false);
    setStatus('signedOut');
    setSignOutWarning(reason ?? null);

    void (async () => {
      try {
        // Revoking needs the token, so this goes before the local clear.
        await api.post('/auth/logout');
      } catch {
        // An expired or already-revoked session is the outcome we wanted, and
        // an unreachable server cannot be waited for. Either way the local
        // clear below still has to happen.
      }
      try {
        await clearToken();
      } catch {
        // Only reachable under Tauri, and only when the OS store could neither
        // delete nor overwrite the entry. Say so: the session is dead, but a
        // credential is still on this machine and somebody should know.
        setSignOutWarning(
          'Signed out, but the saved credential could not be removed from this ' +
            'computer. The session has been revoked on the server, so it can no ' +
            'longer be used.',
        );
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await api.get<StaffProfile>('/auth/profile');
    setProfile(data);
    setStatus('signedIn');
  }, []);

  /**
   * Whether this session has finished two-factor enrolment.
   *
   * Asked of the server rather than inferred, by calling a route that sits
   * behind StaffGuard. A 403 means "staff, but not enrolled" — which is
   * exactly the state the enrolment screen exists for. Inferring it from the
   * profile would mean shipping a second copy of the rule, and the two would
   * drift.
   */
  const checkEnrolment = useCallback(async () => {
    try {
      await api.get('/admin/stats');
      setNeedsEnrolment(false);
    } catch {
      // Any failure here is treated as "not enrolled", which fails safe: the
      // worst outcome is being shown an enrolment screen that then reports the
      // account is already set up.
      setNeedsEnrolment(true);
    }
  }, []);

  // Restore a session on load.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    void (async () => {
      const token = await loadToken();
      if (!token) {
        setStatus('signedOut');
        return;
      }
      try {
        await refresh();
        await checkEnrolment();
      } catch {
        signOut();
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [refresh, signOut, checkEnrolment]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<
        { access_token: string } | { mfaRequired: true; mfaToken: string }
      >('/auth/admin/login', { email, password });

      if ('mfaRequired' in data) {
        // Not a session. It carries no session id, so it is rejected anywhere
        // a real token works — it only buys the right to present a code.
        setMfaToken(data.mfaToken);
        setStatus('mfaRequired');
        return;
      }

      setSignOutWarning(null);
      signingOut.current = false;
      await setToken(data.access_token);
      await refresh();
      await checkEnrolment();
    },
    [refresh, checkEnrolment],
  );

  const submitMfaCode = useCallback(
    async (code: string) => {
      if (!mfaToken) throw new Error('Start signing in again.');
      const { data } = await api.post<{ access_token: string }>(
        '/auth/admin/login/mfa',
        { mfaToken, code },
      );
      setSignOutWarning(null);
      signingOut.current = false;
      await setToken(data.access_token);
      setMfaToken(null);
      await refresh();
      await checkEnrolment();
    },
    [mfaToken, refresh, checkEnrolment],
  );

  const cancelMfa = useCallback(() => {
    setMfaToken(null);
    setStatus('signedOut');
  }, []);

  /**
   * Leave the enrolment gate once two-factor is set up.
   *
   * `refresh()` alone is not enough and that was a real bug: it reloads the
   * profile, but `needsEnrolment` is separate state answered by a different
   * request, so the gate went on rendering the enrolment screen and the only
   * way through was a page reload — which re-ran the whole startup effect and
   * happened to ask again.
   */
  const completeEnrolment = useCallback(async () => {
    await refresh();
    await checkEnrolment();
  }, [refresh, checkEnrolment]);

  const can = useCallback(
    (permission: Permission) => profile?.permissions.includes(permission) ?? false,
    [profile],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      profile,
      needsEnrolment,
      can,
      signIn,
      submitMfaCode,
      cancelMfa,
      refresh,
      completeEnrolment,
      signOut,
      signOutWarning,
    }),
    [
      status,
      profile,
      needsEnrolment,
      can,
      signIn,
      submitMfaCode,
      cancelMfa,
      refresh,
      completeEnrolment,
      signOut,
      signOutWarning,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth used outside AuthProvider');
  return ctx;
}
