import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Scheme = 'light' | 'dark';
export type ThemePreference = Scheme | 'system';

/** Shared with the inline script in index.html — see the note there. */
export const THEME_KEY = 'meow.admin.theme';

interface ThemeValue {
  /** The scheme actually rendered, which is what <html data-theme> carries. */
  scheme: Scheme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue>({
  scheme: 'light',
  preference: 'system',
  setPreference: () => {},
});

function systemScheme(): Scheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): ThemePreference {
  const raw = localStorage.getItem(THEME_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

/**
 * Resolves the preference to a scheme and stamps it on <html>.
 *
 * The CSS knows only two states; the person has three. Doing the resolution
 * here rather than in a `prefers-color-scheme` block means the dark palette is
 * written once, and — more importantly — an explicit choice cannot be
 * overridden by the operating system, which is what a second media-query block
 * would eventually allow through.
 *
 * The preference is stored, never the resolved scheme. Persisting "dark" for
 * someone on `system` would pin them to whichever scheme they happened to be in
 * on the day they first signed in, with no visible setting explaining why.
 *
 * Note this runs *inside* the app, but the initial stamp does not: index.html
 * applies it before the first paint. Without that, a colleague on dark mode
 * gets a full-screen flash of white every time the panel loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStored);
  const [system, setSystem] = useState<Scheme>(systemScheme);

  // The OS scheme can change under a running window — a scheduled switch at
  // sunset, or someone flipping it in settings. A panel left open overnight
  // should follow rather than sit in yesterday's scheme until it is reloaded.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const scheme: Scheme = preference === 'system' ? system : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = scheme;
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    localStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeValue {
  return useContext(ThemeContext);
}
