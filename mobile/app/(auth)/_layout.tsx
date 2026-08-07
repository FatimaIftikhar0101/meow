import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useAuth } from '../../lib/AuthContext';
import { colors } from '../../theme/tokens';

export default function AuthLayout() {
  const { status } = useAuth();

  // Someone with a live session has no business on the sign-in screens; this
  // also covers the moment right after signing in, before any push happens.
  if (status === 'signedIn') return <Redirect href="/(app)/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
