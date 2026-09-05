import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useMotion, DUR } from "../motion";

const SHORTCUTS = [
  { keys: "Backspace", action: "Undo character / stroke" },
  { keys: "Space", action: "Add a space (Write)" },
  { keys: "Enter", action: "Recognise now (Write)" },
  { keys: "Ctrl+Z / Y", action: "Undo / redo stroke" },
  { keys: "W / D", action: "Write / Draw mode" },
  { keys: "C", action: "Clear drawing" },
  { keys: "S", action: "Export text / PNG" },
  { keys: "1–8", action: "Stroke colour (Draw)" },
  { keys: "?", action: "This sheet" },
];

interface ShortcutsPanelProps {
  onClose: () => void;
}

export default function ShortcutsPanel({ onClose }: ShortcutsPanelProps) {
  const { rise } = useMotion();
  return (
    <motion.div
      {...rise(-6, DUR.base)}
      role="dialog"
      aria-label="Keyboard shortcuts"
      className="absolute right-5 top-16 z-40 w-64 rounded-xl border border-line bg-desk-1 p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Shortcuts</span>
        <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-text-2 transition-ui hover:bg-desk-2 hover:text-text-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <dl className="flex flex-col gap-1.5">
        {SHORTCUTS.map(({ keys, action }) => (
          <div key={keys} className="flex items-center justify-between gap-3">
            <dt>
              <kbd className="rounded border border-line bg-desk-0 px-1.5 py-0.5 font-mono text-[11px] text-text-0">{keys}</kbd>
            </dt>
            <dd className="text-right text-[11px] text-text-1">{action}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}
