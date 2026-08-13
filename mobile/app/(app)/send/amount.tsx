import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Keypad } from '../../../components/Keypad';
import { Body, Button, Note, Row, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { receiveCurrencyFor, useCorridors } from '../../../lib/corridors';
import { compareAmount, formatAmount, formatMoney } from '../../../lib/money';
import type { Balance, Quote, Recipient } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

/** Step 2 of 3. How much. */
export default function SendAmount() {
  const router = useRouter();
  const { recipientId } = useLocalSearchParams<{ recipientId: string }>();
  const { corridors } = useCorridors();

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  useEffect(() => {
    void Promise.allSettled([
      api.get<Recipient[]>('/recipients'),
      api.get<Balance>('/wallet/balance'),
    ]).then(([r, b]) => {
      if (r.status === 'fulfilled') {
        setRecipient(r.value.data.find((x) => x.id === recipientId) ?? null);
      }
      if (b.status === 'fulfilled') setBalance(b.value.data);
    });
  }, [recipientId]);

  const sendCurrency = balance?.currency ?? 'CAD';
  const receiveCurrency = receiveCurrencyFor(corridors, recipient?.country);

  /* Live quote, debounced. The endpoint is the same one the review screen and
     the backend's own transfer creation use, so what is shown here is what
     gets charged — no client-side rate maths anywhere. */
  useEffect(() => {
    const numeric = Number(amount);
    if (!amount || !receiveCurrency || !Number.isFinite(numeric) || numeric <= 0) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<Quote>('/corridors/convert', {
          params: { from: sendCurrency, to: receiveCurrency, amount: numeric },
        });
        setQuote(data);
        setQuoteError('');
      } catch {
        setQuote(null);
        setQuoteError('Could not fetch a rate for that amount.');
      } finally {
        setQuoting(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      setQuoting(false);
    };
  }, [amount, sendCurrency, receiveCurrency]);

  /**
   * The wallet must cover the amount *plus* the fee — the backend debits both
   * in one transaction and rejects the transfer otherwise. Checking only the
   * amount here would let someone reach the review screen and be refused.
   */
  const total = quote ? (quote.sendAmount + quote.fee).toFixed(2) : null;
  const insufficient = useMemo(() => {
    if (!total || !balance) return false;
    return compareAmount(balance.balance, total) < 0;
  }, [total, balance]);

  const belowMin = quote !== null && quote.sendAmount < quote.minSendAmount;
  const aboveMax = quote !== null && quote.sendAmount > quote.maxSendAmount;
  const canContinue = quote !== null && !insufficient && !belowMin && !aboveMax && !quoting;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <BackBar title={recipient ? `To ${recipient.name}` : 'Amount'} />

      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <Body size={12.5} tone="faint">
            Step 2 of 3 · You send
          </Body>

          <Row gap={6} style={{ alignItems: 'flex-end', marginTop: 6 }}>
            <Title size={46} style={{ letterSpacing: -2 }}>
              {amount === '' ? '0' : amount}
            </Title>
            <Title size={20} tone="faint" style={{ paddingBottom: 7 }}>
              {sendCurrency}
            </Title>
          </Row>

          {/* The receive figure is the headline of the review screen, but it is
              shown here too: it is the number the recipient cares about, and
              waiting a screen to reveal it is what makes rates feel hidden. */}
          <View
            style={{
              marginTop: 14,
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              padding: 14,
              gap: 9,
            }}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <Body size={13}>They receive</Body>
              {quoting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Body size={17} tone="ink" weight="700" numbers>
                  {quote && receiveCurrency
                    ? formatMoney(quote.receiveAmount, receiveCurrency)
                    : '—'}
                </Body>
              )}
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body size={12} tone="faint">
                Rate
              </Body>
              <Body size={12} tone="faint" numbers>
                {quote
                  ? `1 ${sendCurrency} = ${formatAmount(quote.rate, 4)} ${receiveCurrency}`
                  : '—'}
              </Body>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body size={12} tone="faint">
                Fee
              </Body>
              <Body size={12} tone="faint" numbers>
                {quote ? formatMoney(quote.fee, sendCurrency) : '—'}
              </Body>
            </Row>
          </View>

          <View style={{ marginTop: 10, minHeight: 42 }}>
            {quoteError ? (
              <Note>{quoteError}</Note>
            ) : insufficient ? (
              <Note>
                That is {formatMoney(total, sendCurrency)} with the fee — more than your{' '}
                {formatMoney(balance?.balance ?? '0', sendCurrency)} balance. Add money first.
              </Note>
            ) : belowMin && quote ? (
              <Note tone="pending">
                The minimum for this corridor is {formatMoney(quote.minSendAmount, sendCurrency)}.
              </Note>
            ) : aboveMax && quote ? (
              <Note tone="pending">
                The maximum for this corridor is {formatMoney(quote.maxSendAmount, sendCurrency)}.
              </Note>
            ) : (
              <Body size={12} tone="faint">
                Balance {formatMoney(balance?.balance ?? '0', sendCurrency)}
                {total ? ` · this costs ${formatMoney(total, sendCurrency)} in total` : ''}
              </Body>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
          <Keypad value={amount} onChange={setAmount} />
          <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
            <Button
              label="Review transfer"
              variant="primary"
              disabled={!canContinue}
              onPress={() =>
                router.push({
                  pathname: '/(app)/send/review',
                  params: {
                    recipientId: recipientId!,
                    amount: String(quote!.sendAmount),
                    sendCurrency,
                    receiveCurrency: receiveCurrency!,
                  },
                })
              }
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
