/**
 * Generate the app's native brand icons from the master FOUR wordmark —
 * `npm run icon:brand`.
 *
 * Source is `FOUR LOGO White Alpha.png` (2048x2148): the white FOUR mark in
 * its 2x2 "FO/UR" grid, on transparency, drawn edge-to-edge with no margin.
 * The ink is uniform white, so every output can be built from the alpha
 * channel alone — same doctrine as `make-notification-icon.mjs`, from which
 * the PNG codec and box-sampler here are lifted.
 *
 * The BOX variant is deliberately NOT used for the app icon: its baked
 * rounded corners would double-round under the iOS icon mask, and its black
 * box is nearly invisible against this app's #0d1013 background.
 *
 * Outputs (same filenames app.json already points at — no config change):
 *
 *   icon.png                       1024  OPAQUE on #0d1013 (App Store rejects
 *                                        alpha in the marketing icon), mark
 *                                        74% of canvas height
 *   splash-icon.png                 512  transparent, 92% fill. Must stay the
 *                                        plain wordmark: the JS animated
 *                                        splash renders this same asset so
 *                                        its first frame pixel-matches the
 *                                        native splash
 *   android-icon-foreground.png   1024  transparent, mark 45% of canvas —
 *                                        inside the adaptive icon's ~66%
 *                                        safe zone with margin for round masks
 *   android-icon-monochrome.png    432  pure white, same 45% geometry. Feeds
 *                                        the themed-icon slot AND
 *                                        `npm run icon:notification` — run
 *                                        that after this
 *
 * Pure Node — `zlib` for the PNG codec, no image library.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const SRC = "apps/mobile/assets/images/FOUR LOGO White Alpha.png";
const DIR = "apps/mobile/assets/images";

/** The app background — must match `backgroundColor` in app.json. */
const BG = [0x0d, 0x10, 0x13];

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

/** colorType 6 (RGBA, bpp 4) or 2 (opaque RGB, bpp 3). */
function writePng(path, size, px, colorType) {
  const bpp = colorType === 2 ? 3 : 4;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;

  const stride = size * bpp;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
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

// The mark's real extent. The master is drawn edge-to-edge, but the bbox
// crop keeps this robust if the export ever gains a margin.
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

/**
 * Render the mark centred on a `size` canvas at `fill` of the canvas height,
 * returning the box-sampled alpha for each pixel. Box-sampling matters: the
 * source is 2048px and the outputs as small as 432 — point-sampling would
 * alias the letter edges badly.
 */
function renderAlpha(size, fill) {
  const box = size * fill;
  const scale = Math.min(box / markW, box / markH);
  const drawW = markW * scale;
  const drawH = markH * scale;
  const originX = (size - drawW) / 2;
  const originY = (size - drawH) / 2;

  const alpha = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx0 = minX + (x - originX) / scale;
      const sy0 = minY + (y - originY) / scale;
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
      if (n > 0) alpha[y * size + x] = Math.round(sum / n);
    }
  }
  return alpha;
}

/** White mark on transparency. */
function writeTransparent(name, size, fill) {
  const alpha = renderAlpha(size, fill);
  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] === 0) continue;
    out[i * 4] = 255;
    out[i * 4 + 1] = 255;
    out[i * 4 + 2] = 255;
    out[i * 4 + 3] = alpha[i];
  }
  writePng(`${DIR}/${name}`, size, out, 6);
  console.log(`${DIR}/${name}  ${size}x${size}, white on transparent, fill ${fill}`);
}

/** White mark composited over the app background, no alpha channel at all. */
function writeOpaque(name, size, fill) {
  const alpha = renderAlpha(size, fill);
  const out = Buffer.alloc(size * size * 3);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i] / 255;
    out[i * 3] = Math.round(255 * a + BG[0] * (1 - a));
    out[i * 3 + 1] = Math.round(255 * a + BG[1] * (1 - a));
    out[i * 3 + 2] = Math.round(255 * a + BG[2] * (1 - a));
  }
  writePng(`${DIR}/${name}`, size, out, 2);
  console.log(`${DIR}/${name}  ${size}x${size}, opaque on #0d1013, fill ${fill}`);
}

console.log(`${SRC}  ${src.width}x${src.height}, mark ${markW}x${markH}`);

writeOpaque("icon.png", 1024, 0.74);
writeTransparent("splash-icon.png", 512, 0.92);
writeTransparent("android-icon-foreground.png", 1024, 0.45);
writeTransparent("android-icon-monochrome.png", 432, 0.45);

console.log("Now run: npm run icon:notification");
