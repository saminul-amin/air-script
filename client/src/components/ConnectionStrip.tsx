import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from "lucide-react";
import type { ServiceHealth, ServiceState } from "../types";
import { BACKEND_MAY_SLEEP } from "../config";
import { useMotion, DUR } from "../motion";

interface ConnectionStripProps {
  state: ServiceState;
  health: ServiceHealth | null;
  elapsedMs: number;
  /** True when characters are recognised in the browser, so the server only matters for correction. */
  onDevice: boolean;
  onRetry: () => void;
}

/**
 * One-line strip between the top bar and the paper. Exists only while the
 * backend is waking, degraded or offline — and says honestly what still works.
 */
export default function ConnectionStrip({ state, health, elapsedMs, onDevice, onRetry }: ConnectionStripProps) {
  const { reduce, t } = useMotion();
  const seconds = Math.round(elapsedMs / 1000);

  let icon = <Loader2 className={`h-3.5 w-3.5 ${reduce ? "" : "animate-spin"}`} />;
  let text = onDevice ? "Checking the text correction service." : "Connecting to the recognition service.";
  let tone = "text-text-1";
  let visible = state !== "ready";

  if (onDevice) {
    // Recognition is local; the strip only talks about correction.
    if (state === "checking" || state === "degraded") visible = false;
    if (state === "waking") {
      text = BACKEND_MAY_SLEEP
        ? `Waking the correction service — it sleeps when idle and can take a couple of minutes (${seconds}s so far). Characters are recognised on your device; the text is corrected once it answers.`
        : `Correction service not answering yet, retrying (${seconds}s). Recognition still runs on your device.`;
    } else if (state === "offline") {
      icon = <CloudOff className="h-3.5 w-3.5" />;
      text = "Correction service unreachable. Characters are still recognised on your device; raw text is shown and will be corrected when the service is back.";
      tone = "text-warn";
    }
  } else if (state === "waking") {
    text = BACKEND_MAY_SLEEP
      ? `Waking the recognition service. The free tier sleeps when idle and can take a couple of minutes — ${seconds}s so far. You can draw meanwhile.`
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
      {visible && (
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
