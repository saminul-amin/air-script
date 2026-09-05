import { AnimatePresence, motion } from "framer-motion";
import { Grab, Hand, Pointer, ThumbsUp, type LucideIcon } from "lucide-react";
import type { GestureType, TrackingState } from "../types";
import { useMotion, DUR } from "../motion";

interface GestureIndicatorProps {
  gesture: GestureType;
  trackingStatus: TrackingState;
  visible: boolean;
}

const GESTURES: Record<GestureType, { Icon: LucideIcon; label: string; action: string; active: boolean }> = {
  point: { Icon: Pointer, label: "Pointing", action: "drawing", active: true },
  fist: { Icon: Grab, label: "Fist", action: "pen up", active: false },
  two_finger: { Icon: Hand, label: "Two fingers", action: "pen up", active: false },
  open_palm: { Icon: Hand, label: "Open palm", action: "hold to clear", active: false },
  thumbs_up: { Icon: ThumbsUp, label: "Thumbs up", action: "", active: false },
  none: { Icon: Hand, label: "No hand", action: "show your hand", active: false },
};

/**
 * Large outlined glyph in the paper's corner so the current gesture is
 * unmistakable at a glance. Pointing (drawing) is filled with the accent.
 */
export default function GestureIndicator({ gesture, trackingStatus, visible }: GestureIndicatorProps) {
  const { t, reduce } = useMotion();
  if (!visible) return null;

  const starting = trackingStatus === "starting";
  const g = GESTURES[gesture];
  const key = starting ? "starting" : gesture;
  const Icon = g.Icon;

  return (
    <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2.5 rounded-xl bg-desk-0/85 px-3 py-2 text-text-0 shadow-lg backdrop-blur">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
          transition={t(DUR.fast)}
          className="flex items-center gap-2.5"
        >
          <Icon
            className={`h-8 w-8 ${g.active ? "text-accent" : "text-text-1"}`}
            strokeWidth={g.active ? 2.25 : 1.5}
            fill={g.active ? "var(--accent-soft)" : "none"}
          />
          <div className="leading-tight">
            <div className="text-xs font-medium">{starting ? "Starting camera" : g.label}</div>
            <div className="text-[11px] text-text-2">{starting ? "allow access if asked" : g.action}</div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
