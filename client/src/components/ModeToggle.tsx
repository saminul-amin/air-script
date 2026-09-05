import { motion } from "framer-motion";
import { PenLine, Paintbrush } from "lucide-react";
import type { AppMode } from "../types";
import { useMotion, DUR } from "../motion";

interface ModeToggleProps {
  mode: AppMode;
  onToggle: (mode: AppMode) => void;
}

const OPTIONS: { value: AppMode; label: string; Icon: typeof PenLine; key: string }[] = [
  { value: "writing", label: "Write", Icon: PenLine, key: "W" },
  { value: "drawing", label: "Draw", Icon: Paintbrush, key: "D" },
];

/** Segmented control with a sliding thumb. */
export default function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  const { t } = useMotion();
  return (
    <div role="radiogroup" aria-label="Mode" className="relative flex items-center rounded-lg bg-desk-2 p-0.5">
      {OPTIONS.map(({ value, label, Icon, key }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            onClick={() => onToggle(value)}
            title={`${label} mode (${key})`}
            className={`relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-ui ${
              active ? "text-text-0" : "text-text-2 hover:text-text-1"
            }`}
          >
            {active && (
              <motion.span
                layoutId="mode-thumb"
                transition={t(DUR.base)}
                className="absolute inset-0 -z-10 rounded-md bg-desk-0 shadow-[inset_0_0_0_1px_var(--line-strong)]"
              />
            )}
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
