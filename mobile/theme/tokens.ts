/**
 * Semantic design tokens. Screens and components import from here and never
 * from theme/palette.ts — they ask for a *role* ("the colour of a card", "the
 * colour that means delivered"), not for a colour.
 *
 * Why it is built this way
 * ───────────────────────
 * Revision 2 was rejected for being too green, revision 3 replaced the palette
 * outright, and neither change should have required touching a screen. It did,
 * because the old tokens were named after colours (`mint`, `clay`, `paper`)
 * rather than after jobs. A token called `mint` cannot survive a brand that
 * stops being green.
 *
 * So: `palette.ts` holds the hexes, this file assigns them jobs, and the app
 * uses the jobs. Re-theming is now a two-file edit no matter how many screens
 * exist — swap the scales in palette.ts, re-point the roles below, done.
 *
 * Adding a role is cheap; adding a hex to a screen is not. If a screen needs a
 * colour that isn't here, the fix is a new role, not a literal.
 *
 * Light and dark
 * ──────────────
 * Both schemes are defined and both are real. `colors` is the light scheme,
 * which is what the client approved, and it is a plain object so that every
 * existing `colors.x` call site keeps working without a hook.
 *
 * Dark mode is NOT wired up: nothing renders `schemes.dark` yet. Turning it on
 * is a mechanical change — wrap the tree in `ThemeProvider` and swap
 * `import { colors }` for `const { colors } = useTheme()` in the components that
 * should react. The dark scheme is kept in step with the light one so that work
 * stays mechanical rather than becoming a redesign. See [dark mode] in README.
 */

import { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { brick, earth, gold, grey, neutral, pine, slate } from './palette';

/**
 * Typefaces, as roles.
 *
 * `display` is the serif from the approved direction — headlines and the
 * received amount, the figure the person on the other end cares about. It
 * resolves to whatever serif the platform ships (Noto Serif on Android), which
 * is close to the artifact but not identical. Shipping an exact face means
 * bundling a font file; that decision is still open with the client, and when
 * it lands it changes this one line rather than every screen.
 */
export const fonts = {
  display: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
  /** `undefined` means the platform UI font, which is what body copy wants. */
  body: undefined as string | undefined,
} as const;

/* ── Roles ─────────────────────────────────────────────────────────────── */

export interface Scheme {
  /* Surfaces. There is no "almost white" here — see palette.ts. */
  /** The ground under every screen. */
  canvas: string;
  /** Raised surfaces. Separates from canvas by hairline, never by tint. */
  card: string;
  /** Recessed panels — keypad, read-only summaries, avatars. */
  inset: string;
  /** The one large colour object per screen: the corridor slab. */
  slab: string;
  /** Bottom of the slab's gradient. */
  slabDeep: string;
  /** The dark disc the brand mark sits on. Gold needs it — 1.97:1 on white. */
  roundel: string;

  /* Borders */
  line: string;
  lineStrong: string;

  /* Content */
  /** Primary text and every monetary figure. */
  ink: string;
  /** Secondary text, captions. */
  inkMuted: string;
  /** Placeholders and the quietest labels. */
  inkFaint: string;
  /** Text on `slab`. */
  onSlab: string;
  /** Secondary text on `slab`. */
  onSlabMuted: string;

  /* Action — anything a finger lands on */
  accent: string;
  accentDeep: string;
  /** Soft accent fill: chips, selected states. */
  accentSoft: string;
  /**
   * The client's Slate Blue Grey at full strength. Icons, illustration and
   * inactive tabs only: at 4.38:1 it is not safe for body text, so it is a
   * separate role from `accent` on purpose and must stay that way.
   */
  accentMuted: string;
  onAccent: string;

  /* Status. Solid fills with light text — a pale chip disappears on white. */
  success: string;
  successSoft: string;
  onSuccess: string;
  pending: string;
  pendingSoft: string;
  onPending: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;

  /* Brand. The mark, and only the mark. */
  gold: string;
  goldLight: string;
  goldDeep: string;
  goldPupil: string;
}

/* ── Light: the approved scheme ────────────────────────────────────────── */

const light: Scheme = {
  canvas: neutral[0],
  card: neutral[0],
  inset: slate[50],
  slab: slate[600],
  slabDeep: slate[800],
  roundel: neutral[900],

  line: slate[100],
  lineStrong: slate[200],

  ink: neutral[900],
  inkMuted: grey.muted,
  inkFaint: grey.faint,
  onSlab: neutral[0],
  onSlabMuted: slate[200],

  accent: slate[700],
  accentDeep: slate[800],
  accentSoft: slate[50],
  accentMuted: slate[500],
  onAccent: neutral[0],

  success: pine[500],
  successSoft: pine[100],
  onSuccess: neutral[0],
  pending: earth[500],
  pendingSoft: earth[100],
  onPending: neutral[0],
  danger: brick[500],
  dangerSoft: brick[100],
  onDanger: neutral[0],

  gold: gold.mid,
  goldLight: gold.light,
  goldDeep: gold.deep,
  goldPupil: gold.pupil,
};

/* ── Dark: defined, not yet rendered ───────────────────────────────────── */

const dark: Scheme = {
  canvas: neutral[1000],
  card: '#212729',
  inset: '#1E2325',
  slab: slate[800],
  slabDeep: slate[900],
  // On a dark ground the mark no longer needs rescuing, but keeping a roundel
  // means the lockup is one shape in both schemes rather than two designs.
  roundel: '#2A3237',

  line: '#2C3336',
  lineStrong: '#3C4549',

  ink: '#E8EDEF',
  inkMuted: '#9DAAB1',
  inkFaint: '#7A868C',
  onSlab: neutral[0],
  onSlabMuted: slate[300],

  // Slate inverts: the light tints become the readable ones on a dark ground.
  accent: slate[300],
  accentDeep: slate[200],
  accentSoft: '#263036',
  accentMuted: slate[400],
  onAccent: neutral[1000],

  success: pine[300],
  successSoft: '#1E2A20',
  onSuccess: neutral[1000],
  pending: earth[300],
  pendingSoft: '#2A231C',
  onPending: neutral[1000],
  danger: brick[300],
  dangerSoft: '#2E1D18',
  onDanger: neutral[1000],

  gold: gold.mid,
  goldLight: gold.light,
  goldDeep: gold.deep,
  goldPupil: gold.pupil,
};

export const schemes = { light, dark } as const;
export type SchemeName = keyof typeof schemes;

/** The active scheme. Light, because that is what was approved. */
export const colors = light;

/* ── Hook, for when dark mode is turned on ─────────────────────────────── */

export const ThemeContext = createContext<{ name: SchemeName; colors: Scheme }>({
  name: 'light',
  colors: light,
});

/**
 * Reads the active scheme. Identical to importing `colors` today; the
 * difference only matters once a provider above it can change the scheme.
 */
export function useTheme() {
  return useContext(ThemeContext);
}

/* ── Shape, spacing, type ──────────────────────────────────────────────── */

export const radius = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
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
 * ignored there. Both are set so the platforms agree, but on the phone it is
 * `elevation` doing the work.
 *
 * Shadows are cool and shallow on purpose. On a white ground a warm or heavy
 * shadow reads as grime; the job here is separation, not depth.
 */
export const shadow = {
  lift: {
    shadowColor: '#1B2A31',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  liftLg: {
    shadowColor: '#1B2A31',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
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
  display: { fontSize: 42, fontWeight: '700', letterSpacing: -1.3 },
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  h2: { fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  h3: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyStrong: { fontSize: 15, fontWeight: '600' },
  small: { fontSize: 13, fontWeight: '400' },
  smallStrong: { fontSize: 13, fontWeight: '600' },
  micro: { fontSize: 11, fontWeight: '600' },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
} as const;
