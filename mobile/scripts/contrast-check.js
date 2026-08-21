/**
 * Measures every text-on-surface pair in both schemes against WCAG 2.1 AA.
 *
 *   node mobile/scripts/contrast-check.js        # or: npm run check:contrast
 *
 * Exists because "does dark mode look all right?" is not a question anyone can
 * answer by looking. The first run of this found five real failures, and four
 * of them were in the *light* scheme that had already shipped — `inkFaint` at
 * 3.06:1 on white, and a text-input border at 1.48:1 that was the only thing
 * marking where the field was. Neither was visible as a bug; both were.
 *
 * It parses theme/palette.ts and theme/tokens.ts as text rather than importing
 * them, because tokens.ts pulls in react-native and this has to run under plain
 * node in CI with no bundler.
 *
 * Thresholds are WCAG's: 4.5:1 for body text (1.4.3), 3:1 for the boundary of a
 * control and for non-text graphics (1.4.11). The two surface-separation rows
 * carry no requirement and are printed for information — a card and a canvas
 * that are both #FFFFFF separate by their hairline, which is the design.
 *
 * Adding a role to the Scheme means adding its pairs below. A token nothing
 * measures is a token that will drift.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ── WCAG 2.1 relative luminance ────────────────────────────────────────── */

function luminance(hex) {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const linear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = channels.map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Reading the theme without running it ───────────────────────────────── */

function readScales() {
  const src = fs.readFileSync(path.join(ROOT, 'theme/palette.ts'), 'utf8');
  const scales = {};
  for (const m of src.matchAll(/export const (\w+) = \{([\s\S]*?)\} as const;/g)) {
    const scale = {};
    for (const k of m[2].matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) scale[k[1]] = k[2];
    scales[m[1]] = scale;
  }
  return scales;
}

function readScheme(src, name, scales) {
  const start = src.indexOf(`const ${name}: Scheme = {`);
  if (start < 0) throw new Error(`scheme "${name}" not found in theme/tokens.ts`);
  const body = src.slice(start, src.indexOf('\n};', start));
  const scheme = {};
  for (const m of body.matchAll(
    /^\s*(\w+):\s*(?:'(#[0-9A-Fa-f]{6})'|(\w+)\[(\d+)\]|(\w+)\.(\w+)),/gm,
  )) {
    const [, key, literal, scaleName, index, objName, prop] = m;
    scheme[key] =
      literal ?? (scaleName ? scales[scaleName]?.[index] : scales[objName]?.[prop]);
    if (!scheme[key]) throw new Error(`${name}.${key} could not be resolved to a hex`);
  }
  return scheme;
}

/* ── What gets measured ─────────────────────────────────────────────────── */

const TEXT = 4.5;
const UI = 3;
const INFO = 0; // printed, not required

const PAIRS = [
  ['ink', 'canvas', 'body text on canvas', TEXT],
  ['ink', 'card', 'body text on card', TEXT],
  ['ink', 'inset', 'body text on inset', TEXT],
  ['inkMuted', 'canvas', 'secondary text on canvas', TEXT],
  ['inkMuted', 'card', 'secondary text on card', TEXT],
  ['inkMuted', 'inset', 'secondary text on inset', TEXT],
  ['inkFaint', 'canvas', 'faint text / placeholder', TEXT],
  ['inkFaint', 'card', 'faint text on card', TEXT],
  ['inkFaint', 'inset', 'faint text on inset', TEXT],
  ['accent', 'canvas', 'link / ghost button label', TEXT],
  ['accent', 'card', 'link on card', TEXT],
  ['accent', 'inset', 'secondary button label', TEXT],
  ['accent', 'accentSoft', 'chip label / info note', TEXT],
  ['ink', 'accentSoft', 'text on a soft chip', TEXT],
  ['inkMuted', 'accentSoft', 'muted text on a soft chip', TEXT],
  // On a dark ground a soft tint is LIGHTER than the card, so it — not the
  // card — is the tightest ground the faint tone has to clear.
  ['inkFaint', 'accentSoft', 'faint text on a soft chip', TEXT],
  // Button variant `primary` on a slab: a white ground on a dark surface.
  ['slabDeep', 'onSlab', 'primary button on a slab', TEXT],
  ['accentDeep', 'canvas', 'deep accent on canvas', TEXT],
  ['onSlabDanger', 'slab', 'destructive button on a slab', TEXT],
  ['onSlabDanger', 'slabDeep', 'destructive button, slab bottom', TEXT],
  ['onAccent', 'accent', 'primary button label', TEXT],
  ['onSlab', 'slab', 'text on the corridor slab', TEXT],
  ['onSlabMuted', 'slab', 'muted text on the slab', TEXT],
  ['onSlabMuted', 'slabDeep', 'muted text, slab bottom', TEXT],
  ['success', 'successSoft', 'success note', TEXT],
  ['pending', 'pendingSoft', 'pending note', TEXT],
  ['danger', 'dangerSoft', 'danger note', TEXT],
  ['onSuccess', 'success', 'delivered pill', TEXT],
  ['onPending', 'pending', 'in-flight pill', TEXT],
  ['onDanger', 'danger', 'failed pill', TEXT],
  ['success', 'canvas', 'success text on canvas', TEXT],
  ['pending', 'canvas', 'pending text on canvas', TEXT],
  ['danger', 'canvas', 'danger text on canvas', TEXT],
  ['fieldBorder', 'card', 'text input border', UI],
  ['fieldBorder', 'canvas', 'input border on canvas', UI],
  ['accent', 'card', 'focused input border', UI],
  ['accentMuted', 'card', 'icon / inactive tab', UI],
  ['line', 'card', 'hairline divider', INFO],
  ['card', 'canvas', 'card vs canvas', INFO],
  ['inset', 'canvas', 'inset vs canvas', INFO],
];

/* ── Run ────────────────────────────────────────────────────────────────── */

const scales = readScales();
const tokens = fs.readFileSync(path.join(ROOT, 'theme/tokens.ts'), 'utf8');
const schemes = {
  light: readScheme(tokens, 'light', scales),
  dark: readScheme(tokens, 'dark', scales),
};

let failed = 0;
for (const [schemeName, scheme] of Object.entries(schemes)) {
  console.log(`\n${schemeName}`);
  console.log('─'.repeat(78));
  for (const [fg, bg, label, min] of PAIRS) {
    if (!(fg in scheme)) throw new Error(`${schemeName} has no token "${fg}"`);
    if (!(bg in scheme)) throw new Error(`${schemeName} has no token "${bg}"`);
    const r = contrast(scheme[fg], scheme[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    const need = min ? `need ${min}` : 'info';
    console.log(
      `${ok ? '  ok ' : 'FAIL'} ${r.toFixed(2).padStart(6)}  ${need.padEnd(9)} ${label.padEnd(28)} ${fg} on ${bg}`,
    );
  }
}

// Every token in the Scheme should be measured by something, or a colour can be
// changed to anything at all and nothing here will notice.
const measured = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));
const unmeasured = Object.keys(schemes.light).filter(
  (k) => !measured.has(k) && !k.startsWith('gold') && k !== 'roundel' && k !== 'lineStrong',
);
if (unmeasured.length) {
  console.log(`\nnot measured by any pair: ${unmeasured.join(', ')}`);
}

console.log(`\n${failed ? `${failed} failing pair(s)` : 'all pairs pass'}`);
process.exit(failed ? 1 : 0);
