import { HealthStatus, AIHealth } from "../types";
import { aiServiceUrl } from "../config";

const AI_HEALTH_TIMEOUT_MS = 8_000;

/**
 * Gateway health plus a best-effort probe of the AI service's /health.
 * The gateway itself is always "ok"; the `ai` block tells the client whether
 * real model weights are loaded upstream (or that the upstream is asleep).
 */
export const getHealthStatus = async (): Promise<HealthStatus> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_HEALTH_TIMEOUT_MS);
  let ai: AIHealth;
  try {
    const response = await fetch(`${aiServiceUrl()}/health`, { signal: controller.signal });
    if (response.ok) {
      const body = (await response.json()) as Partial<AIHealth>;
      ai = { reachable: true, status: body.status ?? "unknown", model: body.model, version: body.version };
    } else {
      ai = { reachable: false, status: `http ${response.status}` };
    }
  } catch (err) {
    ai = { reachable: false, status: err instanceof Error ? err.message : "unreachable" };
  } finally {
    clearTimeout(timer);
  }

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "air-drawing-server",
    ai,
  };
};
