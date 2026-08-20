'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Notification, ToastNotification } from '@/lib/useNotifications';

interface BellProps {
  notifications: Notification[];
  unreadCount: number;
  toasts: ToastNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismissToast: (id: string) => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  toasts,
  onMarkRead,
  onMarkAllRead,
  onDismissToast,
}: BellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      {/* Bell button */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-10 h-10 rounded-full bg-[var(--surface-elevated)]/80 backdrop-blur-md border border-[var(--border-strong)] flex items-center justify-center text-[var(--foreground)] hover:border-[var(--accent)] transition"
          aria-label="Notifications"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16 V11 a6 6 0 0 1 12 0 V16 L20 18 H4 Z" />
            <path d="M10 21 a2 2 0 0 0 4 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--danger)] text-white text-[10px] font-bold px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-12 w-80 max-h-[420px] overflow-y-auto bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-2xl shadow-2xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--muted-foreground)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={() => { onMarkAllRead(); }}
                  className="text-[11px] font-bold text-[var(--accent)] hover:text-[var(--accent-deep)]"
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                No notifications yet
              </div>
            ) : (
              <div>
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} onRead={onMarkRead} onClose={() => setOpen(false)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} notification={t} onDismiss={onDismissToast} />
        ))}
      </div>
    </>
  );
}

function NotificationRow({
  notification: n,
  onRead,
  onClose,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const isTransfer = n.type === 'transfer_status';
  const transferId = isTransfer ? (n.metadata as Record<string, string>)?.transferId : null;
  const age = timeAgo(n.createdAt);

  const inner = (
    <div
      className={`flex gap-3 px-4 py-3 hover:bg-[var(--surface)]/60 transition cursor-pointer ${!n.read ? 'bg-[var(--accent-soft)]/30' : ''}`}
      onClick={() => { if (!n.read) onRead(n.id); }}
    >
      <div className="shrink-0 mt-0.5">
        <StatusDot type={n.type} status={(n.metadata as Record<string, string>)?.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug ${!n.read ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}>
          {n.title}
        </p>
        <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5 truncate">{n.body}</p>
        <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{age}</p>
      </div>
    </div>
  );

  if (transferId) {
    return (
      <Link href={`/transfers/detail?id=${transferId}`} onClick={onClose}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function StatusDot({ type, status }: { type: string; status?: string }) {
  let color = 'var(--accent)';
  if (type === 'transfer_status') {
    if (status === 'delivered') color = 'var(--mint)';
    else if (status === 'failed' || status === 'cancelled') color = 'var(--danger)';
  }
  return (
    <span
      className="w-2.5 h-2.5 rounded-full block mt-1"
      style={{ backgroundColor: color }}
    />
  );
}

function Toast({
  notification: n,
  onDismiss,
}: {
  notification: ToastNotification;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-auto flex items-start gap-3 bg-[var(--surface-elevated)] border border-[var(--border-strong)] rounded-xl px-4 py-3 shadow-lg min-w-[280px] max-w-sm animate-slide-up"
      style={{ animation: 'slide-up 0.3s ease-out' }}
    >
      <StatusDot type={n.type} status={(n.metadata as Record<string, string>)?.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">{n.title}</p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">{n.body}</p>
      </div>
      <button
        onClick={() => onDismiss(n.id)}
        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-sm shrink-0"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
