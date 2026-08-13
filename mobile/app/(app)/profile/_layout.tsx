import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '../../../theme/tokens';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}
    />
  );
}
