import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Zap } from "lucide-react";

/**
 * SuggestionsPanel — shows word suggestions and next-word predictions
 * below the output panel in writing mode.
 *
 * Props:
 *   suggestions    — array of {word, frequency}
 *   nextWords      — array of strings
 *   autocomplete   — {completion, full_word, confidence} | null
 *   onAccept       — called with the full word when user clicks a suggestion
 *   visible        — whether the panel should show
 */
import type { WordSuggestion, AutocompleteResponse } from "../types";

interface SuggestionsPanelProps {
  suggestions?: WordSuggestion[];
  nextWords?: string[];
  autocomplete?: AutocompleteResponse | null;
  onAccept: (word: string) => void;
  visible: boolean;
}

export default function SuggestionsPanel({
  suggestions = [],
  nextWords = [],
  autocomplete = null,
  onAccept,
  visible,
}: SuggestionsPanelProps) {
  const hasSuggestions = suggestions.length > 0;
  const hasNextWords = nextWords.length > 0;
  const hasAutocomplete = autocomplete && autocomplete.full_word;
  const hasAnything = hasSuggestions || hasNextWords || hasAutocomplete;

  if (!visible || !hasAnything) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2 }}
        className="glass-strong rounded-2xl p-3 shadow-xl shadow-black/20 flex flex-col gap-2.5"
      >
        {/* Auto-complete suggestion */}
        {hasAutocomplete && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Complete
              </span>
              <span className="text-[9px] text-gray-600 ml-auto">
                {Math.round(autocomplete.confidence * 100)}%
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAccept(autocomplete.full_word)}
              className="w-full px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-xl text-sm font-mono font-bold text-yellow-300 transition-colors text-left"
            >
              {autocomplete.full_word}
              <span className="text-yellow-500/50 ml-0.5">{/* ghost */}</span>
            </motion.button>
          </div>
        )}

        {/* Word suggestions (prefix-based) */}
        {hasSuggestions && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Suggestions
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.map(({ word }) => (
                <motion.button
                  key={word}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAccept(word)}
                  className="px-2.5 py-1 bg-white/8 hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/20 rounded-lg text-xs font-mono text-gray-300 hover:text-cyan-300 transition-colors"
                >
                  {word}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Next word predictions */}
        {hasNextWords && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3 h-3 text-purple-400" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Next Word
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {nextWords.map((w) => (
                <motion.button
                  key={w}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onAccept(w)}
                  className="px-2.5 py-1 bg-white/8 hover:bg-purple-500/15 border border-white/5 hover:border-purple-500/20 rounded-lg text-xs font-mono text-gray-300 hover:text-purple-300 transition-colors"
                >
                  {w}
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
