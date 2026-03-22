import { useRef, RefObject } from "react";
import type { Point } from "../types";

interface DrawingCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  whiteboard?: boolean;
  onPointerDrawStart?: (coords: Point) => void;
  onPointerDrawMove?: (coords: Point) => void;
  onPointerDrawEnd?: () => void;
}

/**
 * DrawingCanvas – HTML5 Canvas with Pointer Events API for hand/mouse/stylus.
 */
export default function DrawingCanvas({
  canvasRef,
  width,
  height,
  whiteboard = false,
  onPointerDrawStart,
  onPointerDrawMove,
  onPointerDrawEnd,
}: DrawingCanvasProps) {
  const pointerActive = useRef(false);

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
    if (e.pointerType === "touch") return;
    pointerActive.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCoords(e);
    if (coords && onPointerDrawStart) onPointerDrawStart(coords);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointerActive.current) return;
    const coords = getCoords(e);
    if (coords && onPointerDrawMove) onPointerDrawMove(coords);
  };

  const handleUp = () => {
    if (!pointerActive.current) return;
    pointerActive.current = false;
    if (onPointerDrawEnd) onPointerDrawEnd();
  };

  return (
    <>
      {whiteboard && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white rounded-2xl" />
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full -scale-x-100 cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
    </>
  );
}
