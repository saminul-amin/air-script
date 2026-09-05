import { useCallback, useEffect, useRef, useState } from "react";
import type { Sample } from "../types";
import { CANVAS_WIDTH } from "../config";

const POINT_INTERVAL_MS = 14;       // ~70 points/s, close to a real pointer stream
const BETWEEN_STROKES_MS = 180;
const RECOGNITION_GRACE_MS = 1_050; // > CHAR_PAUSE_MS in useWordBuilder so auto-recognition fires
const MAX_WAIT_MS = 30_000;         // the first request may wait on a cold backend

interface ReplayTargets {
  /** Feed one point in canvas coordinates. */
  drawSegment: (x: number, y: number) => void;
  /** Finish the current stroke (pen lifted). */
  finishStroke: () => { accepted: boolean };
  /** Word-builder hooks. */
  onStroke: () => void;
  onDrawingStop: () => void;
  /** Ref that is true while a recognition request is in flight. */
  busyRef: React.MutableRefObject<boolean>;
  /** Reset text + canvas before a replay begins. */
  reset: () => void;
  /** Suppress pause-based punctuation while the script drives the canvas. */
  setIgnorePauses: (value: boolean) => void;
}

/**
 * useSampleReplay — plays a recorded stroke sequence through exactly the same
 * pipeline as mouse or hand input, one character at a time, waiting for each
 * recognition to come back before drawing the next.
 */
export default function useSampleReplay(targets: ReplayTargets) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; char: string } | null>(null);
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const sleep = (ms: number, token: { cancelled: boolean }) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      const check = setInterval(() => {
        if (token.cancelled) {
          clearTimeout(t);
          clearInterval(check);
          resolve();
        }
      }, 25);
      setTimeout(() => clearInterval(check), ms + 30);
    });

  const stop = useCallback(() => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    cancelRef.current = null;
    setIsPlaying(false);
    setProgress(null);
  }, []);

  const play = useCallback(
    async (sample: Sample) => {
      stop();
      const token = { cancelled: false };
      cancelRef.current = token;
      setIsPlaying(true);
      targetsRef.current.reset();
      targetsRef.current.setIgnorePauses(true);

      try {
        for (let ci = 0; ci < sample.characters.length; ci++) {
          if (token.cancelled) return;
          const character = sample.characters[ci];
          setProgress({ index: ci, total: sample.characters.length, char: character.char });

          for (const stroke of character.strokes) {
            for (const p of stroke) {
              if (token.cancelled) return;
              // Screen → canvas space (the canvas is CSS-mirrored, see DrawingCanvas).
              targetsRef.current.drawSegment(CANVAS_WIDTH - p.x, p.y);
              targetsRef.current.onStroke();
              await sleep(POINT_INTERVAL_MS, token);
            }
            const result = targetsRef.current.finishStroke();
            if (result.accepted) targetsRef.current.onDrawingStop();
            await sleep(BETWEEN_STROKES_MS, token);
          }

          // Let the word builder's pause timer fire, then wait for the request.
          await sleep(RECOGNITION_GRACE_MS, token);
          const startedAt = performance.now();
          while (targetsRef.current.busyRef.current && performance.now() - startedAt < MAX_WAIT_MS) {
            if (token.cancelled) return;
            await sleep(60, token);
          }
          await sleep(120, token);
        }
      } finally {
        targetsRef.current.setIgnorePauses(false);
        if (cancelRef.current === token) {
          cancelRef.current = null;
          setIsPlaying(false);
          setProgress(null);
        }
      }
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { play, stop, isPlaying, progress };
}
