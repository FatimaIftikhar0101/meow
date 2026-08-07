import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Card, Divider, Loader, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { dateTimeOf } from '../../../lib/format';
import { formatMoney } from '../../../lib/money';
import type { AdminUserDetail } from '../../../lib/types';
import { colors } from '../../../theme/tokens';
import { Tag } from './index';

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<AdminUserDetail>(`/admin/users/${id}`);
      setUser(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load this user.'));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSuspend = () => {
    if (!user) return;
    const next = !user.suspended;
    Alert.alert(
      next ? 'Suspend this account?' : 'Reinstate this account?',
      next
        ? 'They will be signed out of every device and cannot sign in or send until reinstated.'
        : 'They will be able to sign in and send again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Suspend' : 'Reinstate',
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await api.post(`/admin/users/${id}/${next ? 'suspend' : 'unsuspend'}`);
              await load();
            } catch (err) {
              setError(errorMessage(err, 'Could not change the account status.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const overrideKyc = (status: 'passed' | 'failed') => {
    Alert.alert(
      `Override KYC to ${status}?`,
      'This writes a new KYC record attributed to you and is kept in the audit log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Mark ${status}`,
          style: status === 'failed' ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            try {
              await api.post(`/admin/users/${id}/kyc/override`, {
                status,
                reason: `Manual override by admin`,
              });
              await load();
            } catch (err) {
              setError(errorMessage(err, 'Could not override KYC.'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <BackBar title="User" />
        {error ? (
          <View style={{ padding: 16 }}>
            <Note>{error}</Note>
          </View>
        ) : (
          <Loader />
        )}
      </SafeAreaView>
    );
  }

  const latestKyc = user.kycRecords[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="User" />
      <Screen>
        <View style={{ gap: 15 }}>
          <View>
            <Title size={21} numberOfLines={1}>
              {user.email}
            </Title>
            <Row gap={7} style={{ marginTop: 5 }}>
              {user.role === 'admin' && <Tag label="Admin" tone="mint" />}
              {user.suspended ? (
                <Tag label="Suspended" tone="clay" />
              ) : (
                <Tag label="Active" tone="mint" />
              )}
              <Body size={12} tone="ink3">
                {user.country ?? '—'} · {user.transferCount} transfers
              </Body>
            </Row>
          </View>

          {error ? <Note>{error}</Note> : null}

          <Card>
            <Body size={11} tone="ink3" weight="600" style={{ marginBottom: 8 }}>
              BALANCES
            </Body>
            {user.balances.length === 0 ? (
              <Body size={13} tone="ink3">
                No wallets.
              </Body>
            ) : (
              user.balances.map((b, i) => (
                <View key={b.currency}>
                  {i > 0 && (
                    <View style={{ marginVertical: 9 }}>
                      <Divider />
                    </View>
                  )}
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body size={13}>{b.currency}</Body>
                    <Body size={14} tone="ink" weight="700" numbers>
                      {formatMoney(b.balance, b.currency)}
                    </Body>
                  </Row>
                </View>
              ))
            )}
          </Card>

          <Card>
            <Body size={11} tone="ink3" weight="600" style={{ marginBottom: 8 }}>
              KYC
            </Body>
            {latestKyc ? (
              <View style={{ gap: 3 }}>
                <Body
                  size={14}
                  weight="700"
                  tone={
                    latestKyc.status === 'passed'
                      ? 'mint'
                      : latestKyc.status === 'failed'
                        ? 'clay'
                        : 'amber'
                  }
                >
                  {latestKyc.status.toUpperCase()}
                </Body>
                <Body size={12} tone="ink3">
                  {latestKyc.provider ?? 'unknown provider'} · {dateTimeOf(latestKyc.createdAt)}
                  {latestKyc.reason ? ` · ${latestKyc.reason}` : ''}
                </Body>
              </View>
            ) : (
              <Body size={13} tone="ink3">
                No KYC record on file.
              </Body>
            )}
            <Row gap={9} style={{ marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Mark passed"
                  compact
                  variant="outline"
                  onPress={() => overrideKyc('passed')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Mark failed"
                  compact
                  variant="danger"
                  onPress={() => overrideKyc('failed')}
                />
              </View>
            </Row>
          </Card>

          <Button
            label={user.suspended ? 'Reinstate account' : 'Suspend account'}
            variant={user.suspended ? 'outline' : 'danger'}
            loading={busy}
            onPress={toggleSuspend}
          />
          {user.role === 'admin' && (
            <Body size={11.5} tone="ink3" style={{ textAlign: 'center' }}>
              Admin accounts cannot be suspended — the backend refuses it.
            </Body>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
