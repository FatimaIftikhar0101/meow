/**
 * Generates every app icon in the repo from design/brand/mark.svg.
 *
 *   node design/brand/build-icons.mjs
 *
 * Why this exists
 * ───────────────
 * Every icon shipped up to 2026-08-21 was a framework placeholder: Expo's blue
 * chevron on the phone, Tauri's teal-and-yellow logo on the desktop, and Vite's
 * purple lightning as the panel's favicon. Three different frameworks' default
 * artwork, in a product with a perfectly good mark of its own that only existed
 * as JSX. Nobody had noticed because nobody installs their own app.
 *
 * So the mark now has a file, and every raster comes from it by command rather
 * than by somebody exporting a PNG by hand and forgetting one size.
 *
 * The one rule the layouts encode
 * ───────────────────────────────
 * Gold is 1.97:1 on white. The mark is never placed on a light ground bare — it
 * carries a charcoal disc, or it sits on a charcoal square. That is not a
 * stylistic preference; it is why `tokens.roundel` exists at all, and an app
 * icon is exactly the place the rule would otherwise get quietly broken, since
 * a launcher may draw it against anything.
 *
 * Android adaptive icons
 * ──────────────────────
 * The foreground layer is drawn on a 108dp canvas of which only the middle 72dp
 * is guaranteed visible and 66dp is genuinely safe — launchers mask to circles,
 * squircles, rounded squares and teardrops, and animate the layers apart. So the
 * mark occupies 58% of the canvas rather than filling it. Getting this wrong
 * produces an icon that looks fine in the emulator and is cropped on a Pixel.
 *
 * Run `npx tauri icon design/brand/out/desktop-source.png` from admin/ afterwards
 * to regenerate the desktop set; that tool owns the .ico and .icns muxing.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');

// sharp belongs to the retired Next.js client, which is the only package in the
// repo that already depends on it. Reaching across is deliberate: this is a
// build-time tool run by hand, and adding an image pipeline to the phone app's
// dependencies to draw its own icon would be a poor trade.
const require = createRequire(import.meta.url);
const sharp = require(path.join(ROOT, 'web', 'node_modules', 'sharp'));

/* ── The palette, from mobile/theme/palette.ts ──────────────────────────── */

const CHARCOAL = '#3C3C3C'; // neutral[900] — tokens.roundel
const GOLD_LIGHT = '#FFF1C2';
const GOLD_MID = '#E0B259';
const GOLD_DEEP = '#9A6D18';
const PUPIL = '#07090F';

const CAT =
  'M 11 11 L 13 8 L 14 13 L 18 13 L 19 8 L 21 11 Q 23 16 21 20 Q 16 23 11 20 Q 9 16 11 11 Z';

/**
 * The cat's real bounding box inside the 32-unit viewBox.
 *
 * Not the viewBox, and not the control points either — a quadratic curve never
 * reaches its control point, so `Q 23 16 21 20` peaks at x=22, not 23. Sizing
 * against these numbers rather than against the 32-unit box is what stops the
 * cat coming out small and adrift in a sea of charcoal: the head is 12 units
 * wide in a box of 32, so "scale the viewBox to 60%" yields a mark that
 * actually occupies 22% of the icon.
 */
const CAT_BOX = { x: 10, y: 8, w: 12, h: 13.5 };
const CAT_CX = CAT_BOX.x + CAT_BOX.w / 2; // 16
const CAT_CY = CAT_BOX.y + CAT_BOX.h / 2; // 14.75

/* ── SVG builders ───────────────────────────────────────────────────────── */

const gradient = `
  <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${GOLD_LIGHT}"/>
    <stop offset="60%" stop-color="${GOLD_MID}"/>
    <stop offset="100%" stop-color="${GOLD_DEEP}"/>
  </linearGradient>`;

/**
 * The mark, sized and centred by the cat rather than by the viewBox.
 *
 * `width` is how many pixels the head should span; the group is translated so
 * the head's centre lands on (cx, cy).
 *
 * The ring is off by default for icons. It is part of the mark as the app draws
 * it inline, but it is a 1.5-unit stroke on a 32-unit box — under about 64px it
 * stops resolving and becomes a grey halo, while taking up the room the head
 * needs to be recognisable. An app icon is seen at 48px far more often than at
 * 512, so the head wins.
 */
function markGroup(width, cx, cy, { ring = false } = {}) {
  const s = width / CAT_BOX.w;
  const dx = cx - CAT_CX * s;
  const dy = cy - CAT_CY * s;
  return `
  <g transform="translate(${dx} ${dy}) scale(${s})">
    ${ring ? `<circle cx="16" cy="16" r="15" fill="none" stroke="url(#g)" stroke-width="1.5"/>` : ''}
    <path d="${CAT}" fill="url(#g)"/>
    <circle cx="13.5" cy="15" r="0.9" fill="${PUPIL}"/>
    <circle cx="18.5" cy="15" r="0.9" fill="${PUPIL}"/>
  </g>`;
}

/**
 * Full-bleed charcoal square with the mark centred.
 *
 * For the iOS/store icon, which must be opaque and square — the OS applies its
 * own squircle mask, and an icon with transparent corners gets black ones.
 */
function squareIcon(size, headFraction = 0.5) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${gradient}</defs>
  <rect width="${size}" height="${size}" fill="${CHARCOAL}"/>
  ${markGroup(size * headFraction, size / 2, size / 2)}
</svg>`;
}

/**
 * The lockup: a charcoal disc with the mark on it, transparent outside.
 *
 * The head spans 46% of the diameter — a little tighter than the square icon,
 * because a circle has less usable area than the square that contains it and
 * the ears need room before they touch the edge.
 */
function roundelIcon(size, headFraction = 0.46) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${gradient}</defs>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${CHARCOAL}"/>
  ${markGroup(size * headFraction, size / 2, size / 2)}
</svg>`;
}

/** Adaptive-icon foreground: the mark alone, inside Android's safe zone. */
function adaptiveForeground(size) {
  // 44% of the 108dp canvas puts the whole head inside the 66dp safe circle
  // with margin for the ears, which sit above the head's centre.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${gradient}</defs>
  ${markGroup(size * 0.44, size / 2, size / 2)}
</svg>`;
}

/**
 * Adaptive-icon monochrome layer, for Android 13+ themed icons.
 *
 * The system reads only the alpha channel and tints it with the wallpaper
 * palette, so this must be a silhouette. The pupils are punched out as holes
 * rather than drawn dark — a filled shape would tint to the same colour as the
 * body and the cat would lose its face.
 */
function adaptiveMonochrome(size) {
  const width = size * 0.44;
  const s = width / CAT_BOX.w;
  const dx = size / 2 - CAT_CX * s;
  const dy = size / 2 - CAT_CY * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <mask id="m">
    <g transform="translate(${dx} ${dy}) scale(${s})">
      <path d="${CAT}" fill="#fff"/>
      <circle cx="13.5" cy="15" r="0.9" fill="#000"/>
      <circle cx="18.5" cy="15" r="0.9" fill="#000"/>
    </g>
  </mask>
  <rect width="${size}" height="${size}" fill="#FFFFFF" mask="url(#m)"/>
</svg>`;
}

/** A solid charcoal plate, for the adaptive icon's background layer. */
function solid(size, colour) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${colour}"/>
</svg>`;
}

/* ── Targets ────────────────────────────────────────────────────────────── */

const OUT = path.join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

const targets = [
  // ── Mobile ──────────────────────────────────────────────────────────────
  {
    file: 'mobile/assets/icon.png',
    svg: squareIcon(1024),
    size: 1024,
    flatten: true, // iOS rejects an icon with an alpha channel.
    note: 'store / home screen icon',
  },
  {
    file: 'mobile/assets/android-icon-foreground.png',
    svg: adaptiveForeground(512),
    size: 512,
    note: 'adaptive foreground, 58% safe zone',
  },
  {
    file: 'mobile/assets/android-icon-background.png',
    svg: solid(512, CHARCOAL),
    size: 512,
    note: 'adaptive background',
  },
  {
    file: 'mobile/assets/android-icon-monochrome.png',
    svg: adaptiveMonochrome(512),
    size: 512,
    note: 'themed icon silhouette',
  },
  {
    file: 'mobile/assets/splash-icon.png',
    svg: roundelIcon(1024),
    size: 1024,
    note: 'splash — carries its own disc so it reads on both splash grounds',
  },
  { file: 'mobile/assets/favicon.png', svg: roundelIcon(64), size: 64, note: 'expo web' },

  // ── Desktop source, fed to `npx tauri icon` ─────────────────────────────
  {
    file: 'design/brand/out/desktop-source.png',
    svg: roundelIcon(1024),
    size: 1024,
    note: 'source for the Tauri icon set',
  },
];

/* ── Render ─────────────────────────────────────────────────────────────── */

for (const t of targets) {
  const dest = path.join(ROOT, t.file);
  mkdirSync(path.dirname(dest), { recursive: true });

  let pipeline = sharp(Buffer.from(t.svg), { density: 384 }).resize(t.size, t.size);
  if (t.flatten) pipeline = pipeline.flatten({ background: CHARCOAL });

  const buf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(dest, buf);

  const meta = await sharp(buf).metadata();
  console.log(
    `  ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(4)} ` +
      `${meta.hasAlpha ? 'rgba' : 'rgb '}  ${t.file.padEnd(46)} ${t.note}`,
  );
}

/* ── The panel's favicon stays vector ───────────────────────────────────── */

const faviconDest = path.join(ROOT, 'admin/public/favicon.svg');
writeFileSync(
  faviconDest,
  `<!-- Generated by design/brand/build-icons.mjs. Do not edit by hand. -->\n` +
    roundelIcon(64) +
    '\n',
);
console.log(`  vector      ${'admin/public/favicon.svg'.padEnd(46)} panel browser tab`);

console.log(
  '\nNext, for the desktop icon set (.ico/.icns/Windows Store tiles):\n' +
    '  cd admin && npx tauri icon ../design/brand/out/desktop-source.png\n',
);

// Keep the standalone source file in step with what this script draws, so the
// two cannot silently disagree about what the mark is.
const markSvg = readFileSync(path.join(HERE, 'mark.svg'), 'utf8');
if (!markSvg.includes(CAT)) {
  console.warn(
    'WARNING: design/brand/mark.svg no longer contains the same silhouette path\n' +
      'as this script. One of them has been edited without the other.',
  );
}
