import { Play, ShieldCheck, Square } from "lucide-react";
import type { Sample } from "../types";
import { SAMPLES } from "../data/samples";

interface SampleRowProps {
  onReplay: (sample: Sample) => void;
  onStopReplay: () => void;
  isReplaying: boolean;
  trackingError: string | null;
}

/** "Replay a sample" plus the privacy line — the first thing a visitor can click. */
export default function SampleRow({ onReplay, onStopReplay, isReplaying, trackingError }: SampleRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-text-2">Replay a sample</span>
        {SAMPLES.map((s) => (
          <button
            key={s.id}
            disabled={isReplaying}
            onClick={() => onReplay(s)}
            title={s.description}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-desk-1 px-2.5 py-1.5 font-mono text-text-1 transition-ui hover:border-line-strong hover:text-text-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-3 w-3" /> {s.label}
          </button>
        ))}
        {isReplaying && (
          <button
            onClick={onStopReplay}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-accent-ink transition-ui hover:border-accent"
          >
            <Square className="h-3 w-3" /> Stop
          </button>
        )}
      </div>

      <p className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-2">
        <ShieldCheck className="h-3.5 w-3.5 text-ok/80" />
        Video never leaves your browser. Hand tracking runs on-device; only stroke images are sent.
      </p>

      {trackingError && (
        <p role="alert" className="basis-full text-[11px] text-warn">
          {trackingError}
        </p>
      )}
    </div>
  );
}
