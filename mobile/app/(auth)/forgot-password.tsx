import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Button, Field, Note, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';

/**
 * Step one of two. Asks for the address, then hands straight over to the screen
 * that accepts the code.
 *
 * It used to end here with "a reset link is on its way", which was wrong twice
 * over: the server sends a six-digit code rather than a link, and there was no
 * screen anywhere in the app that would accept one. Somebody following this
 * flow to the letter ended up holding a valid code and staring at a sign-in
 * form.
 *
 * The response is deliberately identical whether or not the address is
 * registered — this endpoint must not answer "does this person bank here?" — so
 * the handover happens regardless of what came back.
 */
export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return setError('Enter your email address.');
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      router.push({ pathname: '/(auth)/reset-password', params: { email: email.trim() } });
    } catch (err) {
      // Only a network or rate-limit failure reaches here; an unknown address
      // returns 200 like any other.
      setError(errorMessage(err, 'Could not send the code. Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackBar title="Reset password" />
      <Screen>
        <View style={{ gap: 18, paddingTop: 8 }}>
          <View>
            <Title size={26}>Forgot your password?</Title>
            <Body size={14} style={{ marginTop: 5 }}>
              We&apos;ll email you a six-digit code to set a new one.
            </Body>
          </View>

          {error ? <Note>{error}</Note> : null}
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            textContentType="emailAddress"
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Button label="Send me a code" onPress={submit} loading={busy} />

          <Note tone="info">
            Already have a code? Continue on the next screen — it accepts one you were sent
            earlier, as long as it has not expired.
          </Note>
          <Button
            label="I already have a code"
            variant="ghost"
            onPress={() =>
              router.push({
                pathname: '/(auth)/reset-password',
                params: email.trim() ? { email: email.trim() } : {},
              })
            }
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
