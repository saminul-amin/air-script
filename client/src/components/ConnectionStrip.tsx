import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from "lucide-react";
import type { ServiceHealth, ServiceState } from "../types";
import { BACKEND_MAY_SLEEP } from "../config";
import { useMotion, DUR } from "../motion";

interface ConnectionStripProps {
  state: ServiceState;
  health: ServiceHealth | null;
  elapsedMs: number;
  onRetry: () => void;
}

/**
 * One-line strip between the top bar and the paper. Exists only while the
 * backend is waking, degraded or offline — and says so honestly.
 */
export default function ConnectionStrip({ state, health, elapsedMs, onRetry }: ConnectionStripProps) {
  const { reduce, t } = useMotion();
  const seconds = Math.round(elapsedMs / 1000);

  let icon = <Loader2 className={`h-3.5 w-3.5 ${reduce ? "" : "animate-spin"}`} />;
  let text = "Connecting to the recognition service.";
  let tone = "text-text-1";

  if (state === "waking") {
    text = BACKEND_MAY_SLEEP
      ? `Waking the recognition service. The free tier sleeps when idle and takes up to a minute — ${seconds}s so far. You can draw meanwhile.`
      : `Recognition service not answering yet, retrying (${seconds}s). Check that the AI service and gateway are running.`;
  } else if (state === "degraded") {
    icon = <AlertTriangle className="h-3.5 w-3.5" />;
    text = `Service is up but has no trained model: ${health?.error ?? "weights missing"}. Text tools work; recognition will not.`;
    tone = "text-warn";
  } else if (state === "offline") {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    text = "Recognition service is unreachable. You can still draw; recognition will fail until it is back.";
    tone = "text-danger";
  }

  return (
    <AnimatePresence initial={false}>
      {state !== "ready" && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={t(DUR.slow)}
          className="overflow-hidden"
        >
          <div className={`flex items-center gap-2.5 border-b border-line bg-desk-1 px-5 py-2 text-xs ${tone}`}>
            <span className="shrink-0">{icon}</span>
            <span className="min-w-0 flex-1 truncate">{text}</span>
            {state === "offline" && (
              <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-desk-2 px-2 py-1 text-text-0 hover:bg-line-strong">
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
