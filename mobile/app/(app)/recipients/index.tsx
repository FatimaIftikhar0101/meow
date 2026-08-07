import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/StatusPill';
import { Body, Button, Card, Empty, Loader, Row, Screen, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { countryFlag } from '../../../lib/money';
import type { Recipient } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

export default function Recipients() {
  const router = useRouter();
  const [list, setList] = useState<Recipient[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<Recipient[]>('/recipients');
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
        <View style={{ gap: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Title size={26}>People</Title>
            <Button
              label="Add"
              compact
              variant="mint"
              onPress={() => router.push('/(app)/recipients/new')}
            />
          </Row>

          {list === null ? (
            <Loader />
          ) : list.length === 0 ? (
            <Empty
              title="No recipients yet"
              body="Add the person you send to and their bank details. You only do this once."
              action={
                <Button
                  label="Add a recipient"
                  onPress={() => router.push('/(app)/recipients/new')}
                />
              }
            />
          ) : (
            <View style={{ gap: 8 }}>
              {list.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() =>
                    router.push({ pathname: '/(app)/recipients/[id]', params: { id: r.id } })
                  }
                >
                  <Card padded={false} style={{ padding: 13 }}>
                    <Row gap={12}>
                      <Avatar name={r.name} size={42} />
                      <View style={{ flex: 1 }}>
                        <Body size={14.5} tone="ink" weight="600" numberOfLines={1}>
                          {r.name}
                        </Body>
                        <Body size={12} tone="ink3" numberOfLines={1}>
                          {countryFlag(r.country)} {r.bankName ?? r.country} ·{' '}
                          {maskAccount(r.bankAccount)}
                        </Body>
                      </View>
                      <Button
                        label="Send"
                        compact
                        variant="outline"
                        onPress={() =>
                          router.push({
                            pathname: '/(app)/send/amount',
                            params: { recipientId: r.id },
                          })
                        }
                      />
                    </Row>
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}

/** Only the last four digits. The full number is on the detail screen. */
export function maskAccount(account: string): string {
  if (account.length <= 4) return account;
  return `••••${account.slice(-4)}`;
}
