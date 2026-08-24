import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { CatMark } from '../../components/CatMark';
import { CorridorCard } from '../../components/CorridorCard';
import { Avatar, StatusPill } from '../../components/StatusPill';
import { UpdateBanner } from '../../components/UpdateNotice';
import { Body, Card, Kicker, Note, Row, SectionHeader, Title } from '../../components/ui';
import api from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { corridorFor, useCorridors } from '../../lib/corridors';
import { GREETING, dayPartFor, timeOf } from '../../lib/format';
import { formatAmount, formatMoney } from '../../lib/money';
import { useLive, useTransferStatus } from '../../lib/sockets';
import { useAppUpdate } from '../../lib/updates';
import type { Balance, ComplianceStatus, Recipient, TransferSummary } from '../../lib/types';
import { radius, useTheme } from '../../theme/tokens';

const IN_FLIGHT = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
];

/* ── Quick actions ─────────────────────────────────────────────────────── */

function QuickIcon({ name, color }: { name: 'send' | 'add' | 'people' | 'bell'; color: string }) {
  const p = {
    stroke: color,
    strokeWidth: 2.1,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      {name === 'send' && (
        <>
          <Path d="M7 17 17 7" {...p} />
          <Path d="M9 7h8v8" {...p} />
        </>
      )}
      {name === 'add' && (
        <>
          <Path d="M12 5v14" {...p} />
          <Path d="M5 12h14" {...p} />
        </>
      )}
      {name === 'people' && (
        <>
          <Circle cx={9} cy={8} r={3.2} {...p} />
          <Path d="M3 19c0-3.1 2.7-5.2 6-5.2s6 2.1 6 5.2" {...p} />
          <Path d="M18 8.5v5M15.5 11h5" {...p} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" {...p} />
          <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...p} />
        </>
      )}
    </Svg>
  );
}

/**
 * Icon tiles on `inset`, not bordered cards. Bordered cards left 48.8px of
 * usable width inside their padding, which wrapped "Add money" onto two lines.
 * Send carries the accent fill — it is the one action the screen exists for.
 */
function QuickActions() {
  const { colors } = useTheme();
  const router = useRouter();
  const items = [
    { key: 'send', label: 'Send', icon: 'send' as const, hero: true, go: () => router.push('/(app)/send') },
    { key: 'add', label: 'Add money', icon: 'add' as const, hero: false, go: () => router.push({ pathname: '/(app)/wallet/fund', params: { from: 'home' } }) },
    { key: 'people', label: 'People', icon: 'people' as const, hero: false, go: () => router.push('/(app)/recipients') },
    { key: 'alerts', label: 'Activity', icon: 'bell' as const, hero: false, go: () => router.push({ pathname: '/(app)/notifications', params: { from: 'home' } }) },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 7 }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.go}
          accessibilityRole="button"
          accessibilityLabel={it.label}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            gap: 7,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: it.hero ? colors.accent : colors.inset,
            }}
          >
            <QuickIcon name={it.icon} color={it.hero ? colors.onAccent : colors.accent} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
            {it.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ── Screen ────────────────────────────────────────────────────────────── */

export default function Home() {
  const { name: scheme, colors } = useTheme();
  const update = useAppUpdate();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { corridors } = useCorridors();
  const { unreadCount } = useLive();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [transfers, setTransfers] = useState<TransferSummary[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [kyc, setKyc] = useState<ComplianceStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [b, t, r, k] = await Promise.allSettled([
      api.get<Balance>('/wallet/balance'),
      api.get<TransferSummary[]>('/transfers'),
      api.get<Recipient[]>('/recipients'),
      api.get<ComplianceStatus>('/compliance/status'),
    ]);
    if (b.status === 'fulfilled') setBalance(b.value.data);
    if (t.status === 'fulfilled') setTransfers(t.value.data);
    if (r.status === 'fulfilled') setRecipients(r.value.data);
    if (k.status === 'fulfilled') setKyc(k.value.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A status change anywhere means the home summary is stale.
  useTransferStatus(() => {
    void load();
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const part = dayPartFor();
  const firstName = profile?.firstName || profile?.fullName?.split(' ')[0] || 'there';

  const inFlight = useMemo(() => transfers.filter((t) => IN_FLIGHT.includes(t.status)), [transfers]);
  const lastDelivered = useMemo(() => transfers.find((t) => t.status === 'delivered'), [transfers]);

  const corridor = useMemo(() => {
    const from = balance?.currency ?? 'CAD';
    // Prefer the corridor the user actually uses; otherwise the first active
    // one out of their wallet currency.
    const usual = transfers[0]?.receiveCurrency;
    return (
      (usual ? corridorFor(corridors, from, usual) : null) ??
      corridors.find((c) => c.fromCurrency === from && c.active) ??
      null
    );
  }, [corridors, balance, transfers]);

  const kycPending = kyc != null && kyc.status !== 'passed';

  /**
   * A one-line status under the name: what the user would otherwise open the
   * app to check. Suppressed while the KYC banner is up, since the banner
   * already says the only thing that matters.
   */
  const line = useMemo(() => {
    if (kycPending) return null;
    if (inFlight.length === 1) {
      return `One transfer still on its way to ${inFlight[0].recipient.name.split(' ')[0]}.`;
    }
    if (inFlight.length > 1) return `${inFlight.length} transfers still on their way.`;
    if (lastDelivered) {
      return `Your ${formatMoney(lastDelivered.amount, lastDelivered.sendCurrency)} reached ${
        lastDelivered.recipient.name.split(' ')[0]
      } at ${timeOf(lastDelivered.createdAt)}.`;
    }
    if (corridor) {
      const applied = (Number(corridor.baseRate) * (10000 - corridor.marginBps)) / 10000;
      const where =
        corridor.toCountry === 'PK'
          ? 'Pakistan'
          : corridor.toCountry === 'IN'
            ? 'India'
            : corridor.toCountry;
      return `Rates are fresh — ${formatAmount(applied, 2)} to ${where}.`;
    }
    return 'Everything delivered. Rest easy.';
  }, [kycPending, inFlight, lastDelivered, corridor]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Follows the scheme. Hardcoded "dark" put dark glyphs on a dark
          ground: the clock, the battery and the signal bars all vanish. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 28, gap: 18 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ paddingHorizontal: 16 }}>
          <UpdateBanner update={update} />
        </View>

        {/* The time-of-day scene used to live here and took the first third of
            the screen on every visit. It is a brief intro now, so the rate —
            the thing people open the app for — is above the fold. */}
        <View style={{ paddingHorizontal: 16 }}>
          <Row gap={11}>
            <CatMark size={34} eyesClosed={part === 'night'} />
            <View style={{ flex: 1 }}>
              <Kicker>{GREETING[part]}</Kicker>
              <Title size={19} numberOfLines={1} style={{ marginTop: 2 }}>
                {firstName}
              </Title>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/notifications', params: { from: 'home' } })}
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
              }
              style={({ pressed }) => ({
                width: 38,
                height: 38,
                borderRadius: radius.md,
                backgroundColor: colors.inset,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <QuickIcon name="bell" color={colors.accent} />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 7,
                    right: 7,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.danger,
                    borderWidth: 1.5,
                    borderColor: colors.canvas,
                  }}
                />
              )}
            </Pressable>
          </Row>

          {line && (
            <Body size={12.5} tone="muted" style={{ marginTop: 8 }}>
              {line}
            </Body>
          )}
        </View>

        {kycPending && (
          <View style={{ paddingHorizontal: 16 }}>
            <Pressable onPress={() => router.push('/(app)/profile')}>
              <Note tone="pending">
                {kyc.status === 'failed'
                  ? `Identity check failed${kyc.reason ? `: ${kyc.reason}` : ''}. Tap to review.`
                  : 'Verify your identity before your first transfer. Tap to start — it takes seconds.'}
              </Note>
            </Pressable>
          </View>
        )}

        <View style={{ paddingHorizontal: 16 }}>
          <CorridorCard
            corridor={corridor}
            balance={balance?.balance ?? null}
            balanceCurrency={balance?.currency ?? 'CAD'}
          />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <QuickActions />
        </View>

        {/* On its way */}
        {inFlight.length > 0 && (
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            <SectionHeader
              title="On its way"
              actionLabel="View all"
              onAction={() => router.push('/(app)/activity')}
            />
            {inFlight.slice(0, 3).map((t) => (
              <Pressable
                key={t.id}
                onPress={() =>
                  router.push({ pathname: '/(app)/activity/[id]', params: { id: t.id, from: 'home' } })
                }
              >
                <Card padded={false} style={{ padding: 12 }}>
                  <Row gap={11}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radius.xs,
                        backgroundColor: colors.pendingSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <QuickIcon name="send" color={colors.pending} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body size={13.5} tone="ink" weight="600" numberOfLines={1}>
                        {t.recipient.name}
                      </Body>
                      <View style={{ marginTop: 3 }}>
                        <StatusPill status={t.status} compact />
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Body size={13.5} tone="ink" weight="700" numbers>
                        −{formatMoney(t.amount, t.sendCurrency)}
                      </Body>
                      {t.receiveAmount && (
                        <Body size={11} tone="faint" numbers>
                          {formatMoney(t.receiveAmount, t.receiveCurrency)}
                        </Body>
                      )}
                    </View>
                  </Row>
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {/* Send again */}
        <View style={{ gap: 10 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <SectionHeader
              title="Send again"
              actionLabel={recipients.length > 0 ? `All ${recipients.length}` : 'Add someone'}
              onAction={() => router.push('/(app)/recipients')}
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
          >
            {recipients.slice(0, 8).map((r) => (
              <Pressable
                key={r.id}
                onPress={() =>
                  router.push({ pathname: '/(app)/send/amount', params: { recipientId: r.id } })
                }
                style={({ pressed }) => ({
                  alignItems: 'center',
                  width: 52,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Avatar name={r.name} size={44} />
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 10.5, color: colors.inkMuted, marginTop: 6, fontWeight: '600' }}
                >
                  {r.name.split(' ')[0]}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => router.push({ pathname: '/(app)/recipients/new', params: { from: 'home' } })}
              accessibilityRole="button"
              accessibilityLabel="Add a recipient"
              style={({ pressed }) => ({
                alignItems: 'center',
                width: 52,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: colors.lineStrong,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20, color: colors.inkFaint, marginTop: -2 }}>+</Text>
              </View>
              <Text
                style={{ fontSize: 10.5, color: colors.inkMuted, marginTop: 6, fontWeight: '600' }}
              >
                New
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
