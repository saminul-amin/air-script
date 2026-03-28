import type {
  CharacterPrediction,
  ProcessTextResponse,
  RecognizedChar,
  SuggestResponse,
  AutocompleteResponse,
  LearnResponse,
} from "../types";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL;// || "http://localhost:8000";

/**
 * Send a canvas image blob to the AI service for character recognition.
 * @param {Blob} imageBlob - PNG blob of the canvas drawing
 * @returns {Promise<{prediction: string, confidence: number, top3: string[]}>}
 */
export async function recognizeCharacter(imageBlob: Blob): Promise<CharacterPrediction> {
  const formData = new FormData();
  formData.append("file", imageBlob, "drawing.png");

  const res = await fetch(`${AI_SERVICE_URL}/predict-character`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `AI service error: ${res.status}`);
  }

  return res.json();
}

/**
 * Send accumulated characters to the correction pipeline.
 * @param {Array<{label: string, confidence: number, top3?: string[], pause_before_ms?: number}>} characters
 * @returns {Promise<{raw_text: string, corrected_text: string, stages: object}>}
 */
export async function processText(
  characters: RecognizedChar[],
): Promise<ProcessTextResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/process-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw_characters: characters.map((ch) => ({
        label: ch.label,
        confidence: ch.confidence ?? 0,
        top3: ch.top3 ?? [],
        pause_before_ms: ch.pauseBeforeMs ?? 0,
      })),
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `AI service error: ${res.status}`);
  }

  return res.json();
}

/**
 * Get word suggestions for a partial word.
 * @param {string} prefix - The partial word typed so far
 * @param {string} context - Full text context for next-word prediction
 * @param {number} limit - Max suggestions to return
 */
export async function fetchSuggestions(
  prefix: string,
  context: string = "",
  limit: number = 5,
): Promise<SuggestResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, context, limit }),
  });

  if (!res.ok) return { suggestions: [], next_words: [] };
  return res.json();
}

/**
 * Get auto-completion for a partial word.
 * @param {string} partial - The partial word
 * @param {string} context - Full text context
 */
export async function fetchAutocomplete(
  partial: string,
  context: string = "",
): Promise<AutocompleteResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partial, context }),
  });

  if (!res.ok) return { completion: null, full_word: null, confidence: 0 };
  return res.json();
}

/**
 * Send a user correction to the personal dictionary.
 * @param {string} wrong - The original (wrong) word
 * @param {string} correct - The user's correction
 */
export async function learnCorrection(
  wrong: string,
  correct: string,
): Promise<LearnResponse | null> {
  const res = await fetch(`${AI_SERVICE_URL}/learn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wrong, correct }),
  });

  if (!res.ok) return null;
  return res.json();
}
