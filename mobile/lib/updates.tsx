import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Over-the-air updates, applied on the user's terms.
 *
 * What this can and cannot ship
 * ─────────────────────────────
 * JavaScript and assets, and nothing else. A new native module, a permission,
 * an SDK bump — those still need a store build, and `runtimeVersion` is set to
 * the `fingerprint` policy precisely so that an update built against different
 * native code is never offered to a binary that cannot run it. The failure this
 * prevents is not cosmetic: a JS bundle calling a native method the installed
 * APK does not have crashes on launch, and the person cannot get back out of it.
 *
 * Why nothing reloads by itself
 * ─────────────────────────────
 * `expo-updates` is configured `checkAutomatically: ON_LOAD` with a zero
 * fallback timeout, so the app always starts instantly from the bundle it
 * already has and fetches the new one in the background. A downloaded update
 * then applies on the next cold start on its own.
 *
 * `reloadAsync()` is deliberately never called automatically. This app moves
 * money: somebody is halfway through entering a recipient's account number, or
 * has just pressed Send and is watching for the status to change. Swapping the
 * JS bundle underneath them tears down every screen and every piece of unsaved
 * state. A silent reload would, at best, lose a half-typed form; at worst it
 * would leave someone unsure whether their transfer went through. So the update
 * waits, visibly, and restarting is something they choose.
 *
 * Re-checking on foreground
 * ─────────────────────────
 * `ON_LOAD` fires once, when the app launches. A phone is not restarted for
 * weeks, and Android keeps the process alive for days — without the AppState
 * listener below, someone who never force-quits would sit on an old bundle
 * indefinitely, which is exactly the person a hotfix is usually for.
 */

/** Ten minutes. Long enough not to hammer the CDN when someone is switching
 *  between apps, short enough that a hotfix lands the same working day. */
const RECHECK_MS = 10 * 60 * 1000;

export interface UpdateState {
  /** A new bundle is downloaded and will run after a restart. */
  ready: boolean;
  checking: boolean;
  /** Set when a manual check failed, so the button can say so. */
  error: string | null;
  /** Null when nothing was found on the last manual check. */
  upToDate: boolean | null;
  check: () => Promise<void>;
  restart: () => Promise<void>;
}

export function useAppUpdate(): UpdateState {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState<boolean | null>(null);
  const lastCheck = useRef(0);

  const check = useCallback(async (manual = true) => {
    // False in Expo Go and in a dev client running from Metro, where there is
    // no update channel to check and every call would throw.
    if (!Updates.isEnabled) return;
    setChecking(true);
    if (manual) setError(null);
    try {
      lastCheck.current = Date.now();
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setReady(true);
        setUpToDate(false);
      } else if (manual) {
        setUpToDate(true);
      }
    } catch (err) {
      // Never surfaced unless the person asked. A failed background check is
      // an ordinary consequence of being on a train, and telling someone their
      // banking app "could not update" while they are trying to send money is
      // alarming out of all proportion to what went wrong.
      if (manual) {
        setError(err instanceof Error ? err.message : 'Could not check for updates.');
      }
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check(false);

    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') return;
      if (Date.now() - lastCheck.current < RECHECK_MS) return;
      void check(false);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [check]);

  const restart = useCallback(async () => {
    await Updates.reloadAsync();
  }, []);

  return {
    ready,
    checking,
    error,
    upToDate,
    check: () => check(true),
    restart,
  };
}

/**
 * What build this is, for the support desk.
 *
 * "Which version are you on?" is the first question on any support call, and
 * with OTA updates the store version number no longer answers it — two phones
 * on 1.0.0 can be running different JavaScript. The update id is what actually
 * identifies the code, so it is shown alongside.
 */
export function runningVersion(appVersion: string): string {
  if (!Updates.isEnabled) return `${appVersion} (development)`;
  if (Updates.isEmbeddedLaunch) return `${appVersion} (as installed)`;
  const id = Updates.updateId ? Updates.updateId.slice(0, 8) : 'unknown';
  return `${appVersion} · update ${id}`;
}
