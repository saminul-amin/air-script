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
    characters: chars.split("").map((c, i) => placeGlyph(c, id.length * 97 + i * 13)),
  };
}

export const SAMPLES: Sample[] = [
  word("hello", "HELLO", "Five letters, one word — watch the correction step lowercase it.", "HELLO"),
  word("air", "AIR", "Three quick capitals.", "AIR"),
  word("year", "2026", "Digits stay digits in a numeric context.", "2026"),
];

export const DEFAULT_SAMPLE_ID = SAMPLES[0].id;
