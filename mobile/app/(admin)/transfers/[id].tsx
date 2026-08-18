import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { StatusPill } from '../../../components/StatusPill';
import {
  Body,
  Button,
  Card,
  Divider,
  Loader,
  Note,
  Row,
  Screen,
  Title,
} from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { STATUS_LABEL, dateTimeOf } from '../../../lib/format';
import { formatAmount, formatMoney } from '../../../lib/money';
import { TERMINAL_STATUSES, type AdminTransferDetail } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

function KV({ k, v }: { k: string; v: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Body size={12.5} tone="faint">
        {k}
      </Body>
      <Body size={12.5} tone="ink" weight="600" numbers style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Body>
    </Row>
  );
}

export default function AdminTransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [t, setT] = useState<AdminTransferDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminTransferDetail>(`/admin/transfers/${id}`);
      setT(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this transfer.'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const forceFail = () => {
    Alert.alert(
      'Force-fail this transfer?',
      'The amount and fee are refunded to the sender’s wallet and the transfer is marked failed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force fail',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api.post(`/admin/transfers/${id}/force-fail`, {
                reason: 'Force-failed from the admin console',
              });
              await load();
            } catch (err) {
              setError(errorMessage(err, 'Could not force-fail this transfer.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (!t) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
        <BackBar title="Transfer" />
        {error ? (
          <View style={{ padding: 16 }}>
            <Note>{error}</Note>
          </View>
        ) : (
          <Loader />
        )}
      </SafeAreaView>
    );
  }

  const terminal = TERMINAL_STATUSES.includes(t.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title={t.id.slice(0, 8).toUpperCase()} />
      <Screen>
        <View style={{ gap: 15 }}>
          <View style={{ gap: 6 }}>
            <Title size={22}>
              {formatMoney(t.sendAmount, t.sendCurrency)} → {t.recipient.name}
            </Title>
            <StatusPill status={t.status} />
            {t.failureReason ? <Note>{t.failureReason}</Note> : null}
          </View>

          {error ? <Note>{error}</Note> : null}

          <Card>
            <View style={{ gap: 9 }}>
              <KV k="Sender" v={t.user.email} />
              <KV k="Recipient" v={t.recipient.name} />
              <KV k="Account" v={t.recipient.bankAccountMasked} />
              <KV k="Destination" v={t.recipient.country} />
              <Divider />
              <KV k="Send amount" v={formatMoney(t.sendAmount, t.sendCurrency)} />
              <KV k="Fee" v={formatMoney(t.feeAmount, t.sendCurrency)} />
              <KV
                k="Receive amount"
                v={t.receiveAmount ? formatMoney(t.receiveAmount, t.receiveCurrency) : '—'}
              />
              <KV
                k="Rate applied"
                v={t.fxRateApplied ? formatAmount(t.fxRateApplied, 6) : '—'}
              />
              <Divider />
              <KV k="Provider" v={t.providerName ?? '—'} />
              <KV k="Provider ref" v={t.providerRef ?? '—'} />
              <KV k="Created" v={dateTimeOf(t.createdAt)} />
            </View>
          </Card>

          <Card>
            <Body size={11} tone="faint" weight="600" style={{ marginBottom: 9 }}>
              LEDGER ENTRIES
            </Body>
            {t.ledgerEntries.length === 0 ? (
              <Body size={13} tone="faint">
                None.
              </Body>
            ) : (
              t.ledgerEntries.map((e, i) => (
                <View key={e.id}>
                  {i > 0 && (
                    <View style={{ marginVertical: 9 }}>
                      <Divider />
                    </View>
                  )}
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Body size={13} tone="ink" weight="600">
                        {e.type.replace(/_/g, ' ')}
                      </Body>
                      <Body size={11} tone="faint">
                        {dateTimeOf(e.createdAt)}
                      </Body>
                    </View>
                    <Body
                      size={13.5}
                      tone={e.direction === 'credit' ? 'accent' : 'ink'}
                      weight="700"
                      numbers
                    >
                      {e.direction === 'credit' ? '+' : '−'}
                      {formatMoney(e.amount, e.currency)}
                    </Body>
                  </Row>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Body size={11} tone="faint" weight="600" style={{ marginBottom: 9 }}>
              TIMELINE
            </Body>
            {t.timeline.map((e, i) => (
              <View key={e.id}>
                {i > 0 && (
                  <View style={{ marginVertical: 8 }}>
                    <Divider />
                  </View>
                )}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Body size={12.5} tone="ink">
                    {e.message || STATUS_LABEL[e.status]}
                  </Body>
                  <Body size={11.5} tone="faint">
                    {dateTimeOf(e.createdAt)}
                  </Body>
                </Row>
              </View>
            ))}
          </Card>

          {!terminal && (
            <Button
              label="Force-fail transfer"
              variant="danger"
              loading={busy}
              onPress={forceFail}
            />
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
