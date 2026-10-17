import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterPrediction, Language, LocalRecognitionStatus } from "../types";
import { LOCAL_MODELS } from "../config";
import { loadLocalRecognizer, type LoadReport, type LocalRecognizer } from "../recognition/browserRecognizer";

export interface LatencyStats {
  count: number;
  medianMs: number;
  lastMs: number;
  medianPreprocessMs: number;
  medianInferenceMs: number;
}

interface LanguageState {
  status: LocalRecognitionStatus;
  error: string | null;
  report: LoadReport | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * useLocalRecognizer — loads ONNX Runtime Web and the model for the current
 * language after first paint, keeps every language's model once loaded, and
 * exposes `recognize`, which resolves to:
 *   - a prediction,
 *   - null when the canvas is blank, or
 *   - undefined when on-device recognition is unavailable (failed to load, or
 *     disabled), so the caller can fall back to the server.
 *
 * While a model is still loading, `recognize` waits for it rather than
 * falling back: the wait is a few seconds at most and the UI says so.
 */
export default function useLocalRecognizer(enabled: boolean, language: Language) {
  const [state, setState] = useState<LanguageState>({ status: enabled ? "loading" : "off", error: null, report: null });
  const [stats, setStats] = useState<LatencyStats | null>(null);
  const loaders = useRef(new Map<Language, Promise<LocalRecognizer | null>>());
  const settled = useRef(new Map<Language, LanguageState>());
  const languageRef = useRef(language);
  languageRef.current = language;
  const samples = useRef<Record<Language, { total: number[]; pre: number[]; inf: number[] }>>({
    en: { total: [], pre: [], inf: [] },
    bn: { total: [], pre: [], inf: [] },
  });

  const start = useCallback((lang: Language): Promise<LocalRecognizer | null> => {
    const existing = loaders.current.get(lang);
    if (existing) return existing;
    const { url, labels } = LOCAL_MODELS[lang];
    const promise = loadLocalRecognizer(url, labels)
      .then((r) => {
        settled.current.set(lang, { status: "ready", error: null, report: r.report });
        if (import.meta.env.DEV) {
          const mb = (r.report.modelBytes / 1e6).toFixed(2);
          console.info(
            `[recognition] ${lang}: ${r.report.modelFile} (${mb} MB) ready in ${Math.round(r.report.totalMs)} ms ` +
              `(runtime ${Math.round(r.report.runtimeMs)}, fetch ${Math.round(r.report.fetchMs)}, session ${Math.round(r.report.sessionMs)}, warm-up ${Math.round(r.report.warmupMs)})`,
          );
        }
        if (languageRef.current === lang) setState(settled.current.get(lang)!);
        return r;
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[recognition] ${lang}: on-device recognition unavailable, using the server:`, message);
        settled.current.set(lang, { status: "failed", error: message, report: null });
        if (languageRef.current === lang) setState(settled.current.get(lang)!);
        return null;
      });
    loaders.current.set(lang, promise);
    return promise;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "off", error: null, report: null });
      return;
    }
    const done = settled.current.get(language);
    if (done) {
      setState(done);
      return;
    }
    setState({ status: "loading", error: null, report: null });
    let cancelled = false;
    // After first paint, when the browser is idle.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const kick = () => {
      if (!cancelled) start(language);
    };
    let idleId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(kick, { timeout: 1000 });
    else timer = setTimeout(kick, 50);
    return () => {
      cancelled = true;
      if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, language, start]);

  const recognize = useCallback(
    async (pixels: ImageData): Promise<CharacterPrediction | null | undefined> => {
      if (!enabled) return undefined;
      const lang = languageRef.current;
      const recognizer = await (loaders.current.get(lang) ?? start(lang));
      if (!recognizer) return undefined;
      const { result, preprocessMs, inferenceMs } = await recognizer.recognize(pixels.data, pixels.width, pixels.height);
      if (result) {
        const s = samples.current[lang];
        s.total.push(preprocessMs + inferenceMs);
        s.pre.push(preprocessMs);
        s.inf.push(inferenceMs);
        setStats({
          count: s.total.length,
          medianMs: median(s.total),
          lastMs: preprocessMs + inferenceMs,
          medianPreprocessMs: median(s.pre),
          medianInferenceMs: median(s.inf),
        });
      }
      return result;
    },
    [enabled, start],
  );

  // Dev-only: expose the numbers so they can be read from the console.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as Window & { __airscriptRecognition?: unknown }).__airscriptRecognition = { language, ...state, stats };
  }, [language, state, stats]);

  return { status: state.status, error: state.error, report: state.report, stats, recognize };
}
