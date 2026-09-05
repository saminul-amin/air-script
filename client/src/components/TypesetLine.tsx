import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, FileDown, PenLine, RotateCcw } from "lucide-react";
import type { RecognizedChar } from "../types";
import { useMotion, DUR } from "../motion";

interface TypesetLineProps {
  word: RecognizedChar[];
  wordString: string;
  correctedText: string;
  rawText: string;
  showCorrected: boolean;
  isProcessing: boolean;
  isRecognizing: boolean;
  error: string | null;
  userEditedText: string | null;
  onToggleCorrected: () => void;
  onTextEdit: (text: string | null) => void;
  onEditDone: (oldText: string, newText: string) => void;
  onExport: () => void;
}

const CHANGE_HIGHLIGHT_MS = 1100;

function confidenceClass(c: number) {
  if (c >= 0.7) return "text-text-1";
  if (c >= 0.4) return "text-warn";
  return "text-danger";
}

/**
 * The typeset line: the corrected sentence set large under the paper, with
 * the raw character strip beneath it. When the pipeline changes a word the
 * new word cross-fades in and carries an accent underline for a beat, so the
 * correction is shown rather than silently swapped.
 */
export default function TypesetLine(p: TypesetLineProps) {
  const { t, reduce } = useMotion();
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textBeforeEdit = useRef<string | null>(null);

  const isEdited = p.userEditedText !== null;
  const displayText = p.showCorrected ? p.correctedText : p.rawText;
  const text = displayText || p.wordString;
  const hasContent = p.word.length > 0;

  // ── Word-level change tracking ─────────────────────────────────────
  const words = useMemo(() => text.split(/(\s+)/).filter((w) => w.length > 0), [text]);
  const prevWords = useRef<string[]>([]);
  const [changed, setChanged] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prev = prevWords.current;
    const diff = new Set<number>();
    // Only flag substitutions of existing words, not newly appended ones.
    for (let i = 0; i < Math.min(prev.length, words.length); i++) {
      if (prev[i] !== words[i] && words[i].trim()) diff.add(i);
    }
    prevWords.current = words;
    if (diff.size === 0) return;
    setChanged(diff);
    const timer = setTimeout(() => setChanged(new Set()), CHANGE_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [words]);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  const handleEditToggle = () => {
    if (editing) {
      if (textBeforeEdit.current !== null && p.userEditedText !== null) p.onEditDone(textBeforeEdit.current, p.userEditedText);
      textBeforeEdit.current = null;
      setEditing(false);
    } else {
      textBeforeEdit.current = text;
      if (p.userEditedText === null) p.onTextEdit(text);
      setEditing(true);
    }
  };

  const ctl = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-2 transition-ui hover:bg-desk-2 hover:text-text-0";

  return (
    <section aria-label="Recognised text" className="flex min-h-[7.5rem] flex-col gap-2">
      {/* Big line */}
      <div className="min-h-[3.25rem]">
        {!hasContent ? (
          <p className="font-display text-[28px] italic leading-tight text-text-2 md:text-[34px]">
            Write on the paper, or replay a sample.
          </p>
        ) : editing ? (
          <textarea
            ref={textareaRef}
            value={p.userEditedText ?? ""}
            onChange={(e) => p.onTextEdit(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-md border border-line-strong bg-desk-1 px-3 py-2 font-display text-[28px] leading-tight text-text-0 outline-none md:text-[34px]"
          />
        ) : isEdited ? (
          <p className="font-display text-[40px] leading-tight text-text-0 md:text-[52px]">{p.userEditedText}</p>
        ) : (
          <p className="font-display text-[40px] leading-tight text-text-0 md:text-[52px]" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              {words.map((w, i) => (
                <motion.span
                  key={`${i}-${w}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, position: "absolute" }}
                  transition={t(DUR.base)}
                  className={changed.has(i) ? "word-changed" : ""}
                >
                  {w}
                </motion.span>
              ))}
            </AnimatePresence>
            {(p.isProcessing || p.isRecognizing) && (
              <span className={`ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.1em] bg-accent ${reduce ? "" : "caret"}`} aria-hidden />
            )}
          </p>
        )}
      </div>

      {/* Raw strip + controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex min-h-[1.5rem] items-center gap-[2px] font-mono text-[15px] tracking-[0.08em]">
          {p.word.map((ch, i) => (
            <span key={i} className={ch.label === " " ? "w-2" : confidenceClass(ch.confidence)} title={`${ch.label} · ${Math.round(ch.confidence * 100)}%`}>
              {ch.label === " " ? " " : ch.label}
            </span>
          ))}
          {p.isRecognizing && <span className={`ml-0.5 h-4 w-[2px] bg-accent ${reduce ? "" : "caret"}`} aria-hidden />}
          {!hasContent && <span className="text-[11px] tracking-normal text-text-2">raw characters appear here</span>}
        </div>

        {hasContent && (
          <div className="ml-auto flex items-center gap-1">
            {!isEdited && (
              <button onClick={p.onToggleCorrected} className={ctl} title="Toggle raw / corrected">
                {p.showCorrected ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {p.showCorrected ? "Show raw" : "Show corrected"}
              </button>
            )}
            <button onClick={handleEditToggle} className={`${ctl} ${editing ? "bg-desk-2 text-text-0" : ""}`} title="Edit the text by hand">
              <PenLine className="h-3 w-3" /> {editing ? "Done" : "Edit"}
            </button>
            {isEdited && !editing && (
              <button onClick={() => { p.onTextEdit(null); setEditing(false); }} className={ctl} title="Back to the pipeline's text">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
            <button onClick={p.onExport} className={ctl} title="Download as .txt (S)">
              <FileDown className="h-3 w-3" /> Export
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {p.error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t(DUR.fast)} role="alert" className="text-xs text-danger">
            {p.error}
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}
