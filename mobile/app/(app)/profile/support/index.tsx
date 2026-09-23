import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../../components/BackBar';
import { Body, Card, Divider, Empty, Loader, Row, Screen, Title } from '../../../../components/ui';
import api from '../../../../lib/api';
import { relativeTime } from '../../../../lib/format';
import type { SupportCategory, SupportTicket } from '../../../../lib/types';
import { useTheme } from '../../../../theme/tokens';

function statusLabel(status: SupportTicket['status']) {
  return status === 'in_progress' ? 'In progress' : status === 'resolved' ? 'Resolved' : 'Open';
}

export default function SupportHome() {
  const { colors } = useTheme();
  const router = useRouter();
  const [categories, setCategories] = useState<SupportCategory[] | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setFailed(false);
    const [help, mine] = await Promise.allSettled([
      api.get<SupportCategory[]>('/support/help'),
      api.get<SupportTicket[]>('/support/tickets'),
    ]);
    if (help.status === 'fulfilled') setCategories(help.value.data); else setCategories([]);
    if (mine.status === 'fulfilled') setTickets(mine.value.data); else setTickets([]);
    if (help.status === 'rejected' && mine.status === 'rejected') setFailed(true);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
    <BackBar title="Help & support" onBack={() => router.replace('/(app)/profile')} />
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={{ gap: 16 }}>
        <View>
          <Title size={22}>How can we help?</Title>
          <Body size={13.5} tone="muted" style={{ marginTop: 4 }}>Start with an answer below. If it does not solve the issue, you can contact support from that topic.</Body>
        </View>
        {failed ? <Card><Empty title="Could not load help" body="Check your connection and pull down to try again." /></Card> : categories === null ? <Loader label="Loading help…" /> : categories.length === 0 ? <Card><Empty title="Help is being prepared" body="Please check back shortly." /></Card> : <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {categories.map((category, index) => <React.Fragment key={category.id}><Pressable accessibilityRole="button" accessibilityLabel={`${category.name}, ${category.faqs.length} answers`} onPress={() => router.push({ pathname: '/(app)/profile/support/category', params: { categoryId: category.id } })} style={({ pressed }) => ({ minHeight: 54, justifyContent: 'center', opacity: pressed ? 0.62 : 1 })}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1, paddingRight: 10 }}><Body size={14} tone="ink" weight="600">{category.name}</Body><Body size={12} tone="faint" style={{ marginTop: 2 }}>{category.description}</Body></View><Body size={12} tone="accent" weight="600">{category.faqs.length} {category.faqs.length === 1 ? 'answer' : 'answers'} ›</Body></Row></Pressable>{index < categories.length - 1 ? <Divider /> : null}</React.Fragment>)}
        </Card>}
        <View style={{ marginTop: 4 }}><Title size={18}>Your requests</Title><Body size={12.5} tone="faint" style={{ marginTop: 3 }}>See every conversation you have started with support.</Body></View>
        {tickets === null ? <Loader label="Loading requests…" /> : tickets.length === 0 ? <Card><Empty title="No support requests yet" body="Choose a help topic above to find answers or contact support." /></Card> : <View style={{ gap: 9 }}>{tickets.map((ticket) => <Pressable key={ticket.id} accessibilityRole="button" accessibilityLabel={`${ticket.subject}, ${statusLabel(ticket.status)}`} onPress={() => router.push({ pathname: '/(app)/profile/support/[id]', params: { id: ticket.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}><Card><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1, paddingRight: 8 }}><Body size={14} tone="ink" weight="600" numberOfLines={1}>{ticket.subject}</Body><Body size={12} tone="faint" style={{ marginTop: 3 }}>{ticket.category.name} · {relativeTime(ticket.lastActivityAt)}</Body></View><View style={{ backgroundColor: ticket.status === 'resolved' ? colors.successSoft : colors.pendingSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Body size={11} tone={ticket.status === 'resolved' ? 'accent' : 'pending'} weight="600">{statusLabel(ticket.status)}</Body></View></Row></Card></Pressable>)}</View>}
      </View>
    </Screen>
  </SafeAreaView>;
}
