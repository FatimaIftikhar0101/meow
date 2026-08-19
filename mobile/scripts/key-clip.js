/**
 * Turn a kitten clip shot on a black background into a transparent animated
 * WebP the app can play.
 *
 *   node scripts/key-clip.js design/clips/waiting.webm assets/kitten/waiting.webp
 *
 * Needs ffmpeg on PATH. Options: --fps=12 --width=320 --quality=76
 *
 * Why not ffmpeg's own lumakey: two things it gets wrong on this footage.
 *
 *  1. Dark parts of the subject — the pupils, the shadow under the chin — are
 *     as black as the background, so a luma threshold punches holes in the cat.
 *     On the first clip that was 30,620 pixels across 73 frames. Only
 *     transparency *connected to the frame edge* is really background, so the
 *     mask is flood-filled inward from the border and anything enclosed stays
 *     opaque.
 *  2. Footage shot on black is effectively premultiplied against it, so fringe
 *     pixels are pulled toward black and read as a grey halo on a white
 *     canvas. Dividing colour back out by alpha undoes that.
 *
 * Output is animated WebP rather than video on purpose: transparent video on
 * Android means VP9-alpha in WebM plus a TextureView and a surface that honours
 * alpha, which is a lot of machinery to make a cat sit on a card. expo-image
 * plays animated WebP with transparency and loops it for nothing.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const [, , INPUT, OUTPUT, ...rest] = process.argv;
if (!INPUT || !OUTPUT) {
  console.error(
    'usage: node scripts/key-clip.js <input> <output.webp> [--fps=12] [--width=320] [--quality=76]',
  );
  process.exit(1);
}
const opt = (name, dflt) => {
  const hit = rest.find((a) => a.startsWith('--' + name + '='));
  return hit ? Number(hit.split('=')[1]) : dflt;
};
const FPS = opt('fps', 12);
const WIDTH = opt('width', 320);
const QUALITY = opt('quality', 76);

/** Luma at or below this is certainly background; at or above HI certainly
 *  subject. The band between becomes the soft edge. */
const LO = 10;
const HI = 46;
/** Anything above this counts as subject when measuring the bounding box. */
const BBOX_T = 24;

function readFrames(src, filter, pixFmt) {
  const args = ['-v', 'error', '-i', src];
  if (filter) args.push('-vf', filter);
  args.push('-f', 'rawvideo', '-pix_fmt', pixFmt, '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
}

const probe = execFileSync(
  'ffprobe',
  ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
   'stream=width,height,pix_fmt', '-of', 'csv=p=0:s=x', INPUT],
  { encoding: 'utf8' },
).trim();
const [wStr, hStr, PIX_FMT] = probe.split('x');
const W = Number(wStr);
const H = Number(hStr);

/**
 * Does the source carry a real alpha channel?
 *
 * ProRes 4444 (yuva444p12le) does; the VP9 WebM exported alongside it does not
 * — that export flattens alpha onto black, which is why the keying path below
 * exists at all. When genuine alpha is available it is always the better
 * source: no threshold to pick, no enclosed-shadow problem, and edge softness
 * that was authored rather than inferred.
 */
const HAS_ALPHA = /^yuva|^rgba|^bgra|^ya/.test(PIX_FMT || '');
console.log(
  'input ' + path.basename(INPUT) + '  ' + W + 'x' + H + '  ' + PIX_FMT +
  (HAS_ALPHA ? '  (real alpha — keying skipped)' : '  (no alpha — keying from black)'),
);

/* ── 1. Union bounding box of the subject across every frame ──────────────
 *
 * Per-frame cropping would make the kitten drift as its silhouette changes, so
 * the box is the union over the whole clip and every frame uses it. ffmpeg's
 * cropdetect is no help: compression noise in the black leaves a few non-zero
 * pixels at the very edge and it reports that no crop is possible at all.
 */
const PIX = HAS_ALPHA ? 'rgba' : 'rgb24';
const BPP = HAS_ALPHA ? 4 : 3;

const full = readFrames(INPUT, null, PIX);
const FS = W * H * BPP;
const frameCount = Math.floor(full.length / FS);
let minX = W, maxX = -1, minY = H, maxY = -1;
for (let f = 0; f < frameCount; f++) {
  const off = f * FS;
  for (let y = 0; y < H; y++) {
    let row = false;
    for (let x = 0; x < W; x++) {
      const i = off + (y * W + x) * BPP;
      // With a real matte the subject is simply wherever alpha is. Without one
      // it has to be inferred: anything brighter than the black it was
      // flattened onto.
      const inside = HAS_ALPHA
        ? full[i + 3] > 8
        : 0.2126 * full[i] + 0.7152 * full[i + 1] + 0.0722 * full[i + 2] > BBOX_T;
      if (inside) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        row = true;
      }
    }
    if (row) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) {
  throw new Error(
    HAS_ALPHA
      ? 'no subject found — the alpha channel is empty'
      : 'no subject found — is the background actually dark?',
  );
}

const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const pad = Math.round(Math.max(bw, bh) * 0.06);
// Even dimensions: some encoders reject odd ones.
const cw = Math.min(W, (bw + pad * 2) & ~1);
const ch = Math.min(H, (bh + pad * 2) & ~1);
const cx = Math.max(0, Math.min(minX - pad, W - cw));
const cy = Math.max(0, Math.min(minY - pad, H - ch));
console.log(
  'subject ' + bw + 'x' + bh + ' at ' + minX + ',' + minY +
  '  ->  crop ' + cw + 'x' + ch + ' at ' + cx + ',' + cy,
);

/* ── 2. Alpha ─────────────────────────────────────────────────────────────── */
const cropped = readFrames(
  INPUT,
  'crop=' + cw + ':' + ch + ':' + cx + ':' + cy,
  PIX,
);
const CFS = cw * ch * BPP;
const n = Math.floor(cropped.length / CFS);
const out = Buffer.alloc(cw * ch * 4 * n);

if (HAS_ALPHA) {
  // Nothing to infer. The matte was authored, so it is copied through as-is:
  // no threshold to pick, no enclosed-shadow problem, and the edge softness is
  // the one the artist produced rather than one reconstructed from luma.
  cropped.copy(out, 0, 0, Math.min(cropped.length, out.length));
  console.log('copied ' + n + ' frames with their authored alpha');
} else {
  keyFromBlack();
}

/**
 * Recover a matte from footage flattened onto black.
 *
 * Only reached when the source has no alpha — the VP9 WebM export, typically.
 * Kept because that is what tends to arrive, but it is strictly the worse
 * input: see the header for the two failure modes it has to work around.
 */
function keyFromBlack() {
const bg = new Uint8Array(cw * ch);
const stack = new Int32Array(cw * ch);
const alpha = new Uint8Array(cw * ch);
let enclosed = 0;

for (let f = 0; f < n; f++) {
  const off = f * CFS;
  for (let p = 0; p < cw * ch; p++) {
    const i = off + p * 3;
    const L = 0.2126 * cropped[i] + 0.7152 * cropped[i + 1] + 0.0722 * cropped[i + 2];
    alpha[p] = L <= LO ? 0 : L >= HI ? 255 : Math.round(((L - LO) / (HI - LO)) * 255);
  }

  bg.fill(0);
  let sp = 0;
  const push = (p) => {
    if (!bg[p] && alpha[p] < 24) {
      bg[p] = 1;
      stack[sp++] = p;
    }
  };
  for (let x = 0; x < cw; x++) {
    push(x);
    push((ch - 1) * cw + x);
  }
  for (let y = 0; y < ch; y++) {
    push(y * cw);
    push(y * cw + cw - 1);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % cw;
    const y = (p / cw) | 0;
    if (x > 0) push(p - 1);
    if (x < cw - 1) push(p + 1);
    if (y > 0) push(p - cw);
    if (y < ch - 1) push(p + cw);
  }

  const obase = f * cw * ch * 4;
  for (let p = 0; p < cw * ch; p++) {
    const i = off + p * 3;
    const o = obase + p * 4;
    // Enclosed darkness is cat, not background.
    const a = bg[p] ? alpha[p] : 255;
    if (!bg[p] && alpha[p] < 24) enclosed++;
    if (a === 0) continue; // buffer is already zeroed
    const s = 255 / a;
    out[o] = Math.min(255, Math.round(cropped[i] * s));
    out[o + 1] = Math.min(255, Math.round(cropped[i + 1] * s));
    out[o + 2] = Math.min(255, Math.round(cropped[i + 2] * s));
    out[o + 3] = a;
  }
}
console.log('keyed ' + n + ' frames; ' + enclosed + ' enclosed dark px kept opaque');
}

/* ── 3. Encode ────────────────────────────────────────────────────────────── */
const tmp = path.join(os.tmpdir(), 'keyclip-' + process.pid + '.rgba');
fs.writeFileSync(tmp, out);
try {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y',
     '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', cw + 'x' + ch, '-r', '24', '-i', tmp,
     '-vf', 'fps=' + FPS + ',scale=' + WIDTH + ':-2:flags=lanczos',
     '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', String(QUALITY),
     '-compression_level', '6', '-loop', '0', '-an', OUTPUT],
    { stdio: 'inherit' },
  );
} finally {
  fs.unlinkSync(tmp);
}

/* ── 4. Verify it really is animated and really has alpha ─────────────────── */
const b = fs.readFileSync(OUTPUT);
let off = 12;
let anmf = 0;
let flags = 0;
let ow = 0;
let oh = 0;
while (off + 8 <= b.length) {
  const id = b.toString('ascii', off, off + 4);
  const size = b.readUInt32LE(off + 4);
  if (id === 'VP8X') {
    flags = b[off + 8];
    ow = b.readUIntLE(off + 12, 3) + 1;
    oh = b.readUIntLE(off + 15, 3) + 1;
  }
  if (id === 'ANMF') anmf++;
  off += 8 + size + (size & 1);
}
const hasAlpha = !!(flags & 0x10);
const isAnimated = !!(flags & 0x02);
console.log(
  'wrote ' + OUTPUT + '  ' + ow + 'x' + oh + '  ' + anmf + ' frames  alpha=' +
  hasAlpha + '  animated=' + isAnimated + '  ' + Math.round(b.length / 1024) + 'KB',
);
if (!hasAlpha || !isAnimated || anmf < 2) {
  console.error('output is not an animated WebP with alpha — do not ship it');
  process.exit(1);
}
