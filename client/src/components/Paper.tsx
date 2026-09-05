import { AnimatePresence, motion } from "framer-motion";
import { RefObject } from "react";
import DrawingCanvas from "./DrawingCanvas";
import GestureIndicator from "./GestureIndicator";
import WebcamPreview from "./WebcamPreview";
import type { AppMode, GestureType, Point, TrackingState } from "../types";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../config";
import { useMotion, DUR } from "../motion";

interface PaperProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  mode: AppMode;
  cameraOn: boolean;
  showWebcam: boolean;
  trackingStatus: TrackingState;
  gesture: GestureType;
  pointerEnabled: boolean;
  onPointerDrawStart: (p: Point) => void;
  onPointerDrawMove: (p: Point) => void;
  onPointerDrawEnd: () => void;
  replayProgress: { index: number; total: number; char: string } | null;
  filterReason: string | null;
  isEmpty: boolean;
}

const FILTER_TEXT: Record<string, string> = {
  "too-fast": "Too quick to be a stroke — ignored",
  "too-few-points": "Too short to be a stroke — ignored",
  "small-bbox": "Too small — ignored",
  "short-path": "Too short — ignored",
  "dot-few-points": "Stray dot ignored",
  "dot-small-bbox": "Stray dot ignored",
  "dot-short-path": "Stray dot ignored",
};

/** The hero: a sheet of warm paper carrying the drawing canvas and its overlays. */
export default function Paper(p: PaperProps) {
  const { rise, fade, t } = useMotion();
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-paper shadow-[0_1px_0_var(--paper-edge)_inset,0_30px_60px_-30px_rgba(0,0,0,0.8)]"
      style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
    >
      {/* Ruled baseline hint in writing mode */}
      <motion.div
        aria-hidden
        className="paper-rule pointer-events-none absolute inset-0"
        animate={{ opacity: p.mode === "writing" ? 1 : 0 }}
        transition={t(DUR.base)}
      />

      <DrawingCanvas
        canvasRef={p.canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        pointerEnabled={p.pointerEnabled}
        onPointerDrawStart={p.onPointerDrawStart}
        onPointerDrawMove={p.onPointerDrawMove}
        onPointerDrawEnd={p.onPointerDrawEnd}
      />

      {/* First-visit hint, fades out as soon as anything exists */}
      <AnimatePresence>
        {p.isEmpty && !p.replayProgress && (
          <motion.p
            {...fade(DUR.slow)}
            className="pointer-events-none absolute inset-x-0 top-[70%] mt-2 text-center font-display text-[15px] italic text-ink-soft"
          >
            {p.cameraOn ? "point your index finger to write" : "write one character here"}
          </motion.p>
        )}
      </AnimatePresence>

      <GestureIndicator gesture={p.gesture} trackingStatus={p.trackingStatus} visible={p.cameraOn} />
      <WebcamPreview sourceVideoRef={p.videoRef} visible={p.cameraOn && p.showWebcam} />

      {/* Replay progress */}
      <AnimatePresence>
        {p.replayProgress && (
          <motion.div
            {...rise(6, DUR.base)}
            className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-desk-0/85 px-2.5 py-1.5 text-xs text-text-0 shadow-lg backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Replaying
            <span className="font-mono text-text-1">
              {p.replayProgress.char} · {p.replayProgress.index + 1}/{p.replayProgress.total}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Noise filter toast */}
      <AnimatePresence>
        {p.filterReason && (
          <motion.div
            {...rise(6, DUR.base)}
            role="status"
            className="absolute bottom-3 left-3 rounded-lg bg-desk-0/85 px-2.5 py-1.5 text-[11px] text-text-1 shadow-lg backdrop-blur"
          >
            {FILTER_TEXT[p.filterReason] ?? "Stroke ignored"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
