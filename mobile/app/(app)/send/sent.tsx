import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Kitten } from '../../../components/Kitten';
import { Body, Button, Card, Loader, Row, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import type { TransferDetail } from '../../../lib/types';
import { radius, useTheme } from '../../../theme/tokens';

/**
 * The moment after the money moves. No confetti: this screen's job is to say
 * what happens next and get out of the way, because the user's next question
 * is always "when does it arrive".
 */
export default function Sent() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);

  useEffect(() => {
    api
      .get<TransferDetail>(`/transfers/${id}`)
      .then(({ data }) => setTransfer(data))
      .catch(() => {});
  }, [id]);

  /**
   * Leaving the success screen tears the send flow down behind it.
   *
   * `review` reached here with `replace`, so only the review step was
   * discarded — the stack underneath was still
   * `[pick recipient, enter amount, sent]`. Pressing back on a transfer that
   * had already gone landed on the amount keypad, prefilled with the amount
   * just sent. On a money app that is not merely untidy: it looks like the
   * payment did not go through and invites someone to send it a second time.
   *
   * `dismissAll` empties the flow first, so nothing is left to walk back into
   * and the next send starts from the beginning rather than resuming a
   * finished one.
   */
  const leave = useCallback(
    (go: () => void) => {
      try {
        if (router.canDismiss()) router.dismissAll();
      } catch {
        // Emptying the flow is housekeeping. It must never be what stops
        // someone leaving the screen their money just left from — if it
        // fails, the stale stack simply stays behind, which is exactly the
        // behaviour that shipped before, and `go()` still runs.
      }
      go();
    },
    [router],
  );

  const goHome = useCallback(
    () => leave(() => router.replace('/(app)/home')),
    [leave, router],
  );

  // The hardware button has to agree with the buttons on screen. Without this
  // it is the one route out that still walks back into the finished flow.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          {/* The money has just left. The mascot carries the moment so the
              copy does not have to shout; the amount and the recipient below
              are still the first things that render. */}
          <Kitten state="travel" width={168} accessibilityLabel="Transfer sent" />
          <Title size={26} style={{ textAlign: 'center' }}>
            On its way.
          </Title>
          {transfer ? (
            <Body size={14} style={{ textAlign: 'center', maxWidth: 280 }}>
              {formatMoney(transfer.receiveAmount, transfer.receiveCurrency)} to{' '}
              {transfer.recipient.name}. We&apos;ll tell you the moment it lands.
            </Body>
          ) : (
            <Loader />
          )}
        </View>

        {transfer && (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body size={12.5} tone="faint">
                Reference
              </Body>
              <Body size={12.5} tone="ink" weight="600" numbers>
                {transfer.id.slice(0, 8).toUpperCase()}
              </Body>
            </Row>
            <View
              style={{
                marginTop: 12,
                backgroundColor: colors.inset,
                borderRadius: radius.sm,
                padding: 12,
              }}
            >
              <Body size={12.5} tone="accent" weight="500">
                Track it live on the next screen. You can still cancel for a full refund until it
                reaches the payout partner.
              </Body>
            </View>
          </Card>
        )}

        <View style={{ gap: 9 }}>
          <Button
            label="Track this transfer"
            variant="primary"
            onPress={() =>
              leave(() =>
                router.replace({
                  pathname: '/(app)/activity/[id]',
                  params: { id: id!, from: 'send' },
                }),
              )
            }
          />
          <Button label="Back to home" variant="outline" onPress={goHome} />
        </View>
      </View>
    </SafeAreaView>
  );
}
