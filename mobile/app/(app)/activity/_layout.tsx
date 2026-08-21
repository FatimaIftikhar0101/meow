import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../../../theme/tokens';

export default function ActivityLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}
