import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Card, Loader, Note, Row, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { formatAmount } from '../../lib/money';
import type { AdminStats } from '../../lib/types';
import { colors, radius } from '../../theme/tokens';

function Stat({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'amber' | 'mint' | 'clay' }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.md,
        padding: 13,
        gap: 2,
      }}
    >
      <Body size={20} tone={tone} weight="700" numbers>
        {value}
      </Body>
      <Body size={11} tone="ink3">
        {label}
      </Body>
    </View>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminStats>('/admin/stats');
      setStats(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load admin statistics.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const links = [
    { label: 'Users', hint: 'Search, suspend, override KYC', to: '/(admin)/users' as const },
    { label: 'Transfers', hint: 'Inspect and force-fail', to: '/(admin)/transfers' as const },
    { label: 'Corridors', hint: 'Rates, margins, fees and limits', to: '/(admin)/corridors' as const },
    { label: 'Audit log', hint: 'Every state change, newest first', to: '/(admin)/audit' as const },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Admin" onBack={() => router.replace('/(app)/profile')} />
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
          <Title size={25}>Operations</Title>

          {error ? <Note>{error}</Note> : null}

          {!stats ? (
            <Loader />
          ) : (
            <View style={{ gap: 9 }}>
              <Row gap={9}>
                <Stat label="Customers" value={String(stats.users)} />
                <Stat label="Transfers" value={String(stats.transfers)} />
              </Row>
              <Row gap={9}>
                <Stat label="In flight" value={String(stats.inFlight)} tone="amber" />
                <Stat label="Delivered" value={String(stats.delivered)} tone="mint" />
                <Stat label="Failed" value={String(stats.failed)} tone="clay" />
              </Row>
              <Card>
                <Body size={11} tone="ink3" weight="600">
                  DELIVERED VOLUME
                </Body>
                <Title size={26} style={{ marginTop: 2 }}>
                  {formatAmount(stats.totalDeliveredVolume)}
                </Title>
                <Body size={11.5} tone="ink3">
                  Sum of every delivered transfer, in its send currency.
                </Body>
              </Card>
            </View>
          )}

          <View style={{ gap: 9 }}>
            {links.map((l) => (
              <Pressable key={l.label} onPress={() => router.push(l.to)}>
                <Card padded={false} style={{ padding: 15 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Body size={14.5} tone="ink" weight="600">
                        {l.label}
                      </Body>
                      <Body size={12} tone="ink3">
                        {l.hint}
                      </Body>
                    </View>
                    <Body size={16} tone="ink3">
                      ›
                    </Body>
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
