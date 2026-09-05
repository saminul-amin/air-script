import { useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";

/**
 * Shared motion presets. Every animated element takes its timing from here so
 * durations stay in the 120–260 ms band, and everything collapses to an
 * instant change when the user prefers reduced motion.
 */
export const EASE_OUT = [0.2, 0, 0, 1] as const;

export const DUR = {
  fast: 0.14,
  base: 0.2,
  slow: 0.26,
} as const;

export const NO_MOTION: Transition = { duration: 0 };

export function useMotion() {
  const reduce = useReducedMotion() === true;

  /** Transition of the given duration, or none. */
  const t = (duration: number = DUR.base, extra: Partial<Transition> = {}): Transition =>
    reduce ? NO_MOTION : { duration, ease: EASE_OUT, ...extra };

  /** Fade + small rise, used for chips, cards and strips entering. */
  const rise = (px: number = 6, duration: number = DUR.base, delay: number = 0) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: px },
    animate: { opacity: 1, y: 0 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: px / 2 },
    transition: reduce ? NO_MOTION : { duration, ease: EASE_OUT, delay },
  });

  /** Plain cross-fade. */
  const fade = (duration: number = DUR.base) => ({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: reduce ? NO_MOTION : { duration, ease: EASE_OUT },
  });

  return { reduce, t, rise, fade };
}
