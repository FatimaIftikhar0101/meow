import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import { LiveProvider } from '../lib/sockets';
import { ThemeProvider } from '../theme/ThemeProvider';
import { useTheme } from '../theme/tokens';

void SplashScreen.preventAutoHideAsync();

/**
 * Holds the splash screen until the persisted token has been checked, so the
 * app never flashes the welcome screen at someone who is already signed in.
 * Route protection itself lives in the group layouts, not here.
 */
function SplashGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'loading') return null;
  return <>{children}</>;
}

/**
 * Everything below `<ThemeProvider>`, and therefore everything that can read the
 * scheme. Splitting this out of `RootLayout` is not stylistic: a component
 * cannot consume a context it renders itself, so a `useTheme()` call up in
 * `RootLayout` would quietly return the light default forever and the one
 * surface it paints — the ground behind every screen transition — would stay
 * white in dark mode.
 */
function Themed() {
  const { name, colors } = useTheme();
  return (
    <SplashGate>
      {/* The bar's *content* colour, so it is inverted relative to the scheme:
          light glyphs on a dark ground, and the other way round. */}
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </SplashGate>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <LiveProvider>
              <Themed />
            </LiveProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
