import type { ProcessTextPayload, RecognizedChar, Stroke } from "../types";
import { catmullRomSmooth } from "./drawing";

/**
 * Map the client's character list to the AI service's /process-text body.
 * Missing confidence/top3/pause values are normalised so the server never
 * receives undefined.
 */
export function buildProcessTextPayload(characters: RecognizedChar[]): ProcessTextPayload {
  return {
    raw_characters: characters.map((ch) => ({
      label: ch.label,
      confidence: Number.isFinite(ch.confidence) ? ch.confidence : 0,
      top3: Array.isArray(ch.top3) && ch.top3.length > 0 ? ch.top3 : [ch.label],
      pause_before_ms: Math.max(0, Math.round(ch.pauseBeforeMs ?? 0)),
    })),
  };
}

/**
 * Paint strokes onto a 2D context exactly the way the live canvas does:
 * Catmull-Rom smoothed polylines with round caps and joins.
 */
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    const segmentsPerSpan = 6;
    const smooth = catmullRomSmooth(stroke.points, segmentsPerSpan);
    ctx.strokeStyle = stroke.color;

    const widths = stroke.widths;
    if (!widths || widths.length !== stroke.points.length) {
      ctx.beginPath();
      ctx.moveTo(smooth[0].x, smooth[0].y);
      for (let i = 1; i < smooth.length; i++) ctx.lineTo(smooth[i].x, smooth[i].y);
      ctx.lineWidth = stroke.width;
      ctx.stroke();
      continue;
    }

    // Speed-sensitive ink: each smoothed segment takes the width interpolated
    // from the two original points it lies between.
    for (let i = 1; i < smooth.length; i++) {
      const src = (i - 1) / segmentsPerSpan;
      const a = Math.min(Math.floor(src), widths.length - 1);
      const b = Math.min(a + 1, widths.length - 1);
      const f = src - Math.floor(src);
      ctx.lineWidth = widths[a] + (widths[b] - widths[a]) * f;
      ctx.beginPath();
      ctx.moveTo(smooth[i - 1].x, smooth[i - 1].y);
      ctx.lineTo(smooth[i].x, smooth[i].y);
      ctx.stroke();
    }
  }
}

/** The colour every stroke is painted in for recognition. */
export const RECOGNITION_INK = "#ffffff";

/**
 * Strokes as the model must see them: bright ink on a transparent background,
 * whatever colour they were drawn in on screen. The service composites onto
 * black and thresholds, so dark display ink would otherwise vanish.
 */
export function forRecognition(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => ({ ...s, color: RECOGNITION_INK }));
}

/**
 * Paint strokes on a fresh off-screen canvas. The live canvas is mirrored with
 * CSS, so the snapshot is flipped back to what the user actually sees.
 */
function paintOffscreen(strokes: Stroke[], width: number, height: number, mirrored: boolean): CanvasRenderingContext2D | null {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;
  if (mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  paintStrokes(ctx, strokes);
  return ctx;
}

/** Render strokes to the PNG the server's CNN receives (the fallback path). */
export function strokesToImageBlob(
  strokes: Stroke[],
  width: number,
  height: number,
  mirrored: boolean = true,
): Promise<Blob | null> {
  const ctx = paintOffscreen(strokes, width, height, mirrored);
  if (!ctx) return Promise.resolve(null);
  return new Promise((resolve) => ctx.canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/**
 * Render strokes to raw RGBA pixels for on-device recognition. These are the
 * same bytes a PNG of the canvas would decode to, so the TypeScript
 * preprocessing sees exactly what the Python service would have.
 */
export function strokesToImageData(strokes: Stroke[], width: number, height: number, mirrored: boolean = true): ImageData | null {
  const ctx = paintOffscreen(strokes, width, height, mirrored);
  if (!ctx) return null;
  return ctx.getImageData(0, 0, width, height);
}
