import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import type { WordSuggestion, AutocompleteResponse } from "../types";
import { useMotion, DUR } from "../motion";

interface SuggestionsPanelProps {
  suggestions?: WordSuggestion[];
  nextWords?: string[];
  autocomplete?: AutocompleteResponse | null;
  onAccept: (word: string) => void;
}

interface ChipRowProps {
  title: string;
  items: string[];
  onAccept: (w: string) => void;
  primary?: string | null;
}

function ChipRow({ title, items, onAccept, primary = null }: ChipRowProps) {
  const { t, reduce } = useMotion();
  if (items.length === 0 && !primary) return null;
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {primary && (
            <motion.button
              key={`primary-${primary}`}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={t(DUR.base)}
              onClick={() => onAccept(primary)}
              className="rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1 font-mono text-xs text-accent-ink transition-ui hover:border-accent"
            >
              {primary}
            </motion.button>
          )}
          {items.map((w, i) => (
            <motion.button
              key={w}
              layout={!reduce}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={t(DUR.base, { delay: reduce ? 0 : 0.03 * i })}
              onClick={() => onAccept(w)}
              className="rounded-md border border-line bg-desk-0 px-2.5 py-1 font-mono text-xs text-text-1 transition-ui hover:border-line-strong hover:text-text-0"
            >
              {w}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Suggestions enter and reorder as the word builds; the best completion leads. */
export default function SuggestionsPanel({ suggestions = [], nextWords = [], autocomplete = null, onAccept }: SuggestionsPanelProps) {
  const complete = autocomplete?.full_word ?? null;
  const rest = suggestions.map((s) => s.word).filter((w) => w !== complete);
  const hasAnything = complete || rest.length > 0 || nextWords.length > 0;
  if (!hasAnything) return null;

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-desk-1 p-4">
        <ChipRow title={complete ? "Complete" : "Suggestions"} items={rest} primary={complete} onAccept={onAccept} />
        <ChipRow title="Next word" items={nextWords} onAccept={onAccept} />
      </div>
    </LayoutGroup>
  );
}
