import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Card, Empty, Loader, Row, Screen, Title } from '../../components/ui';
import api from '../../lib/api';
import { relativeTime } from '../../lib/format';
import { useLive } from '../../lib/sockets';
import type { Notification } from '../../lib/types';
import { colors } from '../../theme/tokens';

export default function Notifications() {
  const router = useRouter();
  const { onNotification, refreshUnread, markAllRead } = useLive();
  const [list, setList] = useState<Notification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Notification[]>('/notifications');
      setList(data);
    } catch {
      setList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A notification arriving while this screen is open should appear at once,
  // not on the next refresh.
  useFocusEffect(
    useCallback(() => onNotification((n) => setList((cur) => [n, ...(cur ?? [])])), [onNotification]),
  );

  const openTarget = (n: Notification) => {
    const transferId = n.metadata?.transferId;
    void api.post(`/notifications/${n.id}/read`).then(refreshUnread).catch(() => {});
    setList((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
    if (typeof transferId === 'string') {
      router.push({ pathname: '/(app)/activity/[id]', params: { id: transferId } });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar
        title="Notifications"
        right={
          list && list.some((n) => !n.read) ? (
            <Pressable
              onPress={async () => {
                await markAllRead();
                setList((cur) => cur?.map((n) => ({ ...n, read: true })) ?? cur);
              }}
              hitSlop={8}
              style={{ paddingHorizontal: 10 }}
            >
              <Body size={12.5} tone="mint" weight="600">
                Mark all read
              </Body>
            </Pressable>
          ) : undefined
        }
      />
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              await refreshUnread();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={{ gap: 10 }}>
          {list === null ? (
            <Loader />
          ) : list.length === 0 ? (
            <Empty
              title="Nothing yet"
              body="Transfer updates and referral rewards land here as they happen."
            />
          ) : (
            list.map((n) => (
              <Pressable key={n.id} onPress={() => openTarget(n)}>
                <Card
                  padded={false}
                  style={{
                    padding: 13,
                    backgroundColor: n.read ? colors.card : colors.tint,
                    borderColor: n.read ? colors.line : colors.mintLo,
                  }}
                >
                  <Row gap={10} style={{ alignItems: 'flex-start' }}>
                    {!n.read && (
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: colors.mintInk,
                          marginTop: 5,
                        }}
                      />
                    )}
                    <View style={{ flex: 1 }}>
                      <Body size={13.5} tone="ink" weight="600">
                        {n.title}
                      </Body>
                      <Body size={12.5} tone="ink2" style={{ marginTop: 2 }}>
                        {n.body}
                      </Body>
                      <Body size={11} tone="ink3" style={{ marginTop: 4 }}>
                        {relativeTime(n.createdAt)}
                      </Body>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            ))
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
