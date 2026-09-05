import { Request } from "express";
import { AIServiceError } from "../types";
import { aiServiceUrl, upstreamTimeoutMs } from "../config";

/**
 * Turn a non-OK upstream response into an AIServiceError that carries the
 * upstream status and its `detail`/`error` message, so the client sees the
 * real reason (e.g. "model not loaded") instead of a generic 502.
 */
async function upstreamError(response: Response): Promise<AIServiceError> {
  let detail = `AI service responded with ${response.status}`;
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    const message = body.detail ?? body.error;
    if (typeof message === "string" && message.trim()) detail = message;
    else if (message) detail = JSON.stringify(message);
  } catch {
    // Non-JSON body — keep the generic message.
  }
  const err: AIServiceError = new Error(detail);
  err.status = response.status;
  err.upstream = true;
  return err;
}

function networkError(cause: unknown): AIServiceError {
  const err: AIServiceError = new Error(
    `AI service unreachable at ${aiServiceUrl()}: ${cause instanceof Error ? cause.message : String(cause)}`
  );
  err.status = 502;
  err.upstream = false;
  return err;
}

async function fetchUpstream(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), upstreamTimeoutMs());
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (cause) {
    throw networkError(cause);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Forward the raw request to the FastAPI AI service.
 * Streams the request body as-is (multipart/form-data).
 */
export const forwardToAI = async (
  req: Request,
  endpoint: string = "/predict"
): Promise<unknown> => {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key !== "host" && typeof value === "string") {
      headers[key] = value;
    }
  }

  const response = await fetchUpstream(`${aiServiceUrl()}${endpoint}`, {
    method: "POST",
    headers,
    body: req as unknown as BodyInit,
    duplex: "half",
  } as RequestInit);

  if (!response.ok) throw await upstreamError(response);
  return response.json();
};

/**
 * Forward a JSON body to the FastAPI AI service.
 */
export const forwardJSON = async (
  body: unknown,
  endpoint: string
): Promise<unknown> => {
  const response = await fetchUpstream(`${aiServiceUrl()}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await upstreamError(response);
  return response.json();
};

/**
 * GET a JSON resource from the AI service.
 */
export const fetchFromAI = async (endpoint: string): Promise<unknown> => {
  const response = await fetchUpstream(`${aiServiceUrl()}${endpoint}`, { method: "GET" });
  if (!response.ok) throw await upstreamError(response);
  return response.json();
};
