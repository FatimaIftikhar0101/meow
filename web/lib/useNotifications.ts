'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type ToastNotification = Notification & { dismissed?: boolean };

const WS_URL =
  (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3000';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api.get('/notifications').then((r) => setNotifications(r.data)).catch(() => {});
    api.get('/notifications/unread-count').then((r) => setUnreadCount(r.data.count)).catch(() => {});

    const socket = io(`${WS_URL}/notifications`, {
      auth: { token: `Bearer ${token}` },
    });
    socketRef.current = socket;

    socket.on('notification', (data: Notification) => {
      setNotifications((prev) => [data, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      setToasts((prev) => [...prev, { ...data, dismissed: false }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== data.id));
      }, 5000);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const markRead = useCallback(async (id: string) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { notifications, unreadCount, toasts, markRead, markAllRead, dismissToast };
}
