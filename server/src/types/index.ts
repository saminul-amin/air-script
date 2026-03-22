import { Request } from "express";

// ── Environment ─────────────────────────────────────────────────────────

export interface EnvConfig {
  PORT: number;
  AI_SERVICE_URL: string;
}

// ── Health ──────────────────────────────────────────────────────────────

export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
}

// ── AI Service (FastAPI) ────────────────────────────────────────────────

/** Error thrown when the AI service returns a non-OK response. */
export interface AIServiceError extends Error {
  status?: number;
}

/** POST /predict – multipart image → prediction result. */
export interface PredictionResponse {
  prediction: string;
  confidence: number;
  top3: string[];
}

/** POST /predict-character – single character prediction. */
export interface CharacterPredictionResponse {
  prediction: string;
  confidence: number;
  top3: string[];
}

/** POST /process-text – request body. */
export interface ProcessTextRequest {
  raw_characters: {
    label: string;
    confidence: number;
    top3: string[];
    pause_before_ms: number;
  }[];
}

/** POST /process-text – response body. */
export interface ProcessTextResponse {
  raw_text: string;
  corrected_text: string;
  stages: Record<string, string>;
}

/** POST /suggest – request body. */
export interface SuggestRequest {
  prefix: string;
  context: string;
  limit: number;
}

/** POST /suggest – response body. */
export interface SuggestResponse {
  suggestions: { word: string; frequency: number }[];
  next_words: string[];
}

/** POST /autocomplete – request body. */
export interface AutocompleteRequest {
  partial: string;
  context: string;
}

/** POST /autocomplete – response body. */
export interface AutocompleteResponse {
  completion: string | null;
  full_word: string | null;
  confidence: number;
}

/** POST /learn – request body. */
export interface LearnRequest {
  wrong: string;
  correct: string;
}

/** POST /learn – response body. */
export interface LearnResponse {
  status: string;
  wrong: string;
  correct: string;
}

/** GET /personal-dict – response body. */
export interface PersonalDictResponse {
  entries: Record<string, string>;
}

// ── Incoming Express requests (typed bodies) ────────────────────────────

export type PredictRequest = Request;  // multipart — body is a stream

export type ProcessTextTypedRequest = Request<
  Record<string, never>,
  ProcessTextResponse,
  ProcessTextRequest
>;

export type SuggestTypedRequest = Request<
  Record<string, never>,
  SuggestResponse,
  SuggestRequest
>;

export type AutocompleteTypedRequest = Request<
  Record<string, never>,
  AutocompleteResponse,
  AutocompleteRequest
>;

export type LearnTypedRequest = Request<
  Record<string, never>,
  LearnResponse,
  LearnRequest
>;
