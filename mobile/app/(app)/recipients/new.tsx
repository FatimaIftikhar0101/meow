import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Field, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { destinationCountries, useCorridors } from '../../../lib/corridors';
import { countryFlag } from '../../../lib/money';
import { radius, useTheme } from '../../../theme/tokens';
import { LIMITS } from '../../../lib/limits';

const COUNTRY_NAME: Record<string, string> = {
  PK: 'Pakistan',
  IN: 'India',
  PH: 'Philippines',
};

export default function NewRecipient() {
  const { colors } = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

  /**
   * Leaving, back to wherever this was opened from.
   *
   * This screen is mounted at two routes. Inside the send stack
   * (`/send/new-recipient`) the pop alone is correct and lands on the picker.
   * From the recipients list it is correct too, because that list is this
   * screen's parent. Only the Home dashboard needs the extra step: nothing
   * about "add someone" from Home makes the People tab a place you have been.
   *
   * The pop is unconditional and first — it is the call that was already here.
   * The tab switch is optional, so a failure leaves you on the recipients list
   * rather than stranded on a form for a recipient already saved.
   */
  const leave = React.useCallback(() => {
    router.back();
    if (from === 'home') router.push('/(app)/home');
  }, [router, from]);
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
      leave();
    } catch (err) {
      setError(errorMessage(err, 'Could not save this recipient.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="New recipient" onBack={leave} />
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
              maxLength={LIMITS.recipientName}
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
              maxLength={LIMITS.bankAccount}
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="PK36SCBL0000001123456702"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Field
              label="Bank name (optional)"
              maxLength={LIMITS.bankName}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Habib Bank Limited"
            />
            <Field
              label="Phone (optional)"
              maxLength={LIMITS.phone}
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
