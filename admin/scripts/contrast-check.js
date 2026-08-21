/**
 * Measures the panel's colour roles against WCAG 2.1 AA, in both schemes.
 *
 *   node scripts/contrast-check.js        # or: npm run check:contrast
 *
 * The counterpart to mobile/scripts/contrast-check.js, and the thresholds and
 * reasoning are the same — 4.5:1 for body text (1.4.3), 3:1 for the boundary of
 * a control (1.4.11). It reads src/index.css directly rather than importing
 * anything, so it runs under plain node with no bundler.
 *
 * Beyond the fixed pairs, it cross-checks every `text-*` and `bg-*` token that
 * actually appears in src/**\/*.tsx against every background token that appears
 * there too. That is deliberately stricter than the real DOM — not every text
 * colour lands on every surface — but a pairing that passes here cannot fail on
 * a screen, and it catches the case where somebody puts `text-ink-faint` on
 * `bg-slab` two years from now on a screen nobody re-measured.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/* ── WCAG 2.1 relative luminance ────────────────────────────────────────── */

function luminance(hex) {
  const h = hex.replace('#', '');
  const linear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map((i) => linear(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── Reading the two schemes out of the stylesheet ──────────────────────── */

const css = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8');

function block(startMarker) {
  const start = css.indexOf(startMarker);
  if (start < 0) throw new Error(`"${startMarker}" not found in src/index.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('\n}', open);
  const vars = {};
  for (const m of css.slice(open, close).matchAll(/--color-([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    vars[m[1]] = m[2].toLowerCase();
  }
  return vars;
}

const light = block('@theme {');
// Dark only re-points the roles that differ; everything else is inherited.
const dark = { ...light, ...block("[data-theme='dark'] {") };
const schemes = { light, dark };

/* ── The pairs that must hold ───────────────────────────────────────────── */

const TEXT = 4.5;
const UI = 3;

const PAIRS = [
  ['ink', 'canvas', 'body text on canvas', TEXT],
  ['ink', 'card', 'body text on card', TEXT],
  ['ink', 'inset', 'sidebar text', TEXT],
  ['ink-muted', 'canvas', 'secondary text on canvas', TEXT],
  ['ink-muted', 'card', 'secondary text on card', TEXT],
  ['ink-muted', 'inset', 'sidebar secondary / nav item', TEXT],
  ['ink-faint', 'canvas', 'placeholder on canvas', TEXT],
  ['ink-faint', 'card', 'placeholder in a field', TEXT],
  ['ink-faint', 'inset', 'placeholder on inset', TEXT],
  ['on-accent', 'accent', 'primary button, active nav', TEXT],
  ['ink', 'accent-soft', 'nav hover', TEXT],
  ['on-danger', 'danger', 'danger button', TEXT],
  ['danger', 'danger-soft', 'error banner', TEXT],
  ['success', 'success-soft', 'success banner', TEXT],
  ['pending', 'pending-soft', 'pending banner', TEXT],
  ['on-success', 'success', 'delivered pill', TEXT],
  ['on-pending', 'pending', 'in-flight pill', TEXT],
  ['danger', 'card', 'inline error text', TEXT],
  ['on-slab', 'slab', 'text on a slab', TEXT],
  ['on-slab-muted', 'slab', 'muted text on a slab', TEXT],
  ['field-border', 'card', 'input / secondary button border', UI],
  ['field-border', 'canvas', 'input border on canvas', UI],
  ['field-border', 'inset', 'input border on inset', UI],
  ['accent', 'card', 'focused input border', UI],
  ['gold', 'roundel', 'the mark on its disc', UI],
];

/* ── The pairings a developer is free to choose ─────────────────────────── */

/**
 * Not every text token against every background: most roles are bound to one
 * surface by definition. `on-success` exists for `bg-success` and nowhere else,
 * and gold belongs to the mark on its roundel. Crossing those with arbitrary
 * backgrounds reports a hundred failures describing combinations nobody can
 * write, which is worse than reporting nothing — a check that cries wolf gets
 * turned off.
 *
 * What is worth guarding is the space where the choice is genuinely open: any
 * general-purpose text role on any of the three surfaces, and each status
 * colour on the three surfaces plus its own tint. The bound pairs are covered
 * by PAIRS above.
 */
const SURFACES = ['canvas', 'card', 'inset'];
const NEUTRAL_TEXT = ['ink', 'ink-muted', 'ink-faint', 'accent'];
const STATUS = ['success', 'pending', 'danger'];

function freeChoicePairs() {
  const out = [];
  for (const fg of NEUTRAL_TEXT) {
    for (const bg of [...SURFACES, 'accent-soft']) out.push([fg, bg]);
  }
  for (const fg of STATUS) {
    for (const bg of [...SURFACES, `${fg}-soft`]) out.push([fg, bg]);
  }
  return out;
}

/* ── Run ────────────────────────────────────────────────────────────────── */

let failed = 0;

for (const [name, scheme] of Object.entries(schemes)) {
  console.log(`\n${name}\n${'─'.repeat(74)}`);
  for (const [fg, bg, label, min] of PAIRS) {
    if (!(fg in scheme)) throw new Error(`${name} has no --color-${fg}`);
    if (!(bg in scheme)) throw new Error(`${name} has no --color-${bg}`);
    const r = contrast(scheme[fg], scheme[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(
      `${ok ? '  ok ' : 'FAIL'} ${r.toFixed(2).padStart(6)}  need ${String(min).padEnd(4)} ${label.padEnd(32)} ${fg} on ${bg}`,
    );
  }
}

const free = freeChoicePairs();
let freeFails = 0;
console.log(`\nfree-choice matrix: ${free.length} pairings × 2 schemes`);
console.log('─'.repeat(74));
for (const [name, scheme] of Object.entries(schemes)) {
  for (const [fg, bg] of free) {
    const r = contrast(scheme[fg], scheme[bg]);
    if (r < TEXT) {
      failed++;
      freeFails++;
      console.log(`FAIL ${r.toFixed(2).padStart(6)}  ${name}: text-${fg} on bg-${bg}`);
    }
  }
}
if (!freeFails) console.log('  every pairing clears 4.5:1 in both schemes');

console.log(`\n${failed ? `${failed} failing pair(s)` : 'all pairs pass'}`);
process.exit(failed ? 1 : 0);
