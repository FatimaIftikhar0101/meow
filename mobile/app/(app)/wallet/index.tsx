import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Card, Empty, Loader, Row, Screen, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { dateTimeOf } from '../../../lib/format';
import { formatAmount, formatMoney } from '../../../lib/money';
import type { Balance, LedgerTransaction } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

/** Ledger entry types, spelled the way a person would describe them. */
const ENTRY_LABEL: Record<string, string> = {
  wallet_fund: 'Added money',
  transfer_hold: 'Sent',
  fee: 'Transfer fee',
  transfer_refund: 'Refund',
  referral_bonus: 'Referral reward',
};

export default function Wallet() {
  const router = useRouter();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [entries, setEntries] = useState<LedgerTransaction[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [b, t] = await Promise.allSettled([
      api.get<Balance>('/wallet/balance'),
      api.get<LedgerTransaction[]>('/wallet/transactions', { params: { limit: 50 } }),
    ]);
    if (b.status === 'fulfilled') setBalance(b.value.data);
    setEntries(t.status === 'fulfilled' ? t.value.data : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Wallet" />
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
          <View
            style={{
              backgroundColor: colors.ink,
              borderRadius: radius.lg,
              padding: 20,
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Body size={11} tone="onInk2" weight="600">
              AVAILABLE BALANCE
            </Body>
            <Title size={36} tone="onInk">
              {balance ? formatAmount(balance.balance) : '—'}{' '}
              <Title size={17} tone="onInk2">
                {balance?.currency ?? ''}
              </Title>
            </Title>
            <Body size={11.5} tone="onInk2" style={{ textAlign: 'center', marginTop: 4 }}>
              This is a staging balance you top up before sending. It is not a bank account and
              earns no interest.
            </Body>
          </View>

          <Button
            label="Add money"
            variant="mint"
            onPress={() => router.push('/(app)/wallet/fund')}
          />

          <View style={{ gap: 8 }}>
            <Body size={11.5} tone="ink3" weight="600">
              TRANSACTIONS
            </Body>
            {entries === null ? (
              <Loader />
            ) : entries.length === 0 ? (
              <Empty title="No transactions yet" body="Add money to get started." />
            ) : (
              entries.map((e) => {
                const credit = e.direction === 'credit';
                return (
                  <Card key={e.id} padded={false} style={{ padding: 13 }}>
                    <Row gap={11}>
                      <View style={{ flex: 1 }}>
                        <Body size={13.5} tone="ink" weight="600">
                          {ENTRY_LABEL[e.type] ?? e.type.replace(/_/g, ' ')}
                        </Body>
                        <Body size={11.5} tone="ink3" numberOfLines={1}>
                          {e.transfer
                            ? `${e.transfer.recipient.name} · ${dateTimeOf(e.createdAt)}`
                            : dateTimeOf(e.createdAt)}
                        </Body>
                      </View>
                      <Body
                        size={14}
                        tone={credit ? 'mint' : 'ink'}
                        weight="700"
                        numbers
                      >
                        {credit ? '+' : '−'}
                        {formatMoney(e.amount, e.currency)}
                      </Body>
                    </Row>
                  </Card>
                );
              })
            )}
          </View>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
