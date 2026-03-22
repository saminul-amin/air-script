import type { Point, BBox, ValidationResult } from "../types";

// ── Stroke Validation — filters noise before recognition ────────────────
//
// All thresholds are tuned for a 640×480 canvas.
// Strokes smaller than these limits are treated as noise.

// ── Configurable thresholds ─────────────────────────────────────────────

/** Minimum number of tracked points to count as a real stroke */
export const MIN_POINT_COUNT = 5;

/** Minimum bounding-box dimension (px) — strokes smaller are noise */
export const MIN_BBOX_SIZE = 8;

/** Minimum total path length (px) — very short scribbles are noise */
export const MIN_PATH_LENGTH = 15;

/** Minimum stroke duration (ms) — extremely fast taps are noise */
export const MIN_DURATION_MS = 60;

/**
 * Maximum bounding-box size (px) to consider a stroke a "dot".
 * Dots smaller than this may be attached to a previous character
 * (for "i", "j") rather than discarded outright.
 */
export const DOT_BBOX_MAX = 18;

/** Maximum vertical gap (px) between a dot and the previous stroke's
 *  bounding box for the dot to be considered part of that character */
export const DOT_ATTACH_GAP = 60;

// ── Geometry helpers ────────────────────────────────────────────────────

/**
 * Axis-aligned bounding box for an array of {x, y} points.
 * Returns { minX, minY, maxX, maxY, width, height }.
 */
export function getBoundingBox(points: Point[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Total accumulated path length (Euclidean) for an array of {x, y}.
 */
export function calculateStrokeLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// ── Core validator ──────────────────────────────────────────────────────

/**
 * Categorise a finished stroke.
 *
 * @param {Array<{x:number,y:number}>} points — recorded stroke points
 * @param {number} durationMs — how long the user drew (ms)
 * @returns {{ valid: boolean, isDot: boolean, bbox: object|null, reason: string|null }}
 */
export function validateStroke(points: Point[], durationMs: number = Infinity): ValidationResult {
  // ── 1. Minimum point count ──────────────────────────────────────────
  if (points.length < MIN_POINT_COUNT) {
    const bbox = points.length > 0 ? getBoundingBox(points) : null;
    // Might still be a deliberate dot/tap
    if (bbox && bbox.width <= DOT_BBOX_MAX && bbox.height <= DOT_BBOX_MAX) {
      return { valid: false, isDot: true, bbox, reason: "dot-few-points" };
    }
    return { valid: false, isDot: false, bbox, reason: "too-few-points" };
  }

  const bbox = getBoundingBox(points);

  // ── 2. Time-based filter ────────────────────────────────────────────
  if (durationMs < MIN_DURATION_MS) {
    return { valid: false, isDot: false, bbox, reason: "too-fast" };
  }

  // ── 3. Bounding-box size ────────────────────────────────────────────
  if (bbox.width < MIN_BBOX_SIZE && bbox.height < MIN_BBOX_SIZE) {
    if (bbox.width <= DOT_BBOX_MAX && bbox.height <= DOT_BBOX_MAX) {
      return { valid: false, isDot: true, bbox, reason: "dot-small-bbox" };
    }
    return { valid: false, isDot: false, bbox, reason: "small-bbox" };
  }

  // ── 4. Total path length ────────────────────────────────────────────
  const pathLen = calculateStrokeLength(points);
  if (pathLen < MIN_PATH_LENGTH) {
    if (bbox.width <= DOT_BBOX_MAX && bbox.height <= DOT_BBOX_MAX) {
      return { valid: false, isDot: true, bbox, reason: "dot-short-path" };
    }
    return { valid: false, isDot: false, bbox, reason: "short-path" };
  }

  // ── Passed all checks ──────────────────────────────────────────────
  return { valid: true, isDot: false, bbox, reason: null };
}

// ── Smart dot attachment ────────────────────────────────────────────────

/**
 * Decide whether a dot-stroke should be attached to the previous
 * character (as in "i" or "j") or discarded as noise.
 *
 * @param {object} dotBbox — bounding box of the candidate dot
 * @param {object|null} prevBbox — bounding box of the last valid stroke (or null)
 * @returns {boolean} true → attach to the prev character, false → discard
 */
export function shouldAttachDot(dotBbox: BBox | null, prevBbox: BBox | null): boolean {
  if (!prevBbox || !dotBbox) return false;

  // Dot must appear ABOVE the previous stroke (lower y = higher on screen)
  if (dotBbox.minY >= prevBbox.minY) return false;

  // Horizontal overlap: dot centre must be within the previous stroke's
  // x range (with a small tolerance).
  const dotCx = (dotBbox.minX + dotBbox.maxX) / 2;
  const tolerance = prevBbox.width * 0.4;
  if (dotCx < prevBbox.minX - tolerance || dotCx > prevBbox.maxX + tolerance) {
    return false;
  }

  // Vertical gap must not be too large
  const gap = prevBbox.minY - dotBbox.maxY;
  if (gap > DOT_ATTACH_GAP) return false;

  return true;
}
