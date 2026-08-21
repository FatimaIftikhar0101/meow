import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../theme/tokens';

export default function RecipientsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}
