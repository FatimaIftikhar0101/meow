/**
 * Raw colour. This is the ONLY file in the app that contains a hex literal.
 *
 * Nothing here has a job — these are scales, not roles. `slate[600]` does not
 * know it is the corridor card, and `pine[500]` does not know it means
 * "delivered". Those decisions live one level up, in theme/tokens.ts.
 *
 * That separation is the point: re-theming the app means editing the scales
 * below and nothing else. Every screen refers to roles, so a new brand colour
 * lands everywhere at once without a single component changing.
 *
 * ── Revision 3, approved 2026-08-13 ──────────────────────────────────────
 * The client supplied five colours and a 60/30/10 split on a white ground:
 *
 *   Slate Blue Grey  #6B7B84   60%   surfaces, actions, icons
 *   Charcoal Grey    #3C3C3C   30%   text, and the roundel behind the mark
 *   Dark Pine        #2D4530    ·    delivered, and nothing else
 *   Earth Brown      #5E4B3B   10%   money in flight
 *
 * The five supplied values appear below unchanged, each marked ← supplied.
 * Everything around them is a tint or shade of those five, mixed toward white
 * or black, so the family stays coherent.
 *
 * One rule the scales encode, learned the hard way in revision 2: there is no
 * "almost white" here. A surface is `neutral[0]`, or it is a slate. A warm
 * off-white sitting next to a true white reads as dirt rather than as a colour.
 */

/** The identity. 500 is the client's value; the rest are mixed to white/black. */
export const slate = {
  50: '#F4F7F8',
  100: '#E7ECEF',
  200: '#CBD6DB',
  300: '#AFC0C7',
  400: '#93A6AF',
  500: '#6B7B84', // ← supplied · Slate Blue Grey
  600: '#55666F',
  700: '#3E4E57',
  800: '#2E3B42',
  900: '#212B30',
} as const;

/** True white and true charcoal. Nothing between them is tinted warm. */
export const neutral = {
  0: '#FFFFFF',
  900: '#3C3C3C', // ← supplied · Charcoal Grey
  950: '#2A2E30',
  1000: '#16191B',
} as const;

/**
 * Cool greys for secondary text, so muted copy belongs to the slate family.
 *
 * The two text greys were re-derived when the schemes were measured: the old
 * pair read 4.89:1 and 3.06:1 on white, so `faint` failed WCAG AA outright and
 * `muted` cleared it by four hundredths. They now sit at 6.54:1 and 4.85:1,
 * which keeps three distinct levels of emphasis — 11 / 6.5 / 4.9 — where before
 * there were two that passed and one that did not.
 *
 * None of the client's five colours moved. These are derived cool greys, not
 * supplied values.
 */
export const grey = {
  muted: '#555F65',
  faint: '#6A7377',
  /**
   * The edge of a text input, and nothing else.
   *
   * A hairline is right for a divider and wrong for a control: the field's
   * background is the same white as the page behind it, so the border is the
   * only thing saying "type here". WCAG 1.4.11 asks for 3:1 on exactly that
   * basis, and the hairline managed 1.48:1. This is 3.24:1.
   */
  field: '#899094',
} as const;

/** Success. Reserved for a delivered transfer — see tokens.ts. */
export const pine = {
  100: '#E3EBE4',
  300: '#6E9A72',
  400: '#3E5C42',
  500: '#2D4530', // ← supplied · Dark Pine
} as const;

/** Money in motion. The whole 10%, spent on the status people watch. */
export const earth = {
  100: '#F0EAE3',
  300: '#A98C6E',
  400: '#7A6350',
  500: '#5E4B3B', // ← supplied · Earth Brown
} as const;

/**
 * Failure. The one colour not supplied by the client, and flagged to her as
 * such: none of the five can say *stop*, and a transfer that failed must never
 * be mistaken for an ordinary row. Pulled from the same earth family so it
 * belongs, rather than dropping a pure red into a muted palette.
 */
export const brick = {
  100: '#F6E3DE',
  300: '#D07A63',
  500: '#A34434',
} as const;

/**
 * The brand mark's gold, taken from app/_components/Brand.tsx unchanged.
 *
 * It is a gradient, not a flat colour, and it belongs to the logo alone — never
 * a button, never text. Note `mid` measures 1.97:1 on white, so the mark always
 * carries a dark roundel with it (`tokens.roundel`, 5.61:1). That is not a flaw
 * in the mark; it was drawn for the dark web app, where it has something to
 * glow against.
 */
export const gold = {
  light: '#FFF1C2',
  mid: '#E0B259',
  deep: '#9A6D18',
  /** The mark's pupils, from Brand.tsx. */
  pupil: '#07090F',
} as const;
