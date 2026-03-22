import { motion } from "framer-motion";
import { Pen, Camera, CameraOff, Keyboard } from "lucide-react";
import ModeToggle from "./ModeToggle";
import type { AppMode } from "../types";

interface NavbarProps {
  mode: AppMode;
  onModeToggle: (mode: AppMode) => void;
  showWebcam: boolean;
  onWebcamToggle: () => void;
  showShortcuts: boolean;
  onShortcutsToggle: () => void;
}

export default function Navbar({ mode, onModeToggle, showWebcam, onWebcamToggle, showShortcuts, onShortcutsToggle }: NavbarProps) {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-2.5 glass-strong rounded-2xl shadow-xl shadow-black/20"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-glow">
          <Pen className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
          AirScript
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Mode Toggle */}
      <ModeToggle mode={mode} onToggle={onModeToggle} />

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Camera toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onWebcamToggle}
        className={`p-2 rounded-xl transition-colors ${
          showWebcam
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
        }`}
        title={showWebcam ? "Hide camera" : "Show camera"}
      >
        {showWebcam ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
      </motion.button>

      {/* Shortcuts toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onShortcutsToggle}
        className={`p-2 rounded-xl transition-colors ${
          showShortcuts
            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
            : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent"
        }`}
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-4 h-4" />
      </motion.button>
    </motion.nav>
  );
}
