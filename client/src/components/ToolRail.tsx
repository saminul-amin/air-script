import {
  Undo2,
  Redo2,
  Trash2,
  Download,
  Space,
  ScanText,
  Eraser,
  FileDown,
  type LucideIcon,
} from "lucide-react";
import ColorPicker from "./ColorPicker";
import type { AppMode } from "../types";

interface RailButtonProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "accent" | "danger";
}

function RailButton({ icon: Icon, label, hint, onClick, disabled, tone = "default" }: RailButtonProps) {
  const toneCls =
    tone === "accent"
      ? "text-accent hover:bg-accent-soft"
      : tone === "danger"
      ? "text-text-2 hover:text-danger hover:bg-desk-2"
      : "text-text-2 hover:text-text-0 hover:bg-desk-2";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-ui disabled:opacity-30 disabled:hover:bg-transparent ${toneCls}`}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-desk-1 px-2 py-1 text-[11px] text-text-0 opacity-0 shadow-lg transition-ui group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
        {hint && <kbd className="ml-1.5 font-mono text-text-2">{hint}</kbd>}
      </span>
    </button>
  );
}

interface ToolRailProps {
  mode: AppMode;
  hasStrokes: boolean;
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
  strokeColor: string;
  lineWidth: number;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
}

/** 56 px icon rail. Labels appear on hover and in the shortcuts sheet. */
export default function ToolRail(p: ToolRailProps) {
  const divider = <div className="my-1 h-px w-6 bg-line" />;
  return (
    <nav aria-label="Tools" className="flex w-14 shrink-0 flex-col items-center gap-0.5 py-2">
      {p.mode === "writing" ? (
        <>
          <RailButton icon={ScanText} label={p.isRecognizing ? "Reading…" : "Recognise now"} hint="Enter" onClick={p.onRecognize} disabled={p.isRecognizing || !p.hasStrokes} tone="accent" />
          <RailButton icon={Space} label="Add space" hint="Space" onClick={p.onAddSpace} />
          {divider}
          <RailButton icon={Undo2} label="Undo character" hint="Backspace" onClick={p.onUndoChar} />
          <RailButton icon={Eraser} label="Clear drawing" hint="C" onClick={p.onClearChar} />
          <RailButton icon={Trash2} label="Clear everything" onClick={p.onClearAll} tone="danger" />
          {divider}
          <RailButton icon={FileDown} label="Export text" hint="S" onClick={p.onExportText} />
        </>
      ) : (
        <>
          <RailButton icon={Undo2} label="Undo stroke" hint="Ctrl+Z" onClick={p.onUndo} disabled={!p.canUndo} />
          <RailButton icon={Redo2} label="Redo stroke" hint="Ctrl+Y" onClick={p.onRedo} disabled={!p.canRedo} />
          {divider}
          <RailButton icon={Trash2} label="Clear canvas" hint="C" onClick={p.onClearCanvas} tone="danger" />
          <RailButton icon={Download} label="Export PNG" hint="S" onClick={p.onExportPNG} />
          {divider}
          <ColorPicker strokeColor={p.strokeColor} lineWidth={p.lineWidth} onColorChange={p.onColorChange} onWidthChange={p.onWidthChange} />
        </>
      )}
    </nav>
  );
}
