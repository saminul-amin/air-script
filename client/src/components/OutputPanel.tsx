import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Sparkles, PenLine } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const panelVariants = {
  hidden: { x: 20, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { x: 20, opacity: 0, transition: { duration: 0.2 } },
};

import type { RecognizedChar, CharacterPrediction } from "../types";

interface OutputPanelProps {
  word: RecognizedChar[];
  wordString: string;
  lastResult: CharacterPrediction | null;
  isRecognizing: boolean;
  correctedText: string;
  rawText: string;
  showCorrected: boolean;
  isProcessing: boolean;
  onToggleCorrected: () => void;
  error: string | null;
  userEditedText: string | null;
  onTextEdit: (text: string | null) => void;
  onEditDone: (oldText: string, newText: string) => void;
}

export default function OutputPanel({
  word,
  wordString,
  lastResult,
  isRecognizing,
  correctedText,
  rawText,
  showCorrected,
  isProcessing,
  onToggleCorrected,
  error,
  userEditedText,
  onTextEdit,
  onEditDone,
}: OutputPanelProps) {
  const hasContent = word.length > 0 || lastResult;
  const displayText = showCorrected ? correctedText : rawText;
  const isEdited = userEditedText !== null;
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textBeforeEdit = useRef<string | null>(null);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  const handleEditToggle = () => {
    if (editing) {
      // Finishing edit — trigger learn callback
      if (onEditDone && textBeforeEdit.current !== null && userEditedText !== null) {
        onEditDone(textBeforeEdit.current, userEditedText);
      }
      textBeforeEdit.current = null;
      setEditing(false);
    } else {
      // Starting edit — snapshot the current text for diff
      textBeforeEdit.current = displayText || wordString || "";
      if (userEditedText === null) {
        const seed = displayText || wordString || "";
        onTextEdit(seed);
      }
      setEditing(true);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onTextEdit(e.target.value);
  };

  const handleResetEdit = () => {
    onTextEdit(null);
    setEditing(false);
  };

  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-3 w-[260px] shrink-0 h-full"
    >
      {/* Header */}
      <div className="glass-strong rounded-2xl px-4 py-3 shadow-xl shadow-black/20">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Smart Output
          </h2>
        </div>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Characters are recognized and assembled into corrected text.
        </p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-2xl px-3 py-2"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main output card */}
      <div className="glass-strong rounded-2xl p-4 shadow-xl shadow-black/20 flex-1 flex flex-col gap-3 thin-scrollbar overflow-y-auto">
        {!hasContent ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <span className="text-lg">✍️</span>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Draw a character to start…
            </p>
          </div>
        ) : (
          <>
            {/* Live Input / Corrected Output */}
            {word.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    {isEdited ? "Edited" : showCorrected ? "Corrected" : "Live Input"}
                  </h3>
                  <div className="flex items-center gap-1">
                    {/* Edit toggle */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleEditToggle}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-lg font-medium transition-colors ${
                        editing
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-white/8 hover:bg-white/12 text-gray-400 hover:text-gray-200"
                      }`}
                      title={editing ? "Stop editing" : "Edit text"}
                    >
                      <PenLine className="w-3 h-3" />
                      {editing ? "Done" : "Edit"}
                    </motion.button>
                    {isEdited && !editing && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleResetEdit}
                        className="px-2 py-0.5 text-[10px] bg-white/8 hover:bg-white/12 rounded-lg text-gray-400 hover:text-gray-200 font-medium"
                        title="Reset to auto-corrected text"
                      >
                        Reset
                      </motion.button>
                    )}
                    {/* Corrected/Raw toggle */}
                    {!editing && !isEdited && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onToggleCorrected}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/8 hover:bg-white/12 transition-colors rounded-lg text-gray-400 hover:text-gray-200 font-medium"
                      >
                        {showCorrected ? (
                          <><EyeOff className="w-3 h-3" /> Raw</>
                        ) : (
                          <><Eye className="w-3 h-3" /> Corrected</>
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>

                <div className="min-h-[3rem] bg-black/30 rounded-xl border border-white/5">
                  {editing ? (
                    <textarea
                      ref={textareaRef}
                      value={userEditedText ?? ""}
                      onChange={handleTextChange}
                      className="w-full min-h-[3rem] bg-transparent px-3 py-2.5 text-lg font-mono font-bold text-yellow-300 break-words leading-relaxed resize-y outline-none placeholder-gray-600"
                      placeholder="Type to edit…"
                      rows={2}
                    />
                  ) : isProcessing ? (
                    <span className="block px-3 py-2.5 text-gray-500 text-sm animate-pulse">Processing…</span>
                  ) : displayText ? (
                    <p className={`px-3 py-2.5 text-lg font-mono font-bold break-words select-all leading-relaxed ${
                      isEdited ? "text-yellow-300" : "text-emerald-400"
                    }`}>
                      {displayText}
                    </p>
                  ) : (
                    <p className="px-3 py-2.5 text-lg font-mono font-bold text-cyan-400 break-words select-all leading-relaxed">
                      {wordString}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Character breakdown */}
            {word.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Characters
                </h3>
                <div className="flex items-center gap-0.5 flex-wrap min-h-[1.75rem] bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                  {word.map((ch, i) => (
                    <span
                      key={i}
                      className={`text-base font-mono font-bold transition-colors ${
                        ch.label === " "
                          ? "w-2.5"
                          : ch.confidence > 0.7
                          ? "text-cyan-400"
                          : ch.confidence > 0.4
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                      title={`${ch.label} (${(ch.confidence * 100).toFixed(1)}%)`}
                    >
                      {ch.label === " " ? "\u00A0" : ch.label}
                    </span>
                  ))}
                  {isRecognizing && (
                    <span className="w-2 h-4 border-r-2 border-cyan-400 animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            )}

            {/* Last prediction */}
            {lastResult && (
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-0.5 min-w-[3rem]">
                    <span className="text-[10px] text-gray-500">Last</span>
                    <span className="text-2xl font-bold text-cyan-400">{lastResult.prediction}</span>
                    <span className="text-[10px] text-gray-500">
                      {(lastResult.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {lastResult.top3 && lastResult.top3.length > 1 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-gray-500">Alternatives</span>
                      <div className="flex gap-1">
                        {lastResult.top3.slice(1).map((alt, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-white/8 rounded-lg text-[11px] font-mono text-gray-400"
                          >
                            {alt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
