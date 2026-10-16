/**
 * Render the preprocessing parity fixtures.
 *
 *   npx vite-node scripts/make-preprocessing-fixtures.ts
 *
 * Each fixture is a 640×480 PNG painted with the same `paintStrokes` the app
 * uses for recognition snapshots (white ink, transparent background, mirrored
 * back the way `strokesToImageBlob` does it). The set is:
 *
 *   - every character of the built-in sample replays, drawn the way
 *     `useSampleReplay` feeds them through `useCanvas` (smoothed points);
 *   - each distinct sample glyph at several scales, positions, widths, with
 *     and without speed-sensitive widths;
 *   - edge cases: a one-pixel-wide line, a glyph that clips the canvas edge, a
 *     tiny glyph (upscaling path), a solid page (inversion path), a stroke
 *     with a detached dot, and two separated marks.
 *
 * Afterwards run `python tools/make_preprocessing_fixtures.py` in
 * `ai-service/` to record the Python pipeline's output for each PNG.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { SAMPLES } from "../src/data/samples";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../src/config";
import { paintStrokes, forRecognition } from "../src/utils/strokePayload";
import { smoothCoordinate } from "../src/utils/drawing";
import type { Point, Stroke } from "../src/types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../tests/fixtures/preprocessing");

interface FixtureEntry {
  id: string;
  source: string;
  strokes: Stroke[];
}

// Deterministic pseudo-random numbers (mulberry32) so the set is reproducible.
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

/** Feed points the way useCanvas does: mirrored input, 0.55 lerp smoothing. */
function asDrawn(points: Point[], mirrorInput: boolean): Point[] {
  const out: Point[] = [];
  let prev: Point | null = null;
  for (const p of points) {
    const x = mirrorInput ? CANVAS_WIDTH - p.x : p.x;
    const y = p.y;
    const px = prev ? smoothCoordinate(prev.x, x, 0.55) : x;
    const py = prev ? smoothCoordinate(prev.y, y, 0.55) : y;
    out.push({ x: px, y: py });
    prev = { x: px, y: py };
  }
  return out;
}

/** Speed-sensitive widths like useCanvas, from the point spacing. */
function speedWidths(points: Point[], base: number): number[] {
  const widths: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      widths.push(base);
      continue;
    }
    const speed = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const factor = 1.25 - (1.25 - 0.55) * Math.min(1, speed / 18);
    const prev = widths[i - 1];
    widths.push(prev + (base * factor - prev) * 0.25);
  }
  return widths;
}

function transform(points: Point[], scale: number, dx: number, dy: number): Point[] {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  return points.map((p) => ({ x: cx + (p.x - cx) * scale + dx, y: cy + (p.y - cy) * scale + dy }));
}

function makeStrokes(raw: Point[][], opts: { width: number; variable: boolean; scale?: number; dx?: number; dy?: number; mirrorInput?: boolean }): Stroke[] {
  const { width, variable, scale = 1, dx = 0, dy = 0, mirrorInput = true } = opts;
  return raw.map((pts) => {
    const points = asDrawn(transform(pts, scale, dx, dy), mirrorInput);
    return { points, color: "#1c1f27", width, widths: variable ? speedWidths(points, width) : undefined };
  });
}

function render(strokes: Stroke[]): Buffer {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  // strokesToImageBlob(mirrored = true)
  ctx.translate(CANVAS_WIDTH, 0);
  ctx.scale(-1, 1);
  paintStrokes(ctx, forRecognition(strokes));
  return canvas.toBuffer("image/png");
}

function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const entries: FixtureEntry[] = [];
  const add = (id: string, source: string, strokes: Stroke[]) => entries.push({ id, source, strokes });

  // 1. Sample replays, exactly as the app replays them.
  for (const sample of SAMPLES) {
    sample.characters.forEach((ch, i) => {
      add(`sample-${sample.id}-${i}-${ch.char}`, `sample replay "${sample.label}" character ${i} (${ch.char})`, makeStrokes(ch.strokes, { width: 4, variable: true }));
    });
  }

  // 2. Distinct glyphs under variations.
  const glyphs = new Map<string, Point[][]>();
  for (const sample of SAMPLES) for (const ch of sample.characters) if (!glyphs.has(ch.char)) glyphs.set(ch.char, ch.strokes);
  const variations = [
    { tag: "small", scale: 0.45, dx: -160, dy: 60, width: 3, variable: false },
    { tag: "large", scale: 1.3, dx: 0, dy: 0, width: 4, variable: true },
    { tag: "thick", scale: 0.9, dx: 120, dy: -40, width: 8, variable: false },
    { tag: "thin", scale: 1.0, dx: -60, dy: 30, width: 2, variable: true },
    { tag: "offset", scale: 0.7, dx: 180, dy: 110, width: 5, variable: true },
  ];
  for (const [char, strokes] of glyphs) {
    for (const v of variations) {
      add(`glyph-${char}-${v.tag}`, `glyph ${char}, ${v.tag} (scale ${v.scale}, width ${v.width}${v.variable ? ", speed widths" : ""})`, makeStrokes(strokes, v));
    }
  }

  // 3. Edge cases.
  const rand = rng(7);
  const wobble = (pts: Point[], amp: number) => pts.map((p) => ({ x: p.x + (rand() - 0.5) * amp, y: p.y + (rand() - 0.5) * amp }));
  const line = (a: Point, b: Point, n = 40): Point[] => Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / (n - 1), y: a.y + ((b.y - a.y) * i) / (n - 1) }));

  add("edge-hairline", "one-pixel diagonal hairline (dilation keeps it)", makeStrokes([wobble(line({ x: 200, y: 400 }, { x: 440, y: 80 }), 1.5)], { width: 1, variable: false }));
  add("edge-clipped", "glyph O scaled past the canvas edge (crop clamps to the border)", makeStrokes(glyphs.get("O")!, { width: 6, variable: false, scale: 2.1, dx: 0, dy: 0 }));
  add("edge-tiny", "glyph A at 7% (smaller than 28 px, exercises Lanczos upscaling)", makeStrokes(glyphs.get("A")!, { width: 1, variable: false, scale: 0.07, dx: 90, dy: -70 }));
  add(
    "edge-solid-page",
    "thick strokes covering the whole canvas (mean > 0.5, inversion path)",
    makeStrokes(
      Array.from({ length: 20 }, (_, i) => line({ x: -10, y: -10 + i * 26 }, { x: 650, y: -10 + i * 26 }, 8)),
      { width: 40, variable: false, mirrorInput: false },
    ),
  );
  add(
    "edge-dot-attached",
    "a stroke with a small detached dot above it (the dot of an i)",
    makeStrokes([wobble(line({ x: 320, y: 160 }, { x: 322, y: 360 }), 2), wobble(line({ x: 318, y: 112 }, { x: 324, y: 118 }, 6), 1)], { width: 5, variable: true }),
  );
  add(
    "edge-two-marks",
    "two separate horizontal marks far apart (bounding box spans both)",
    makeStrokes([wobble(line({ x: 120, y: 150 }, { x: 260, y: 155 }), 2), wobble(line({ x: 400, y: 330 }, { x: 540, y: 325 }), 2)], { width: 4, variable: false }),
  );
  add("edge-corner", "glyph 2 pushed into the top-left corner (asymmetric clamping)", makeStrokes(glyphs.get("2")!, { width: 4, variable: true, scale: 0.8, dx: -215, dy: -130 }));
  add(
    "edge-scribble",
    "dense scribble (many self-crossings, wide bounding box)",
    makeStrokes(
      [wobble(Array.from({ length: 160 }, (_, i) => ({ x: 180 + i * 1.8 + Math.sin(i / 3) * 40, y: 240 + Math.cos(i / 2.2) * 90 })), 3)],
      { width: 5, variable: true },
    ),
  );

  const manifest = { canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, fixtures: entries.map((e) => ({ id: e.id, source: e.source, strokes: e.strokes })) };
  for (const e of entries) fs.writeFileSync(path.join(OUT_DIR, `${e.id}.png`), render(e.strokes));
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest));
  console.log(`wrote ${entries.length} fixtures to ${OUT_DIR}`);
}

main();
