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
 * Both schemes are real and both are rendered. `schemes.light` is what the
 * client approved and remains the default; `schemes.dark` is what the app wears
 * when the phone asks for it, or when the person picks it in Profile.
 *
 * Components read the active scheme through `useTheme()`. The bare `colors`
 * export below is still the light scheme and still valid, but only for things
 * that are genuinely not part of the themed UI — the printed receipt, which is
 * ink on white paper regardless of what the screen is doing. Anything a person
 * looks at on the phone must use the hook, or it will stay light while the rest
 * of the screen goes dark, which is the one failure mode worse than no dark
 * mode at all.
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
  /**
   * The edge of a text input.
   *
   * Separate from `lineStrong` because the two have different jobs and
   * therefore different floors. A divider is decoration and may be a hairline;
   * the outline of a control is the only thing telling a person where to type,
   * and WCAG 1.4.11 asks 3:1 of it. Sharing one token forced a choice between a
   * heavy-looking card and an invisible field.
   */
  fieldBorder: string;

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
  /**
   * Danger, on a slab.
   *
   * A separate role because the slab is dark in *both* schemes while `danger`
   * is a mid-tone in both: the light scheme's brick on the light scheme's slab
   * measures 1.02:1, which is not a near miss, it is an invisible control. The
   * destructive button on the corridor slab has been unreadable since the slab
   * was introduced. So this is a light brick in both schemes — 4.82:1 on the
   * light slab, 9.32:1 on the dark one — and it is the only tone that may be
   * used for danger on that surface.
   */
  onSlabDanger: string;

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
  fieldBorder: grey.field,

  ink: neutral[900],
  inkMuted: grey.muted,
  inkFaint: grey.faint,
  onSlab: neutral[0],
  onSlabMuted: slate[100],
  onSlabDanger: brick[100],

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

/* ── Dark ──────────────────────────────────────────────────────────────── */

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
  // 3.00:1 on `card`, the tightest of the three dark surfaces.
  fieldBorder: '#697073',

  ink: '#E8EDEF',
  inkMuted: '#9DAAB1',
  // Clears 4.5:1 on every dark surface including `accentSoft`, which is the
  // lightest of them: a soft tint sits *above* the card on a dark ground,
  // inverting which surface is the tightest case.
  inkFaint: '#8C979B',
  onSlab: neutral[0],
  onSlabMuted: slate[300],
  // Same value as light: the ground is dark either way.
  onSlabDanger: brick[100],

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

/* ── The four greeting scenes ──────────────────────────────────────────── */

/**
 * Sky, land and celestial tones for the time-of-day intro.
 *
 * Every value is drawn from the same five scales as the UI, so the greeting
 * cannot drift away from the brand the way the old green landscapes did. Note
 * that the sun is an earth tone, never gold: gold belongs to the mark alone,
 * and a gold sun would put the brand's one saturated colour on scenery.
 *
 * `onDark` decides whether the greeting text is ink or white, so a scene and
 * its type can never disagree about which ground they are on.
 */
/** The four moments the greeting knows about. Mirrors `dayPartFor()`. */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export interface SceneTokens {
  /** Top → bottom sky gradient. */
  sky: readonly [string, string];
  /** Hill bands, far to near. */
  hills: readonly [string, string, string];
  /** The sun or the moon. */
  celestial: string;
  /** Soft halo around it. */
  halo: string;
  stars: boolean;
  /** A crescent rather than a disc. */
  crescent: boolean;
  onDark: boolean;
}

const lightScenes: Record<DayPart, SceneTokens> = {
  morning: {
    sky: [slate[100], neutral[0]],
    hills: [slate[200], slate[300], slate[400]],
    celestial: earth[300],
    halo: 'rgba(169,140,110,0.20)',
    stars: false,
    crescent: false,
    onDark: false,
  },
  afternoon: {
    sky: [slate[50], neutral[0]],
    hills: [slate[200], slate[400], slate[600]],
    celestial: slate[300],
    halo: 'rgba(147,166,175,0.22)',
    stars: false,
    crescent: false,
    onDark: false,
  },
  evening: {
    sky: [slate[700], earth[400]],
    hills: [slate[800], slate[900], neutral[1000]],
    celestial: earth[300],
    halo: 'rgba(169,140,110,0.30)',
    stars: false,
    crescent: false,
    onDark: true,
  },
  night: {
    sky: [slate[900], neutral[1000]],
    hills: ['#1B2126', '#151A1E', neutral[1000]],
    celestial: neutral[0],
    halo: 'rgba(255,255,255,0.16)',
    stars: true,
    crescent: true,
    onDark: true,
  },
};

/**
 * The same four moments, for a phone in dark mode.
 *
 * Not an afterthought and not optional. The greeting is full-screen, and the
 * light morning scene is a near-white sky: showing that to someone who has
 * asked for dark mode means 1.8 seconds of blinding white every time they open
 * the app. It also broke the type — the light scenes set `onDark: false`, which
 * resolves to `colors.ink`, and `ink` in the dark scheme is #E8EDEF. The
 * person's own name would have been painted white on a white sky.
 *
 * So both bright scenes get a night-time sky and `onDark: true`. The sun and
 * moon keep their positions and their colours, which is what still tells
 * morning from evening once every sky is dark.
 */
const darkScenes: Record<DayPart, SceneTokens> = {
  morning: {
    sky: [slate[800], slate[700]],
    hills: [slate[900], '#1B2126', neutral[1000]],
    celestial: earth[300],
    halo: 'rgba(169,140,110,0.24)',
    stars: false,
    crescent: false,
    onDark: true,
  },
  afternoon: {
    sky: [slate[700], slate[600]],
    hills: [slate[800], slate[900], neutral[1000]],
    celestial: slate[300],
    halo: 'rgba(147,166,175,0.24)',
    stars: false,
    crescent: false,
    onDark: true,
  },
  // Already dark, and already correct in both schemes.
  evening: lightScenes.evening,
  night: lightScenes.night,
};

/**
 * The greeting scenes for a scheme.
 *
 * A function rather than an object because the scene is chosen by two things at
 * once — the hour and the scheme — and a lookup that only knows one of them is
 * how the white-on-white bug above happened.
 */
export function scenesFor(scheme: SchemeName): Record<DayPart, SceneTokens> {
  return scheme === 'dark' ? darkScenes : lightScenes;
}

/**
 * The light scheme, importable without a hook.
 *
 * For output that is not on the screen — `lib/receipt.ts` renders HTML that
 * ends up on paper or in a PDF, where the ground is white whatever the phone is
 * wearing. Reaching for this from a component is almost always a mistake; use
 * `useTheme()` there.
 */
export const colors = light;

/* ── Hook ──────────────────────────────────────────────────────────────── */

/**
 * What the person asked for, which is not the same as what is rendered.
 *
 * `system` defers to the phone and is the default; the other two are an
 * explicit override. Storing the preference rather than the resolved scheme is
 * what lets someone on `system` follow their phone into night mode forever
 * instead of being pinned to whichever scheme they first launched in.
 */
export type ThemePreference = SchemeName | 'system';

export interface ThemeValue {
  /** The scheme actually being rendered. */
  name: SchemeName;
  colors: Scheme;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeValue>({
  name: 'light',
  colors: light,
  preference: 'system',
  setPreference: () => {},
});

/**
 * Reads the active scheme. Every component that draws a colour uses this — a
 * component holding a colour captured at import time cannot follow a change.
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
