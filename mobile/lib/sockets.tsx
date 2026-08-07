import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io, Socket } from 'socket.io-client';
import api, { API_URL } from './api';
import { useAuth } from './AuthContext';
import { getToken } from './auth-store';
import type { Notification, TransferStatus } from './types';

/**
 * Live updates from the two Nest gateways.
 *
 * Both authenticate off `handshake.auth.token` and join a `user:<id>` room, so
 * one connection per namespace covers everything this user can receive. The
 * transports are pinned to websocket: the default starts with HTTP long-polling
 * and upgrades, which on a phone means a burst of requests and a slower first
 * event for no benefit.
 */

export interface TransferStatusEvent {
  transferId: string;
  status: TransferStatus;
}

interface LiveValue {
  connected: boolean;
  unreadCount: number;
  /** Subscribe to transfer status changes. Returns an unsubscribe function. */
  onTransferStatus: (fn: (e: TransferStatusEvent) => void) => () => void;
  /** Subscribe to incoming notifications. Returns an unsubscribe function. */
  onNotification: (fn: (n: Notification) => void) => () => void;
  refreshUnread: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

const LiveContext = createContext<LiveValue | null>(null);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [connected, setConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const transferSubs = useRef(new Set<(e: TransferStatusEvent) => void>());
  const notificationSubs = useRef(new Set<(n: Notification) => void>());

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await api.get<{ count: number }>('/notifications/unread-count');
      setUnreadCount(data.count);
    } catch {
      /* A missed badge count is not worth surfacing. */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    await api.post('/notifications/read-all');
    setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (status !== 'signedIn') {
      setConnected(false);
      setUnreadCount(0);
      return;
    }
    const token = getToken();
    if (!token) return;

    const opts = {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    };

    const transfers: Socket = io(`${API_URL}/transfers`, opts);
    const notifications: Socket = io(`${API_URL}/notifications`, opts);

    transfers.on('connect', () => setConnected(true));
    transfers.on('disconnect', () => setConnected(false));
    transfers.on('transfer:status', (e: TransferStatusEvent) => {
      transferSubs.current.forEach((fn) => fn(e));
    });

    notifications.on('notification', (n: Notification) => {
      notificationSubs.current.forEach((fn) => fn(n));
      setUnreadCount((c) => c + 1);
    });

    void refreshUnread();

    return () => {
      transfers.removeAllListeners();
      notifications.removeAllListeners();
      transfers.disconnect();
      notifications.disconnect();
    };
  }, [status, refreshUnread]);

  const onTransferStatus = useCallback((fn: (e: TransferStatusEvent) => void) => {
    transferSubs.current.add(fn);
    return () => {
      transferSubs.current.delete(fn);
    };
  }, []);

  const onNotification = useCallback((fn: (n: Notification) => void) => {
    notificationSubs.current.add(fn);
    return () => {
      notificationSubs.current.delete(fn);
    };
  }, []);

  const value = useMemo<LiveValue>(
    () => ({
      connected,
      unreadCount,
      onTransferStatus,
      onNotification,
      refreshUnread,
      markAllRead,
    }),
    [connected, unreadCount, onTransferStatus, onNotification, refreshUnread, markAllRead],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside <LiveProvider>');
  return ctx;
}

/** Convenience: run `fn` whenever any transfer changes status. */
export function useTransferStatus(fn: (e: TransferStatusEvent) => void) {
  const { onTransferStatus } = useLive();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(
    () => onTransferStatus((e) => ref.current(e)),
    [onTransferStatus],
  );
}
