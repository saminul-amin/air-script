import { useCallback, useRef, useState } from "react";
import { smoothCoordinate } from "../utils/drawing";
import { validateStroke, shouldAttachDot } from "../utils/strokeValidator";
import { paintStrokes, strokesToImageBlob, forRecognition } from "../utils/strokePayload";
import type { Point, Stroke, StrokeStyle, StrokeResult, BBox } from "../types";

export const DEFAULT_COLOR = "#1c1f27"; // --ink
const DEFAULT_LINE_WIDTH = 4;

// Speed-sensitive ink: fast segments thin out, slow ones thicken, within these bounds.
const INK_MIN_FACTOR = 0.55;
const INK_MAX_FACTOR = 1.25;
const INK_SPEED_REF = 18; // px per point at which the line reaches its thinnest
const INK_SMOOTHING = 0.25;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * useCanvas — manages the drawing canvas with:
 *   - Configurable stroke color + width
 *   - Per-stroke history with undo / redo
 *   - Catmull-Rom spline smoothing for jitter reduction
 *   - Canvas snapshot export (mirrored to match CSS flip)
 */
export default function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevPoint = useRef<Point | null>(null);

  // Current stroke being drawn (array of {x,y} points) and its per-point ink widths
  const currentStroke = useRef<Point[]>([]);
  const currentWidths = useRef<number[]>([]);
  // Stroke color/width at time of stroke start
  const currentStrokeStyle = useRef<StrokeStyle>({ color: DEFAULT_COLOR, width: DEFAULT_LINE_WIDTH });

  // Undo / redo stacks — each entry: { points: [{x,y}...], color, width }
  const undoStack = useRef<Stroke[]>([]);
  const redoStack = useRef<Stroke[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Stroke validation timing + last valid stroke's bbox (for dot attachment)
  const strokeStartTime = useRef<number | null>(null);
  const lastValidBbox = useRef<BBox | null>(null);
  const [lastFilterReason, setLastFilterReason] = useState<string | null>(null);
  const filterReasonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Set filter reason with auto-clear after 1.5s */
  const showFilterReason = useCallback((reason: string | null) => {
    if (filterReasonTimer.current) clearTimeout(filterReasonTimer.current);
    setLastFilterReason(reason);
    if (reason) {
      filterReasonTimer.current = setTimeout(() => setLastFilterReason(null), 1500);
    }
  }, []);

  // Exposed stroke color (changed via UI)
  const [strokeColor, setStrokeColor] = useState(DEFAULT_COLOR);
  const [lineWidth, setLineWidth] = useState(DEFAULT_LINE_WIDTH);

  // ── Internal: redraw all strokes in the undo stack ──────────────────

  const _redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, undoStack.current);
  }, []);

  // ── Public: move drawing cursor / draw a segment ────────────────────

  const drawSegment = useCallback(
    (x: number, y: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Smooth coordinate
      let px = x;
      let py = y;
      if (prevPoint.current) {
        px = smoothCoordinate(prevPoint.current.x, x, 0.55);
        py = smoothCoordinate(prevPoint.current.y, y, 0.55);
      }

      // Start new stroke if needed
      if (currentStroke.current.length === 0) {
        currentStrokeStyle.current = { color: strokeColor, width: lineWidth };
        currentWidths.current = [];
        strokeStartTime.current = performance.now();
      }
      currentStroke.current.push({ x: px, y: py });

      // Ink width follows pointer speed (constant under reduced motion).
      const base = currentStrokeStyle.current.width;
      let width = base;
      if (!prefersReducedMotion() && prevPoint.current) {
        const speed = Math.hypot(px - prevPoint.current.x, py - prevPoint.current.y);
        const factor = INK_MAX_FACTOR - (INK_MAX_FACTOR - INK_MIN_FACTOR) * Math.min(1, speed / INK_SPEED_REF);
        const prevWidth = currentWidths.current[currentWidths.current.length - 1] ?? base;
        width = prevWidth + (base * factor - prevWidth) * INK_SMOOTHING;
      }
      currentWidths.current.push(width);

      // Draw incremental segment for responsiveness
      if (prevPoint.current) {
        ctx.beginPath();
        ctx.moveTo(prevPoint.current.x, prevPoint.current.y);
        ctx.lineTo(px, py);
        ctx.strokeStyle = currentStrokeStyle.current.color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      prevPoint.current = { x: px, y: py };
    },
    [strokeColor, lineWidth],
  );

  // ── Public: finish current stroke (finger lifted) ───────────────────
  // Returns { accepted, isDot, dotAttached, reason } so callers know
  // whether this stroke should trigger recognition.

  const finishStroke = useCallback((): StrokeResult => {
    const points = [...currentStroke.current];
    const widths = prefersReducedMotion() ? undefined : [...currentWidths.current];
    currentStroke.current = [];
    currentWidths.current = [];
    prevPoint.current = null;

    if (points.length <= 1) {
      // Nothing meaningful drawn — just clear the single-point trace
      _redrawAll();
      return { accepted: false, isDot: false, dotAttached: false, reason: "empty" };
    }

    // Measure stroke duration
    const durationMs = strokeStartTime.current
      ? performance.now() - strokeStartTime.current
      : Infinity;
    strokeStartTime.current = null;

    const result = validateStroke(points, durationMs);

    if (result.valid) {
      // ── Valid stroke → keep it ──────────────────────────────────────
      undoStack.current.push({
        points,
        color: currentStrokeStyle.current.color,
        width: currentStrokeStyle.current.width,
        widths,
      });
      redoStack.current = [];
      setCanUndo(true);
      setCanRedo(false);
      lastValidBbox.current = result.bbox;
      showFilterReason(null);
      _redrawAll();
      return { accepted: true, isDot: false, dotAttached: false, reason: null };
    }

    if (result.isDot) {
      // ── Smart dot handling ──────────────────────────────────────────
      const attach = shouldAttachDot(result.bbox, lastValidBbox.current);
      if (attach) {
        // Keep the dot (it may be the dot of an "i" or "j")
        undoStack.current.push({
          points,
          color: currentStrokeStyle.current.color,
          width: currentStrokeStyle.current.width,
          widths,
        });
        redoStack.current = [];
        setCanUndo(true);
        setCanRedo(false);
        showFilterReason(null);
        _redrawAll();
        return { accepted: true, isDot: true, dotAttached: true, reason: null };
      }
      // Dot too far from previous stroke → discard
      showFilterReason(result.reason);
      _redrawAll(); // erases the discarded dot
      return { accepted: false, isDot: true, dotAttached: false, reason: result.reason };
    }

    // ── Noise → discard ────────────────────────────────────────────────
    showFilterReason(result.reason);
    _redrawAll(); // re-renders without the discarded stroke
    return { accepted: false, isDot: false, dotAttached: false, reason: result.reason };
  }, [_redrawAll, showFilterReason]);

  /** Reset previous point without finishing the stroke (e.g. transient loss) */
  const resetPrev = useCallback((): StrokeResult => {
    // Finish any in-progress stroke
    if (currentStroke.current.length > 1) {
      return finishStroke();
    }
    currentStroke.current = [];
    prevPoint.current = null;
    return { accepted: false, isDot: false, dotAttached: false, reason: "empty" };
  }, [finishStroke]);

  // ── Undo / Redo ─────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const last = undoStack.current.pop();
    redoStack.current.push(last);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    _redrawAll();
  }, [_redrawAll]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const item = redoStack.current.pop();
    undoStack.current.push(item);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    _redrawAll();
  }, [_redrawAll]);

  // ── Clear canvas ────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    currentStroke.current = [];
    currentWidths.current = [];
    prevPoint.current = null;
    strokeStartTime.current = null;
    lastValidBbox.current = null;
    setCanUndo(false);
    setCanRedo(false);
    showFilterReason(null);
  }, [showFilterReason]);

  // ── Snapshot (mirrored) ─────────────────────────────────────────────

  const getSnapshot = useCallback((): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return Promise.resolve(null);
    if (undoStack.current.length === 0) return Promise.resolve(null);
    // Re-paint the strokes in recognition ink rather than copying the pixels,
    // so the on-screen colour (dark ink on paper) never affects the model.
    return strokesToImageBlob(forRecognition(undoStack.current), canvas.width, canvas.height, true);
  }, []);

  /** Export the canvas as a downloadable PNG (un-mirrored, original) */
  const exportCanvasPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "air-drawing.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  const hasStrokes = canUndo;

  return {
    canvasRef,
    hasStrokes,
    drawSegment,
    finishStroke,
    resetPrev,
    clearCanvas,
    getSnapshot,
    exportCanvasPNG,
    undo,
    redo,
    canUndo,
    canRedo,
    strokeColor,
    setStrokeColor,
    lineWidth,
    setLineWidth,
    lastFilterReason,
  };
}
