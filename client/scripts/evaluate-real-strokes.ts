/**
 * Evaluate recorded real strokes through the exact browser pipeline.
 *
 *   npx vite-node scripts/evaluate-real-strokes.ts [set.json ...]
 *
 * Input: one or more JSON files exported by the ?record=1 recorder (default:
 * every file in tests/fixtures/real-strokes/). Each sample carries the PNG the
 * browser would have handed to recognition, so the evaluation is the
 * TypeScript preprocessing plus ONNX Runtime (onnxruntime-node) on the same
 * bytes — the same code path as the app, minus the browser.
 *
 * Output: docs/accuracy-real-strokes.json (top-1, top-3, per-class accuracy,
 * most confused pairs, confusion matrix, for every model in client/models)
 * and a Markdown summary on stdout. Plot the matrix with
 * `python ai-service/tools/plot_confusion.py docs/accuracy-real-strokes.json`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import * as ort from "onnxruntime-node";
import { preprocessRgba, INPUT_SIZE } from "../src/recognition/preprocess";
import { classify } from "../src/recognition/classify";
import { EMNIST_LABELS } from "../src/recognition/labels";
import type { RecordedSet } from "../src/hooks/useRecorder";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(HERE, "../tests/fixtures/real-strokes");
const MODEL_DIR = path.resolve(HERE, "../models");
const OUT = path.resolve(HERE, "../../docs/accuracy-real-strokes.json");
const TOP_K = 3;
const MOST_CONFUSED = 10;

interface ModelMetrics {
  samples: number;
  blank: number;
  top1: number;
  top3: number;
  per_class: Record<string, { support: number; accuracy: number | null }>;
  most_confused: { true: string; predicted: string; count: number; share_of_true_class: number }[];
  confusion_matrix: number[][];
}

function loadSets(files: string[]): RecordedSet["samples"] {
  const samples: RecordedSet["samples"] = [];
  for (const f of files) {
    const set = JSON.parse(fs.readFileSync(f, "utf-8")) as RecordedSet;
    if (set.version !== 1) throw new Error(`${f}: unsupported recorder version ${String(set.version)}`);
    samples.push(...set.samples);
  }
  return samples;
}

function decode(pngBase64: string) {
  const png = PNG.sync.read(Buffer.from(pngBase64, "base64"));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
}

async function evaluate(modelPath: string, inputs: { label: string; input: Float32Array | null }[]): Promise<ModelMetrics> {
  const session = await ort.InferenceSession.create(modelPath);
  const n = EMNIST_LABELS.length;
  const index = new Map(EMNIST_LABELS.map((l, i) => [l, i]));
  const confusion: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  let top1 = 0;
  let top3 = 0;
  let blank = 0;
  let counted = 0;
  for (const { label, input } of inputs) {
    const t = index.get(label);
    if (t === undefined) throw new Error(`label "${label}" is not an EMNIST Balanced class`);
    if (!input) {
      blank++;
      continue;
    }
    const out = await session.run({ image: new ort.Tensor("float32", input, [1, 1, INPUT_SIZE, INPUT_SIZE]) });
    const logits = out.logits.data as Float32Array;
    const result = classify(logits, EMNIST_LABELS);
    const order = Array.from(logits.keys()).sort((a, b) => logits[b] - logits[a]);
    const p = order[0];
    confusion[t][p]++;
    counted++;
    if (result.prediction === label) top1++;
    if (order.slice(0, TOP_K).includes(t)) top3++;
  }
  const per_class: ModelMetrics["per_class"] = {};
  for (let c = 0; c < n; c++) {
    const support = confusion[c].reduce((a, b) => a + b, 0);
    per_class[EMNIST_LABELS[c]] = { support, accuracy: support ? confusion[c][c] / support : null };
  }
  const pairs: ModelMetrics["most_confused"] = [];
  for (let t = 0; t < n; t++) {
    for (let p = 0; p < n; p++) {
      if (t !== p && confusion[t][p] > 0) {
        const support = confusion[t].reduce((a, b) => a + b, 0);
        pairs.push({ true: EMNIST_LABELS[t], predicted: EMNIST_LABELS[p], count: confusion[t][p], share_of_true_class: confusion[t][p] / support });
      }
    }
  }
  pairs.sort((a, b) => b.count - a.count || b.share_of_true_class - a.share_of_true_class);
  return {
    samples: counted,
    blank,
    top1: counted ? top1 / counted : 0,
    top3: counted ? top3 / counted : 0,
    per_class,
    most_confused: pairs.slice(0, MOST_CONFUSED),
    confusion_matrix: confusion,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args : fs.existsSync(DEFAULT_DIR) ? fs.readdirSync(DEFAULT_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(DEFAULT_DIR, f)) : [];
  if (files.length === 0) {
    console.error(`No recorded sets. Draw them at /?record=1, export the JSON into ${DEFAULT_DIR} (or pass paths).`);
    process.exit(1);
  }
  const samples = loadSets(files);
  console.log(`${samples.length} samples from ${files.length} file(s)`);

  const inputs = samples.map((s) => {
    const png = decode(s.png);
    return { label: s.label, input: preprocessRgba(png.data, png.width, png.height) };
  });

  const models = fs.readdirSync(MODEL_DIR).filter((f) => f.endsWith(".onnx")).sort();
  const report: Record<string, unknown> = {
    dataset: "real strokes recorded in the app (?record=1), evaluated through the TypeScript preprocessing + ONNX Runtime",
    files: files.map((f) => path.basename(f)),
    samples: samples.length,
    classes: EMNIST_LABELS,
    evaluated_on: new Date().toISOString().slice(0, 10),
    onnxruntime: ort.env.versions?.node ?? "onnxruntime-node",
    models: {} as Record<string, ModelMetrics>,
    reference: "onnx int8 (emnist_cnn.int8.onnx)",
  };
  const results = report.models as Record<string, ModelMetrics>;
  for (const m of models) {
    const key = `onnx ${m.includes("int8") ? "int8" : "fp32"} (${m})`;
    results[key] = await evaluate(path.join(MODEL_DIR, m), inputs);
  }
  if (!(report.reference as string in results)) report.reference = Object.keys(results)[0];

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + "\n");

  console.log("\n| Model | Samples | Top-1 | Top-3 |\n|---|---|---|---|");
  for (const [name, m] of Object.entries(results)) console.log(`| ${name} | ${m.samples} | ${(m.top1 * 100).toFixed(2)}% | ${(m.top3 * 100).toFixed(2)}% |`);
  const ref = results[report.reference as string];
  console.log(`\nMost confused pairs (${report.reference}):\n`);
  for (const c of ref.most_confused) console.log(`- \`${c.true}\` → \`${c.predicted}\`: ${c.count} (${(c.share_of_true_class * 100).toFixed(1)}%)`);
  if (ref.blank) console.log(`\n${ref.blank} sample(s) were blank after preprocessing and were not counted.`);
  console.log(`\nwrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
