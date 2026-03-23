/**
 * PredictionPanel — displays accumulated word, corrected text, and top-3 alternatives.
 * Glassmorphism styled for the side panel.
 */
import type { RecognizedChar, CharacterPrediction } from "../types";

interface PredictionPanelProps {
  word: RecognizedChar[];
  wordString: string;
  lastResult: CharacterPrediction | null;
  isRecognizing: boolean;
  correctedText: string;
  rawText: string;
  showCorrected: boolean;
  isProcessing: boolean;
  onToggleCorrected: () => void;
}

export default function PredictionPanel({
  word,
  wordString,
  lastResult,
  isRecognizing,
  correctedText,
  rawText,
  showCorrected,
  isProcessing,
  onToggleCorrected,
}: PredictionPanelProps) {
  const hasContent = word.length > 0 || lastResult;
  if (!hasContent) {
    return (
      <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
        <p className="text-sm text-gray-500 text-center">
          Draw a character to start&hellip;
        </p>
      </div>
    );
  }

  const displayText = showCorrected ? correctedText : rawText;

  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Corrected / Raw output */}
      {word.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              {showCorrected ? "Corrected" : "Raw"}
            </h2>
            <button
              onClick={onToggleCorrected}
              className="px-2 py-0.5 text-[10px] bg-white/10 hover:bg-white/20 transition-colors rounded-lg text-gray-300 font-medium"
            >
              {showCorrected ? "Raw" : "Corrected"}
            </button>
          </div>

          <div className="min-h-[2.5rem] bg-black/30 rounded-xl px-3 py-2.5 border border-white/5">
            {isProcessing ? (
              <span className="text-gray-500 text-sm animate-pulse">Processing&hellip;</span>
            ) : displayText ? (
              <p className="text-xl font-mono font-bold text-emerald-400 break-words select-all leading-tight">
                {displayText}
              </p>
            ) : (
              <p className="text-xl font-mono font-bold text-cyan-400 break-words select-all leading-tight">
                {wordString}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Raw characters with confidence coloring */}
      {word.length > 0 && (
        <div>
          <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
            Characters
          </h2>
          <div className="flex items-center gap-0.5 flex-wrap min-h-[1.75rem] bg-black/30 rounded-xl px-3 py-2 border border-white/5">
            {word.map((ch, i) => (
              <span
                key={i}
                className={`text-lg font-mono font-bold ${
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
              <span className="w-2.5 h-5 border-r-2 border-cyan-400 animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Last character prediction with top-3 */}
      {lastResult && (
        <div className="flex items-center gap-4 pt-2 border-t border-white/10">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-gray-500">Last</span>
            <span className="text-2xl font-bold text-cyan-400">{lastResult.prediction}</span>
            <span className="text-[10px] text-gray-500">
              {(lastResult.confidence * 100).toFixed(0)}%
            </span>
          </div>

          {lastResult.top3 && lastResult.top3.length > 1 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500">Alternatives</span>
              <div className="flex gap-1.5">
                {lastResult.top3.slice(1).map((alt, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-white/10 rounded-lg text-xs font-mono text-gray-300"
                  >
                    {alt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
