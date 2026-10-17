/**
 * Run every "Replay a sample" glyph through the browser pipeline (paintStrokes
 * → TypeScript preprocessing → ONNX) and print what the model makes of it,
 * so a sample that does not read as intended is caught before it ships.
 *
 *   npx vite-node scripts/check-samples.ts
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import * as ort from "onnxruntime-node";
import { SAMPLES } from "../src/data/samples";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../src/config";
import { paintStrokes, forRecognition } from "../src/utils/strokePayload";
import { smoothCoordinate } from "../src/utils/drawing";
import { preprocessRgba, INPUT_SIZE } from "../src/recognition/preprocess";
import { classify } from "../src/recognition/classify";
import { EMNIST_LABELS } from "../src/recognition/labels";
import { BENGALI_LABELS } from "../src/recognition/bengali";
import type { Point, Stroke } from "../src/types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODELS = path.resolve(HERE, "../models");
const MODEL_FOR = { en: { file: "emnist_cnn.int8.onnx", labels: EMNIST_LABELS }, bn: { file: "bn_cnn.int8.onnx", labels: BENGALI_LABELS } } as const;

function asDrawn(points: Point[]): Point[] {
  const out: Point[] = [];
  let prev: Point | null = null;
  for (const p of points) {
    const x = CANVAS_WIDTH - p.x;
    const px = prev ? smoothCoordinate(prev.x, x, 0.55) : x;
    const py = prev ? smoothCoordinate(prev.y, p.y, 0.55) : p.y;
    out.push({ x: px, y: py });
    prev = { x: px, y: py };
  }
  return out;
}

function pixels(strokes: Stroke[]) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.translate(CANVAS_WIDTH, 0);
  ctx.scale(-1, 1);
  paintStrokes(ctx, forRecognition(strokes));
  return ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

async function main() {
  const sessions = new Map<string, ort.InferenceSession>();
  let wrong = 0;
  for (const sample of SAMPLES) {
    const { file, labels } = MODEL_FOR[sample.language];
    if (!sessions.has(file)) sessions.set(file, await ort.InferenceSession.create(path.join(MODELS, file)));
    const session = sessions.get(file)!;
    const line: string[] = [];
    for (const ch of sample.characters) {
      const strokes: Stroke[] = ch.strokes.map((pts) => ({ points: asDrawn(pts), color: "#1c1f27", width: sample.strokeWidth ?? 4 }));
      const img = pixels(strokes);
      const input = preprocessRgba(img.data, img.width, img.height);
      if (!input) {
        line.push(`${ch.char}→(blank)`);
        wrong++;
        continue;
      }
      const out = await session.run({ image: new ort.Tensor("float32", input, [1, 1, INPUT_SIZE, INPUT_SIZE]) });
      const r = classify(out.logits.data as Float32Array, labels);
      const ok = r.prediction === ch.char;
      if (!ok) wrong++;
      line.push(`${ch.char}→${r.prediction} ${(r.confidence * 100).toFixed(0)}%${ok ? "" : ` [top3 ${r.top3.join(" ")}]`}`);
    }
    console.log(`${sample.language} ${sample.label}: ${line.join("  ")}`);
  }
  console.log(wrong === 0 ? "\nevery sample glyph reads as intended" : `\n${wrong} glyph(s) do not read as intended`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
