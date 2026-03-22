import { motion } from "framer-motion";
import { Palette } from "lucide-react";

const COLORS = [
  { name: "Cyan", value: "#00e5ff" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Violet", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
];

const WIDTHS = [2, 4, 6, 8];

interface ColorPickerProps {
  strokeColor: string;
  lineWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}

export default function ColorPicker({ strokeColor, lineWidth, onColorChange, onWidthChange }: ColorPickerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-strong rounded-2xl px-4 py-3 shadow-xl shadow-black/20"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Palette className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Colors</span>
      </div>

      {/* Color swatches */}
      <div className="flex items-center gap-1.5 mb-3">
        {COLORS.map((c) => (
          <motion.button
            key={c.value}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onColorChange(c.value)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${
              strokeColor === c.value
                ? "border-white shadow-lg ring-2 ring-white/20"
                : "border-white/10 hover:border-white/40"
            }`}
            style={{
              backgroundColor: c.value,
              boxShadow: strokeColor === c.value ? `0 0 12px ${c.value}40` : undefined,
            }}
            title={c.name}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-white/5 mb-3" />

      {/* Brush size + preview */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mr-1">Size</span>
        {WIDTHS.map((w) => (
          <motion.button
            key={w}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onWidthChange(w)}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all ${
              lineWidth === w
                ? "bg-white/15 ring-1 ring-white/20"
                : "hover:bg-white/8"
            }`}
            title={`${w}px`}
          >
            <span
              className="rounded-full bg-white/80"
              style={{ width: w + 2, height: w + 2 }}
            />
          </motion.button>
        ))}

        <div className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-black/20 border border-white/5">
          <span
            className="rounded-full"
            style={{ width: lineWidth + 2, height: lineWidth + 2, backgroundColor: strokeColor }}
          />
        </div>
      </div>
    </motion.div>
  );
}
