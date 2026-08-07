import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/StatusPill';
import { Body, Button, Card, Divider, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { useAuth } from '../../../lib/AuthContext';
import { dateOf } from '../../../lib/format';
import { useLive } from '../../../lib/sockets';
import type { Balance, ComplianceStatus } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9 5l7 7-7 7"
        stroke={colors.ink3}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function LinkRow({
  label,
  hint,
  onPress,
  badge,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 13 }}>
        <View style={{ flex: 1 }}>
          <Body size={14} tone="ink" weight="600">
            {label}
          </Body>
          {hint ? (
            <Body size={12} tone="ink3">
              {hint}
            </Body>
          ) : null}
        </View>
        {badge && badge > 0 ? (
          <View
            style={{
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              paddingHorizontal: 6,
              backgroundColor: colors.clay,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Body size={11} tone="onInk" weight="700">
              {badge > 9 ? '9+' : String(badge)}
            </Body>
          </View>
        ) : null}
        <Chevron />
      </Row>
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const { profile, isAdmin, signOut, refresh } = useAuth();
  const { unreadCount } = useLive();

  const [kyc, setKyc] = useState<ComplianceStatus | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [k, b] = await Promise.allSettled([
      api.get<ComplianceStatus>('/compliance/status'),
      api.get<Balance>('/wallet/balance'),
    ]);
    if (k.status === 'fulfilled') setKyc(k.value.data);
    if (b.status === 'fulfilled') setBalance(b.value.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const verify = async () => {
    setError('');
    setVerifying(true);
    try {
      const { data } = await api.post<ComplianceStatus>('/compliance/verify');
      setKyc(data);
    } catch (err) {
      setError(errorMessage(err, 'Verification could not be completed.'));
    } finally {
      setVerifying(false);
    }
  };

  const resendVerification = async () => {
    try {
      await api.post('/auth/resend-verification');
      Alert.alert('Email sent', 'Check your inbox for the verification link.');
    } catch (err) {
      Alert.alert('Could not send', errorMessage(err));
    }
  };

  const name = profile?.fullName || profile?.email || '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(), refresh()]);
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={{ gap: 16 }}>
          <Row gap={13}>
            <Avatar name={name} size={56} tone="ink" />
            <View style={{ flex: 1 }}>
              <Title size={21} numberOfLines={1}>
                {profile?.fullName ?? 'Your account'}
              </Title>
              <Body size={12.5} tone="ink3" numberOfLines={1}>
                {profile?.email}
              </Body>
              {profile?.createdAt && (
                <Body size={11} tone="ink3">
                  Member since {dateOf(profile.createdAt)}
                </Body>
              )}
            </View>
          </Row>

          {error ? <Note>{error}</Note> : null}

          {/* Identity verification. Placed above everything else because
              nothing else in the app works until it passes. */}
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Body size={14} tone="ink" weight="600">
                  Identity verification
                </Body>
                <Body
                  size={12.5}
                  tone={
                    kyc?.status === 'passed' ? 'mint' : kyc?.status === 'failed' ? 'clay' : 'amber'
                  }
                  weight="600"
                >
                  {kyc?.status === 'passed'
                    ? `Verified${kyc.verifiedAt ? ` on ${dateOf(kyc.verifiedAt)}` : ''}`
                    : kyc?.status === 'failed'
                      ? `Failed${kyc.reason ? ` — ${kyc.reason}` : ''}`
                      : 'Not verified yet'}
                </Body>
              </View>
            </Row>
            {kyc?.status !== 'passed' && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Body size={12} tone="ink3">
                  Required before your first transfer. This build uses a mock provider, so it
                  completes instantly.
                </Body>
                <Button
                  label="Verify my identity"
                  variant="mint"
                  loading={verifying}
                  onPress={verify}
                />
              </View>
            )}
          </Card>

          {profile && !profile.emailVerified && (
            <Pressable onPress={resendVerification}>
              <Note tone="amber">
                Your email is not verified yet. Tap to resend the link.
              </Note>
            </Pressable>
          )}

          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <LinkRow
              label="Wallet"
              hint={balance ? `${balance.balance} ${balance.currency} available` : undefined}
              onPress={() => router.push('/(app)/wallet')}
            />
            <Divider />
            <LinkRow
              label="Notifications"
              badge={unreadCount}
              onPress={() => router.push('/(app)/notifications')}
            />
            <Divider />
            <LinkRow
              label="Refer & earn"
              hint="Earn when a friend's first transfer lands"
              onPress={() => router.push('/(app)/referrals')}
            />
          </Card>

          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <LinkRow
              label="Devices & sessions"
              hint="See where you're signed in, and sign out remotely"
              onPress={() => router.push('/(app)/profile/sessions')}
            />
            <Divider />
            <LinkRow
              label="Change password"
              onPress={() => router.push('/(app)/profile/change-password')}
            />
          </Card>

          {isAdmin && (
            <Pressable onPress={() => router.push('/(admin)')}>
              <View
                style={{
                  backgroundColor: colors.ink,
                  borderRadius: radius.md,
                  padding: 15,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Body size={14} tone="onInk" weight="600">
                      Admin portal
                    </Body>
                    <Body size={12} tone="onInk2">
                      Users, transfers, corridors and the audit log
                    </Body>
                  </View>
                  <Body size={16} tone="mint">
                    ›
                  </Body>
                </Row>
              </View>
            </Pressable>
          )}

          <Button
            label="Sign out"
            variant="outline"
            onPress={() =>
              Alert.alert('Sign out?', 'You will need your password to sign back in.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
            }
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
