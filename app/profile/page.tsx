'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { logout, setToken } from '@/lib/auth';
import { BrandWordmark, BackLink } from '@/app/_components/Brand';

interface Profile {
  userId: string;
  email: string;
  country: string | null;
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
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/auth/profile'),
      api.get('/compliance/status'),
    ])
      .then(([profileRes, kycRes]) => {
        setProfile(profileRes.data);
        setKyc(kycRes.data);
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
        style={{ background: 'linear-gradient(180deg, rgba(255,232,176,0.5) 0%, rgba(255,255,255,0) 100%)' }}
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

function ProfileLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-5 py-4 hover:bg-[var(--muted)] transition">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <span className="text-[var(--muted-foreground)]">→</span>
    </Link>
  );
}
