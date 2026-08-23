import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { CodeInput } from '../../components/CodeInput';
import { Body, Button, Note, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';

/**
 * Confirming the address on file, from the six digits sent to it.
 *
 * Lives inside `(app)` rather than `(auth)` because it is only ever reached by
 * someone already signed in: registration issues a session immediately, and
 * `/auth/resend-verification` needs a token. Verification is a thing you finish
 * from inside the account, not a gate in front of it.
 *
 * Before this screen existed the profile banner posted a resend and said "tap
 * to resend the link" — so tapping it repeatedly produced a stream of codes and
 * no way to use any of them.
 */
export default function VerifyEmail() {
  const router = useRouter();
  const { profile, refresh } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const email = profile?.email ?? '';

  /**
   * Back means the profile, and it has to be said out loud.
   *
   * This screen is a tab route with no tab button, so `router.back()` asks the
   * *tab* navigator to go back and it returns to the first tab — Home. A
   * button labelled "Back to profile" was therefore taking people to the
   * dashboard, and the arrow did the same. Same shape of bug as Wallet; the
   * label here just made it visible.
   */
  const toProfile = React.useCallback(
    () => router.replace('/(app)/profile'),
    [router],
  );

  const submit = async (value: string = code) => {
    if (value.length !== 6) return setError('Enter the six digits from the email.');
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/verify-email', { email, code: value });
      // The profile carries `emailVerified`, and the banner that sent us here
      // reads it — without this the screen behind would still say unverified.
      await refresh();
      toProfile();
    } catch (err) {
      setError(errorMessage(err, 'That code is not valid. Request a new one.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setResending(true);
    try {
      await api.post('/auth/resend-verification');
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send another code. Try again in a moment.'));
    } finally {
      setResending(false);
    }
  };

  if (profile?.emailVerified) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <BackBar title="Verify your email" onBack={toProfile} />
        <Screen>
          <View style={{ gap: 18, paddingTop: 8 }}>
            <Title size={26}>Already verified.</Title>
            <Note tone="success">{email} is confirmed. Nothing more to do here.</Note>
            <Button label="Back to profile" onPress={toProfile} />
          </View>
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackBar title="Verify your email" onBack={toProfile} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 18, paddingTop: 8 }}>
            <View>
              <Title size={26}>Confirm your email.</Title>
              <Body size={14} style={{ marginTop: 5 }}>
                Enter the six digits we sent to {email}. Codes expire in fifteen minutes and work
                once.
              </Body>
            </View>

            {error ? <Note>{error}</Note> : null}
            {sent && !error ? (
              <Note tone="success">A new code is on its way. The previous one no longer works.</Note>
            ) : null}

            <CodeInput
              value={code}
              onChange={setCode}
              autoFocus
              onFilled={submit}
              error={!!error && code.length === 6}
            />

            <Button label="Verify" onPress={() => submit()} loading={busy} />
            <Button
              label={sent ? 'Send another code' : 'I did not get a code'}
              variant="ghost"
              onPress={resend}
              loading={resending}
            />

            <Body size={12} tone="faint" style={{ textAlign: 'center' }}>
              Check the spam folder — Meow sends from a shared address until its own domain is
              set up, and filters treat that as suspicious.
            </Body>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
