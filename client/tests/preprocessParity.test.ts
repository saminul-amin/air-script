// @vitest-environment node
/**
 * The TypeScript preprocessing port must reproduce the Python pipeline.
 *
 * Fixtures: PNGs rendered by scripts/make-preprocessing-fixtures.ts with the
 * app's own paintStrokes, and expected.json written by
 * ai-service/tools/make_preprocessing_fixtures.py (Pillow + NumPy + PyTorch).
 *
 * Tolerance: every one of the 784 inputs may differ by at most one 8-bit grey
 * level (1/255). Every integer step of the port is exact, so the only room
 * left for disagreement is the last-ulp difference between V8's Math.sin and
 * the C library's sin when a Lanczos coefficient lands on a rounding boundary.
 * That flips one grey level at most. The test also reports the measured
 * maximum so the README can quote it, and requires the ONNX top-1 from the
 * TypeScript input to equal the top-1 from the Python input on every fixture.
 */

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import * as ort from "onnxruntime-node";
import { describe, expect, it, beforeAll } from "vitest";
import { preprocessRgba, INPUT_SIZE } from "../src/recognition/preprocess";
import { classify } from "../src/recognition/classify";
import { EMNIST_LABELS } from "../src/recognition/labels";

const FIXTURE_DIR = path.resolve(__dirname, "fixtures/preprocessing");
const MODEL_DIR = path.resolve(__dirname, "../public/models");
const MIN_FIXTURES = 50;
const MAX_ABS_DIFF = 1 / 255 + 1e-7;

interface Expected {
  blank: boolean;
  input_f32_le_b64?: string;
  top1?: string;
  top3?: string[];
  confidence?: number;
}

interface Loaded {
  id: string;
  expected: Expected;
  actual: Float32Array | null;
  pythonInput: Float32Array | null;
}

function decodePng(file: string): { width: number; height: number; data: Uint8Array } {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length) };
}

function decodeFloat32(b64: string): Float32Array {
  const bytes = Buffer.from(b64, "base64");
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Float32Array(copy.buffer); // little-endian on every platform Node runs on
}

const expectedJson = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, "expected.json"), "utf-8")) as { pillow: string; fixtures: Record<string, Expected> };
const ids = Object.keys(expectedJson.fixtures).sort();

const loaded: Loaded[] = ids.map((id) => {
  const expected = expectedJson.fixtures[id];
  const png = decodePng(path.join(FIXTURE_DIR, `${id}.png`));
  return {
    id,
    expected,
    actual: preprocessRgba(png.data, png.width, png.height),
    pythonInput: expected.blank ? null : decodeFloat32(expected.input_f32_le_b64!),
  };
});

describe("preprocessing parity with preprocessing.py", () => {
  it(`has at least ${MIN_FIXTURES} fixtures with a recorded Python output`, () => {
    expect(ids.length).toBeGreaterThanOrEqual(MIN_FIXTURES);
    for (const id of ids) expect(fs.existsSync(path.join(FIXTURE_DIR, `${id}.png`))).toBe(true);
  });

  it("agrees with Python on which images are blank", () => {
    for (const f of loaded) expect(f.actual === null, f.id).toBe(f.expected.blank);
  });

  it(`matches the Python 28×28 input within ${MAX_ABS_DIFF.toExponential(2)} on every fixture`, () => {
    let worst = 0;
    let worstId = "";
    let exact = 0;
    let differingPixels = 0;
    for (const f of loaded) {
      if (!f.actual || !f.pythonInput) continue;
      expect(f.actual.length).toBe(INPUT_SIZE * INPUT_SIZE);
      let max = 0;
      for (let i = 0; i < f.actual.length; i++) {
        const d = Math.abs(f.actual[i] - f.pythonInput[i]);
        if (d > 0) differingPixels++;
        if (d > max) max = d;
      }
      if (max === 0) exact++;
      if (max > worst) {
        worst = max;
        worstId = f.id;
      }
      expect(max, `${f.id}: max |TS - Python| = ${max}`).toBeLessThanOrEqual(MAX_ABS_DIFF);
    }
    const n = loaded.filter((f) => f.actual).length;
    console.log(
      `preprocessing parity on ${n} fixtures (Pillow ${expectedJson.pillow}): ${exact}/${n} bit-exact, ` +
        `${differingPixels} of ${n * INPUT_SIZE * INPUT_SIZE} values differ, max |diff| = ${worst.toExponential(3)}` +
        (worst > 0 ? ` (${worstId})` : ""),
    );
  });
});

describe("ONNX top-1 from the TypeScript input equals the Python input's", () => {
  const models = fs.existsSync(MODEL_DIR) ? fs.readdirSync(MODEL_DIR).filter((f) => f.endsWith(".onnx")).sort() : [];
  const sessions = new Map<string, ort.InferenceSession>();

  beforeAll(async () => {
    for (const m of models) sessions.set(m, await ort.InferenceSession.create(path.join(MODEL_DIR, m)));
  });

  it("has at least one model under public/models", () => {
    expect(models.length).toBeGreaterThan(0);
  });

  for (const m of models) {
    it(`${m}: same prediction from both inputs on every fixture`, async () => {
      const session = sessions.get(m)!;
      const run = async (input: Float32Array) => {
        const out = await session.run({ image: new ort.Tensor("float32", input, [1, 1, INPUT_SIZE, INPUT_SIZE]) });
        return classify(out.logits.data as Float32Array, EMNIST_LABELS);
      };
      let agreeWithTorch = 0;
      let n = 0;
      for (const f of loaded) {
        if (!f.actual || !f.pythonInput) continue;
        n++;
        const fromTs = await run(f.actual);
        const fromPython = await run(f.pythonInput);
        expect(fromTs.prediction, `${f.id}: TS→${fromTs.prediction} vs Python→${fromPython.prediction}`).toBe(fromPython.prediction);
        if (fromTs.prediction === f.expected.top1) agreeWithTorch++;
      }
      console.log(`${m}: TS input and Python input agree on ${n}/${n} fixtures; ${agreeWithTorch}/${n} match the PyTorch label recorded by Python`);
      if (m === "emnist_cnn.onnx") expect(agreeWithTorch).toBe(n); // fp32 ONNX is the PyTorch model
    });
  }
});
