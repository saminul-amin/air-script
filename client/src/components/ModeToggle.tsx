import { motion } from "framer-motion";
import { Paintbrush, PenTool } from "lucide-react";
import type { AppMode } from "../types";

interface ModeToggleProps {
  mode: AppMode;
  onToggle: (mode: AppMode) => void;
}

/**
 * ModeToggle — premium animated toggle between Drawing and Writing modes.
 */
export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="relative flex items-center bg-white/5 rounded-xl p-1 gap-0.5">
      {/* Sliding highlight */}
      <motion.div
        className="absolute top-1 bottom-1 rounded-lg"
        animate={{
          x: mode === "drawing" ? 0 : "100%",
          width: "calc(50% - 2px)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          background:
            mode === "drawing"
              ? "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(168,85,247,0.3))"
              : "linear-gradient(135deg, rgba(6,182,212,0.5), rgba(34,211,238,0.3))",
          boxShadow:
            mode === "drawing"
              ? "0 0 16px rgba(139,92,246,0.3)"
              : "0 0 16px rgba(6,182,212,0.3)",
        }}
      />
      <button
        onClick={() => onToggle("drawing")}
        className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          mode === "drawing" ? "text-white" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <Paintbrush className="w-3.5 h-3.5" />
        Draw
      </button>
      <button
        onClick={() => onToggle("writing")}
        className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          mode === "writing" ? "text-white" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <PenTool className="w-3.5 h-3.5" />
        Write
      </button>
    </div>
  );
}
