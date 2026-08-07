import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusPill } from '../../../components/StatusPill';
import { Body, Card, Empty, Loader, Row, Screen, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { dateOf } from '../../../lib/format';
import { formatMoney } from '../../../lib/money';
import { useTransferStatus } from '../../../lib/sockets';
import type { TransferSummary } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

/** Groups transfers under Today / Yesterday / a date, the way a statement reads. */
function groupLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return dateOf(iso);
}

export default function Activity() {
  const router = useRouter();
  const [list, setList] = useState<TransferSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<TransferSummary[]>('/transfers');
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

  // Live: a transfer moving to the next stage re-sorts and re-labels this list.
  useTransferStatus(() => {
    void load();
  });

  const groups = useMemo(() => {
    if (!list) return [];
    const map = new Map<string, TransferSummary[]>();
    for (const t of list) {
      const key = groupLabel(t.createdAt);
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()];
  }, [list]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={{ gap: 16 }}>
          <Title size={26}>Activity</Title>

          {list === null ? (
            <Loader />
          ) : list.length === 0 ? (
            <Empty
              title="Nothing sent yet"
              body="Your transfers will appear here, newest first, with every stage they pass through."
            />
          ) : (
            groups.map(([label, items]) => (
              <View key={label} style={{ gap: 8 }}>
                <Body size={11.5} tone="ink3" weight="600">
                  {label.toUpperCase()}
                </Body>
                {items.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() =>
                      router.push({ pathname: '/(app)/activity/[id]', params: { id: t.id } })
                    }
                  >
                    <Card padded={false} style={{ padding: 13 }}>
                      <Row gap={11}>
                        <View style={{ flex: 1 }}>
                          <Body size={14.5} tone="ink" weight="600" numberOfLines={1}>
                            {t.recipient.name}
                          </Body>
                          <View style={{ marginTop: 4 }}>
                            <StatusPill status={t.status} compact />
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Body
                            size={14.5}
                            tone={t.status === 'cancelled' || t.status === 'failed' ? 'ink3' : 'ink'}
                            weight="700"
                            numbers
                            style={
                              t.status === 'cancelled' || t.status === 'failed'
                                ? { textDecorationLine: 'line-through' }
                                : undefined
                            }
                          >
                            −{formatMoney(t.amount, t.sendCurrency)}
                          </Body>
                          {t.receiveAmount && (
                            <Body size={11.5} tone="ink3" numbers>
                              {formatMoney(t.receiveAmount, t.receiveCurrency)}
                            </Body>
                          )}
                        </View>
                      </Row>
                    </Card>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
