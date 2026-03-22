/**
 * Toolbar – contextual bottom bar with glassmorphism. Shows different controls per mode.
 */
import type { AppMode } from "../types";

interface ToolbarProps {
  mode: AppMode;
  isDrawing: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearCanvas: () => void;
  onExportPNG: () => void;
  isRecognizing: boolean;
  onRecognize: () => void;
  onAddSpace: () => void;
  onUndoChar: () => void;
  onClearChar: () => void;
  onClearAll: () => void;
  onExportText: () => void;
}

export default function Toolbar({
  mode,
  isDrawing,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearCanvas,
  onExportPNG,
  isRecognizing,
  onRecognize,
  onAddSpace,
  onUndoChar,
  onClearChar,
  onClearAll,
  onExportText,
}: ToolbarProps) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-2xl px-3 py-2 shadow-2xl z-10">
      {/* Status dot */}
      <span className="flex items-center gap-1.5 text-xs font-medium select-none mr-1">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isDrawing ? "bg-green-400 animate-pulse shadow-green-400/50 shadow-sm" : "bg-gray-500"
          }`}
        />
        {isDrawing ? "Drawing" : "Idle"}
      </span>

      <div className="w-px h-5 bg-white/20" />

      {mode === "drawing" ? (
        <>
          <ToolBtn onClick={onUndo} disabled={!canUndo} title="Undo stroke">
            ↩ Undo
          </ToolBtn>
          <ToolBtn onClick={onRedo} disabled={!canRedo} title="Redo stroke">
            ↪ Redo
          </ToolBtn>
          <ToolBtn onClick={onClearCanvas} variant="danger" title="Clear canvas">
            ✕ Clear
          </ToolBtn>
          <ToolBtn onClick={onExportPNG} variant="success" title="Download as PNG">
            ⬇ PNG
          </ToolBtn>
        </>
      ) : (
        <>
          <ToolBtn
            onClick={onRecognize}
            disabled={isRecognizing}
            variant="primary"
          >
            {isRecognizing ? "…" : "Recognize"}
          </ToolBtn>
          <ToolBtn onClick={onAddSpace}>Space</ToolBtn>
          <ToolBtn onClick={onUndoChar} variant="warning">Undo</ToolBtn>
          <ToolBtn onClick={onClearChar} variant="orange">Clear Char</ToolBtn>
          <ToolBtn onClick={onClearAll} variant="danger">Clear All</ToolBtn>
          <ToolBtn onClick={onExportText} variant="success" title="Download text">
            ⬇ TXT
          </ToolBtn>
        </>
      )}
    </div>
  );
}

const VARIANTS = {
  default: "bg-white/10 hover:bg-white/20 text-white",
  primary: "bg-cyan-500/80 hover:bg-cyan-500 text-white",
  danger: "bg-red-500/80 hover:bg-red-500 text-white",
  warning: "bg-yellow-500/80 hover:bg-yellow-500 text-white",
  orange: "bg-orange-500/80 hover:bg-orange-500 text-white",
  success: "bg-emerald-500/80 hover:bg-emerald-500 text-white",
};

interface ToolBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: string;
  disabled?: boolean;
}

function ToolBtn({ children, variant = "default", disabled, ...rest }: ToolBtnProps) {
  return (
    <button
      disabled={disabled}
      className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.default}`}
      {...rest}
    >
      {children}
    </button>
  );
}
