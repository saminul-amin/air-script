import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHealth } from "../utils/api";
import type { ServiceHealth, ServiceState } from "../types";

const PROBE_TIMEOUT_MS = 20_000;   // a sleeping Space can hold the first request open for a while
const RETRY_INTERVAL_MS = 3_000;
const GIVE_UP_AFTER_MS = 120_000;  // free Spaces usually wake in under a minute

/**
 * useServiceStatus — probes the backend's /health until it answers, and
 * distinguishes "waking a sleeping free-tier service" from "actually offline".
 *
 * States:
 *   checking  – first probe in flight
 *   waking    – probe failed or timed out; retrying (cold start in progress)
 *   ready     – reachable and real model weights are loaded
 *   degraded  – reachable but the model is not loaded (server-side problem)
 *   offline   – gave up after GIVE_UP_AFTER_MS
 */
export default function useServiceStatus() {
  const [state, setState] = useState<ServiceState>("checking");
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const startedAt = useRef<number>(0);
  const generation = useRef(0);

  const run = useCallback(() => {
    const myGen = ++generation.current;
    startedAt.current = performance.now();
    setState("checking");
    setElapsedMs(0);
    setHealth(null);

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const tick = setInterval(() => {
      if (!stopped) setElapsedMs(performance.now() - startedAt.current);
    }, 500);

    const probe = async () => {
      if (stopped || generation.current !== myGen) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), PROBE_TIMEOUT_MS);
      try {
        const result = await fetchHealth(controller.signal);
        if (stopped || generation.current !== myGen) return;
        setHealth(result);
        setState(result.reachable && result.modelLoaded ? "ready" : "degraded");
        clearInterval(tick);
      } catch {
        if (stopped || generation.current !== myGen) return;
        const elapsed = performance.now() - startedAt.current;
        if (elapsed >= GIVE_UP_AFTER_MS) {
          setState("offline");
          clearInterval(tick);
        } else {
          setState("waking");
          setAttempt((n) => n + 1);
          timer = setTimeout(probe, RETRY_INTERVAL_MS);
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    probe();

    return () => {
      stopped = true;
      clearInterval(tick);
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, []);

  useEffect(() => run(), [run]);

  /** Start the probe loop again (after "offline"). */
  const retry = useCallback(() => {
    setAttempt(0);
    run();
  }, [run]);

  return { state, health, elapsedMs, attempt, retry, isReady: state === "ready" };
}
