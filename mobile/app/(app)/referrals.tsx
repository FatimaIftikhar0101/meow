import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BackBar } from '../../components/BackBar';
import { Body, Button, Card, Divider, Loader, Note, Row, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { dateOf } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import type { ReferralDashboard } from '../../lib/types';
import { radius, useTheme } from '../../theme/tokens';

const STATUS_COPY: Record<string, { label: string; tone: 'accent' | 'pending' | 'faint' }> = {
  rewarded: { label: 'Rewarded', tone: 'accent' },
  qualified: { label: 'Qualified', tone: 'pending' },
  pending: { label: 'Waiting on first transfer', tone: 'faint' },
};

export default function Referrals() {
  const { colors } = useTheme();
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ReferralDashboard>('/referrals/me');
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your referral code.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.code);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  /**
   * The backend returns the code but no share URL, and the app has no public
   * landing page of its own, so the invite carries the code as text. Once a web
   * sign-up page is deployed this should carry `<origin>/register?ref=CODE`
   * instead, which the register screen already reads from its `ref` param.
   */
  const share = async () => {
    if (!data) return;
    await Share.share({
      message: `I use Meow to send money home — $2.99 flat, and the rate you see is the rate you get. Enter my code ${data.code} when you sign up and I get a small reward once your first transfer lands.`,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="Refer & earn" />
      <Screen>
        {error ? (
          <Note>{error}</Note>
        ) : !data ? (
          <Loader />
        ) : (
          <View style={{ gap: 16 }}>
            <View>
              <Title size={25}>Invite a friend.</Title>
              <Body size={13.5} style={{ marginTop: 4 }}>
                You earn when their first transfer is delivered — not when they sign up. Real money,
                credited straight to your wallet.
              </Body>
            </View>

            <View
              style={{
                backgroundColor: colors.slab,
                borderRadius: radius.lg,
                padding: 18,
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Body size={10.5} tone="onSlabMuted" weight="600">
                YOUR CODE
              </Body>
              <Pressable onPress={copy}>
                <Title size={32} tone="onSlab" style={{ letterSpacing: 3 }}>
                  {data.code}
                </Title>
              </Pressable>
              <Body size={11.5} tone={copied ? 'accent' : 'onSlabMuted'}>
                {copied ? 'Copied to clipboard' : 'Tap the code to copy'}
              </Body>
            </View>

            <Row gap={9}>
              <View style={{ flex: 1 }}>
                <Button label="Share invite" variant="primary" onPress={share} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Copy code" variant="outline" onPress={copy} />
              </View>
            </Row>

            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                {[
                  { k: 'Invited', v: String(data.stats.invited) },
                  { k: 'Rewarded', v: String(data.stats.rewarded) },
                  {
                    k: 'Earned',
                    v: formatMoney(data.stats.totalEarned, data.stats.currency),
                  },
                ].map((s) => (
                  <View key={s.k} style={{ alignItems: 'center', flex: 1 }}>
                    <Body size={17} tone="ink" weight="700" numbers>
                      {s.v}
                    </Body>
                    <Body size={11} tone="faint">
                      {s.k}
                    </Body>
                  </View>
                ))}
              </Row>
            </Card>

            {data.referrals.length > 0 && (
              <Card>
                <Body size={11} tone="faint" weight="600" style={{ marginBottom: 10 }}>
                  YOUR INVITES
                </Body>
                {data.referrals.map((r, i) => {
                  const copy = STATUS_COPY[r.status] ?? STATUS_COPY.pending;
                  return (
                    <View key={r.id}>
                      {i > 0 && (
                        <View style={{ marginVertical: 10 }}>
                          <Divider />
                        </View>
                      )}
                      <Row style={{ justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <Body size={13} tone="ink" weight="600">
                            {r.maskedEmail}
                          </Body>
                          <Body size={11} tone="faint">
                            Joined {dateOf(r.createdAt)}
                          </Body>
                        </View>
                        <Body size={11.5} tone={copy.tone} weight="600">
                          {copy.label}
                        </Body>
                      </Row>
                    </View>
                  );
                })}
              </Card>
            )}
          </View>
        )}
      </Screen>
    </SafeAreaView>
  );
}
