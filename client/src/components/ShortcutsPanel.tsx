import { motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

const SHORTCUTS = [
  { keys: "Backspace", action: "Undo stroke / char" },
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Y", action: "Redo" },
  { keys: "Space", action: "Add space (writing)" },
  { keys: "D", action: "Drawing mode" },
  { keys: "W", action: "Writing mode" },
  { keys: "C", action: "Clear canvas / char" },
  { keys: "S", action: "Export (PNG / TXT)" },
  { keys: "1-8", action: "Select color (drawing)" },
  { keys: "?", action: "Toggle this panel" },
];

interface ShortcutsPanelProps {
  onClose: () => void;
}

export default function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute right-4 top-[72px] z-50 w-56 glass-strong rounded-2xl shadow-2xl shadow-black/40 border border-white/10 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Shortcuts
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {SHORTCUTS.map(({ keys, action }) => (
          <div key={keys} className="flex items-center justify-between gap-2">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white/10 rounded text-cyan-300 border border-white/5 shrink-0">
              {keys}
            </kbd>
            <span className="text-[10px] text-gray-400 text-right leading-tight">{action}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
