import { AnimatePresence, motion } from "framer-motion";

interface GestureIndicatorProps {
  label: string | null;
}

/**
 * GestureIndicator — animated floating badge for active gesture.
 */
export default function GestureIndicator({ label }: GestureIndicatorProps) {
  return (
    <AnimatePresence>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute top-3 left-3 z-20 px-3 py-1.5 glass-strong rounded-xl text-xs font-semibold text-white select-none shadow-lg"
        >
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
