'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { logout, setToken } from '@/lib/auth';

interface Profile {
  userId: string;
  email: string;
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
              {profile.email[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile.email}</p>
              <p className="text-sm text-gray-500">Account ID: {profile.userId?.slice(0, 8)}...</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Email</span>
              <span className="text-sm font-medium text-gray-900">{profile.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">KYC Status</span>
              {isVerified ? (
                <span className="text-xs font-medium bg-green-100 text-green-600 px-2.5 py-1 rounded-full">
                  ✓ Verified
                </span>
              ) : kyc?.status === 'failed' ? (
                <span className="text-xs font-medium bg-red-100 text-red-600 px-2.5 py-1 rounded-full">
                  Verification failed
                </span>
              ) : (
                <span className="text-xs font-medium bg-yellow-100 text-yellow-600 px-2.5 py-1 rounded-full">
                  Not verified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KYC verification */}
        {!isVerified && (
          <div className={`border rounded-2xl p-6 ${kyc?.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <h3 className={`font-semibold mb-1 ${kyc?.status === 'failed' ? 'text-red-800' : 'text-yellow-800'}`}>
              {kyc?.status === 'failed' ? 'Verification failed' : 'Verify your identity'}
            </h3>
            <p className={`text-sm mb-4 ${kyc?.status === 'failed' ? 'text-red-700' : 'text-yellow-700'}`}>
              {kyc?.reason ?? 'KYC verification is required to send money. It only takes a moment.'}
            </p>
            {verified ? (
              <p className="text-sm text-green-600 font-medium">✓ Successfully verified!</p>
            ) : kyc?.status === 'failed' ? null : (
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify Now'}
              </button>
            )}
          </div>
        )}

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Change Password</h3>
          {pwError && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-3">{pwError}</div>
          )}
          {pwSuccess && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg mb-3">
              Password updated.
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Current password</label>
              <input
                type="password"
                required
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
              <input
                type="password"
                required
                minLength={10}
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                placeholder="Min 10 chars, with upper, lower, digit"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {pwSaving ? 'Saving...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          <Link href="/wallet/transactions" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
            <span className="text-sm font-medium text-gray-700">Transaction History</span>
            <span className="text-gray-400">→</span>
          </Link>
          <Link href="/recipients" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
            <span className="text-sm font-medium text-gray-700">My Recipients</span>
            <span className="text-gray-400">→</span>
          </Link>
          <Link href="/dashboard" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
            <span className="text-sm font-medium text-gray-700">My Transfers</span>
            <span className="text-gray-400">→</span>
          </Link>
        </div>

        {/* Sign out */}
        <button
          onClick={logout}
          className="w-full border border-red-200 text-red-500 hover:bg-red-50 font-medium py-3 rounded-2xl transition text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
