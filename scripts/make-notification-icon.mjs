/**
 * Generate the Android notification icon — `npm run icon:notification`.
 *
 * Android does NOT draw a notification's small icon in colour. It reads the
 * **alpha channel only**, flattens everything opaque to a single silhouette,
 * and tints it with the colour from the `expo-notifications` plugin config
 * (`#f2ab35`, the `degraded` token). So a source with any colour in it, or any
 * anti-aliased grey, still ends up as a solid shape — and a source whose alpha
 * covers the whole canvas ends up as the white square everyone has seen on a
 * badly configured app.
 *
 * The app had no notification icon configured at all, so every page and every
 * daily reminder arrived under the launcher icon silhouetted — a filled blob.
 *
 * This builds one from `android-icon-monochrome.png`, which is the right
 * source (it is already the one-colour version of the mark, drawn for
 * Android's themed-icon slot) but is wrong in two ways for this job:
 *
 *   1. **It is grey**, around #808080. Harmless given the alpha-only rule, but
 *      the platform guidance says all-white and there is no reason to ship
 *      something that reads wrong when a human opens the file.
 *   2. **Its glyph covers 7.5% of a 432×432 canvas** — correct for a launcher
 *      icon, which needs a wide safe margin, and far too small for a 24dp
 *      status-bar slot where the icon would render as a speck.
 *
 * So: find the real bounding box of the mark, crop to it, scale it to fill a
 * 96×96 canvas leaving the ~12.5% padding Android's own icons use, and write
 * it out as pure white with the alpha preserved.
 *
 * Pure Node — `zlib` for the PNG codec, no image library. The repo has no
 * imaging dependency and this runs once per icon change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const SRC = "apps/mobile/assets/images/android-icon-monochrome.png";
const OUT = "apps/mobile/assets/images/notification-icon.png";

/** Android's small-icon canvas. 24dp at xxxhdpi. */
const SIZE = 96;
/** Padding each side, as a fraction. Matches the platform's own small icons. */
const PAD = 0.125;
/** Below this, a pixel is background rather than part of the mark. */
const ALPHA_FLOOR = 10;

// --- PNG read ---------------------------------------------------------------

function readPng(path) {
  const buf = readFileSync(path);
  let off = 8;
  const idat = [];
  let width, height, bitDepth, colorType;

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IHDR") {
      width = buf.readUInt32BE(off + 8);
      height = buf.readUInt32BE(off + 12);
      bitDepth = buf[off + 16];
      colorType = buf[off + 17];
    }
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(
      `Expected 8-bit RGBA; got bitDepth=${bitDepth} colorType=${colorType}. ` +
        `This script only implements that one combination.`,
    );
  }

  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);

  // Undo the per-scanline filters. PNG filter types 0-4, per the spec.
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 0xff;
    }
  }

  return { width, height, px };
}

// --- PNG write --------------------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, width, height, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10-12: compression, filter, interlace — all 0.

  // Filter type 0 (None) on every row. The image is tiny and mostly
  // transparent; a smarter filter would save bytes nobody is counting.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

// --- build ------------------------------------------------------------------

const src = readPng(SRC);
const srcStride = src.width * 4;

// The mark's real extent, ignoring the launcher-icon safe margin around it.
let minX = src.width,
  minY = src.height,
  maxX = -1,
  maxY = -1;
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    if (src.px[y * srcStride + x * 4 + 3] > ALPHA_FLOOR) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) throw new Error(`${SRC} is fully transparent — nothing to crop.`);

const markW = maxX - minX + 1;
const markH = maxY - minY + 1;

// Fit the mark inside the padded box, preserving its aspect ratio, centred.
const box = SIZE * (1 - PAD * 2);
const scale = Math.min(box / markW, box / markH);
const drawW = markW * scale;
const drawH = markH * scale;
const originX = (SIZE - drawW) / 2;
const originY = (SIZE - drawH) / 2;

const out = Buffer.alloc(SIZE * SIZE * 4); // zeroed: fully transparent
const outStride = SIZE * 4;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Box-sample the source region this destination pixel covers. The source
    // is ~4x the destination, so point-sampling would alias the mark's edges
    // badly at this size.
    const sx0 = minX + ((x - originX) / scale);
    const sy0 = minY + ((y - originY) / scale);
    const sx1 = sx0 + 1 / scale;
    const sy1 = sy0 + 1 / scale;

    let sum = 0;
    let n = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) {
      for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
        n++;
        if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
        sum += src.px[sy * srcStride + sx * 4 + 3];
      }
    }
    if (n === 0) continue;

    const i = y * outStride + x * 4;
    // Pure white, always. Android reads the alpha and tints it anyway; white
    // is what the platform guidance asks for and what a human opening the
    // file should see.
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
    out[i + 3] = Math.round(sum / n);
  }
}

writePng(OUT, SIZE, SIZE, out);

const covered = (() => {
  let c = 0;
  for (let i = 3; i < out.length; i += 4) if (out[i] > ALPHA_FLOOR) c++;
  return ((100 * c) / (SIZE * SIZE)).toFixed(1);
})();

console.log(`${SRC}  ${src.width}x${src.height}`);
console.log(`  mark bounds: ${markW}x${markH} at (${minX},${minY})`);
console.log(`${OUT}  ${SIZE}x${SIZE}, white on transparent`);
console.log(`  coverage: ${covered}% of canvas (was 7.5% in the source)`);
