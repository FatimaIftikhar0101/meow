import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { Body, Button, Field, Note, Screen, Title } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { LIMITS } from '../../lib/limits';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  // Prefilled when another flow already knows the address — a completed
  // password reset that could not sign itself in, most often.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // The (auth) layout redirects on `signedIn`, so there is nothing to
      // navigate to here — doing both would push a duplicate route.
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackBar title="Log in" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 18, paddingTop: 8 }}>
            <View>
              <Title size={26}>Welcome back.</Title>
              <Body size={14} style={{ marginTop: 5 }}>
                Your transfers are where you left them.
              </Body>
            </View>

            {error ? <Note>{error}</Note> : null}

            <Field
              label="Email"
              maxLength={LIMITS.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              textContentType="emailAddress"
            />
            <Field
              label="Password"
              maxLength={LIMITS.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••••"
              textContentType="password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            <Button label="Log in" onPress={submit} loading={busy} />

            <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
              <Body size={13} tone="accent" weight="600" style={{ textAlign: 'center' }}>
                Forgot your password?
              </Body>
            </Pressable>

            <Pressable onPress={() => router.replace('/(auth)/register')}>
              <Body size={13} tone="faint" style={{ textAlign: 'center' }}>
                New to Meow? <Body size={13} tone="accent" weight="600">Create an account</Body>
              </Body>
            </Pressable>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
