import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Card, Divider, Field, Loader, Note, Row, Screen, Title } from '../../../components/ui';
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
  // Suspending an account and overriding identity verification both record a
  // reason against the customer for as long as the audit trail is retained.
  // Alert.prompt is iOS-only, so this is a field on the screen rather than a
  // dialog — and it is required rather than defaulted, because a canned string
  // like "Manual override by admin" is the same as recording nothing.
  const [reason, setReason] = useState('');
  const trimmedReason = reason.trim();
  const reasonReady = trimmedReason.length >= 3;

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
              await api.post(`/admin/users/${id}/${next ? 'suspend' : 'unsuspend'}`, {
                reason: trimmedReason,
              });
              setReason('');
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
                reason: trimmedReason,
              });
              setReason('');
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="User" />
      <Screen>
        <View style={{ gap: 15 }}>
          <View>
            <Title size={21} numberOfLines={1}>
              {user.email}
            </Title>
            <Row gap={7} style={{ marginTop: 5 }}>
              {user.role === 'admin' && <Tag label="Admin" tone="accent" />}
              {user.suspended ? (
                <Tag label="Suspended" tone="danger" />
              ) : (
                <Tag label="Active" tone="accent" />
              )}
              <Body size={12} tone="faint">
                {user.country ?? '—'} · {user.transferCount} transfers
              </Body>
            </Row>
          </View>

          {error ? <Note>{error}</Note> : null}

          <Card>
            <Body size={11} tone="faint" weight="600" style={{ marginBottom: 8 }}>
              BALANCES
            </Body>
            {user.balances.length === 0 ? (
              <Body size={13} tone="faint">
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
            <Body size={11} tone="faint" weight="600" style={{ marginBottom: 8 }}>
              KYC
            </Body>
            {latestKyc ? (
              <View style={{ gap: 3 }}>
                <Body
                  size={14}
                  weight="700"
                  tone={
                    latestKyc.status === 'passed'
                      ? 'accent'
                      : latestKyc.status === 'failed'
                        ? 'danger'
                        : 'pending'
                  }
                >
                  {latestKyc.status.toUpperCase()}
                </Body>
                <Body size={12} tone="faint">
                  {latestKyc.provider ?? 'unknown provider'} · {dateTimeOf(latestKyc.createdAt)}
                  {latestKyc.reason ? ` · ${latestKyc.reason}` : ''}
                </Body>
              </View>
            ) : (
              <Body size={13} tone="faint">
                No KYC record on file.
              </Body>
            )}
            <Row gap={9} style={{ marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Mark passed"
                  compact
                  variant="outline"
                  disabled={!reasonReady}
                  onPress={() => overrideKyc('passed')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Mark failed"
                  compact
                  variant="danger"
                  disabled={!reasonReady}
                  onPress={() => overrideKyc('failed')}
                />
              </View>
            </Row>
          </Card>

          <Card>
            <Field
              label="Reason"
              hint="Required. Kept in the audit log against this account."
              placeholder="Why are you taking this action?"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={200}
            />
          </Card>

          <Button
            label={user.suspended ? 'Reinstate account' : 'Suspend account'}
            variant={user.suspended ? 'outline' : 'danger'}
            loading={busy}
            disabled={!reasonReady}
            onPress={toggleSuspend}
          />
          {user.role === 'admin' && (
            <Body size={11.5} tone="faint" style={{ textAlign: 'center' }}>
              Admin accounts cannot be suspended — the backend refuses it.
            </Body>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
