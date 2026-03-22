import type { Point, HandLandmarks, FingerStates, GestureType } from "../types";

/**
 * Smooths a coordinate value using linear interpolation.
 */
export function smoothCoordinate(prev: number, curr: number, factor: number = 0.5): number {
  return prev + (curr - prev) * factor;
}

// ── Finger state helpers ────────────────────────────────────────────────

function _fingerExtended(landmarks: HandLandmarks, tipIdx: number, pipIdx: number): boolean {
  return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

function _thumbExtended(landmarks: HandLandmarks): boolean {
  // Thumb: compare tip x with IP joint x (laterally, not vertically)
  const tipX = landmarks[4].x;
  const ipX = landmarks[3].x;
  const wristX = landmarks[0].x;
  // If hand is roughly right-facing, thumb extends leftward (lower x)
  return wristX < 0.5 ? tipX < ipX : tipX > ipX;
}

/**
 * Analyse all five fingers and return a boolean tuple.
 * Order: [thumb, index, middle, ring, pinky]
 */
export function getFingerStates(landmarks: HandLandmarks): FingerStates {
  if (!landmarks || landmarks.length < 21) return [false, false, false, false, false];
  return [
    _thumbExtended(landmarks),
    _fingerExtended(landmarks, 8, 6),
    _fingerExtended(landmarks, 12, 10),
    _fingerExtended(landmarks, 16, 14),
    _fingerExtended(landmarks, 20, 18),
  ];
}

// ── Gesture detection ───────────────────────────────────────────────────

/** Index finger up, others down → draw / write */
export function isDrawingGesture(landmarks: HandLandmarks): boolean {
  const [, index, middle, ring, pinky] = getFingerStates(landmarks);
  return index && !middle && !ring && !pinky;
}

/** No fingers up → closed fist → stop drawing */
export function isFistGesture(landmarks: HandLandmarks): boolean {
  const [thumb, index, middle, ring, pinky] = getFingerStates(landmarks);
  return !thumb && !index && !middle && !ring && !pinky;
}

/** Index + middle up, ring + pinky down → two-finger (space / erase) */
export function isTwoFingerGesture(landmarks: HandLandmarks): boolean {
  const [, index, middle, ring, pinky] = getFingerStates(landmarks);
  return index && middle && !ring && !pinky;
}

/** All five fingers extended → open palm → clear canvas */
export function isOpenPalmGesture(landmarks: HandLandmarks): boolean {
  const [thumb, index, middle, ring, pinky] = getFingerStates(landmarks);
  return thumb && index && middle && ring && pinky;
}

/** Only thumb up → confirm word */
export function isThumbUpGesture(landmarks: HandLandmarks): boolean {
  const [thumb, index, middle, ring, pinky] = getFingerStates(landmarks);
  return thumb && !index && !middle && !ring && !pinky;
}

/**
 * Detect the current high-level gesture from landmarks.
 * Returns a string label for display / logic branching.
 * Priority order matters — most specific gestures first.
 */
export function detectGesture(landmarks: HandLandmarks): GestureType {
  if (!landmarks || landmarks.length < 21) return "none";
  if (isThumbUpGesture(landmarks)) return "thumbs_up";
  if (isOpenPalmGesture(landmarks)) return "open_palm";
  if (isTwoFingerGesture(landmarks)) return "two_finger";
  if (isDrawingGesture(landmarks)) return "point";
  if (isFistGesture(landmarks)) return "fist";
  return "none";
}

// ── Catmull-Rom spline smoothing ────────────────────────────────────────

/**
 * Given an array of {x,y} control points, return a denser array
 * interpolated with Catmull-Rom splines for smoother strokes.
 */
export function catmullRomSmooth(points: Point[], segmentsPerSpan: number = 6): Point[] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[Math.min(i + 1, points.length - 1)];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    for (let t = 1; t <= segmentsPerSpan; t++) {
      const f = t / segmentsPerSpan;
      const f2 = f * f;
      const f3 = f2 * f;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * f +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * f2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * f3);
      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * f +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * f2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * f3);
      out.push({ x, y });
    }
  }
  return out;
}
