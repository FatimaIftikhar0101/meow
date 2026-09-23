import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../../components/BackBar';
import { Body, Button, Card, Empty, Field, Loader, Note, Row, Screen, Title } from '../../../../components/ui';
import api, { errorMessage } from '../../../../lib/api';
import type { SupportCategory, SupportTicket, TransferSummary } from '../../../../lib/types';
import { useTheme } from '../../../../theme/tokens';

export default function NewSupportRequest() {
  const { colors } = useTheme();
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const [category, setCategory] = useState<SupportCategory | null | undefined>(undefined);
  const [transfers, setTransfers] = useState<TransferSummary[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [transferId, setTransferId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!categoryId) { setCategory(null); return; }
    const [help, activity] = await Promise.allSettled([api.get<SupportCategory[]>('/support/help'), api.get<TransferSummary[]>('/transfers')]);
    setCategory(help.status === 'fulfilled' ? help.value.data.find((item) => item.id === categoryId) ?? null : null);
    if (activity.status === 'fulfilled') setTransfers(activity.value.data.slice(0, 8));
  }, [categoryId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const submit = async () => {
    if (!category) return;
    if (subject.trim().length < 3 || message.trim().length < 10) { setError('Add a short subject and at least 10 characters so support can understand the issue.'); return; }
    setBusy(true); setError('');
    try {
      const { data } = await api.post<SupportTicket>('/support/tickets', { categoryId: category.id, transferId, subject: subject.trim(), body: message.trim() });
      router.replace({ pathname: '/(app)/profile/support/[id]', params: { id: data.id } });
    } catch (issue) { setError(errorMessage(issue, 'Your support request could not be sent.')); } finally { setBusy(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
    <BackBar title="Contact support" onBack={() => router.replace({ pathname: '/(app)/profile/support/category', params: { categoryId: categoryId ?? '' } })} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        {category === undefined ? <Loader label="Preparing your request…" /> : category === null ? <Card><Empty title="Choose a help topic first" body="Support requests need a category so they reach the right team." action={<Button label="Choose a topic" variant="outline" onPress={() => router.replace('/(app)/profile/support')} />}/></Card> : <View style={{ gap: 16 }}>
          <View><Title size={22}>Contact support</Title><Body size={13.5} tone="muted" style={{ marginTop: 4 }}>This request will be sent under <Body size={13.5} tone="ink" weight="600">{category.name}</Body>. Please do not include passwords, card numbers, or verification codes.</Body></View>
          {error ? <Note>{error}</Note> : null}
          <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={120} placeholder="Briefly describe the issue" autoCapitalize="sentences" />
          <View style={{ gap: 6 }}><Body size={12} tone="ink" weight="600">What happened?</Body><TextInput value={message} onChangeText={setMessage} multiline maxLength={2000} placeholder="Include the details that will help us investigate." placeholderTextColor={colors.inkFaint} textAlignVertical="top" style={{ minHeight: 128, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: 12, backgroundColor: colors.card, color: colors.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 }} /><Body size={11} tone="faint">{message.length}/2,000</Body></View>
          <View><Title size={17}>Link a recent transfer <Body size={12} tone="faint" weight="400">(optional)</Body></Title><Body size={12.5} tone="muted" style={{ marginTop: 3 }}>It lets support find the relevant transfer more quickly.</Body><View style={{ gap: 8, marginTop: 10 }}>{transfers.length === 0 ? <Body size={12.5} tone="faint">No recent transfers available to link.</Body> : transfers.map((transfer) => { const selected = transferId === transfer.id; return <Pressable key={transfer.id} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${selected ? 'Remove' : 'Link'} transfer to ${transfer.recipient.name}`} onPress={() => setTransferId((current) => current === transfer.id ? undefined : transfer.id)} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: selected ? colors.accent : colors.line, borderRadius: 10, backgroundColor: selected ? colors.accentSoft : colors.card, opacity: pressed ? 0.68 : 1 })}><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Body size={13.5} tone="ink" weight="600">{transfer.recipient.name} · {transfer.amount} {transfer.sendCurrency}</Body><Body size={11.5} tone="faint" style={{ marginTop: 2 }}>{transfer.recipient.country} · {transfer.status.replaceAll('_', ' ')}</Body></View><Body size={12} tone={selected ? 'accent' : 'faint'} weight="600">{selected ? 'Linked' : 'Link'}</Body></Row></Pressable>; })}</View></View>
          <Button label="Send support request" onPress={submit} loading={busy} disabled={!subject.trim() || !message.trim()} />
        </View>}
      </Screen>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
