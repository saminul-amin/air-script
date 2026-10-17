import type { Point, Sample, SampleCharacter } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../config";

/**
 * Recorded-style stroke sequences used by "Replay a sample". Each glyph is a
 * hand-drawn-looking polyline in screen coordinates, generated from a few
 * control points with a deterministic wobble so it does not look machine-made.
 *
 * Only characters the EMNIST Balanced model knows are used
 * (digits, uppercase A–Z, and lowercase a b d e f g h n q r t).
 */

// Deterministic pseudo-random wobble (mulberry32) so replays are identical every time.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Interpolate a polyline of control points into dense, slightly wobbly points. */
function trace(control: Point[], seed: number, stepPx = 6): Point[] {
  const rand = rng(seed);
  const out: Point[] = [];
  for (let i = 0; i < control.length - 1; i++) {
    const a = control[i];
    const b = control[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(2, Math.round(len / stepPx));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({
        x: a.x + (b.x - a.x) * t + (rand() - 0.5) * 2.2,
        y: a.y + (b.y - a.y) * t + (rand() - 0.5) * 2.2,
      });
    }
  }
  out.push(control[control.length - 1]);
  return out;
}

/** Sample an arc of an ellipse (angles in degrees, clockwise on screen). */
function arc(cx: number, cy: number, rx: number, ry: number, fromDeg: number, toDeg: number, n = 24): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = fromDeg + ((toDeg - fromDeg) * i) / n;
    const rad = (t * Math.PI) / 180;
    pts.push({ x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) });
  }
  return pts;
}

// Glyphs are defined in a 200 × 260 box, then placed on the canvas.
const BOX_W = 200;
const BOX_H = 260;

type GlyphFn = (seed: number) => Point[][];

const GLYPHS: Record<string, GlyphFn> = {
  H: (s) => [
    trace([{ x: 30, y: 20 }, { x: 34, y: 240 }], s),
    trace([{ x: 170, y: 20 }, { x: 166, y: 240 }], s + 1),
    trace([{ x: 32, y: 128 }, { x: 168, y: 132 }], s + 2),
  ],
  E: (s) => [
    trace([{ x: 160, y: 24 }, { x: 40, y: 20 }, { x: 44, y: 240 }, { x: 165, y: 236 }], s),
    trace([{ x: 44, y: 128 }, { x: 140, y: 130 }], s + 1),
  ],
  L: (s) => [trace([{ x: 50, y: 20 }, { x: 54, y: 238 }, { x: 165, y: 236 }], s)],
  O: (s) => [trace(arc(100, 130, 70, 108, -80, 280, 30), s)],
  A: (s) => [
    trace([{ x: 30, y: 240 }, { x: 100, y: 20 }, { x: 170, y: 240 }], s),
    trace([{ x: 58, y: 165 }, { x: 144, y: 167 }], s + 1),
  ],
  I: (s) => [trace([{ x: 100, y: 20 }, { x: 102, y: 240 }], s)],
  R: (s) => [
    trace([{ x: 40, y: 240 }, { x: 42, y: 20 }, ...arc(105, 78, 60, 58, -90, 90, 14), { x: 44, y: 136 }], s),
    trace([{ x: 90, y: 136 }, { x: 170, y: 240 }], s + 1),
  ],
  "2": (s) => [trace([...arc(100, 80, 62, 60, -160, 60, 16), { x: 40, y: 236 }, { x: 170, y: 236 }], s)],
  "0": (s) => [trace(arc(100, 130, 62, 108, -90, 270, 30), s)],
  "6": (s) => [
    trace([{ x: 150, y: 30 }, { x: 70, y: 110 }, ...arc(100, 180, 62, 60, -180, 180, 20)], s),
  ],
};

function placeGlyph(char: string, seed: number): SampleCharacter {
  const glyph = GLYPHS[char];
  if (!glyph) throw new Error(`No sample glyph for "${char}"`);
  const scale = 0.95;
  const offsetX = (CANVAS_WIDTH - BOX_W * scale) / 2;
  const offsetY = (CANVAS_HEIGHT - BOX_H * scale) / 2;
  const strokes = glyph(seed).map((stroke) =>
    stroke.map((p) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })),
  );
  return { char, strokes };
}

function word(id: string, label: string, description: string, chars: string): Sample {
  return {
    id,
    label,
    description,
    language: "en",
    characters: chars.split("").map((c, i) => placeGlyph(c, id.length * 97 + i * 13)),
  };
}

// ── Bengali glyphs ─────────────────────────────────────────────────────────
// Polylines traced from a printed Bengali font (ai-service/tools/bn_glyph_strokes.py:
// skeletonised glyph outlines, simplified, scaled into the box). Hand-drawn
// attempts read poorly; these read as intended through the trained model in
// Chrome too (`npm run check:samples` covers the Node side). ল and ং were tried
// and dropped: both sit on a decision boundary (ল/ন) and flip with the renderer.
const BN_TRACED: Record<string, Point[][]> = {
  "ব": [[{ x: 139.2, y: 92.5 }, { x: 102.8, y: 93.6 }, { x: 74.0, y: 101.3 }, { x: 52.0, y: 116.7 }, { x: 47.5, y: 136.6 }, { x: 29.9, y: 144.4 }], [{ x: 140.3, y: 204.0 }, { x: 140.3, y: 53.8 }, { x: 24.4, y: 52.7 }], [{ x: 48.7, y: 137.7 }, { x: 137.0, y: 173.1 }], [{ x: 174.5, y: 52.7 }, { x: 141.4, y: 52.7 }]],
  "আ": [[{ x: 24.3, y: 126.4 }, { x: 38.7, y: 147.2 }, { x: 49.4, y: 155.8 }, { x: 66.7, y: 160.8 }, { x: 78.1, y: 159.4 }, { x: 97.5, y: 142.2 }, { x: 96.1, y: 116.4 }, { x: 90.3, y: 104.2 }, { x: 80.3, y: 99.9 }, { x: 68.8, y: 101.3 }, { x: 63.8, y: 116.4 }], [{ x: 159.9, y: 182.4 }, { x: 159.2, y: 83.4 }, { x: 168.5, y: 76.9 }, { x: 180.0, y: 75.5 }], [{ x: 124.7, y: 173.7 }, { x: 124.7, y: 76.2 }, { x: 139.8, y: 76.9 }, { x: 158.4, y: 84.1 }], [{ x: 124.0, y: 75.5 }, { x: 19.3, y: 75.5 }], [{ x: 98.2, y: 142.9 }, { x: 123.3, y: 150.1 }]],
  "ক": [[{ x: 139.4, y: 147.8 }, { x: 151.6, y: 141.2 }, { x: 149.7, y: 116.9 }, { x: 131.9, y: 101.9 }, { x: 102.8, y: 98.1 }, { x: 102.8, y: 65.3 }, { x: 176.9, y: 64.4 }], [{ x: 102.8, y: 192.8 }, { x: 102.8, y: 99.1 }, { x: 76.6, y: 100.9 }, { x: 57.8, y: 108.4 }, { x: 45.6, y: 118.8 }, { x: 41.9, y: 135.6 }, { x: 25.0, y: 143.1 }], [{ x: 41.9, y: 136.6 }, { x: 100.0, y: 162.8 }], [{ x: 101.9, y: 64.4 }, { x: 22.2, y: 64.4 }]],
  "ম": [[{ x: 81.8, y: 122.3 }, { x: 52.0, y: 126.7 }, { x: 44.2, y: 143.3 }, { x: 46.4, y: 155.4 }, { x: 55.3, y: 163.1 }, { x: 78.5, y: 162.0 }, { x: 84.0, y: 156.5 }, { x: 88.4, y: 134.4 }], [{ x: 140.3, y: 204.0 }, { x: 137.0, y: 148.8 }, { x: 88.4, y: 133.3 }, { x: 78.5, y: 94.7 }, { x: 66.3, y: 79.2 }, { x: 58.6, y: 56.0 }, { x: 24.4, y: 52.7 }], [{ x: 174.5, y: 52.7 }, { x: 140.3, y: 53.8 }, { x: 138.1, y: 148.8 }], [{ x: 139.2, y: 52.7 }, { x: 63.0, y: 52.7 }, { x: 59.7, y: 56.0 }]],
  "২": [[{ x: 56.3, y: 19.7 }, { x: 50.8, y: 32.2 }, { x: 53.5, y: 37.7 }, { x: 67.4, y: 51.6 }, { x: 125.7, y: 86.3 }, { x: 132.6, y: 96.0 }, { x: 135.4, y: 109.9 }, { x: 128.4, y: 144.6 }, { x: 111.8, y: 155.7 }, { x: 107.6, y: 162.6 }, { x: 59.1, y: 155.7 }], [{ x: 106.2, y: 164.0 }, { x: 114.6, y: 184.8 }, { x: 143.7, y: 219.5 }, { x: 143.7, y: 238.9 }]],
  "০": [[{ x: 154.0, y: 168.5 }, { x: 160.5, y: 157.0 }, { x: 163.8, y: 119.4 }, { x: 155.6, y: 91.5 }, { x: 140.9, y: 75.2 }, { x: 118.0, y: 63.7 }, { x: 88.5, y: 62.1 }, { x: 68.9, y: 67.0 }, { x: 52.5, y: 78.5 }, { x: 39.5, y: 94.8 }, { x: 31.3, y: 130.8 }, { x: 39.5, y: 163.5 }, { x: 57.5, y: 184.8 }, { x: 82.0, y: 194.6 }, { x: 114.7, y: 194.6 }, { x: 139.3, y: 184.8 }, { x: 152.4, y: 170.1 }]],
  "দ": [[{ x: 150.7, y: 217.4 }, { x: 151.7, y: 208.1 }, { x: 143.4, y: 191.6 }, { x: 137.2, y: 154.3 }, { x: 140.3, y: 92.2 }, { x: 114.5, y: 97.4 }, { x: 89.7, y: 119.1 }, { x: 64.8, y: 127.4 }, { x: 62.8, y: 160.5 }], [{ x: 63.8, y: 126.4 }, { x: 61.7, y: 40.5 }, { x: 24.5, y: 39.5 }], [{ x: 62.8, y: 40.5 }, { x: 174.5, y: 39.5 }], [{ x: 130.0, y: 104.7 }, { x: 139.3, y: 95.3 }], [{ x: 126.9, y: 108.8 }, { x: 125.9, y: 107.8 }]],
  "৫": [[{ x: 133.4, y: 107.4 }, { x: 113.0, y: 89.2 }, { x: 107.4, y: 63.2 }, { x: 100.6, y: 58.7 }, { x: 76.8, y: 65.5 }, { x: 64.3, y: 76.8 }, { x: 40.6, y: 107.4 }, { x: 29.2, y: 133.4 }, { x: 27.0, y: 154.9 }, { x: 31.5, y: 177.5 }, { x: 49.6, y: 200.2 }, { x: 71.1, y: 211.5 }, { x: 89.2, y: 214.9 }, { x: 110.8, y: 214.9 }, { x: 115.3, y: 208.1 }], [{ x: 180.9, y: 100.6 }, { x: 162.8, y: 100.6 }, { x: 134.5, y: 108.5 }, { x: 127.7, y: 125.5 }, { x: 116.4, y: 134.5 }, { x: 105.1, y: 152.6 }, { x: 102.8, y: 168.5 }, { x: 114.2, y: 204.7 }, { x: 144.7, y: 210.4 }]],
};

/** Polyline length in box units. */
function pathLength(poly: Point[]): number {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  return len;
}

// Specks shorter than this carry no shape; anything longer is drawn even if the
// stroke validator may reject it (the replay still recognises the character).
const MIN_FRAGMENT = 6;

const BN_GLYPHS: Record<string, GlyphFn> = Object.fromEntries(
  Object.entries(BN_TRACED).map(([ch, polys]) => [
    ch,
    (s: number) =>
      polys
        .filter((poly) => pathLength(poly) >= MIN_FRAGMENT)
        .map((poly, i) => trace(poly, s + i)),
  ]),
);


/** The dataset's strokes are thick; replay (and Bengali drawing) use this width. */
export const BENGALI_INK_WIDTH = 11;

function placeBengaliGlyph(char: string, seed: number): SampleCharacter {
  const glyph = BN_GLYPHS[char];
  if (!glyph) throw new Error(`No Bengali sample glyph for "${char}"`);
  // Larger than the English glyphs: the pointer smoothing rounds small loops
  // (ল, ং) less when the glyph is bigger, and the crop normalises size anyway.
  const scale = 1.25;
  const offsetX = (CANVAS_WIDTH - BOX_W * scale) / 2;
  const offsetY = (CANVAS_HEIGHT - BOX_H * scale) / 2;
  const strokes = glyph(seed).map((stroke) => stroke.map((p) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })));
  return { char, strokes };
}

/** A Bengali sample: `chars` are the isolated characters drawn in order; the app composes them. */
function bengaliWord(id: string, label: string, description: string, chars: string[]): Sample {
  return {
    id,
    label,
    description,
    language: "bn",
    strokeWidth: BENGALI_INK_WIDTH,
    characters: chars.map((c, i) => placeBengaliGlyph(c, id.length * 89 + i * 17)),
  };
}

export const SAMPLES: Sample[] = [
  word("hello", "HELLO", "Five letters, one word — watch the correction step lowercase it.", "HELLO"),
  word("air", "AIR", "Three quick capitals.", "AIR"),
  word("year", "2026", "Digits stay digits in a numeric context.", "2026"),
  bengaliWord("kak", "কাক", "ক আ ক — the আ written after ক becomes its sign (া): crow.", ["ক", "আ", "ক"]),
  bengaliWord("dada", "দাদা", "দ আ দ আ — two compositions: grandfather.", ["দ", "আ", "দ", "আ"]),
  bengaliWord("bn-year", "২০২৫", "Bengali digits.", ["২", "০", "২", "৫"]),
];

export const DEFAULT_SAMPLE_ID = SAMPLES[0].id;
