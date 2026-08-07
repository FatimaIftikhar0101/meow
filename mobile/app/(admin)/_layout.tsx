import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { useAuth } from '../../lib/AuthContext';
import { colors } from '../../theme/tokens';

/**
 * Role gate. The backend's AdminGuard is the real control — every /admin route
 * is guarded server-side — so this is purely so a customer never sees a screen
 * that would only 403 at them.
 */
export default function AdminLayout() {
  const { status, isAdmin } = useAuth();

  if (status !== 'signedIn') return <Redirect href="/(auth)/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/home" />;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}
    />
  );
}
