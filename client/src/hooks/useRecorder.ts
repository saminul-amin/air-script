import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Stroke } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT, RECORD_SAMPLES_PER_CLASS } from "../config";
import { EMNIST_LABELS } from "../recognition/labels";

/** One labelled drawing: the strokes, and the exact PNG the recogniser would see. */
export interface RecordedSample {
  label: string;
  strokes: Stroke[];
  /** Base64 PNG, white ink on transparent, mirrored back like a recognition snapshot. */
  png: string;
  recordedAt: string;
}

export interface RecordedSet {
  version: 1;
  canvas: { width: number; height: number };
  labels: string[];
  perClass: number;
  userAgent: string;
  samples: RecordedSample[];
}

interface Targets {
  getStrokes: () => Stroke[];
  getSnapshot: () => Promise<Blob | null>;
  clearCanvas: () => void;
}

const STORAGE_KEY = "airscript.recorder.v1";

// Deterministic shuffle so the prompt order is the same every session (mulberry32).
function shuffled<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

function loadSaved(): RecordedSample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { samples?: RecordedSample[] };
    return Array.isArray(parsed.samples) ? parsed.samples : [];
  } catch {
    return [];
  }
}

/**
 * useRecorder — the dev-only labelled-stroke collector behind ?record=1.
 *
 * The prompt order is one shuffled pass over all 47 classes per round, so
 * consecutive targets differ and every class ends up with the same count.
 * Saved samples persist in localStorage until exported or reset.
 */
export default function useRecorder(targets: Targets) {
  const [samples, setSamples] = useState<RecordedSample[]>(loadSaved);
  const [cursor, setCursor] = useState(0);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const order = useMemo(() => {
    const out: string[] = [];
    for (let round = 0; round < RECORD_SAMPLES_PER_CLASS; round++) out.push(...shuffled([...EMNIST_LABELS], 1000 + round));
    return out;
  }, []);

  // Resume where the saved samples left off.
  useEffect(() => {
    setCursor(Math.min(samples.length, order.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ samples }));
    } catch {
      // Storage full or unavailable: the session still works, just without persistence.
    }
  }, [samples]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of samples) c[s.label] = (c[s.label] ?? 0) + 1;
    return c;
  }, [samples]);

  const target = cursor < order.length ? order[cursor] : null;
  const done = target === null;

  const saveAndNext = useCallback(async () => {
    if (busy || target === null) return;
    const strokes = targetsRef.current.getStrokes();
    if (strokes.length === 0) return;
    setBusy(true);
    try {
      const blob = await targetsRef.current.getSnapshot();
      if (!blob) return;
      const png = await blobToBase64(blob);
      setSamples((prev) => [...prev, { label: target, strokes, png, recordedAt: new Date().toISOString() }]);
      setLastSaved(target);
      setCursor((c) => c + 1);
      targetsRef.current.clearCanvas();
    } finally {
      setBusy(false);
    }
  }, [busy, target]);

  const skip = useCallback(() => {
    if (target === null) return;
    targetsRef.current.clearCanvas();
    setCursor((c) => c + 1);
  }, [target]);

  const undoLast = useCallback(() => {
    setSamples((prev) => prev.slice(0, -1));
    setCursor((c) => Math.max(0, c - 1));
    setLastSaved(null);
    targetsRef.current.clearCanvas();
  }, []);

  const reset = useCallback(() => {
    setSamples([]);
    setCursor(0);
    setLastSaved(null);
    targetsRef.current.clearCanvas();
  }, []);

  const exportJson = useCallback(() => {
    const set: RecordedSet = {
      version: 1,
      canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
      labels: [...EMNIST_LABELS],
      perClass: RECORD_SAMPLES_PER_CLASS,
      userAgent: navigator.userAgent,
      samples,
    };
    const blob = new Blob([JSON.stringify(set)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `airscript-real-strokes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [samples]);

  return {
    target,
    done,
    cursor,
    total: order.length,
    savedCount: samples.length,
    countForTarget: target ? (counts[target] ?? 0) : 0,
    perClass: RECORD_SAMPLES_PER_CLASS,
    lastSaved,
    busy,
    saveAndNext,
    skip,
    undoLast,
    reset,
    exportJson,
  };
}
