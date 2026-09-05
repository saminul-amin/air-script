import { useRef, RefObject } from "react";
import type { Point } from "../types";

interface DrawingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  /** Accept mouse, pen and touch input. Off while hand tracking drives the canvas. */
  pointerEnabled?: boolean;
  className?: string;
  onPointerDrawStart?: (coords: Point) => void;
  onPointerDrawMove?: (coords: Point) => void;
  onPointerDrawEnd?: () => void;
}

/**
 * DrawingCanvas — HTML5 canvas driven by the Pointer Events API, so mouse,
 * stylus and touch all feed the same stroke pipeline as hand tracking.
 *
 * The canvas is mirrored with CSS (so camera input behaves like a mirror);
 * pointer coordinates are flipped back so strokes land under the cursor.
 */
export default function DrawingCanvas({
  canvasRef,
  width,
  height,
  pointerEnabled = true,
  className = "",
  onPointerDrawStart,
  onPointerDrawMove,
  onPointerDrawEnd,
}: DrawingCanvasProps) {
  const activePointer = useRef<number | null>(null);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: canvas.width - (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerEnabled || activePointer.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activePointer.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; drawing still works.
    }
    const coords = getCoords(e);
    if (coords && onPointerDrawStart) onPointerDrawStart(coords);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return;
    const coords = getCoords(e);
    if (coords && onPointerDrawMove) onPointerDrawMove(coords);
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    if (onPointerDrawEnd) onPointerDrawEnd();
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute inset-0 w-full h-full -scale-x-100 ${
        pointerEnabled ? "cursor-crosshair" : "cursor-default"
      } ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      aria-label="Drawing surface"
      role="img"
    />
  );
}
