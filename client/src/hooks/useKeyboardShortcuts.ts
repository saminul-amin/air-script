import { useEffect, useCallback } from "react";
import type { AppMode } from "../types";

/**
 * Color palette — must match the COLORS array in ColorPicker.jsx.
 * Keys "1"–"8" map to these values.
 */
const COLOR_MAP: Record<number, string> = {
  1: "#00e5ff",
  2: "#ffffff",
  3: "#ef4444",
  4: "#22c55e",
  5: "#eab308",
  6: "#a855f7",
  7: "#f97316",
  8: "#ec4899",
};

/**
 * useKeyboardShortcuts — centralised keyboard handler.
 *
 * Shortcuts:
 *   Backspace       → Undo last char (writing) / Undo stroke (drawing)
 *   Ctrl+Z          → Undo
 *   Ctrl+Y          → Redo
 *   D               → Drawing mode
 *   W               → Writing mode
 *   C               → Clear canvas (drawing) / Clear char (writing)
 *   S               → Export PNG (drawing) / Export TXT (writing)
 *   Space           → Add space (writing)
 *   1-8             → Select color (drawing)
 *   ?               → Toggle shortcuts panel
 *
 * All shortcuts are suppressed when an <input>, <textarea>, or
 * [contenteditable] element has focus — so manual text editing works.
 */
interface KeyboardShortcutOptions {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  undo: () => void;
  redo: () => void;
  clearCanvas: () => void;
  exportCanvasPNG: () => void;
  addSpace: () => void;
  undoLastChar: () => void;
  clearCurrentChar: () => void;
  clearAll: () => void;
  exportText: () => void;
  setStrokeColor: (color: string) => void;
  showShortcuts: boolean;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function useKeyboardShortcuts({
  mode,
  setMode,
  undo,
  redo,
  clearCanvas,
  exportCanvasPNG,
  addSpace,
  undoLastChar,
  clearCurrentChar,
  clearAll,
  exportText,
  setStrokeColor,
  showShortcuts,
  setShowShortcuts,
}: KeyboardShortcutOptions) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an editable field
      const tag = (e.target as HTMLElement).tagName;
      const editable = (e.target as HTMLElement).isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key;
      const code = e.code;

      // ── Ctrl combos ──────────────────────────────────────────────
      if (ctrl) {
        if (key === "z") {
          e.preventDefault();
          undo();
          return;
        }
        if (key === "y") {
          e.preventDefault();
          redo();
          return;
        }
        // Let Ctrl+C, Ctrl+V, etc. pass through
        return;
      }

      // ── Space → add space (writing mode) ─────────────────────────
      if (code === "Space" && mode === "writing") {
        e.preventDefault();
        addSpace();
        return;
      }

      // ── Backspace → undo char / stroke ───────────────────────────
      if (key === "Backspace") {
        e.preventDefault();
        if (mode === "writing") {
          undoLastChar();
        } else {
          undo();
        }
        return;
      }

      // ── Single-key shortcuts (no modifiers) ──────────────────────
      switch (key.toLowerCase()) {
        case "d":
          setMode("drawing");
          break;
        case "w":
          setMode("writing");
          break;
        case "c":
          if (mode === "drawing") clearCanvas();
          else clearCurrentChar();
          break;
        case "s":
          if (mode === "drawing") exportCanvasPNG();
          else exportText();
          break;
        case "?":
          setShowShortcuts((v) => !v);
          break;
        default:
          // ── Number keys 1-8 → color (drawing mode) ───────────────
          if (mode === "drawing" && /^[1-8]$/.test(key)) {
            const color = COLOR_MAP[parseInt(key, 10)];
            if (color) setStrokeColor(color);
          }
          break;
      }
    },
    [
      mode,
      setMode,
      undo,
      redo,
      clearCanvas,
      exportCanvasPNG,
      addSpace,
      undoLastChar,
      clearCurrentChar,
      clearAll,
      exportText,
      setStrokeColor,
      showShortcuts,
      setShowShortcuts,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
