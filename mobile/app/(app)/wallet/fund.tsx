import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Keypad } from '../../../components/Keypad';
import { Body, Button, Note, Row, Title } from '../../../components/ui';
import api, { errorMessage, statusOf } from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import type { Balance } from '../../../lib/types';
import { radius, useTheme } from '../../../theme/tokens';

const PRESETS = ['50', '100', '250', '500'];

export default function FundWallet() {
  const { colors } = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Same reasoning as the send flow: one key for this screen's lifetime, so a
  // retry after a timeout cannot credit the wallet twice.
  const idempotencyKey = useRef(Crypto.randomUUID()).current;
  const [alreadyFunded, setAlreadyFunded] = useState(false);

  /**
   * Leaving this screen, back to wherever it was opened from.
   *
   * `router.back()` alone always landed on the Wallet screen, because that is
   * this screen's parent in the wallet stack — so opening "Add money" from the
   * Home dashboard and pressing back put you somewhere you had never been.
   *
   * The pop still happens first and unconditionally: it is what stops a funded
   * screen being reachable again, and it is the call that was already here. The
   * tab switch is a second, optional step, so if it ever fails the worst case
   * is the Wallet screen — exactly today's behaviour — rather than being
   * stranded on a form that has already taken money.
   */
  const leave = React.useCallback(() => {
    router.back();
    if (from === 'home') router.push('/(app)/home');
  }, [router, from]);

  useEffect(() => {
    api
      .get<Balance>('/wallet/balance')
      .then(({ data }) => setBalance(data))
      .catch(() => {});
  }, []);

  const numeric = Number(amount);
  const valid = Number.isFinite(numeric) && numeric >= 1 && numeric <= 50000;

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post<Balance>('/wallet/fund', {
        amount: numeric,
        currency: balance?.currency,
        idempotencyKey,
      });
      setBalance(data);
      leave();
    } catch (err) {
      /*
       * A repeated idempotency key is a 409 here, not a replay of the original
       * response — unlike POST /transfers, which returns the transfer it
       * already created. So a retry after a lost response lands here even
       * though the money did arrive. Reporting that as a failure would be
       * wrong and would invite a second, differently-keyed attempt.
       */
      if (statusOf(err) === 409) {
        setAlreadyFunded(true);
        setError('');
        try {
          const { data } = await api.get<Balance>('/wallet/balance');
          setBalance(data);
        } catch {
          /* The banner below already says what happened. */
        }
        setBusy(false);
        return;
      }
      setError(errorMessage(err, 'Could not add money.'));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <BackBar title="Add money" onBack={leave} />
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 14 }}>
          <View>
            <Body size={12.5} tone="faint">
              Balance {formatMoney(balance?.balance ?? '0', balance?.currency ?? 'CAD')}
            </Body>
            <Row gap={6} style={{ alignItems: 'flex-end', marginTop: 6 }}>
              <Title size={46} style={{ letterSpacing: -2 }}>
                {amount === '' ? '0' : amount}
              </Title>
              <Title size={20} tone="faint" style={{ paddingBottom: 7 }}>
                {balance?.currency ?? 'CAD'}
              </Title>
            </Row>
          </View>

          <Row gap={8}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setAmount(p)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: amount === p ? colors.accent : colors.lineStrong,
                  backgroundColor: amount === p ? colors.accentSoft : colors.card,
                  alignItems: 'center',
                }}
              >
                <Body size={13} tone={amount === p ? 'accent' : 'muted'} weight="600" numbers>
                  {p}
                </Body>
              </Pressable>
            ))}
          </Row>

          {alreadyFunded ? (
            <Note tone="success">
              That top-up had already gone through — your balance above is up to date. Nothing was
              charged twice.
            </Note>
          ) : error ? (
            <Note>{error}</Note>
          ) : (
            <Note tone="success">
              This is a demo funding step: no card is charged. In production this is where the
              card or Interac flow runs. The daily funding limit is 20,000.
            </Note>
          )}
        </View>

        <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
          <Keypad value={amount} onChange={setAmount} />
          <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
            {/* Once the key is spent, pressing again can only 409 again — so
                the button becomes the way out instead of a dead retry. */}
            <Button
              label={alreadyFunded ? 'Done' : 'Add money'}
              variant="primary"
              disabled={!alreadyFunded && !valid}
              loading={busy}
              onPress={alreadyFunded ? leave : submit}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
