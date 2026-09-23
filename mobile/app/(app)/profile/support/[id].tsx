import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../../components/BackBar';
import { Body, Button, Card, Empty, Loader, Note, Row, Screen, Title } from '../../../../components/ui';
import api, { errorMessage } from '../../../../lib/api';
import { dateTimeOf, relativeTime } from '../../../../lib/format';
import type { SupportTicket } from '../../../../lib/types';
import { useTheme } from '../../../../theme/tokens';

function label(status: SupportTicket['status']) { return status === 'in_progress' ? 'In progress' : status === 'resolved' ? 'Resolved' : 'Open'; }

export default function SupportThread() {
  const { colors } = useTheme(); const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const [ticket, setTicket] = useState<SupportTicket | null | undefined>(undefined);
  const [reply, setReply] = useState(''); const [error, setError] = useState(''); const [sending, setSending] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { if (!id) { setTicket(null); return; } try { const { data } = await api.get<SupportTicket>(`/support/tickets/${id}`); setTicket(data); } catch { setTicket(null); } }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async () => { if (!id || !reply.trim()) return; setSending(true); setError(''); try { const { data } = await api.post<SupportTicket>(`/support/tickets/${id}/messages`, { body: reply.trim() }); setTicket(data); setReply(''); } catch (issue) { setError(errorMessage(issue, 'Your reply could not be sent.')); } finally { setSending(false); } };
  const back = () => router.replace(from === 'notifications' ? '/(app)/notifications' : '/(app)/profile/support');
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
    <BackBar title="Support request" onBack={back} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {ticket === undefined ? <Loader label="Loading conversation…" /> : ticket === null ? <Card><Empty title="Request unavailable" body="It may no longer be accessible from this account." action={<Button label="Back to Help & support" variant="outline" onPress={back} />}/></Card> : <View style={{ gap: 14 }}>
          <Card><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1, paddingRight: 8 }}><Title size={18}>{ticket.subject}</Title><Body size={12.5} tone="faint" style={{ marginTop: 4 }}>{ticket.category.name} · updated {relativeTime(ticket.lastActivityAt)}</Body></View><View style={{ backgroundColor: ticket.status === 'resolved' ? colors.successSoft : colors.pendingSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}><Body size={11} tone={ticket.status === 'resolved' ? 'accent' : 'pending'} weight="600">{label(ticket.status)}</Body></View></Row>{ticket.transfer ? <Body size={12} tone="muted" style={{ marginTop: 10 }}>Linked transfer: {ticket.transfer.recipientName} · {ticket.transfer.sendAmount} {ticket.transfer.sendCurrency}</Body> : null}</Card>
          {error ? <Note>{error}</Note> : null}
          <View style={{ gap: 9 }}>{ticket.messages?.map((message) => { const mine = message.sender === 'customer'; return <View key={message.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}><View style={{ maxWidth: '88%', backgroundColor: mine ? colors.accent : colors.card, borderWidth: mine ? 0 : 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}><Body size={11} tone={mine ? 'onSlabMuted' : 'faint'} weight="600">{mine ? 'You' : 'Support'}</Body><Body size={13.5} tone={mine ? 'onSlab' : 'ink'} style={{ marginTop: 3, lineHeight: 20 }}>{message.body}</Body><Body size={10.5} tone={mine ? 'onSlabMuted' : 'faint'} style={{ marginTop: 5 }}>{dateTimeOf(message.createdAt)}</Body></View></View>; })}</View>
          <Card style={{ marginTop: 4 }}><Title size={17}>{ticket.status === 'resolved' ? 'Still need help?' : 'Reply to support'}</Title><Body size={12.5} tone="muted" style={{ marginTop: 4 }}>{ticket.status === 'resolved' ? 'Replying will reopen this same request for the support team.' : 'Your reply is added to this request.'}</Body><TextInput value={reply} onChangeText={setReply} multiline maxLength={2000} placeholder="Write your reply" placeholderTextColor={colors.inkFaint} textAlignVertical="top" style={{ minHeight: 96, marginTop: 12, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: 12, backgroundColor: colors.card, color: colors.ink, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 }} /><Body size={11} tone="faint" style={{ marginTop: 4 }}>{reply.length}/2,000</Body><View style={{ marginTop: 12 }}><Button label={ticket.status === 'resolved' ? 'Reply & reopen request' : 'Send reply'} onPress={submit} loading={sending} disabled={!reply.trim()} /></View></Card>
        </View>}
      </Screen>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
