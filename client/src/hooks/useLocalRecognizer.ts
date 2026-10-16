import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterPrediction, LocalRecognitionStatus } from "../types";
import { LOCAL_MODEL_URL } from "../config";
import { loadLocalRecognizer, type LoadReport, type LocalRecognizer } from "../recognition/browserRecognizer";

export interface LatencyStats {
  count: number;
  medianMs: number;
  lastMs: number;
  medianPreprocessMs: number;
  medianInferenceMs: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * useLocalRecognizer — loads ONNX Runtime Web and the CharCNN after first
 * paint and exposes `recognize`, which resolves to:
 *   - a prediction,
 *   - null when the canvas is blank, or
 *   - undefined when on-device recognition is unavailable (still loading
 *     failed, or disabled), so the caller can fall back to the server.
 *
 * While the model is still loading, `recognize` waits for it rather than
 * falling back: the wait is a few seconds at most and the UI says so.
 */
export default function useLocalRecognizer(enabled: boolean) {
  const [status, setStatus] = useState<LocalRecognitionStatus>(enabled ? "loading" : "off");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LoadReport | null>(null);
  const [stats, setStats] = useState<LatencyStats | null>(null);
  const loader = useRef<Promise<LocalRecognizer | null> | null>(null);
  const totals = useRef<number[]>([]);
  const pre = useRef<number[]>([]);
  const inf = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      loader.current = null;
      return;
    }
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      setStatus("loading");
      loader.current = loadLocalRecognizer(LOCAL_MODEL_URL)
        .then((r) => {
          if (cancelled) return r;
          setReport(r.report);
          setStatus("ready");
          if (import.meta.env.DEV) {
            const mb = (r.report.modelBytes / 1e6).toFixed(2);
            console.info(
              `[recognition] ${r.report.modelFile} (${mb} MB) ready in ${Math.round(r.report.totalMs)} ms ` +
                `(runtime ${Math.round(r.report.runtimeMs)}, fetch ${Math.round(r.report.fetchMs)}, session ${Math.round(r.report.sessionMs)}, warm-up ${Math.round(r.report.warmupMs)})`,
            );
          }
          return r;
        })
        .catch((err: unknown) => {
          if (cancelled) return null;
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[recognition] on-device recognition unavailable, using the server:", message);
          setError(message);
          setStatus("failed");
          return null;
        });
    };
    // After first paint, when the browser is idle.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let idleId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(start, { timeout: 1000 });
    else timer = setTimeout(start, 50);
    return () => {
      cancelled = true;
      if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  const recognize = useCallback(async (pixels: ImageData): Promise<CharacterPrediction | null | undefined> => {
    if (!loader.current) return undefined;
    const recognizer = await loader.current;
    if (!recognizer) return undefined;
    const { result, preprocessMs, inferenceMs } = await recognizer.recognize(pixels.data, pixels.width, pixels.height);
    if (result) {
      totals.current.push(preprocessMs + inferenceMs);
      pre.current.push(preprocessMs);
      inf.current.push(inferenceMs);
      setStats({
        count: totals.current.length,
        medianMs: median(totals.current),
        lastMs: preprocessMs + inferenceMs,
        medianPreprocessMs: median(pre.current),
        medianInferenceMs: median(inf.current),
      });
    }
    return result;
  }, []);

  // Dev-only: expose the numbers so they can be read from the console.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as Window & { __airscriptRecognition?: unknown }).__airscriptRecognition = { status, error, report, stats };
  }, [status, error, report, stats]);

  return { status, error, report, stats, recognize };
}
