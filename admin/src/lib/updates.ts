import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Desktop auto-update.
 *
 * Why a panel that moves money needs this more than most
 * ─────────────────────────────────────────────────────
 * A web app is whatever the server last served. A desktop app is whatever each
 * machine last installed, which means an operations workstation can sit on a
 * build from six months ago and nobody finds out until it does something wrong.
 * The point of shipping desktop is the OS credential store; the cost is that
 * retiring an old build stops being automatic. This is how that cost is paid.
 *
 * Why nothing installs itself
 * ───────────────────────────
 * Installing restarts the app. Somebody may be halfway through a customer call
 * with a transfer open, or partway through a form that demands a reason for the
 * audit log. So the check runs quietly and the install is a decision — the same
 * rule as the phone, for the same reason.
 *
 * Signature, and what it is not
 * ─────────────────────────────
 * The plugin verifies a minisign signature against the public key in
 * tauri.conf.json before it will install anything, so a compromised CDN cannot
 * push code into the back office. That is a different guarantee from an OS
 * code-signing certificate, which is what stops Windows SmartScreen warning the
 * person during the install. Both are needed; neither substitutes for the other.
 *
 * Unconfigured is a supported state
 * ─────────────────────────────────
 * Until the public key and the release endpoint are set, `check()` throws, and
 * every failure here is swallowed unless the person asked. A panel that nags
 * about a broken updater on every launch teaches its users to ignore it.
 */

/** Six hours. This is a workstation left open all day, not a phone. */
const RECHECK_MS = 6 * 60 * 60 * 1000;

type UpdateHandle = Awaited<
  ReturnType<(typeof import('@tauri-apps/plugin-updater'))['check']>
>;

export interface DesktopUpdate {
  /** Null while unknown, or when there is nothing to install. */
  available: { version: string; notes?: string } | null;
  checking: boolean;
  installing: boolean;
  /** 0–1 while downloading, null otherwise. */
  progress: number | null;
  error: string | null;
  /** False in a browser tab — the whole feature only exists in the shell. */
  supported: boolean;
  check: () => Promise<void>;
  install: () => Promise<void>;
}

/** True only inside the Tauri shell. In a plain browser there is nothing to
 *  update: the page is whatever the server just served. */
function inDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useDesktopUpdate(): DesktopUpdate {
  const supported = inDesktopShell();
  const [available, setAvailable] = useState<DesktopUpdate['available']>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Held so `install()` uses the very object `check()` verified, rather than
  // re-fetching and installing something that changed in between.
  const pending = useRef<UpdateHandle>(null);

  const check = useCallback(
    async (manual = true) => {
      if (!supported) return;
      setChecking(true);
      if (manual) setError(null);
      try {
        // Imported lazily so a browser build never pulls the plugin in at all.
        const { check: checkForUpdate } = await import('@tauri-apps/plugin-updater');
        const update = await checkForUpdate();
        pending.current = update;
        setAvailable(update ? { version: update.version, notes: update.body } : null);
      } catch (err) {
        if (manual) {
          setError(err instanceof Error ? err.message : 'Could not check for updates.');
        }
      } finally {
        setChecking(false);
      }
    },
    [supported],
  );

  useEffect(() => {
    if (!supported) return;
    // The lint rule wants effects to synchronize with an external system rather
    // than set state — which is exactly what this does: the external system is
    // the release endpoint, and there is no render-time way to know what it
    // holds. The first check runs on mount so a panel opened once a week still
    // learns about a release without anybody pressing anything.
    // oxlint-disable-next-line react/set-state-in-effect
    void check(false);
    const id = setInterval(() => void check(false), RECHECK_MS);
    return () => clearInterval(id);
  }, [supported, check]);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update) return;
    setInstalling(true);
    setError(null);
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
          setProgress(0);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setProgress(total ? downloaded / total : null);
        } else if (event.event === 'Finished') {
          setProgress(1);
        }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The update could not be installed.');
      setInstalling(false);
      setProgress(null);
    }
  }, []);

  return {
    available,
    checking,
    installing,
    progress,
    error,
    supported,
    check: () => check(true),
    install,
  };
}
