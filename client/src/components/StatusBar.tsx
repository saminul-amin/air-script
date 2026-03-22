import { motion, AnimatePresence } from "framer-motion";
import { Hand, MousePointer2, Pause, Pencil, ShieldOff } from "lucide-react";

const gestureIcons = {
  "✏️ Drawing": Pencil,
  "✊ Paused": Pause,
  "✌️ Peace": Hand,
  "🖐️ Clear": Hand,
  "👍 Thumb": Hand,
};

import type { GestureType, AppMode } from "../types";

interface StatusBarProps {
  gesture: GestureType;
  gestureLabel: string | null;
  isDrawing: boolean;
  isLoaded: boolean;
  mode: AppMode;
  filterReason: string | null;
}

export default function StatusBar({ gesture, gestureLabel, isDrawing, isLoaded, mode, filterReason }: StatusBarProps) {
  const GestureIcon = gestureIcons[gestureLabel] || MousePointer2;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-2 glass-strong rounded-2xl shadow-xl shadow-black/20"
    >
      {/* Model status */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isLoaded ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-yellow-400 animate-pulse"
          }`}
        />
        <span className="text-[11px] text-gray-400 font-medium">
          {isLoaded ? "Model Ready" : "Loading…"}
        </span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Drawing state */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full transition-colors ${
            isDrawing ? "bg-cyan-400 animate-pulse shadow-sm shadow-cyan-400/50" : "bg-gray-600"
          }`}
        />
        <span className={`text-[11px] font-medium ${isDrawing ? "text-cyan-400" : "text-gray-500"}`}>
          {isDrawing ? "Drawing" : "Idle"}
        </span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Gesture */}
      <div className="flex items-center gap-2">
        <GestureIcon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[11px] text-gray-400 font-medium min-w-[4rem]">
          {gestureLabel || "No gesture"}
        </span>
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Mode badge */}
      <div
        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${
          mode === "drawing"
            ? "bg-violet-500/20 text-violet-300 border border-violet-500/20"
            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/20"
        }`}
      >
        {mode}
      </div>

      {/* Noise filter indicator */}
      <AnimatePresence>
        {filterReason && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5"
            >
              <ShieldOff className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-amber-400/80 font-medium">Noise filtered</span>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
