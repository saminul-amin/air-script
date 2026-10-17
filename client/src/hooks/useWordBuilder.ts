import { useCallback, useRef, useState } from "react";
import { ApiError, recognizeCharacter, processText } from "../utils/api";
import { composeBengali } from "../recognition/bengali";
import type { RecognizedChar, CharacterPrediction, CorrectionStatus, Language, RecognitionSource } from "../types";

const CHAR_PAUSE_MS = 1000;        // Pause after drawing stops → auto-recognize
const CORRECTION_DELAY_MS = 2000;  // Idle after last char change → run correction

/** On-device recognition, when the app provides it. */
export interface LocalRecognition {
  /** Raw RGBA snapshot of the current strokes, or null when the canvas is empty. */
  getSnapshotPixels: () => ImageData | null;
  /**
   * Recognise the snapshot in the browser. Resolves to a prediction, to null
   * for a blank image, or to undefined when on-device recognition is not
   * available (then the server is used instead).
   */
  recognize: (pixels: ImageData) => Promise<CharacterPrediction | null | undefined>;
}

/**
 * True for failures that mean "the service is not reachable right now":
 * fetch itself failed (network, CORS, abort), or a gateway/proxy answered for
 * an upstream that is down (500 from Vite's dev proxy, 502/503/504 from a
 * gateway or a sleeping Space). A 4xx is a real answer and is not retried.
 */
function isUnreachable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status >= 500;
  return true;
}

/** Automatic retries of one pending correction before giving up on it. */
const MAX_CORRECTION_RETRIES = 2;

/**
 * Manages the word-building flow:
 *  - Detects pauses in drawing (finger stops / lifts)
 *  - Auto-captures & recognizes after pause — on the device when possible,
 *    otherwise through the server
 *  - Maintains an array of recognized characters → word
 *  - Defers correction until word boundaries (space) or idle timeout, and
 *    keeps it pending while the correction service is unreachable
 */
export default function useWordBuilder(getSnapshot, clearCanvas, local?: LocalRecognition, language: Language = "en") {
  const [word, setWord] = useState([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [lastSource, setLastSource] = useState<RecognitionSource | null>(null);
  const [error, setError] = useState(null);
  const [correctedText, setCorrectedText] = useState("");
  const [rawText, setRawText] = useState("");
  const [showCorrected, setShowCorrected] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>("idle");
  const [userEditedText, _setUserEditedText] = useState(null);

  const pauseTimer = useRef(null);
  const correctionTimer = useRef(null);
  const pendingCorrection = useRef<{ chars: RecognizedChar[]; retries: number } | null>(null); // correction still owed
  const localRef = useRef(local);
  localRef.current = local;
  const languageRef = useRef(language);
  languageRef.current = language;
  const hasNewStrokes = useRef(false);
  const lastStopTime = useRef<number | null>(null); // when the previous character's last stroke ended
  const pendingPauseMs = useRef(0);                  // idle time before the current character's first stroke
  const ignorePauses = useRef(false);                // true while a scripted replay drives the canvas

  // Refs so scheduleCorrection can read current values without re-creating
  const userEditRef = useRef(null);      // mirrors userEditedText state
  const editSnapshotLen = useRef(0);     // word.length when user started editing
  const wordRef = useRef([]);            // mirrors word state

  /** Set user edit + snapshot current word length */
  const setUserEditedText = useCallback((val: string | null) => {
    if (val === null) {
      userEditRef.current = null;
      editSnapshotLen.current = 0;
      _setUserEditedText(null);
    } else {
      // First edit → snapshot how many chars existed at edit time
      if (userEditRef.current === null) {
        editSnapshotLen.current = wordRef.current.length;
      }
      userEditRef.current = val;
      _setUserEditedText(val);
    }
  }, []);

  /** Schedule or immediately run the correction pipeline */
  const scheduleCorrection = useCallback((chars: RecognizedChar[], immediate: boolean = false, retries: number = 0) => {
    if (correctionTimer.current) clearTimeout(correctionTimer.current);

    const doCorrection = async () => {
      if (!chars || chars.length === 0) {
        setCorrectedText("");
        setRawText("");
        pendingCorrection.current = null;
        setCorrectionStatus("idle");
        return;
      }
      if (languageRef.current === "bn") {
        // No server-side correction for Bengali yet: the text is composed on
        // the device (vowels after consonants become their signs), nothing is sent.
        const labels = chars.map((c) => c.label);
        setRawText(labels.join(""));
        setCorrectedText(composeBengali(labels));
        pendingCorrection.current = null;
        setCorrectionStatus("skipped");
        return;
      }
      setIsProcessing(true);
      setCorrectionStatus("running");
      try {
        const editText = userEditRef.current;
        const snapLen = editSnapshotLen.current;

        if (editText !== null && chars.length > snapLen) {
          // User has edited + new chars arrived → correct only new chars
          const newChars = chars.slice(snapLen);
          const result = await processText(newChars);
          const suffix = result.corrected_text || newChars.map((c) => c.label).join("");
          const rawSuffix = result.raw_text || newChars.map((c) => c.label).join("");
          setCorrectedText(editText + suffix);
          setRawText(editText + rawSuffix);
        } else {
          // Normal full correction
          const result = await processText(chars);
          setCorrectedText(result.corrected_text);
          setRawText(result.raw_text);
        }
        pendingCorrection.current = null;
        setCorrectionStatus("applied");
      } catch (err) {
        // The characters are already on screen; show them uncorrected and,
        // if the service is merely unreachable, correct them when it is back.
        const raw = chars.map((c) => c.label).join("");
        setCorrectedText(raw);
        setRawText(raw);
        if (isUnreachable(err) && retries < MAX_CORRECTION_RETRIES) {
          pendingCorrection.current = { chars, retries };
          setCorrectionStatus("unavailable");
        } else {
          pendingCorrection.current = null;
          setCorrectionStatus("failed");
        }
      } finally {
        setIsProcessing(false);
      }
    };

    setCorrectionStatus("scheduled");
    if (immediate || languageRef.current === "bn") {
      doCorrection();
    } else {
      correctionTimer.current = setTimeout(doCorrection, CORRECTION_DELAY_MS);
    }
  }, []);

  /** Re-run a correction that was left pending because the service was unreachable. */
  const retryCorrection = useCallback(() => {
    const pending = pendingCorrection.current;
    if (pending) scheduleCorrection(pending.chars, true, pending.retries + 1);
  }, [scheduleCorrection]);

  /** Recognize the current drawing and append as a character */
  const _recognizeAndAppend = useCallback(
    async (throwOnEmpty = false) => {
      setIsRecognizing(true);
      setError(null);
      try {
        // Idle time between the previous character and the first stroke of
        // this one, captured when the stroke began — not when the reply
        // arrives — so a slow backend never turns into a fake "pause".
        const pauseMs = pendingPauseMs.current;

        // On the device first. `undefined` means it is not available here
        // (failed to load, or switched off), so the server takes over; a
        // runtime failure in the local path also falls back, once.
        let result: CharacterPrediction | null | undefined;
        let source: RecognitionSource = "server";
        const localRec = localRef.current;
        if (localRec) {
          const pixels = localRec.getSnapshotPixels();
          if (!pixels) {
            if (throwOnEmpty) throw new Error("Canvas is empty");
            return;
          }
          try {
            result = await localRec.recognize(pixels);
            if (result !== undefined) source = "device";
          } catch (err) {
            console.warn("[recognition] on-device recognition failed for this character, trying the server:", err);
            result = undefined;
          }
        }

        if (result === undefined) {
          const blob = await getSnapshot();
          if (!blob) {
            if (throwOnEmpty) throw new Error("Canvas is empty");
            return;
          }
          result = await recognizeCharacter(blob);
        }

        if (result && result.prediction) {
          setLastSource(source);
          setLastResult(result);
          const newChar = {
            label: result.prediction,
            confidence: result.confidence,
            top3: result.top3,
            pauseBeforeMs: pauseMs,
          };
          setWord((prev) => {
            const updated = [...prev, newChar];
            // Deferred correction — not immediate, wait for word boundary or idle
            scheduleCorrection(updated);
            return updated;
          });
          clearCanvas();
        }
      } catch (err) {
        setError(err.message || "Recognition failed");
      } finally {
        setIsRecognizing(false);
      }
    },
    [getSnapshot, clearCanvas, scheduleCorrection],
  );

  /** Call this every time a draw segment is added */
  const onStroke = useCallback(() => {
    if (!hasNewStrokes.current) {
      pendingPauseMs.current =
        !ignorePauses.current && lastStopTime.current !== null
          ? Math.max(0, Date.now() - lastStopTime.current)
          : 0;
    }
    hasNewStrokes.current = true;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, []);

  /** Call this when drawing stops (finger lifted / gesture lost) */
  const onDrawingStop = useCallback(() => {
    if (!hasNewStrokes.current) return;
    lastStopTime.current = Date.now();

    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(async () => {
      if (!hasNewStrokes.current) return;
      hasNewStrokes.current = false;
      await _recognizeAndAppend(false);
    }, CHAR_PAUSE_MS);
  }, [_recognizeAndAppend]);

  /** Manually trigger recognition (Recognize button) */
  const recognizeNow = useCallback(async () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    hasNewStrokes.current = false;
    await _recognizeAndAppend(true);
  }, [_recognizeAndAppend]);

  /** Remove the last character from the word */
  const undoLastChar = useCallback(() => {
    setWord((prev) => {
      const updated = prev.slice(0, -1);
      scheduleCorrection(updated, true);
      return updated;
    });
  }, [scheduleCorrection]);

  /** Clear the current character drawing (canvas + stroke buffer + pause timer) */
  const clearCurrentChar = useCallback(() => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
    hasNewStrokes.current = false;
    pendingPauseMs.current = 0;
    clearCanvas();
  }, [clearCanvas]);

  /** Clear everything — word + canvas + correction */
  const clearAll = useCallback(() => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (correctionTimer.current) clearTimeout(correctionTimer.current);
    pauseTimer.current = null;
    correctionTimer.current = null;
    hasNewStrokes.current = false;
    pendingPauseMs.current = 0;
    lastStopTime.current = null;
    setWord([]);
    setLastResult(null);
    setLastSource(null);
    setError(null);
    setCorrectedText("");
    setRawText("");
    pendingCorrection.current = null;
    setCorrectionStatus("idle");
    _setUserEditedText(null);
    userEditRef.current = null;
    editSnapshotLen.current = 0;
    clearCanvas();
  }, [clearCanvas]);

  /** Add space — word boundary, trigger immediate correction */
  const addSpace = useCallback(() => {
    setWord((prev) => {
      const updated = [...prev, { label: " ", confidence: 1, top3: [" "], pauseBeforeMs: 0 }];
      scheduleCorrection(updated, true);
      return updated;
    });
  }, [scheduleCorrection]);

  /** Inject a character directly (for suggestion acceptance) */
  const injectChar = useCallback(
    (ch: string) => {
      setWord((prev) => {
        const updated = [
          ...prev,
          { label: ch, confidence: 1, top3: [ch], pauseBeforeMs: 0 },
        ];
        scheduleCorrection(updated);
        return updated;
      });
    },
    [scheduleCorrection],
  );

  /** Ignore idle time between characters (scripted replays should not trigger pause punctuation). */
  const setIgnorePauses = useCallback((value: boolean) => {
    ignorePauses.current = value;
  }, []);

  /** Toggle raw/corrected display */
  const toggleCorrected = useCallback(() => {
    setShowCorrected((prev) => !prev);
  }, []);

  const wordString = word.map((c) => c.label).join("");

  // Keep wordRef in sync so setUserEditedText can snapshot length
  wordRef.current = word;

  return {
    word,
    wordString,
    lastResult,
    lastSource,
    isRecognizing,
    error,
    correctedText,
    rawText,
    showCorrected,
    isProcessing,
    correctionStatus,
    retryCorrection,
    userEditedText,
    setUserEditedText,
    onStroke,
    onDrawingStop,
    recognizeNow,
    undoLastChar,
    clearCurrentChar,
    clearAll,
    addSpace,
    injectChar,
    toggleCorrected,
    setIgnorePauses,
  };
}
