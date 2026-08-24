import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { JourneyPath } from '../../../components/JourneyPath';
import { StatusPill } from '../../../components/StatusPill';
import { WorldMap, countryForCurrency } from '../../../components/WorldMap';
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
import { STATUS_LABEL, progressOf } from '../../../lib/format';
import { countryFlag, formatAmount, formatMoney } from '../../../lib/money';
import { shareReceipt } from '../../../lib/receipt';
import { useTransferStatus } from '../../../lib/sockets';
import { CANCELLABLE_STATUSES, type TransferDetail } from '../../../lib/types';
import { radius, useTheme } from '../../../theme/tokens';

/** Width ÷ height of the map band. Taller than the home card's, because this
 *  screen is about the journey rather than about the rate. */
const MAP_ASPECT = 2.4;

function Journey({ transfer }: { transfer: TransferDetail }) {
  const { colors } = useTheme();
  const failed = transfer.status === 'failed' || transfer.status === 'cancelled';
  const t = progressOf(transfer.status);
  const delivered = transfer.status === 'delivered';
  const originCountry = countryForCurrency(transfer.sendCurrency);

  return (
    <View
      style={{
        backgroundColor: colors.slab,
        borderRadius: radius.lg,
        padding: 16,
        paddingBottom: 18,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Body size={10.5} tone="onSlabMuted" weight="600">
          {failed ? 'DID NOT COMPLETE' : delivered ? 'DELIVERED' : 'IN FLIGHT'}
        </Body>
        {!failed && !delivered && (
          <Row gap={5}>
            <View
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.onSlab }}
            />
            <Body size={10} tone="onSlab" weight="600">
              Live
            </Body>
          </Row>
        )}
      </Row>

      {/* The real route. The mark's position along the arc is the same fraction
          of the journey as the transfer's stage is of the state machine, so at
          a glance it says how far along things are without reading a word.
          A failed transfer shows no progress — the money came back. */}
      <View style={{ marginTop: 10 }}>
        <WorldMap
          fromCountry={originCountry}
          toCountry={transfer.recipient.country}
          progress={failed ? 0 : t}
          aspect={MAP_ASPECT}
          markSize={26}
          showMark={!failed}
          eyesClosed={delivered}
        />
      </View>

      <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
        <Body size={10.5} tone="onSlabMuted">
          Sent
        </Body>
        <Body size={10.5} tone="onSlabMuted">
          {countryFlag(transfer.recipient.country)} {transfer.recipient.name.split(' ')[0]}
        </Body>
      </Row>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Body size={13.5} tone="onSlab" weight="600">
          {failed
            ? (transfer.failureReason ?? STATUS_LABEL[transfer.status])
            : STATUS_LABEL[transfer.status]}
        </Body>
      </View>
    </View>
  );
}

export default function TransferDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();

  /**
   * Back, to wherever this was opened from.
   *
   * A transfer is reachable from four places — the Activity list, the Home
   * dashboard, a notification, and the screen shown the moment a transfer is
   * sent. It used to return to the Activity list from all four, so finishing a
   * transfer and tapping Track left you in a list you had never opened, two
   * presses from where you started.
   *
   * The send flow is the case that matters: by the time this screen is
   * reached the flow behind it has been torn down deliberately, so there is
   * nothing to pop and Home is the only honest destination.
   */
  const backTo = React.useCallback(() => {
    if (from === 'home' || from === 'send') return router.replace('/(app)/home');
    if (from === 'notifications')
      return router.replace('/(app)/notifications');
    return router.replace('/(app)/activity');
  }, [router, from]);
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<TransferDetail>(`/transfers/${id}`);
      setTransfer(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this transfer.'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /* The backend advances transfers on a timer and pushes each change over the
     socket, so this screen updates without polling. Only refetch when the
     event is about *this* transfer. */
  useTransferStatus((e) => {
    if (e.transferId === id) void load();
  });

  const cancellable = transfer !== null && CANCELLABLE_STATUSES.includes(transfer.status);
  const total = transfer
    ? (Number(transfer.amount) + Number(transfer.feeAmount)).toFixed(2)
    : null;

  const cancel = () => {
    Alert.alert(
      'Cancel this transfer?',
      'The full amount and the fee are refunded to your wallet. This cannot be undone.',
      [
        { text: 'Keep sending', style: 'cancel' },
        {
          text: 'Cancel transfer',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { data } = await api.post<TransferDetail>(`/transfers/${id}/cancel`);
              setTransfer(data);
            } catch (err) {
              setError(errorMessage(err, 'Could not cancel — it may have already moved on.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const receipt = async () => {
    if (!transfer) return;
    try {
      await shareReceipt(transfer);
    } catch (err) {
      setError(errorMessage(err, 'Could not generate the receipt.'));
    }
  };

  if (!transfer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
        <BackBar title="Transfer" onBack={backTo} />
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar
        title={`To ${transfer.recipient.name}`}
        onBack={backTo}
      />
      <Screen>
        <View style={{ gap: 16 }}>
          <Journey transfer={transfer} />

          <View style={{ alignItems: 'center', gap: 3 }}>
            <Title size={32} numberOfLines={1}>
              {formatAmount(transfer.receiveAmount)}{' '}
              <Title size={17} tone="faint">
                {transfer.receiveCurrency}
              </Title>
            </Title>
            <StatusPill status={transfer.status} />
          </View>

          {error ? <Note>{error}</Note> : null}

          <Card>
            <View style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13}>You sent</Body>
                <Body size={13} tone="ink" weight="600" numbers>
                  {formatMoney(transfer.amount, transfer.sendCurrency)}
                </Body>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13}>Fee</Body>
                <Body size={13} tone="ink" weight="600" numbers>
                  {formatMoney(transfer.feeAmount, transfer.sendCurrency)}
                </Body>
              </Row>
              <Divider />
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13} tone="ink" weight="600">
                  Total charged
                </Body>
                <Body size={14} tone="ink" weight="700" numbers>
                  {formatMoney(total, transfer.sendCurrency)}
                </Body>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={12} tone="faint">
                  Rate applied
                </Body>
                <Body size={12} tone="faint" numbers>
                  {transfer.fxRateApplied
                    ? `1 ${transfer.sendCurrency} = ${formatAmount(transfer.fxRateApplied, 4)} ${transfer.receiveCurrency}`
                    : '—'}
                </Body>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={12} tone="faint">
                  Reference
                </Body>
                <Body size={12} tone="faint" numbers>
                  {transfer.id.slice(0, 8).toUpperCase()}
                </Body>
              </Row>
            </View>
          </Card>
          {/* The journey. Six stations on one screen, no scrolling: the flat
              list this replaces answered "what happened" but never "how far",
              and the kitten now has somewhere to stand that means something. */}
          <Card>
            <Body size={11} tone="faint" weight="600" style={{ marginBottom: 4 }}>
              JOURNEY
            </Body>
            <JourneyPath status={transfer.status} timeline={transfer.timeline} />
          </Card>

          <View style={{ gap: 9 }}>
            <Button label="Download receipt" variant="outline" onPress={receipt} />
            {cancellable && (
              <Button
                label="Cancel transfer"
                variant="danger"
                loading={busy}
                onPress={cancel}
              />
            )}
          </View>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
