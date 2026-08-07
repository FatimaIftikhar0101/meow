import React, { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Button, Field, Note, Screen, Title } from '../../components/ui';
import api, { errorMessage } from '../../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset link.'));
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
              We&apos;ll email you a link to set a new one.
            </Body>
          </View>

          {sent ? (
            <Note tone="mint">
              If that email is registered, a reset link is on its way. Open it on this phone and
              follow the link — it expires shortly.
            </Note>
          ) : (
            <>
              {error ? <Note>{error}</Note> : null}
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                onSubmitEditing={submit}
                returnKeyType="send"
              />
              <Button label="Send reset link" onPress={submit} loading={busy} />
            </>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}
