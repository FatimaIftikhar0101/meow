import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Field, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { destinationCountries, useCorridors } from '../../../lib/corridors';
import { countryFlag } from '../../../lib/money';
import { colors, radius } from '../../../theme/tokens';

const COUNTRY_NAME: Record<string, string> = {
  PK: 'Pakistan',
  IN: 'India',
  PH: 'Philippines',
};

export default function NewRecipient() {
  const router = useRouter();
  const { corridors } = useCorridors();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Offered countries come from the corridor table, so a corridor added on the
  // backend appears here without a client release.
  // Memoised so the default-selection effect below does not re-run on every
  // render against a freshly-built array.
  const options = useMemo(() => destinationCountries(corridors), [corridors]);
  useEffect(() => {
    if (!country && options.length > 0) setCountry(options[0]);
  }, [country, options]);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Enter the recipient’s full name.');
    if (!country) return setError('Pick a destination country.');
    if (bankAccount.trim().length < 4) return setError('Enter a valid account number.');

    setError('');
    setBusy(true);
    try {
      await api.post('/recipients', {
        name: name.trim(),
        country,
        bankAccount: bankAccount.replace(/\s+/g, ''),
        ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      router.back();
    } catch (err) {
      setError(errorMessage(err, 'Could not save this recipient.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="New recipient" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 16 }}>
            <View>
              <Title size={24}>Who are you sending to?</Title>
              <Body size={13.5} style={{ marginTop: 4 }}>
                Their name must match the bank account exactly, or the payout will be rejected.
              </Body>
            </View>

            {error ? <Note>{error}</Note> : null}

            <Field
              label="Full name"
              value={name}
              onChangeText={setName}
              placeholder="Ayesha Khan"
              autoCapitalize="words"
            />

            <View style={{ gap: 7 }}>
              <Body size={12} tone="ink" weight="600">
                Destination
              </Body>
              <Row gap={8}>
                {options.map((c) => {
                  const on = c === country;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCountry(c)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 7,
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: on ? colors.accent : colors.lineStrong,
                        backgroundColor: on ? colors.accentSoft : colors.card,
                      }}
                    >
                      <Body size={15}>{countryFlag(c)}</Body>
                      <Body size={13} tone={on ? 'accent' : 'muted'} weight="600">
                        {COUNTRY_NAME[c] ?? c}
                      </Body>
                    </Pressable>
                  );
                })}
              </Row>
            </View>

            <Field
              label="Account number / IBAN"
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="PK36SCBL0000001123456702"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Field
              label="Bank name (optional)"
              value={bankName}
              onChangeText={setBankName}
              placeholder="Habib Bank Limited"
            />
            <Field
              label="Phone (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+92 300 1234567"
              hint="Used only if the payout partner needs to reach them."
            />

            <Button label="Save recipient" onPress={submit} loading={busy} />
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
