/**
 * Runtime configuration, read from the environment on each access so that
 * tests (and process managers that inject env late) always see current values.
 * See server/.env.example for the full list.
 */
export const port = (): number => Number(process.env.PORT) || 5000;

export const aiServiceUrl = (): string =>
  (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const upstreamTimeoutMs = (): number => Number(process.env.UPSTREAM_TIMEOUT_MS) || 120_000;
