/**
 * On-device character recognition: ONNX Runtime Web (WASM) running the
 * exported CharCNN on the TypeScript port of the preprocessing pipeline.
 *
 * Everything is lazy: the runtime, its WASM binary and the model are only
 * fetched when `loadLocalRecognizer` is called (the app does that after first
 * paint). Both files are served from this origin, hashed by Vite, so
 * recognition works offline once cached and no pixel ever leaves the page.
 */

import type { CharacterPrediction } from "../types";
import { preprocessRgba, INPUT_SIZE } from "./preprocess";
import { classify } from "./classify";
// The wasm-only ORT bundle inlines its JS glue; only the binary is a separate asset.
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";

export interface LoadReport {
  modelFile: string;
  modelBytes: number;
  /** Importing the ORT JS bundle. */
  runtimeMs: number;
  /** Fetching the model file. */
  fetchMs: number;
  /** Creating the session (loads the WASM binary and the graph). */
  sessionMs: number;
  /** One warm-up inference. */
  warmupMs: number;
  totalMs: number;
}

export interface Recognition {
  /** null when the canvas is blank after preprocessing. */
  result: CharacterPrediction | null;
  preprocessMs: number;
  inferenceMs: number;
}

export interface LocalRecognizer {
  report: LoadReport;
  recognize(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Promise<Recognition>;
}

/**
 * Load ORT, fetch `modelUrl` and warm it up. `labels` is the class order the
 * model was trained with (EMNIST_LABELS or BENGALI_LABELS).
 */
export async function loadLocalRecognizer(modelUrl: string, labels: readonly string[]): Promise<LocalRecognizer> {
  const t0 = performance.now();
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };
  // Threads need SharedArrayBuffer, which needs cross-origin isolation headers
  // we do not set. Say so up front instead of letting ORT probe and warn.
  ort.env.wasm.numThreads = 1;
  const t1 = performance.now();

  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status} for ${modelUrl}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const t2 = performance.now();

  const session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  const t3 = performance.now();

  const feed = (input: Float32Array) => ({ image: new ort.Tensor("float32", input, [1, 1, INPUT_SIZE, INPUT_SIZE]) });
  await session.run(feed(new Float32Array(INPUT_SIZE * INPUT_SIZE)));
  const t4 = performance.now();

  const report: LoadReport = {
    modelFile: modelUrl.split("/").pop() ?? modelUrl,
    modelBytes: bytes.byteLength,
    runtimeMs: t1 - t0,
    fetchMs: t2 - t1,
    sessionMs: t3 - t2,
    warmupMs: t4 - t3,
    totalMs: t4 - t0,
  };

  return {
    report,
    async recognize(rgba, width, height) {
      const p0 = performance.now();
      const input = preprocessRgba(rgba, width, height);
      const p1 = performance.now();
      if (!input) return { result: null, preprocessMs: p1 - p0, inferenceMs: 0 };
      const out = await session.run(feed(input));
      const p2 = performance.now();
      const logits = out.logits.data as Float32Array;
      return { result: classify(logits, labels), preprocessMs: p1 - p0, inferenceMs: p2 - p1 };
    },
  };
}
