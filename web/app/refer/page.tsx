'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { BrandWordmark, BackLink } from '@/app/_components/Brand';
import { Reveal } from '@/app/_components/motion';

interface ReferralDashboard {
  code: string;
  stats: {
    invited: number;
    rewarded: number;
    pending: number;
    totalEarned: string;
    currency: string;
  };
  referrals: {
    maskedEmail: string;
    status: string;
    createdAt: string;
    rewardedAt: string | null;
  }[];
}

export default function ReferPage() {
  const router = useRouter();
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get('/referrals/me')
      .then((res) => setData(res.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  const shareUrl =
    typeof window !== 'undefined' && data
      ? `${window.location.origin}/register?ref=${data.code}`
      : '';

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--muted-foreground)]">Loading…</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[var(--background)] relative">
      <div
        className="absolute inset-x-0 top-0 h-48 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, var(--wash-warm) 0%, var(--wash-warm-end) 100%)' }}
      />
      <nav className="relative bg-transparent border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackLink />
          <BrandWordmark size={24} />
        </div>
        <span className="text-sm text-[var(--muted-foreground)]">Refer & earn</span>
      </nav>

      <div className="relative max-w-xl mx-auto px-4 py-10 space-y-4">
        <Reveal>
          <div className="text-center mb-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              Invite friends, earn $15
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              You earn $15 when your friend completes their first transfer.
            </p>
          </div>
        </Reveal>

        {/* Referral code card */}
        <Reveal delay={80}>
          <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] p-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] font-bold mb-2">
              Your referral code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-extrabold tracking-[0.15em] text-[var(--foreground)]">
                {data.code}
              </span>
              <button
                onClick={() => handleCopy(data.code)}
                className="text-xs font-bold text-[var(--accent)] hover:text-[var(--accent-deep)] transition"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => handleCopy(shareUrl)}
                className="bg-[var(--brand)] hover:bg-[var(--brand-deep)] text-white font-semibold px-6 py-2.5 rounded-full text-sm transition shadow"
              >
                Copy invite link
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-3 break-all">
              {shareUrl}
            </p>
          </div>
        </Reveal>

        {/* Stats */}
        <Reveal delay={160}>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Invited" value={data.stats.invited} />
            <StatTile label="Rewarded" value={data.stats.rewarded} />
            <StatTile
              label="Earned"
              value={`$${Number(data.stats.totalEarned).toFixed(0)}`}
              accent
            />
          </div>
        </Reveal>

        {/* Referral list */}
        {data.referrals.length > 0 && (
          <Reveal delay={240}>
            <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border)]">
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">
                  Your referrals
                </h3>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {data.referrals.map((r, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {r.maskedEmail}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Joined {new Date(r.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        <Link
          href="/dashboard"
          className="block text-center text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition pt-2"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 text-center">
      <p
        className={`text-2xl font-extrabold ${
          accent ? 'text-[var(--mint)]' : 'text-[var(--foreground)]'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted-foreground)] font-bold mt-1">
        {label}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: {
      bg: 'bg-[var(--accent-soft)]',
      text: 'text-[var(--accent)]',
      label: 'Pending',
    },
    rewarded: {
      bg: 'bg-[var(--mint-soft)]',
      text: 'text-[var(--mint)]',
      label: 'Rewarded',
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}
