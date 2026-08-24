import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../components/BackBar';
import { CodeInput } from '../../components/CodeInput';
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
import { LIMITS } from '../../lib/limits';

/**
 * Where a password reset code is actually spent.
 *
 * The backend stopped emailing links some time ago — a link in an email is a
 * GET that changes state, and mail scanners were fetching them and burning the
 * token before the recipient opened the message. It sends six digits instead.
 * Nothing in the app could accept those six digits, so every customer who
 * tapped "Forgot your password?" received a working code and had nowhere to
 * type it. That is what this screen fixes.
 *
 * `/auth/reset-password` sets the password, marks the address verified, and
 * revokes every existing session in one transaction. So the correct thing to do
 * on success is sign in with the password just chosen — anything else would
 * hand somebody a fresh password and a locked-out screen.
 */
export default function ResetPassword() {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return setError('Enter the email you asked for the code with.');
    if (code.length !== 6) return setError('Enter the six digits from the email.');
    if (unmetRules(password).length) {
      return setError('Your new password does not meet the requirements yet.');
    }
    if (password !== confirm) return setError('Those two passwords are not the same.');

    setError('');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim(),
        code,
        newPassword: password,
      });
    } catch (err) {
      // The server answers the same way for a wrong code, an expired one and an
      // unknown address, on purpose — this endpoint must not become a way to
      // find out who banks here. So the message is passed through as-is.
      setError(errorMessage(err, 'That code is not valid. Request a new one.'));
      setCode('');
      setBusy(false);
      return;
    }

    try {
      await signIn(email.trim(), password);
      // The (auth) layout redirects on `signedIn`; navigating here as well
      // would push a duplicate route on top of it.
    } catch {
      // The password *was* changed — reporting a failure here would be a lie
      // that sends someone back to request another code they do not need.
      setBusy(false);
      router.replace({ pathname: '/(auth)/login', params: { email: email.trim() } });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <BackBar title="Enter your code" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 18, paddingTop: 8 }}>
            <View>
              <Title size={26}>Choose a new password.</Title>
              <Body size={14} style={{ marginTop: 5 }}>
                We sent six digits to {email.trim() || 'your email'}. They expire in fifteen
                minutes and work once.
              </Body>
            </View>

            {error ? <Note>{error}</Note> : null}

            {/* Editable, because the code is scoped to an address and a typo in
                the previous screen is otherwise a dead end with no explanation. */}
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

            <View style={{ gap: 8 }}>
              <Body size={12} tone="ink" weight="600">
                Code from the email
              </Body>
              <CodeInput
                value={code}
                onChange={setCode}
                autoFocus={!!params.email}
                error={!!error && code.length === 6}
              />
            </View>

            <Field
              label="New password"
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
              label="Confirm new password"
              maxLength={LIMITS.password}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Type it again"
              textContentType="newPassword"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            <Button label="Set password and sign in" onPress={submit} loading={busy} />

            <Pressable onPress={() => router.replace('/(auth)/forgot-password')}>
              <Body size={13} tone="faint" style={{ textAlign: 'center' }}>
                Code expired? <Body size={13} tone="accent" weight="600">Send a new one</Body>
              </Body>
            </Pressable>
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
