'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { logout, setToken } from '@/lib/auth';
import { BrandWordmark, BackLink } from '@/app/_components/Brand';
import { ThemeToggleFull } from '@/app/_components/ThemeToggle';

interface Profile {
  userId: string;
  email: string;
  country: string | null;
  emailVerified?: boolean;
}

interface KycStatus {
  status: 'pending' | 'passed' | 'failed';
  reason?: string;
  verifiedAt?: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [emailResending, setEmailResending] = useState(false);
  const [emailResent, setEmailResent] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  interface SessionInfo {
    id: string;
    current: boolean;
    userAgent: string | null;
    ipAddress: string | null;
    lastSeenAt: string;
    createdAt: string;
  }
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingAll, setRevokingAll] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/auth/profile'),
      api.get('/compliance/status'),
      api.get('/auth/sessions'),
    ])
      .then(([profileRes, kycRes, sessionsRes]) => {
        setProfile(profileRes.data);
        setKyc(kycRes.data);
        setSessions(sessionsRes.data);
        setSessionsLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post('/compliance/verify');
      setKyc(res.data);
      setVerified(res.data.status === 'passed');
    } catch {
      //
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = kyc?.status === 'passed';

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    setPwSaving(true);
    try {
      const res = await api.post('/auth/change-password', pwForm);
      if (res.data?.access_token) setToken(res.data.access_token);
      setPwSuccess(true);
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setPwError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not change password');
    } finally {
      setPwSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      {/* golden warm wash — matches dashboard */}
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, var(--profile-wash) 0%, var(--wash-warm-end) 100%)' }}
      />
      <nav className="relative bg-transparent border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackLink />
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Profile</span>
      </nav>

      <div className="relative max-w-xl mx-auto px-4 py-10 space-y-4">
        {/* Account card */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--brand)] flex items-center justify-center text-white text-xl font-bold">
              {profile.email[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[var(--foreground)]">{profile.email}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {profile.country ?? '—'} · Account {profile.userId?.slice(0, 8)}…
              </p>
            </div>
            {isVerified ? (
              <span className="text-xs font-semibold bg-[var(--mint-soft)] text-[var(--mint)] px-3 py-1 rounded-full">
                ✓ Verified
              </span>
            ) : kyc?.status === 'failed' ? (
              <span className="text-xs font-semibold bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-1 rounded-full">
                Failed
              </span>
            ) : (
              <span className="text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent)] px-3 py-1 rounded-full">
                Not verified
              </span>
            )}
          </div>
        </div>

        {/* Email verification */}
        {profile.emailVerified === false && (
          <div className="bg-[var(--accent-soft)] border border-[var(--accent)]/30 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 4 12 13 2 4" />
              </svg>
              <h3 className="font-semibold text-[var(--accent)]">Verify your email</h3>
            </div>
            <p className="text-sm text-[var(--accent)] mb-4">
              {emailResent
                ? 'Check your inbox — we just sent a new verification link.'
                : 'We sent a verification link to your email. Click it to verify your account.'}
            </p>
            {!emailResent && (
              <button
                onClick={async () => {
                  setEmailResending(true);
                  try {
                    await api.post('/auth/resend-verification');
                    setEmailResent(true);
                  } catch { /* rate limited */ }
                  finally { setEmailResending(false); }
                }}
                disabled={emailResending}
                className="bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold px-5 py-2.5 rounded-full text-sm transition disabled:opacity-50 shadow"
              >
                {emailResending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
          </div>
        )}
        {profile.emailVerified && (
          <div className="flex items-center gap-2 px-5 py-3 bg-[var(--mint-soft)] rounded-2xl border border-[var(--mint)]/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12 L11 14 L15 10" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span className="text-sm font-semibold text-[var(--mint)]">Email verified</span>
          </div>
        )}

        {/* KYC */}
        {!isVerified && (
          <div className={`border rounded-3xl p-6 ${kyc?.status === 'failed' ? 'bg-[var(--danger-soft)] border-[var(--danger)]/30' : 'bg-[var(--accent-soft)] border-[var(--accent)]/30'}`}>
            <h3 className={`font-semibold mb-1 ${kyc?.status === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>
              {kyc?.status === 'failed' ? 'Verification failed' : 'Verify your identity'}
            </h3>
            <p className={`text-sm mb-4 ${kyc?.status === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>
              {kyc?.reason ?? 'Identity verification is required by Canadian regulators before you can send money. It only takes a moment.'}
            </p>
            {verified ? (
              <p className="text-sm text-[var(--mint)] font-semibold">✓ Successfully verified!</p>
            ) : kyc?.status === 'failed' ? null : (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-[var(--accent)] hover:bg-[var(--accent-deep)] text-white font-semibold px-5 py-2.5 rounded-full text-sm transition disabled:opacity-50 shadow"
              >
                {verifying ? 'Verifying…' : 'Verify now'}
              </button>
            )}
          </div>
        )}

        {/* Change password */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-3">Change password</h3>
          {pwError && (
            <div className="bg-[var(--danger-soft)] text-[var(--danger)] text-sm px-4 py-3 rounded-xl mb-3">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="bg-[var(--mint-soft)] text-[var(--mint)] text-sm px-4 py-3 rounded-xl mb-3">
              Password updated. All other devices have been signed out.
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1 uppercase tracking-wider">Current password</label>
              <input
                type="password"
                required
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--foreground)] mb-1 uppercase tracking-wider">New password</label>
              <input
                type="password"
                required
                minLength={10}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                placeholder="Min 10 chars, with upper, lower, digit"
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white font-semibold px-5 py-2.5 rounded-full text-sm transition disabled:opacity-50"
            >
              {pwSaving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Appearance */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
          <h3 className="font-semibold text-[var(--foreground)] mb-3">Appearance</h3>
          <ThemeToggleFull />
        </div>

        {/* Devices & sessions */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--foreground)]">Devices & sessions</h3>
            {sessions.length > 1 && (
              <button
                onClick={async () => {
                  setRevokingAll(true);
                  try {
                    await api.post('/auth/sessions/revoke-others');
                    const res = await api.get('/auth/sessions');
                    setSessions(res.data);
                  } catch { /* */ }
                  finally { setRevokingAll(false); }
                }}
                disabled={revokingAll}
                className="text-[11px] font-bold text-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50"
              >
                {revokingAll ? 'Revoking…' : 'Sign out all others'}
              </button>
            )}
          </div>
          {sessionsLoading ? (
            <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No active sessions</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-[var(--muted)]/50 rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {parseUA(s.userAgent)}
                      </p>
                      {s.current && (
                        <span className="text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-full bg-[var(--mint-soft)] text-[var(--mint)] border border-[var(--mint)]/30 shrink-0">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {s.ipAddress ?? 'Unknown IP'} · Last active {timeAgo(s.lastSeenAt)}
                    </p>
                  </div>
                  {!s.current && (
                    <button
                      onClick={async () => {
                        try {
                          await api.delete(`/auth/sessions/${s.id}`);
                          setSessions((prev) => prev.filter((x) => x.id !== s.id));
                        } catch { /* */ }
                      }}
                      className="text-xs font-bold text-[var(--danger)] hover:underline shrink-0 ml-3"
                    >
                      Sign out
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
          <ProfileLink href="/wallet/transactions" label="Transaction history" />
          <ProfileLink href="/recipients" label="My recipients" />
          <ProfileLink href="/dashboard" label="My transfers" />
        </div>

        <button
          onClick={logout}
          className="w-full border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--danger-soft)] font-semibold py-3 rounded-2xl transition text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function parseUA(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    ua.match(/Edg\//i) ? 'Edge' :
    ua.match(/OPR\//i) ? 'Opera' :
    ua.match(/Chrome\//i) ? 'Chrome' :
    ua.match(/Safari\//i) ? 'Safari' :
    ua.match(/Firefox\//i) ? 'Firefox' :
    'Browser';
  const os =
    ua.match(/Windows/i) ? 'Windows' :
    ua.match(/Mac OS/i) ? 'macOS' :
    ua.match(/Android/i) ? 'Android' :
    ua.match(/iPhone|iPad/i) ? 'iOS' :
    ua.match(/Linux/i) ? 'Linux' :
    '';
  return os ? `${browser} · ${os}` : browser;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ProfileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-5 py-4 hover:bg-[var(--muted)] transition">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <span className="text-[var(--muted-foreground)]">→</span>
    </Link>
  );
}
