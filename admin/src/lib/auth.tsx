import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [needsEnrolment, setNeedsEnrolment] = useState(false);

  const signOut = useCallback(() => {
    // Not awaited: signing out must feel immediate, and the in-memory mirror is
    // cleared synchronously inside clearToken before it reaches the keychain.
    void clearToken();
    setProfile(null);
    setMfaToken(null);
    setNeedsEnrolment(false);
    setStatus('signedOut');
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
      signOut,
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
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth used outside AuthProvider');
  return ctx;
}
