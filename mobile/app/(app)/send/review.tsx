import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Avatar } from '../../../components/StatusPill';
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
import api, { errorMessage, statusOf } from '../../../lib/api';
import { countryFlag, formatAmount, formatMoney } from '../../../lib/money';
import type { Quote, Recipient, TransferDetail } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

/** Step 3 of 3. Confirm. */
export default function SendReview() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipientId: string;
    amount: string;
    sendCurrency: string;
    receiveCurrency: string;
  }>();

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * Minted once, when this screen mounts — deliberately not at submit time.
   *
   * If the request times out or the app is killed mid-flight, the user lands
   * back here and taps again; reusing the same key means the backend returns
   * the transfer it already created (transfers.service.ts) instead of sending
   * the money twice. A key generated inside the submit handler would be a new
   * one on every tap and would defeat exactly the case it exists for.
   */
  const idempotencyKey = useRef(Crypto.randomUUID()).current;

  useEffect(() => {
    void Promise.allSettled([
      api.get<Recipient[]>('/recipients'),
      api.get<Quote>('/corridors/convert', {
        params: {
          from: params.sendCurrency,
          to: params.receiveCurrency,
          amount: Number(params.amount),
        },
      }),
    ]).then(([r, q]) => {
      if (r.status === 'fulfilled') {
        setRecipient(r.value.data.find((x) => x.id === params.recipientId) ?? null);
      }
      if (q.status === 'fulfilled') setQuote(q.value.data);
      else setError('Could not confirm the rate. Go back and try again.');
    });
  }, [params.recipientId, params.sendCurrency, params.receiveCurrency, params.amount]);

  const total = useMemo(
    () => (quote ? (quote.sendAmount + quote.fee).toFixed(2) : null),
    [quote],
  );

  const confirm = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post<TransferDetail>('/transfers', {
        recipientId: params.recipientId,
        sendAmount: Number(params.amount),
        sendCurrency: params.sendCurrency,
        receiveCurrency: params.receiveCurrency,
        idempotencyKey,
      });
      // Replace, not push: the review screen must not be reachable with the
      // back gesture once the money has moved.
      router.replace({ pathname: '/(app)/send/sent', params: { id: data.id } });
    } catch (err) {
      if (statusOf(err) === 403) {
        setError(
          'Identity verification is required before sending. Complete it from your profile, then try again.',
        );
      } else {
        setError(errorMessage(err, 'The transfer could not be created.'));
      }
      setBusy(false);
    }
  };

  if (!quote || !recipient) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
        <BackBar title="Review" />
        {error ? (
          <View style={{ padding: 16 }}>
            <Note>{error}</Note>
          </View>
        ) : (
          <Loader label="Confirming the rate…" />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <BackBar title="Review" />
      <Screen contentStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={{ gap: 16 }}>
          <Body size={12.5} tone="faint">
            Step 3 of 3
          </Body>

          {/* The headline is what *she* receives. The sender's debit is
              secondary — it is the number the recipient will be asked about. */}
          <View style={{ alignItems: 'center', gap: 4, paddingVertical: 4 }}>
            <Body size={13} tone="faint">
              {recipient.name} receives
            </Body>
            <Title size={40}>
              {formatAmount(quote.receiveAmount)}{' '}
              <Title size={20} tone="faint">
                {params.receiveCurrency}
              </Title>
            </Title>
          </View>

          <Card>
            <Row gap={12}>
              <Avatar name={recipient.name} size={44} />
              <View style={{ flex: 1 }}>
                <Body size={14.5} tone="ink" weight="600">
                  {recipient.name}
                </Body>
                <Body size={12} tone="faint">
                  {countryFlag(recipient.country)} {recipient.bankName ?? recipient.country} ·{' '}
                  {recipient.bankAccount.length > 6
                    ? `••••${recipient.bankAccount.slice(-4)}`
                    : recipient.bankAccount}
                </Body>
              </View>
            </Row>
          </Card>

          <Card>
            <View style={{ gap: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13.5}>You send</Body>
                <Body size={13.5} tone="ink" weight="600" numbers>
                  {formatMoney(quote.sendAmount, params.sendCurrency)}
                </Body>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13.5}>Fee</Body>
                <Body size={13.5} tone="ink" weight="600" numbers>
                  {formatMoney(quote.fee, params.sendCurrency)}
                </Body>
              </Row>
              <Divider />
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={13.5} tone="ink" weight="600">
                  Total charged
                </Body>
                <Body size={15} tone="ink" weight="700" numbers>
                  {formatMoney(total, params.sendCurrency)}
                </Body>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body size={12} tone="faint">
                  Rate applied
                </Body>
                <Body size={12} tone="faint" numbers>
                  1 {params.sendCurrency} = {formatAmount(quote.rate, 4)}{' '}
                  {params.receiveCurrency}
                </Body>
              </Row>
            </View>
          </Card>

          {error ? <Note>{error}</Note> : null}

          <Button
            label={busy ? 'Sending…' : `Send ${formatMoney(total, params.sendCurrency)}`}
            variant="primary"
            loading={busy}
            onPress={confirm}
          />
          <Body size={11.5} tone="faint" style={{ textAlign: 'center' }}>
            You can cancel this transfer for a full refund until it reaches the payout partner.
          </Body>
        </View>
      </Screen>
    </SafeAreaView>
  );
}
