import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../../components/BackBar';
import { Body, Button, Card, Empty, Loader, Screen, Title } from '../../../../components/ui';
import api from '../../../../lib/api';
import type { SupportCategory } from '../../../../lib/types';
import { useTheme } from '../../../../theme/tokens';

export default function SupportCategoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();
  const [category, setCategory] = useState<SupportCategory | null | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => { try { const { data } = await api.get<SupportCategory[]>('/support/help'); setCategory(data.find((item) => item.id === categoryId) ?? null); } catch { setCategory(null); } }, [categoryId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
    <BackBar title={category?.name ?? 'Help topic'} onBack={() => router.replace('/(app)/profile/support')} />
    <Screen>
      {category === undefined ? <Loader label="Loading answers…" /> : category === null ? <Card><Empty title="This topic is unavailable" body="It may have changed. Return to Help & support to choose another topic." action={<Button label="Back to Help & support" variant="outline" onPress={() => router.replace('/(app)/profile/support')} />}/></Card> : <View style={{ gap: 14 }}>
        <View><Title size={22}>{category.name}</Title><Body size={13.5} tone="muted" style={{ marginTop: 4 }}>{category.description}</Body></View>
        <View style={{ gap: 9 }}>{category.faqs.map((faq) => { const expanded = open === faq.id; return <Card key={faq.id} padded={false}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={faq.question} onPress={() => setOpen((current) => current === faq.id ? null : faq.id)} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 14, paddingVertical: 13, opacity: pressed ? 0.65 : 1 })}><Body size={14} tone="ink" weight="600">{faq.question}</Body><Body size={12} tone="accent" weight="600" style={{ marginTop: 4 }}>{expanded ? 'Hide answer' : 'Show answer'}</Body>{expanded ? <Body size={13} tone="muted" style={{ marginTop: 10, lineHeight: 20 }}>{faq.answer}</Body> : null}</Pressable></Card>; })}</View>
        <Card style={{ marginTop: 6 }}><Title size={17}>Still need help?</Title><Body size={13} tone="muted" style={{ marginTop: 4 }}>Tell us what happened. You can attach one of your recent transfers if it relates to the issue.</Body><View style={{ marginTop: 14 }}><Button label="Contact customer support" onPress={() => router.push({ pathname: '/(app)/profile/support/new', params: { categoryId: category.id } })} /></View></Card>
      </View>}
    </Screen>
  </SafeAreaView>;
}
