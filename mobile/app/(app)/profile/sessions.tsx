import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Card, Loader, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { describeUserAgent, dateOf, relativeTime } from '../../../lib/format';
import type { SessionRow } from '../../../lib/types';
import { colors, radius } from '../../../theme/tokens';

export default function Sessions() {
  const [list, setList] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SessionRow[]>('/auth/sessions');
      setList(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your sessions.'));
      setList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const revoke = (s: SessionRow) => {
    Alert.alert(
      'Sign out this device?',
      `${describeUserAgent(s.userAgent)} will be signed out immediately.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/auth/sessions/${s.id}`);
              await load();
            } catch (err) {
              setError(errorMessage(err, 'Could not sign that device out.'));
            }
          },
        },
      ],
    );
  };

  const revokeOthers = () => {
    Alert.alert(
      'Sign out all other devices?',
      'This phone stays signed in. Everything else is signed out at once.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/sessions/revoke-others');
              await load();
            } catch (err) {
              setError(errorMessage(err, 'Could not sign the other devices out.'));
            }
          },
        },
      ],
    );
  };

  const others = list?.filter((s) => !s.current) ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Devices & sessions" />
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={{ gap: 14 }}>
          <View>
            <Title size={22}>Where you&apos;re signed in</Title>
            <Body size={13} style={{ marginTop: 4 }}>
              Each sign-in creates its own session. Signing one out takes effect on that device&apos;s
              very next request.
            </Body>
          </View>

          {error ? <Note>{error}</Note> : null}

          {list === null ? (
            <Loader />
          ) : (
            <View style={{ gap: 9 }}>
              {list.map((s) => (
                <Card key={s.id} padded={false} style={{ padding: 14 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Row gap={7}>
                        <Body size={14} tone="ink" weight="600">
                          {describeUserAgent(s.userAgent)}
                        </Body>
                        {s.current && (
                          <View
                            style={{
                              backgroundColor: colors.mintLo,
                              borderRadius: radius.pill,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                            }}
                          >
                            <Body size={10} tone="mint" weight="700">
                              This device
                            </Body>
                          </View>
                        )}
                      </Row>
                      <Body size={12} tone="ink3">
                        {s.ipAddress ?? 'Unknown IP'} · active {relativeTime(s.lastSeenAt)}
                      </Body>
                      <Body size={11} tone="ink3">
                        Signed in {dateOf(s.createdAt)}
                      </Body>
                    </View>
                    {!s.current && (
                      <Button
                        label="Sign out"
                        compact
                        variant="outline"
                        onPress={() => revoke(s)}
                      />
                    )}
                  </Row>
                </Card>
              ))}

              {others.length > 0 && (
                <Button
                  label={`Sign out all ${others.length} other device${others.length === 1 ? '' : 's'}`}
                  variant="danger"
                  onPress={revokeOthers}
                />
              )}
            </View>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
