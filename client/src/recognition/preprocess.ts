/**
 * A bit-faithful TypeScript port of `ai-service/preprocessing.py`.
 *
 * The Python pipeline is Pillow + NumPy, and Pillow's filters have specific
 * integer semantics that a generic "Gaussian blur" or "Lanczos resize" does
 * not reproduce. Every step here follows the corresponding C routine in
 * Pillow's libImaging so the 28×28 input the model sees in the browser is the
 * same one the Python service would have produced:
 *
 *   1-3. decode → composite on opaque black → grayscale      AlphaComposite.c, Convert.c (rgb2l)
 *   4.   GaussianBlur(radius=1.5)                           BoxBlur.c: three box-blur passes per axis,
 *                                                          box radius from _gaussian_blur_radius,
 *                                                          24-bit fixed-point line blur, edge replication
 *   5.   threshold at 30 → {0, 255}                          NumPy
 *   6.   MaxFilter(3)                                        RankFilter.c on an edge-replicated image
 *   7-8. crop to content with padding, pad to a square       NumPy / Image.paste
 *   9.   resize to 28×28 with LANCZOS                        Resample.c: separable, 22-bit fixed-point coefficients,
 *                                                          horizontal pass then vertical pass, clipped to 8 bits
 *   10.  /255 and invert if the mean is above 0.5            NumPy
 *
 * No DOM here: the input is raw RGBA bytes, which the browser gets from
 * `getImageData` and Node gets from a PNG decoder. `tests/preprocessParity.test.ts`
 * checks this port against the Python output on recorded fixtures.
 */

export const INPUT_SIZE = 28;
const THRESHOLD = 30;
const BLUR_RADIUS = 1.5;
const BLUR_PASSES = 3;

export interface GrayImage {
  width: number;
  height: number;
  /** Row-major 8-bit luminance. */
  data: Uint8Array;
}

// ── 2–3. Composite on black, then grayscale ──────────────────────────────

/** `(((a >> 8) + a) >> 8)` — Pillow's SHIFTFORDIV255. */
function shiftForDiv255(a: number): number {
  return ((a >>> 8) + a) >>> 8;
}

/**
 * Pillow `Image.alpha_composite(black, img).convert("L")` for one pixel.
 * With an opaque black destination the integer blend simplifies to
 * `coef1 = a * 128`, `coef2 = (255 - a) * 128`, so only the source term survives.
 */
export function compositeToGray(rgba: ArrayLike<number>, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    const a = rgba[p + 3];
    if (a === 0) continue; // out = dst = black
    const coef1 = a * 128; // src.a * 255 * 255 * (1 << 7) / outa255, exact for an opaque destination
    const half = 0x80 << 7;
    const r = shiftForDiv255(rgba[p] * coef1 + half) >>> 7;
    const g = shiftForDiv255(rgba[p + 1] * coef1 + half) >>> 7;
    const b = shiftForDiv255(rgba[p + 2] * coef1 + half) >>> 7;
    // Convert.c rgb2l: L24(rgb) >> 16
    data[i] = (r * 19595 + g * 38470 + b * 7471 + 0x8000) >>> 16;
  }
  return { width, height, data };
}

// ── 4. Gaussian blur as Pillow does it: three box blurs per axis ─────────

/** BoxBlur.c `_gaussian_blur_radius`, evaluated in single precision like the C float code. */
export function gaussianBlurBoxRadius(radius: number, passes: number): number {
  const f = Math.fround;
  const sigma2 = f(f(f(radius) * f(radius)) / passes);
  const L = f(Math.sqrt(12.0 * sigma2 + 1.0));
  const l = f(Math.floor((L - 1.0) / 2.0));
  let a = f(f(2 * l + 1) * f(f(l * f(l + 1)) - f(3 * sigma2)));
  a = f(a / f(6 * f(sigma2 - f(f(l + 1) * f(l + 1)))));
  return f(l + a);
}

/**
 * BoxBlur.c `ImagingLineBoxBlur8`. `line` is read, `out` is written; both have
 * `n` entries. Fixed-point with 24 fractional bits, rounded, edges replicated.
 */
function lineBoxBlur8(line: Uint8Array, out: Uint8Array, n: number, radius: number, edgeA: number, edgeB: number, ww: number, fw: number): void {
  const lastx = n - 1;
  let acc = line[0] * (radius + 1);
  for (let x = 0; x < radius; x++) acc += line[x];

  const save = (x: number, bulk: number) => {
    out[x] = (bulk + (1 << 23)) >>> 24;
  };

  if (edgeA <= edgeB) {
    for (let x = 0; x < edgeA; x++) {
      acc += line[x + radius] - line[0];
      save(x, acc * ww + (line[0] + line[x + radius + 1]) * fw);
    }
    for (let x = edgeA; x < edgeB; x++) {
      acc += line[x + radius] - line[x - radius - 1];
      save(x, acc * ww + (line[x - radius - 1] + line[x + radius + 1]) * fw);
    }
    for (let x = edgeB; x <= lastx; x++) {
      acc += line[lastx] - line[x - radius - 1];
      save(x, acc * ww + (line[x - radius - 1] + line[lastx]) * fw);
    }
  } else {
    for (let x = 0; x < edgeB; x++) {
      acc += line[x + radius] - line[0];
      save(x, acc * ww + (line[0] + line[x + radius + 1]) * fw);
    }
    for (let x = edgeB; x < edgeA; x++) {
      acc += line[lastx] - line[0];
      save(x, acc * ww + (line[0] + line[lastx]) * fw);
    }
    for (let x = edgeA; x <= lastx; x++) {
      acc += line[lastx] - line[x - radius - 1];
      save(x, acc * ww + (line[x - radius - 1] + line[lastx]) * fw);
    }
  }
}

/** BoxBlur.c `ImagingHorizontalBoxBlur` parameters for a line of length `n`. */
function boxBlurParams(floatRadius: number, n: number) {
  const radius = Math.trunc(floatRadius);
  // UINT32 ww = (UINT32)(1 << 24) / (floatRadius * 2 + 1);   (float division, truncated)
  const ww = Math.trunc(Math.fround(16777216 / Math.fround(Math.fround(Math.fround(floatRadius) * 2) + 1)));
  // UINT32 fw = ((1 << 24) - (radius * 2 + 1) * ww) / 2;      (integer division)
  const fw = Math.trunc((16777216 - (radius * 2 + 1) * ww) / 2);
  const edgeA = Math.min(radius + 1, n);
  const edgeB = Math.max(n - radius - 1, 0);
  return { radius, ww, fw, edgeA, edgeB };
}

/** BoxBlur.c `ImagingBoxBlur`: `passes` horizontal passes, then `passes` vertical passes. */
export function boxBlur(img: GrayImage, floatRadius: number, passes: number): GrayImage {
  const { width, height } = img;
  const out = new Uint8Array(img.data);
  if (floatRadius === 0 || passes < 1) return { width, height, data: out };

  const h = boxBlurParams(floatRadius, width);
  const rowIn = new Uint8Array(width);
  const rowOut = new Uint8Array(width);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      rowIn.set(out.subarray(y * width, (y + 1) * width));
      lineBoxBlur8(rowIn, rowOut, width, h.radius, h.edgeA, h.edgeB, h.ww, h.fw);
      out.set(rowOut, y * width);
    }
  }

  const v = boxBlurParams(floatRadius, height);
  const colIn = new Uint8Array(height);
  const colOut = new Uint8Array(height);
  for (let pass = 0; pass < passes; pass++) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) colIn[y] = out[y * width + x];
      lineBoxBlur8(colIn, colOut, height, v.radius, v.edgeA, v.edgeB, v.ww, v.fw);
      for (let y = 0; y < height; y++) out[y * width + x] = colOut[y];
    }
  }
  return { width, height, data: out };
}

/** `ImageFilter.GaussianBlur(radius)` (three passes per axis). */
export function gaussianBlur(img: GrayImage, radius: number = BLUR_RADIUS): GrayImage {
  return boxBlur(img, gaussianBlurBoxRadius(radius, BLUR_PASSES), BLUR_PASSES);
}

// ── 5–6. Threshold and dilate ────────────────────────────────────────────

/** `(arr > threshold) * 255` */
export function threshold(img: GrayImage, level: number = THRESHOLD): GrayImage {
  const data = new Uint8Array(img.data.length);
  for (let i = 0; i < data.length; i++) data[i] = img.data[i] > level ? 255 : 0;
  return { width: img.width, height: img.height, data };
}

/**
 * `ImageFilter.MaxFilter(3)`: Pillow expands the image by one replicated edge
 * pixel and takes the 3×3 maximum, which is the max over the clamped window.
 */
export function maxFilter3(img: GrayImage): GrayImage {
  const { width, height } = img;
  const src = img.data;
  const data = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(width - 1, x + 1);
      let m = 0;
      for (let yy = y0; yy <= y1; yy++) {
        const row = yy * width;
        for (let xx = x0; xx <= x1; xx++) {
          const v = src[row + xx];
          if (v > m) m = v;
        }
      }
      data[y * width + x] = m;
    }
  }
  return { width, height, data };
}

// ── 7–8. Crop to content, pad into a centred square ─────────────────────

/** Steps 7 and 8 of preprocessing.py. Returns null for a blank image. */
export function cropToSquare(img: GrayImage): GrayImage | null {
  const { width, height, data } = img;
  let yMin = height, yMax = -1, xMin = width, xMax = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[row + x] > 0) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
      }
    }
  }
  if (yMax < 0) return null;

  const h = yMax - yMin;
  const w = xMax - xMin;
  const pad = Math.max(Math.trunc(Math.max(h, w) * 0.2), 4);
  yMin = Math.max(0, yMin - pad);
  xMin = Math.max(0, xMin - pad);
  yMax = Math.min(height, yMax + pad); // exclusive, like the NumPy slice
  xMax = Math.min(width, xMax + pad);

  const cw = xMax - xMin;
  const ch = yMax - yMin;
  const size = Math.max(cw, ch);
  const square = new Uint8Array(size * size);
  const offX = Math.floor((size - cw) / 2);
  const offY = Math.floor((size - ch) / 2);
  for (let y = 0; y < ch; y++) {
    square.set(data.subarray((yMin + y) * width + xMin, (yMin + y) * width + xMax), (offY + y) * size + offX);
  }
  return { width: size, height: size, data: square };
}

// ── 9. LANCZOS resize, Pillow style ──────────────────────────────────────

const LANCZOS_SUPPORT = 3.0;
const PRECISION_BITS = 32 - 8 - 2;

function sinc(x: number): number {
  if (x === 0) return 1;
  x *= Math.PI;
  return Math.sin(x) / x;
}

function lanczosFilter(x: number): number {
  if (-3.0 <= x && x < 3.0) return sinc(x) * sinc(x / 3);
  return 0;
}

interface Coeffs {
  ksize: number;
  bounds: Int32Array; // xmin, xmax(count) pairs
  kk: Int32Array; // outSize * ksize fixed-point coefficients
}

/** Resample.c `precompute_coeffs` + `normalize_coeffs_8bpc` for the whole input range. */
export function precomputeLanczosCoeffs(inSize: number, outSize: number): Coeffs {
  const scale = inSize / outSize;
  const filterscale = scale < 1 ? 1 : scale;
  const support = LANCZOS_SUPPORT * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const kk = new Int32Array(outSize * ksize);
  const k = new Float64Array(ksize);
  const ss = 1 / filterscale;

  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;

    let ww = 0;
    for (let x = 0; x < xmax; x++) {
      const w = lanczosFilter((x + xmin - center + 0.5) * ss);
      k[x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) if (ww !== 0) k[x] /= ww;
    for (let x = xmax; x < ksize; x++) k[x] = 0;

    for (let x = 0; x < ksize; x++) {
      const v = k[x] * (1 << PRECISION_BITS);
      kk[xx * ksize + x] = v < 0 ? Math.trunc(-0.5 + v) : Math.trunc(0.5 + v);
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, bounds, kk };
}

function clip8(ss0: number): number {
  const v = Math.floor(ss0 / (1 << PRECISION_BITS));
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** `Image.resize((w, h), Image.LANCZOS)` on an "L" image: horizontal pass, then vertical. */
export function resizeLanczos(img: GrayImage, outW: number, outH: number): GrayImage {
  if (img.width === outW && img.height === outH) return { width: outW, height: outH, data: new Uint8Array(img.data) };

  const hc = precomputeLanczosCoeffs(img.width, outW);
  const temp = new Uint8Array(outW * img.height);
  for (let y = 0; y < img.height; y++) {
    const row = y * img.width;
    for (let xx = 0; xx < outW; xx++) {
      const xmin = hc.bounds[xx * 2];
      const xmax = hc.bounds[xx * 2 + 1];
      let ss0 = 1 << (PRECISION_BITS - 1);
      for (let x = 0; x < xmax; x++) ss0 += img.data[row + x + xmin] * hc.kk[xx * hc.ksize + x];
      temp[y * outW + xx] = clip8(ss0);
    }
  }

  const vc = precomputeLanczosCoeffs(img.height, outH);
  const out = new Uint8Array(outW * outH);
  for (let yy = 0; yy < outH; yy++) {
    const ymin = vc.bounds[yy * 2];
    const ymax = vc.bounds[yy * 2 + 1];
    for (let x = 0; x < outW; x++) {
      let ss0 = 1 << (PRECISION_BITS - 1);
      for (let y = 0; y < ymax; y++) ss0 += temp[(y + ymin) * outW + x] * vc.kk[yy * vc.ksize + y];
      out[yy * outW + x] = clip8(ss0);
    }
  }
  return { width: outW, height: outH, data: out };
}

// ── 10. Normalise ───────────────────────────────────────────────────────

/** `/ 255`, then `1 - x` when the mean is above 0.5 (white-on-black convention). */
export function normalise(img: GrayImage): Float32Array {
  const out = new Float32Array(img.data.length);
  let sum = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.fround(img.data[i] / 255);
    sum += out[i];
  }
  if (sum / out.length > 0.5) {
    for (let i = 0; i < out.length; i++) out[i] = Math.fround(1 - out[i]);
  }
  return out;
}

// ── The whole pipeline ──────────────────────────────────────────────────

export interface PreprocessStages {
  gray: GrayImage;
  blurred: GrayImage;
  binary: GrayImage;
  dilated: GrayImage;
  square: GrayImage | null;
  resized: GrayImage | null;
  /** 28×28 float32 in [0, 1], or null for a blank image. */
  input: Float32Array | null;
}

/** Runs every step and keeps the intermediates (for tests and debugging). */
export function preprocessStages(rgba: ArrayLike<number>, width: number, height: number): PreprocessStages {
  const gray = compositeToGray(rgba, width, height);
  const blurred = gaussianBlur(gray);
  const binary = threshold(blurred);
  const dilated = maxFilter3(binary);
  const square = cropToSquare(dilated);
  const resized = square ? resizeLanczos(square, INPUT_SIZE, INPUT_SIZE) : null;
  const input = resized ? normalise(resized) : null;
  return { gray, blurred, binary, dilated, square, resized, input };
}

/**
 * `preprocess_image()` for raw RGBA pixels: returns the 28×28 model input as a
 * flat float32 array (row-major), or null when the image is blank.
 */
export function preprocessRgba(rgba: ArrayLike<number>, width: number, height: number): Float32Array | null {
  return preprocessStages(rgba, width, height).input;
}
