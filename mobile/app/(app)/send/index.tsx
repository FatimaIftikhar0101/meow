import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Avatar } from '../../../components/StatusPill';
import { Body, Button, Card, Empty, Loader, Note, Row, Screen, Title } from '../../../components/ui';
import api from '../../../lib/api';
import { receiveCurrencyFor, useCorridors } from '../../../lib/corridors';
import { countryFlag } from '../../../lib/money';
import type { ComplianceStatus, Recipient } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

/** Step 1 of 3. Who. */
export default function SendPickRecipient() {
  const router = useRouter();
  const { corridors } = useCorridors();
  const [list, setList] = useState<Recipient[] | null>(null);
  const [kyc, setKyc] = useState<ComplianceStatus | null>(null);

  const load = useCallback(async () => {
    const [r, k] = await Promise.allSettled([
      api.get<Recipient[]>('/recipients'),
      api.get<ComplianceStatus>('/compliance/status'),
    ]);
    setList(r.status === 'fulfilled' ? r.value.data : []);
    if (k.status === 'fulfilled') setKyc(k.value.data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const blocked = kyc !== null && kyc.status !== 'passed';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="Send money" />
      <Screen>
        <View style={{ gap: 14 }}>
          <View>
            <Title size={25}>Who is it for?</Title>
            <Body size={13.5} style={{ marginTop: 4 }}>
              Step 1 of 3.
            </Body>
          </View>

          {blocked && (
            <Pressable onPress={() => router.push('/(app)/profile')}>
              <Note tone="pending">
                Identity verification is required before your first transfer. Tap to complete it —
                it takes seconds.
              </Note>
            </Pressable>
          )}

          {list === null ? (
            <Loader />
          ) : list.length === 0 ? (
            <Empty
              title="No one to send to yet"
              body="Add a recipient with their bank details first."
              action={
                <Button
                  label="Add a recipient"
                  onPress={() => router.push('/(app)/recipients/new')}
                />
              }
            />
          ) : (
            <View style={{ gap: 8 }}>
              {list.map((r) => {
                const currency = receiveCurrencyFor(corridors, r.country);
                const supported = currency !== null;
                return (
                  <Pressable
                    key={r.id}
                    disabled={!supported || blocked}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/send/amount',
                        params: { recipientId: r.id },
                      })
                    }
                    style={{ opacity: supported && !blocked ? 1 : 0.5 }}
                  >
                    <Card padded={false} style={{ padding: 13 }}>
                      <Row gap={12}>
                        <Avatar name={r.name} size={42} />
                        <View style={{ flex: 1 }}>
                          <Body size={14.5} tone="ink" weight="600" numberOfLines={1}>
                            {r.name}
                          </Body>
                          <Body size={12} tone="faint">
                            {countryFlag(r.country)}{' '}
                            {supported
                              ? `Receives ${currency}`
                              : 'No active corridor to this country'}
                          </Body>
                        </View>
                      </Row>
                    </Card>
                  </Pressable>
                );
              })}
              <Button
                label="Add someone new"
                variant="outline"
                onPress={() => router.push('/(app)/recipients/new')}
              />
            </View>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
