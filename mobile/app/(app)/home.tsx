import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CorridorCard } from '../../components/CorridorCard';
import { GreetingHero, heroBaseColor } from '../../components/GreetingHero';
import { Avatar, StatusPill } from '../../components/StatusPill';
import { Body, Card, Note, Row, Title } from '../../components/ui';
import api from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { corridorFor, useCorridors } from '../../lib/corridors';
import { dayPartFor, timeOf } from '../../lib/format';
import { formatAmount, formatMoney } from '../../lib/money';
import { useTransferStatus } from '../../lib/sockets';
import type {
  Balance,
  ComplianceStatus,
  Recipient,
  TransferSummary,
} from '../../lib/types';
import { colors, radius } from '../../theme/tokens';

const IN_FLIGHT = ['initiated', 'payment_received', 'compliance_check', 'fx_converted', 'payout_processing'];

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
 * Icon tiles rather than cards. In the first pass each action was a bordered
 * card, which left 48.8px of usable width inside its padding and wrapped
 * "Add money" onto two lines. Dropping the chrome hands the label the full
 * column. Send is mint, not black: the corridor card above is already a black
 * slab, and a second one directly beneath it read as one object.
 */
function QuickActions() {
  const router = useRouter();
  const items = [
    { key: 'send', label: 'Send', icon: 'send' as const, hero: true, go: () => router.push('/(app)/send') },
    { key: 'add', label: 'Add money', icon: 'add' as const, hero: false, go: () => router.push('/(app)/wallet/fund') },
    { key: 'people', label: 'People', icon: 'people' as const, hero: false, go: () => router.push('/(app)/recipients') },
    { key: 'alerts', label: 'Activity', icon: 'bell' as const, hero: false, go: () => router.push('/(app)/notifications') },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {items.map((it) => (
        <Pressable
          key={it.key}
          onPress={it.go}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            gap: 7,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: it.hero ? colors.mint : colors.card,
              borderWidth: 1,
              borderColor: it.hero ? colors.mint : colors.line,
            }}
          >
            <QuickIcon name={it.icon} color={colors.ink} />
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { corridors } = useCorridors();

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

  const inFlight = useMemo(
    () => transfers.filter((t) => IN_FLIGHT.includes(t.status)),
    [transfers],
  );
  const lastDelivered = useMemo(
    () => transfers.find((t) => t.status === 'delivered'),
    [transfers],
  );

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

  /**
   * The greeting's second line reports live state rather than a slogan: what
   * the user would otherwise open the app to check.
   */
  const line = useMemo(() => {
    if (kyc && kyc.status !== 'passed') return 'Verify your identity to start sending.';
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
      return `Rates are fresh — ${formatAmount(applied, 2)} to ${corridor.toCountry === 'PK' ? 'Pakistan' : corridor.toCountry === 'IN' ? 'India' : corridor.toCountry}.`;
    }
    return 'Everything delivered. Rest easy.';
  }, [kyc, inFlight, lastDelivered, corridor]);

  return (
    <View style={{ flex: 1, backgroundColor: heroBaseColor(part) }}>
      <StatusBar style={part === 'night' || part === 'evening' ? 'light' : 'dark'} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ paddingTop: insets.top }}>
          <GreetingHero part={part} name={firstName} line={line} />
        </View>

        <View style={{ backgroundColor: colors.paper, paddingTop: 16, gap: 18 }}>
          {kyc && kyc.status !== 'passed' && (
            <View style={{ paddingHorizontal: 16 }}>
              <Pressable onPress={() => router.push('/(app)/profile')}>
                <Note tone="amber">
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

          {/* Send again */}
          <View style={{ gap: 10 }}>
            <View
              style={{
                paddingHorizontal: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Title size={15}>Send again</Title>
              <Pressable onPress={() => router.push('/(app)/recipients')}>
                <Body size={12} tone="mint" weight="600">
                  {recipients.length > 0 ? `All ${recipients.length}` : 'Add someone'}
                </Body>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
            >
              {recipients.slice(0, 8).map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => router.push({ pathname: '/(app)/send/amount', params: { recipientId: r.id } })}
                  style={({ pressed }) => ({ alignItems: 'center', width: 52, opacity: pressed ? 0.6 : 1 })}
                >
                  <Avatar name={r.name} size={44} />
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 10.5, color: colors.ink2, marginTop: 6, fontWeight: '600' }}
                  >
                    {r.name.split(' ')[0]}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => router.push('/(app)/recipients/new')}
                style={({ pressed }) => ({ alignItems: 'center', width: 52, opacity: pressed ? 0.6 : 1 })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: colors.line2,
                    borderStyle: 'dashed',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20, color: colors.ink3, marginTop: -2 }}>+</Text>
                </View>
                <Text style={{ fontSize: 10.5, color: colors.ink2, marginTop: 6, fontWeight: '600' }}>
                  New
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* On its way */}
          {inFlight.length > 0 && (
            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title size={15}>On its way</Title>
                <Pressable onPress={() => router.push('/(app)/activity')}>
                  <Body size={12} tone="mint" weight="600">
                    View all
                  </Body>
                </Pressable>
              </View>
              {inFlight.slice(0, 3).map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push({ pathname: '/(app)/activity/[id]', params: { id: t.id } })}
                >
                  <Card padded={false} style={{ padding: 12 }}>
                    <Row gap={11}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: radius.xs,
                          backgroundColor: colors.amberLo,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <QuickIcon name="send" color={colors.amber} />
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
                          <Body size={11} tone="ink3" numbers>
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
        </View>
      </ScrollView>
    </View>
  );
}
