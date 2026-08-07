import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { StatusPill } from '../../../components/StatusPill';
import { Body, Card, Empty, Loader, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { STATUS_LABEL, dateTimeOf } from '../../../lib/format';
import { formatMoney } from '../../../lib/money';
import type { AdminTransferRow, Paginated, TransferStatus } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

const FILTERS: (TransferStatus | 'all')[] = [
  'all',
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
  'delivered',
  'failed',
  'cancelled',
];

export default function AdminTransfers() {
  const router = useRouter();
  const [status, setStatus] = useState<TransferStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminTransferRow> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get<Paginated<AdminTransferRow>>('/admin/transfers', {
          params: { page, pageSize: 20, ...(status !== 'all' ? { status } : {}) },
        });
        setData(res.data);
        setError('');
      } catch (err) {
        setError(errorMessage(err, 'Could not load transfers.'));
      }
    })();
  }, [status, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Transfers" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 7, paddingBottom: 10 }}
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((f) => {
          const on = f === status;
          return (
            <Pressable
              key={f}
              onPress={() => {
                setStatus(f);
                setPage(1);
                setData(null);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? colors.ink : colors.line2,
                backgroundColor: on ? colors.ink : colors.card,
              }}
            >
              <Body size={12} tone={on ? 'onInk' : 'ink2'} weight="600">
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
              </Body>
            </Pressable>
          );
        })}
      </ScrollView>

      <Screen contentStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}>
        <View style={{ gap: 10 }}>
          <Title size={20}>{data ? `${data.total} transfers` : 'Transfers'}</Title>

          {error ? <Note>{error}</Note> : null}

          {!data ? (
            <Loader />
          ) : data.items.length === 0 ? (
            <Empty title="Nothing here" body="No transfers with that status." />
          ) : (
            <>
              {data.items.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() =>
                    router.push({ pathname: '/(admin)/transfers/[id]', params: { id: t.id } })
                  }
                >
                  <Card padded={false} style={{ padding: 13 }}>
                    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Body size={13} tone="ink" weight="600" numberOfLines={1}>
                          {t.userEmail} → {t.recipient.name}
                        </Body>
                        <StatusPill status={t.status} compact />
                        <Body size={11} tone="ink3">
                          {dateTimeOf(t.createdAt)} · {t.id.slice(0, 8).toUpperCase()}
                        </Body>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Body size={13.5} tone="ink" weight="700" numbers>
                          {formatMoney(t.sendAmount, t.sendCurrency)}
                        </Body>
                        {t.receiveAmount && (
                          <Body size={11} tone="ink3" numbers>
                            {formatMoney(t.receiveAmount, t.receiveCurrency)}
                          </Body>
                        )}
                      </View>
                    </Row>
                  </Card>
                </Pressable>
              ))}

              {pages > 1 && (
                <Row style={{ justifyContent: 'space-between', paddingTop: 4 }}>
                  <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
                    <Body size={13} tone={page <= 1 ? 'ink3' : 'mint'} weight="600">
                      ‹ Previous
                    </Body>
                  </Pressable>
                  <Body size={12} tone="ink3">
                    Page {page} of {pages}
                  </Body>
                  <Pressable disabled={page >= pages} onPress={() => setPage((p) => p + 1)}>
                    <Body size={13} tone={page >= pages ? 'ink3' : 'mint'} weight="600">
                      Next ›
                    </Body>
                  </Pressable>
                </Row>
              )}
            </>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
