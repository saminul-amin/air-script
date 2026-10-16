import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { useMotion, DUR } from "../motion";

interface RecorderPanelProps {
  target: string | null;
  cursor: number;
  total: number;
  savedCount: number;
  countForTarget: number;
  perClass: number;
  lastSaved: string | null;
  busy: boolean;
  hasStrokes: boolean;
  onSave: () => void;
  onSkip: () => void;
  onUndo: () => void;
  onReset: () => void;
  onExport: () => void;
}

/**
 * The dev-only recorder (?record=1), in place of the typeset line: the target
 * glyph set large where the recognised text normally goes, progress in mono,
 * and the controls in the usual quiet row.
 */
export default function RecorderPanel(p: RecorderPanelProps) {
  const { t, reduce } = useMotion();
  const ctl = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-2 transition-ui hover:bg-desk-2 hover:text-text-0 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section aria-label="Stroke recorder" className="flex min-h-[7.5rem] flex-col gap-2">
      <div className="flex items-end gap-5">
        <div className="min-h-[3.25rem]">
          {p.target ? (
            <p className="font-display text-[40px] leading-tight text-text-0 md:text-[52px]">
              <span className="mr-3 text-[18px] italic text-text-2 md:text-[22px]">draw</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={`${p.cursor}-${p.target}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, position: "absolute" }}
                  transition={t(DUR.base)}
                  className="inline-block text-accent"
                >
                  {p.target}
                </motion.span>
              </AnimatePresence>
            </p>
          ) : (
            <p className="font-display text-[28px] italic leading-tight text-text-1 md:text-[34px]">All done — export the set.</p>
          )}
        </div>
        <div className="mb-2 font-mono text-[12px] text-text-2">
          {p.cursor + (p.target ? 1 : 0)}/{p.total} · {p.savedCount} saved
          {p.target && (
            <>
              {" · "}
              {p.countForTarget}/{p.perClass} for {p.target}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[11px] text-text-2">
          Draw the character the way you normally write it, then save. Enter saves, → skips, Backspace undoes a stroke, C clears the paper.
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={p.onSave} disabled={!p.target || !p.hasStrokes || p.busy} className={`${ctl} bg-desk-2 text-text-0`} title="Save and show the next target (Enter)">
            <Check className="h-3 w-3" /> Save & next
          </button>
          <button onClick={p.onSkip} disabled={!p.target} className={ctl} title="Skip this target (→)">
            <SkipForward className="h-3 w-3" /> Skip
          </button>
          <button onClick={p.onUndo} disabled={p.savedCount === 0} className={ctl} title="Remove the last saved sample">
            <RotateCcw className="h-3 w-3" /> Undo save
          </button>
          <button onClick={p.onExport} disabled={p.savedCount === 0} className={ctl} title="Download the labelled set as JSON">
            <Download className="h-3 w-3" /> Export JSON
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Discard all ${p.savedCount} saved samples?`)) p.onReset();
            }}
            disabled={p.savedCount === 0}
            className={ctl}
            title="Discard every saved sample"
          >
            <Trash2 className="h-3 w-3" /> Reset
          </button>
        </div>
      </div>

      <AnimatePresence>
        {p.lastSaved && (
          <motion.p key={`saved-${p.savedCount}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t(DUR.fast)} role="status" className="text-[11px] text-text-2">
            Saved <span className="font-mono text-text-1">{p.lastSaved}</span>. Samples stay in this browser until you export or reset.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
