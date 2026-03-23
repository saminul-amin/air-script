import { useCallback, useRef, useState } from "react";
import { recognizeCharacter, processText } from "../utils/api";
import type { RecognizedChar, CharacterPrediction } from "../types";

const CHAR_PAUSE_MS = 1000;        // Pause after drawing stops → auto-recognize
const CORRECTION_DELAY_MS = 2000;  // Idle after last char change → run correction

/**
 * Manages the word-building flow:
 *  - Detects pauses in drawing (finger stops / lifts)
 *  - Auto-captures & recognizes after pause
 *  - Maintains an array of recognized characters → word
 *  - Defers correction until word boundaries (space) or idle timeout
 */
export default function useWordBuilder(getSnapshot, clearCanvas) {
  const [word, setWord] = useState([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [correctedText, setCorrectedText] = useState("");
  const [rawText, setRawText] = useState("");
  const [showCorrected, setShowCorrected] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEditedText, _setUserEditedText] = useState(null);

  const pauseTimer = useRef(null);
  const correctionTimer = useRef(null);
  const hasNewStrokes = useRef(false);
  const lastStopTime = useRef(null);

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
  const scheduleCorrection = useCallback((chars: RecognizedChar[], immediate: boolean = false) => {
    if (correctionTimer.current) clearTimeout(correctionTimer.current);

    const doCorrection = async () => {
      if (!chars || chars.length === 0) {
        setCorrectedText("");
        setRawText("");
        return;
      }
      setIsProcessing(true);
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
      } catch {
        setCorrectedText(chars.map((c) => c.label).join(""));
      } finally {
        setIsProcessing(false);
      }
    };

    if (immediate) {
      doCorrection();
    } else {
      correctionTimer.current = setTimeout(doCorrection, CORRECTION_DELAY_MS);
    }
  }, []);

  /** Recognize the current drawing and append as a character */
  const _recognizeAndAppend = useCallback(
    async (throwOnEmpty = false) => {
      setIsRecognizing(true);
      setError(null);
      try {
        const blob = await getSnapshot();
        if (!blob) {
          if (throwOnEmpty) throw new Error("Canvas is empty");
          return;
        }

        const result = await recognizeCharacter(blob);
        if (result.prediction) {
          const now = Date.now();
          const pauseMs = lastStopTime.current
            ? now - lastStopTime.current
            : 0;

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
    hasNewStrokes.current = true;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
  }, []);

  /** Call this when drawing stops (finger lifted / gesture lost) */
  const onDrawingStop = useCallback(() => {
    lastStopTime.current = Date.now();
    if (!hasNewStrokes.current) return;

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
    clearCanvas();
  }, [clearCanvas]);

  /** Clear everything — word + canvas + correction */
  const clearAll = useCallback(() => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    if (correctionTimer.current) clearTimeout(correctionTimer.current);
    pauseTimer.current = null;
    correctionTimer.current = null;
    hasNewStrokes.current = false;
    setWord([]);
    setLastResult(null);
    setError(null);
    setCorrectedText("");
    setRawText("");
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
    isRecognizing,
    error,
    correctedText,
    rawText,
    showCorrected,
    isProcessing,
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
  };
}
