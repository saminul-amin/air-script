import { useCallback, useRef, useState } from "react";
import { detectGesture } from "../utils/drawing";
import type { HandLandmarks, GestureType, GestureCallbacks } from "../types";

// How long (ms) a gesture must be held before it fires its action
const GESTURE_HOLD_MS = 400;

// Gesture labels → human-readable display names
const GESTURE_LABELS: Record<GestureType, string> = {
  point: "✏️ Drawing",
  fist: "✊ Paused",
  two_finger: "✌️ Peace",
  open_palm: "🖐️ Clear",
  thumbs_up: "👍 Thumb",
  none: "",
};

/**
 * useGestures — detects gestures from MediaPipe landmarks and fires
 * one-shot actions when a gesture is held for GESTURE_HOLD_MS.
 *
 * Actionable gestures: open_palm (clear), thumbs_up (space).
 */
export default function useGestures() {
  const [gesture, setGesture] = useState<GestureType>("none");
  const [gestureLabel, setGestureLabel] = useState("");
  const prevGesture = useRef<GestureType>("none");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionFired = useRef(false);

  /**
   * Call this every frame with the latest landmarks + action callbacks.
   * Callbacks: { open_palm: fn, thumbs_up: fn }
   */
  const processGesture = useCallback((landmarks: HandLandmarks, callbacks: GestureCallbacks = {}) => {
    const detected = detectGesture(landmarks);
    setGesture(detected);
    setGestureLabel(GESTURE_LABELS[detected] || "");

    // If gesture changed, reset the hold timer
    if (detected !== prevGesture.current) {
      prevGesture.current = detected;
      actionFired.current = false;
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = null;

      // Actionable gestures: open_palm only
      const actionable: GestureType[] = ["open_palm"];
      if (actionable.includes(detected) && callbacks[detected]) {
        holdTimer.current = setTimeout(() => {
          if (!actionFired.current) {
            actionFired.current = true;
            callbacks[detected]();
          }
        }, GESTURE_HOLD_MS);
      }
    }
  }, []);

  /** Clean up timers */
  const resetGesture = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    prevGesture.current = "none";
    actionFired.current = false;
    setGesture("none");
    setGestureLabel("");
  }, []);

  return { gesture, gestureLabel, processGesture, resetGesture };
}
