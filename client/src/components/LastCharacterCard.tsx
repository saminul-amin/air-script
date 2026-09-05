import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { CharacterPrediction } from "../types";
import { useMotion, DUR } from "../motion";

interface LastCharacterCardProps {
  result: CharacterPrediction | null;
  isRecognizing: boolean;
}

/**
 * The recognition moment: the resolved glyph rises in, the confidence bar
 * lands, the alternatives line up beneath.
 */
export default function LastCharacterCard({ result, isRecognizing }: LastCharacterCardProps) {
  const { t, reduce } = useMotion();
  // A counter so the same letter twice in a row still re-animates.
  const seq = useRef(0);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (result) {
      seq.current += 1;
      setKey(seq.current);
    }
  }, [result]);

  const pct = result ? Math.round(result.confidence * 100) : 0;
  const alternatives = result?.top3?.slice(1) ?? [];
  const altConf = result?.top3_confidences?.slice(1) ?? [];

  return (
    <div className="rounded-xl border border-line bg-desk-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Last character</span>
        {isRecognizing && <span className="text-[11px] text-text-2">reading…</span>}
      </div>

      <div className="flex items-end gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-desk-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {result ? (
              <motion.span
                key={key}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={t(DUR.slow)}
                className="font-display text-[44px] leading-none text-text-0"
              >
                {result.prediction || "·"}
              </motion.span>
            ) : (
              <span className="font-display text-[44px] leading-none text-text-2">·</span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] text-text-2">confidence</span>
            <span className="font-mono text-sm text-text-0">{result ? `${pct}%` : "—"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-desk-0">
            <motion.div
              key={key}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={t(DUR.slow)}
              className={`h-full rounded-full ${pct >= 70 ? "bg-accent" : pct >= 40 ? "bg-warn" : "bg-danger"}`}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-text-2">also</span>
        <AnimatePresence mode="popLayout" initial={false}>
          {alternatives.map((alt, i) => (
            <motion.span
              key={`${key}-${alt}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={t(DUR.base, { delay: reduce ? 0 : 0.04 * i })}
              className="inline-flex items-baseline gap-1 rounded-md bg-desk-0 px-2 py-0.5 font-mono text-xs text-text-1"
            >
              {alt}
              {altConf[i] !== undefined && <span className="text-[10px] text-text-2">{Math.round(altConf[i] * 100)}%</span>}
            </motion.span>
          ))}
        </AnimatePresence>
        {!result && <span className="text-[11px] text-text-2">—</span>}
      </div>
    </div>
  );
}
