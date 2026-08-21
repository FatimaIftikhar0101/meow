import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { schemes, ThemeContext, type SchemeName, type ThemePreference } from './tokens';

const KEY = 'meow.theme';

/**
 * Decides which scheme the app is wearing, and remembers the choice.
 *
 * Three preferences, not two. "System" is the default and is what most people
 * want — the phone already knows whether it is night — but an explicit choice
 * has to be possible, because a person reading a transfer receipt in bright sun
 * does not care what their phone thinks the time is.
 *
 * The stored value is the *preference*, never the resolved scheme. Persisting
 * "dark" for someone who chose "system" would freeze them in whatever scheme
 * they happened to have on the day they first opened the app, and no setting
 * they could see would explain why.
 *
 * Nothing here blocks the first frame. The preference read is asynchronous and
 * the tree renders on the system scheme until it lands, which is the right
 * answer for everyone who never changed it, and a single frame's flicker for
 * everyone who did. Holding the splash screen for a disk read is a worse trade.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(KEY).then((stored) => {
      if (cancelled) return;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    // Applied immediately and persisted in the background: a settings toggle
    // that waits on a disk write feels broken even when it is not.
    setPreferenceState(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const name: SchemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ name, colors: schemes[name], preference, setPreference }),
    [name, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
