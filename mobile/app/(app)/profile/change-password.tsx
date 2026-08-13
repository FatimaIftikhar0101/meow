import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackBar } from '../../../components/BackBar';
import { Body, Button, Field, Note, Row, Screen, Title } from '../../../components/ui';
import api, { errorMessage } from '../../../lib/api';
import { setToken } from '../../../lib/auth-store';
import { colors } from '../../../theme/tokens';

const RULES = [
  { label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { label: 'A lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'An uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /[0-9]/.test(p) },
];

export default function ChangePassword() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const unmet = RULES.filter((r) => !r.test(newPassword));

  const submit = async () => {
    if (unmet.length) return setError('The new password does not meet the requirements yet.');
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post<{ access_token?: string }>('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      // Changing the password revokes every session, including this one — the
      // backend issues a fresh token for this device. Storing it is what keeps
      // the user signed in here instead of being bounced to the login screen.
      if (data?.access_token) await setToken(data.access_token);
      router.back();
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top']}>
      <BackBar title="Change password" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Screen>
          <View style={{ gap: 16 }}>
            <View>
              <Title size={22}>Choose a new password</Title>
              <Body size={13} style={{ marginTop: 4 }}>
                Every other device is signed out when you do this. This phone stays signed in.
              </Body>
            </View>

            {error ? <Note>{error}</Note> : null}

            <Field
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
            />
            <Field
              label="New password"
              value={newPassword}
              onChangeText={setNext}
              secureTextEntry
              autoComplete="new-password"
            />

            {newPassword.length > 0 && unmet.length > 0 && (
              <View style={{ gap: 4, marginTop: -6 }}>
                {RULES.map((r) => {
                  const ok = r.test(newPassword);
                  return (
                    <Row key={r.label} gap={7}>
                      <Body size={12} tone={ok ? 'accent' : 'faint'}>
                        {ok ? '✓' : '○'}
                      </Body>
                      <Body size={12} tone={ok ? 'accent' : 'faint'}>
                        {r.label}
                      </Body>
                    </Row>
                  );
                })}
              </View>
            )}

            <Button label="Change password" onPress={submit} loading={busy} />
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
