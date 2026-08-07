/**
 * The Meow design tokens, transcribed from the approved design artifact
 * (meow-app-v2.html). That file is the visual contract — when a colour here
 * disagrees with it, the artifact wins.
 *
 * Shaped as `{ light, dark }` even though only `light` is used today. Dark mode
 * is deliberately out of scope for this release; keeping the shape means adding
 * it later is a swap in one file rather than a hunt through every StyleSheet.
 * `dark` is a stub and is not referenced anywhere yet.
 *
 * Contrast note: every ink/surface pairing below was checked against WCAG AA in
 * the artifact (4.5:1 body, 3:1 for text ≥24px). `ink3` on `paper` is the
 * tightest at 4.70 — do not lighten it.
 */

const light = {
  /* Ground and ink */
  paper: '#F1F3EE', // warm ground, biased green rather than cream
  card: '#FFFFFF',
  tint: '#E4EDDF', // soft accent surface
  ink: '#121714', // forest-black — hero surfaces and primary text
  ink2: '#5B635B',
  ink3: '#676E66',
  line: '#E3E6DE',
  line2: '#D2D7CD',

  /* Accent. Mint sits on ink, never carries text on paper — mintInk does. */
  mint: '#A9E6A1',
  mintLo: '#CFF0C9',
  mintInk: '#2C5F33',

  /* Status. Separate from the accent, on purpose. */
  amber: '#7F5C13', // in flight
  amberLo: '#F6EBD2',
  clay: '#A9432D', // failed
  clayLo: '#F6DFD8',

  /* The cat, and nothing else. */
  gold: '#E0B259',

  /* Text that sits on the ink slabs */
  onInk: '#EDF2EA',
  onInk2: '#9BA398',
} as const;

/** Stub. Not wired up — see the note at the top of this file. */
const dark = light;

export const colors = light;
export const palettes = { light, dark };

export type Colors = typeof light;

export const radius = {
  xs: 10,
  sm: 14,
  md: 20,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
} as const;

/**
 * Android renders shadows from `elevation` only — the iOS shadow* props are
 * ignored there. Both are set so the two platforms agree, but on the phone it
 * is `elevation` that does the work.
 */
export const shadow = {
  lift: {
    shadowColor: '#121714',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  liftLg: {
    shadowColor: '#121714',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
} as const;

/**
 * `fontVariant: ['tabular-nums']` on every number that changes in place —
 * balances, rates, the keypad amount — so digits do not jitter as they update.
 */
export const type = {
  display: { fontSize: 44, fontWeight: '700', letterSpacing: -1.4 },
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -0.7 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 13, fontWeight: '400' },
  smallStrong: { fontSize: 13, fontWeight: '600' },
  micro: { fontSize: 11, fontWeight: '600' },
  kicker: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
} as const;
