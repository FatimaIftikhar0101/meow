import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Avatar } from '../../../components/StatusPill';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  Loader,
  Note,
  Row,
  Screen,
  Title,
} from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { countryFlag } from '../../../lib/money';
import type { Recipient } from '../../../lib/types';
import { colors } from '../../../theme/tokens';

export default function RecipientDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // There is no GET /recipients/:id, so the one list call feeds this screen.
    // The list is small and already cached client-side by the previous screen.
    api
      .get<Recipient[]>('/recipients')
      .then(({ data }) => {
        const found = data.find((r) => r.id === id) ?? null;
        setRecipient(found);
        if (found) {
          setName(found.name);
          setBankName(found.bankName ?? '');
          setPhone(found.phone ?? '');
        }
      })
      .catch(() => setError('Could not load this recipient.'));
  }, [id]);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.patch(`/recipients/${id}`, {
        name: name.trim(),
        bankName: bankName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      router.back();
    } catch (err) {
      setError(errorMessage(err, 'Could not save your changes.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert(
      'Remove recipient?',
      `${recipient?.name ?? 'This person'} will no longer appear when you send. Transfers already sent to them are unaffected.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/recipients/${id}`);
              router.back();
            } catch (err) {
              setError(errorMessage(err, 'Could not remove this recipient.'));
            }
          },
        },
      ],
    );
  };

  if (!recipient) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <BackBar title="Recipient" />
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <BackBar title="Recipient" />
      <Screen>
        <View style={{ gap: 16 }}>
          <Row gap={13}>
            <Avatar name={recipient.name} size={54} />
            <View style={{ flex: 1 }}>
              <Title size={21}>{recipient.name}</Title>
              <Body size={13} tone="ink3">
                {countryFlag(recipient.country)} {recipient.country}
              </Body>
            </View>
          </Row>

          <Button
            label="Send money"
            variant="mint"
            onPress={() =>
              router.push({ pathname: '/(app)/send/amount', params: { recipientId: recipient.id } })
            }
          />

          {error ? <Note>{error}</Note> : null}

          <Card>
            <Body size={11} tone="ink3" weight="600">
              ACCOUNT
            </Body>
            <Body size={15} tone="ink" weight="600" numbers style={{ marginTop: 3 }}>
              {recipient.bankAccount}
            </Body>
            <View style={{ marginVertical: 12 }}>
              <Divider />
            </View>
            <Body size={12} tone="ink3">
              The account number cannot be edited — a payout to a changed account would be a
              different transfer. Remove this recipient and add them again instead.
            </Body>
          </Card>

          <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Bank name" value={bankName} onChangeText={setBankName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <Button label="Save changes" onPress={save} loading={busy} />
          <Button label="Remove recipient" variant="danger" onPress={remove} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
