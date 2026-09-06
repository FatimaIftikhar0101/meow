/**
 * Generates the phone app's icon set from the client's artwork.
 *
 *   node design/brand/build-app-icon.mjs
 *
 * Why this sits beside build-icons.mjs rather than replacing it
 * ─────────────────────────────────────────────────────────────
 * `build-icons.mjs` draws every raster from `mark.svg`, which is the right
 * pipeline for a vector mark: one source, every size exact, nothing exported by
 * hand. The client supplied a photographic icon instead, and a photograph
 * cannot be re-drawn at each size — it can only be resized. So this script
 * takes the same targets and the same layout rules and feeds them a raster.
 *
 * The vector pipeline is left in place and still owns the desktop panel's
 * favicon, which is a different product surface with a different audience.
 *
 * What the source needs and what it gets
 * ──────────────────────────────────────
 * `icon.png` arrives 1920×2238 with a transparent border, so the artwork is
 * neither square nor flush. Handed to a launcher as-is it would be letterboxed
 * and then cropped, which is how an icon ends up with the cat's chin missing.
 * Trimming the alpha border gives a clean 1685×1685 square, and every target
 * below is built from that.
 *
 * The background is not a style choice
 * ────────────────────────────────────
 * The artwork is transparent and its frame is a teal ring, #1B606F. Against the
 * charcoal the adaptive icon was configured with, that ring sits at 1.55:1 — it
 * disappears, and the icon reads as a cat floating in a dark square. Against
 * white it is 7.12:1. So the ground is white here, and `app.json`'s
 * `adaptiveIcon.backgroundColor` changes with it; leaving that at charcoal
 * while the background *image* is white is the kind of mismatch that shows up
 * only on the one launcher that ignores the image.
 *
 * Android adaptive icons
 * ──────────────────────
 * The foreground is drawn on a 108dp canvas of which the middle 72dp is
 * guaranteed visible. `build-icons.mjs` puts the bare mark at 58% because it is
 * a small glyph that needs room for its disc. This artwork *is* a disc, so it
 * takes 66% — the ring then lands just inside the guaranteed-visible circle,
 * and the ears and chin that break out of the ring stay inside it rather than
 * being shaved off by a circular mask.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');

// sharp belongs to the retired Next.js client, the only package in the repo
// that already depends on it. Same reasoning as build-icons.mjs: this is a
// build-time tool run by hand, and the phone app should not carry an image
// pipeline in order to draw its own icon.
const require = createRequire(import.meta.url);
const sharp = require(path.join(ROOT, 'web', 'node_modules', 'sharp'));

const SOURCE = path.join(ROOT, 'icon.png');

/** The ground the artwork is composited onto. See the note above. */
const GROUND = '#FFFFFF';
/** Kept for the monochrome layer, which is a silhouette rather than artwork. */
const CHARCOAL = '#3C3C3C';

/** The artwork, trimmed of its transparent border and square. */
const artwork = await sharp(SOURCE).trim({ threshold: 1 }).png().toBuffer();

/**
 * Place the artwork on a canvas of `size`, occupying `scale` of it.
 *
 * `fit: 'contain'` with a transparent extension keeps the aspect ratio and
 * centres what is left, so a source that is not perfectly square still lands
 * in the middle rather than being stretched to fill.
 */
async function place(size, scale, { ground = null } = {}) {
  const inner = Math.round(size * scale);
  const art = await sharp(artwork)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ground ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: art, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** A flat square of one colour. */
function solid(size, colour) {
  return sharp({ create: { width: size, height: size, channels: 4, background: colour } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * The themed-icon layer: the artwork's own outline, filled flat.
 *
 * Android tints this to match the user's wallpaper, so colour is discarded and
 * only the shape survives. Taking the shape from the alpha channel keeps the
 * ring and the ears, which is what makes the silhouette recognisable as this
 * icon rather than as a generic circle.
 */
async function monochrome(size, scale) {
  const inner = Math.round(size * scale);
  const { data, info } = await sharp(artwork)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Repaint every pixel charcoal and keep its original opacity.
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = 0x3c;
    out[i + 1] = 0x3c;
    out[i + 2] = 0x3c;
    out[i + 3] = data[i + 3];
  }

  const shape = await sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();

  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: shape, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const targets = [
  {
    file: 'mobile/assets/icon.png',
    // Flush to the edge and opaque: iOS rejects an icon with an alpha channel,
    // and rounds the corners itself.
    make: () => place(1024, 1, { ground: GROUND }),
    note: 'store / home screen icon',
  },
  {
    file: 'mobile/assets/android-icon-foreground.png',
    make: () => place(512, 0.66),
    note: 'adaptive foreground, ring inside the 72dp visible circle',
  },
  {
    file: 'mobile/assets/android-icon-background.png',
    make: () => solid(512, GROUND),
    note: 'adaptive background — white, so the teal ring reads',
  },
  {
    file: 'mobile/assets/android-icon-monochrome.png',
    make: () => monochrome(512, 0.66),
    note: 'themed icon silhouette',
  },
  {
    file: 'mobile/assets/splash-icon.png',
    // Transparent: the splash screen supplies its own ground, and in dark mode
    // that ground is not white.
    make: () => place(1024, 0.8),
    note: 'splash',
  },
  {
    file: 'mobile/assets/favicon.png',
    make: () => place(64, 1, { ground: GROUND }),
    note: 'expo web',
  },
  {
    file: 'design/brand/out/desktop-source.png',
    make: () => place(1024, 0.86, { ground: GROUND }),
    note: 'source for `npx tauri icon`',
  },
];

for (const t of targets) {
  const dest = path.join(ROOT, t.file);
  mkdirSync(path.dirname(dest), { recursive: true });

  let buf = await t.make();
  // Only the iOS icon must lose its alpha channel; everything else is a layer
  // over something, and flattening it would paint a white box on the launcher.
  if (t.file.endsWith('mobile/assets/icon.png') || t.file.endsWith('favicon.png')) {
    buf = await sharp(buf).flatten({ background: GROUND }).png({ compressionLevel: 9 }).toBuffer();
  }
  writeFileSync(dest, buf);

  const meta = await sharp(buf).metadata();
  console.log(
    `  ${String(meta.width).padStart(4)}×${String(meta.height).padEnd(4)} ` +
      `${meta.hasAlpha ? 'rgba' : 'rgb '}  ${t.file.padEnd(46)} ${t.note}`,
  );
}

console.log(
  '\nFor the desktop icon set (.ico/.icns/Windows Store tiles):\n' +
    '  cd admin && npx tauri icon ../design/brand/out/desktop-source.png\n',
);
