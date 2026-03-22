import { motion, AnimatePresence } from "framer-motion";
import {
  Undo2,
  Redo2,
  Trash2,
  Download,
  Space,
  Delete,
  ScanText,
  Eraser,
  FileDown,
} from "lucide-react";

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: "easeOut" as const, staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { x: -10, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

interface SidebarBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "warning" | "success";
  active?: boolean;
}

function SidebarBtn({ icon: Icon, label, onClick, disabled, variant = "default", active }: SidebarBtnProps) {
  const base =
    "group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed";

  const variants = {
    default: "text-gray-400 hover:text-white hover:bg-white/8",
    primary: "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10",
    danger: "text-red-400 hover:text-red-300 hover:bg-red-500/10",
    warning: "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10",
    success: "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10",
  };

  return (
    <motion.button
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.default} ${
        active ? "bg-white/10 text-white" : ""
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </motion.button>
  );
}

import type { AppMode } from "../types";

interface SidebarProps {
  mode: AppMode;
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

export default function Sidebar({
  mode,
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
}: SidebarProps) {
  return (
    <motion.div
      variants={sidebarVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-1 w-[170px] shrink-0 glass-strong rounded-2xl p-2.5 shadow-xl shadow-black/20"
    >
      <p className="px-3 pt-1 pb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
        Tools
      </p>

      {mode === "drawing" ? (
        <>
          <SidebarBtn icon={Undo2} label="Undo" onClick={onUndo} disabled={!canUndo} />
          <SidebarBtn icon={Redo2} label="Redo" onClick={onRedo} disabled={!canRedo} />
          <div className="h-px bg-white/5 my-1" />
          <SidebarBtn icon={Trash2} label="Clear" onClick={onClearCanvas} variant="danger" />
          <SidebarBtn icon={Download} label="Export PNG" onClick={onExportPNG} variant="success" />
        </>
      ) : (
        <>
          <SidebarBtn
            icon={ScanText}
            label={isRecognizing ? "Reading…" : "Recognize"}
            onClick={onRecognize}
            disabled={isRecognizing}
            variant="primary"
          />
          <SidebarBtn icon={Space} label="Space" onClick={onAddSpace} />
          <div className="h-px bg-white/5 my-1" />
          <SidebarBtn icon={Undo2} label="Undo Char" onClick={onUndoChar} variant="warning" />
          <SidebarBtn icon={Eraser} label="Clear Char" onClick={onClearChar} />
          <SidebarBtn icon={Trash2} label="Clear All" onClick={onClearAll} variant="danger" />
          <div className="h-px bg-white/5 my-1" />
          <SidebarBtn icon={FileDown} label="Export TXT" onClick={onExportText} variant="success" />
        </>
      )}
    </motion.div>
  );
}
