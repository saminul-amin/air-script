import type {
  CharacterPrediction,
  ProcessTextResponse,
  RecognizedChar,
  SuggestResponse,
  AutocompleteResponse,
  LearnResponse,
  ServiceHealth,
} from "../types";
import { API_BASE_URL } from "../config";
import { buildProcessTextPayload } from "./strokePayload";

/** Error thrown for non-OK responses, carrying the HTTP status and server detail. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readError(res: Response): Promise<ApiError> {
  let detail = `Service error ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: unknown; error?: unknown };
    const message = body.detail ?? body.error;
    if (typeof message === "string" && message.trim()) detail = message;
  } catch {
    // keep the generic message
  }
  return new ApiError(res.status, detail);
}

/**
 * Send a canvas image blob for character recognition.
 */
export async function recognizeCharacter(imageBlob: Blob): Promise<CharacterPrediction> {
  const formData = new FormData();
  formData.append("file", imageBlob, "drawing.png");

  const res = await fetch(`${API_BASE_URL}/predict-character`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw await readError(res);
  return res.json();
}

/**
 * Send accumulated characters to the correction pipeline.
 */
export async function processText(characters: RecognizedChar[]): Promise<ProcessTextResponse> {
  const res = await fetch(`${API_BASE_URL}/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildProcessTextPayload(characters)),
  });

  if (!res.ok) throw await readError(res);
  return res.json();
}

/**
 * Get word suggestions for a partial word plus next-word predictions.
 */
export async function fetchSuggestions(
  prefix: string,
  context: string = "",
  limit: number = 5,
): Promise<SuggestResponse> {
  const res = await fetch(`${API_BASE_URL}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, context, limit }),
  });

  if (!res.ok) return { suggestions: [], next_words: [] };
  return res.json();
}

/**
 * Get the single best auto-completion for a partial word.
 */
export async function fetchAutocomplete(
  partial: string,
  context: string = "",
): Promise<AutocompleteResponse> {
  const res = await fetch(`${API_BASE_URL}/autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partial, context }),
  });

  if (!res.ok) return { completion: null, full_word: null, confidence: 0 };
  return res.json();
}

/**
 * Send a user correction to the personal dictionary.
 */
export async function learnCorrection(wrong: string, correct: string): Promise<LearnResponse | null> {
  const res = await fetch(`${API_BASE_URL}/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wrong, correct }),
  });

  if (!res.ok) return null;
  return res.json();
}

interface RawHealth {
  status?: string;
  version?: string;
  model?: { loaded?: boolean; sha256?: string | null; error?: string | null };
  ai?: { reachable?: boolean; status?: string; version?: string; model?: RawHealth["model"] };
}

/**
 * Probe the backend. Understands both the gateway shape ({ ai: { model } })
 * and the direct AI-service shape ({ model }).
 */
export async function fetchHealth(signal?: AbortSignal): Promise<ServiceHealth> {
  const res = await fetch(`${API_BASE_URL}/health`, { signal, cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, `Health check failed with ${res.status}`);
  const body = (await res.json()) as RawHealth;

  if (body.ai) {
    return {
      reachable: body.ai.reachable !== false,
      modelLoaded: body.ai.model?.loaded === true,
      version: body.ai.version,
      error: body.ai.model?.error ?? (body.ai.reachable === false ? body.ai.status : null),
    };
  }
  if (!body.model) {
    // Pre-4.1 service: answers /health but does not report its weights.
    return { reachable: true, modelLoaded: true, legacy: true, version: body.version, error: null };
  }
  return {
    reachable: true,
    modelLoaded: body.model.loaded === true,
    version: body.version,
    error: body.model.error ?? null,
  };
}
