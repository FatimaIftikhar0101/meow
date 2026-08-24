import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import {
  Body,
  Button,
  Field,
  Note,
  PasswordChecklist,
  Screen,
  Title,
} from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { unmetRules } from '../../lib/password';
import { radius, useTheme } from '../../theme/tokens';
import { LIMITS } from '../../lib/limits';

export default function Register() {
  const { colors } = useTheme();
  const router = useRouter();
  const { register } = useAuth();
  const params = useLocalSearchParams<{ ref?: string }>();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('CA');
  const [referralCode, setReferralCode] = useState((params.ref ?? '').toUpperCase());
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /* Validate the referral code as it is typed, so an invalid one is caught
     before sign-up rather than silently dropped by the backend. */
  useEffect(() => {
    const code = referralCode.trim();
    if (code.length < 4) {
      setRefValid(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get<{ valid: boolean }>('/referrals/check', {
          params: { code },
        });
        setRefValid(data.valid);
      } catch {
        setRefValid(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [referralCode]);

  const unmet = unmetRules(password);

  const submit = async () => {
    if (fullName.trim().length < 2) return setError('Enter your full name.');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (unmet.length) return setError('Your password does not meet the requirements yet.');

    setError('');
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        country: country.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackBar title="Create an account" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 16, paddingTop: 4 }}>
            <View>
              <Title size={26}>Let&apos;s get you set up.</Title>
              <Body size={14} style={{ marginTop: 5 }}>
                Takes about a minute. You can add recipients afterwards.
              </Body>
            </View>

            {refValid === true && (
              <View
                style={{
                  backgroundColor: colors.accentSoft,
                  borderRadius: radius.sm,
                  paddingHorizontal: 13,
                  paddingVertical: 10,
                }}
              >
                <Body size={13} tone="accent" weight="600">
                  🎁 You&apos;ve been invited — your friend earns a reward when your first
                  transfer lands.
                </Body>
              </View>
            )}

            {error ? <Note>{error}</Note> : null}

            <Field
              label="Full name"
              maxLength={LIMITS.fullName}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ayesha Khan"
              autoComplete="name"
              textContentType="name"
            />
            <Field
              label="Email"
              maxLength={LIMITS.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              maxLength={LIMITS.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 10 characters"
              textContentType="newPassword"
            />

            <PasswordChecklist password={password} />

            <Field
              label="Country"
              value={country}
              onChangeText={(t) => setCountry(t.toUpperCase())}
              maxLength={LIMITS.country}
              autoCapitalize="characters"
              hint="Two-letter code. Determines your wallet currency — CA gives you CAD."
            />
            <Field
              label="Referral code (optional)"
              value={referralCode}
              onChangeText={(t) => setReferralCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={LIMITS.referralCode}
              placeholder="MEOW1234"
              error={refValid === false ? 'That code is not valid.' : undefined}
            />

            <Button label="Create account" onPress={submit} loading={busy} />

            <Pressable onPress={() => router.replace('/(auth)/login')}>
              <Body size={13} tone="faint" style={{ textAlign: 'center' }}>
                Already have an account?{' '}
                <Body size={13} tone="accent" weight="600">
                  Log in
                </Body>
              </Body>
            </Pressable>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
