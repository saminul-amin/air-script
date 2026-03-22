export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface StrokeStyle {
  color: string;
  width: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface StrokeResult {
  accepted: boolean;
  isDot: boolean;
  dotAttached: boolean;
  reason: string | null;
}

export interface ValidationResult {
  valid: boolean;
  isDot: boolean;
  bbox: BBox | null;
  reason: string | null;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type HandLandmarks = Landmark[];

export type FingerStates = [boolean, boolean, boolean, boolean, boolean];

export type GestureType =
  | "point"
  | "fist"
  | "two_finger"
  | "open_palm"
  | "thumbs_up"
  | "none";

export type GestureCallbacks = Partial<Record<GestureType, () => void>>;

export interface RecognizedChar {
  label: string;
  confidence: number;
  top3: string[];
  pauseBeforeMs: number;
}

export interface CharacterPrediction {
  prediction: string;
  confidence: number;
  top3: string[];
}

export interface ProcessTextPayload {
  raw_characters: {
    label: string;
    confidence: number;
    top3: string[];
    pause_before_ms: number;
  }[];
}

export interface ProcessTextResponse {
  raw_text: string;
  corrected_text: string;
  stages: Record<string, string>;
}

export interface SuggestRequest {
  prefix: string;
  context: string;
  limit: number;
}

export interface SuggestResponse {
  suggestions: WordSuggestion[];
  next_words: string[];
}

export interface WordSuggestion {
  word: string;
  frequency: number;
}

export interface AutocompleteRequest {
  partial: string;
  context: string;
}

export interface AutocompleteResponse {
  completion: string | null;
  full_word: string | null;
  confidence: number;
}

export interface LearnRequest {
  wrong: string;
  correct: string;
}

export interface LearnResponse {
  status: string;
  wrong: string;
  correct: string;
}

export type AppMode = "drawing" | "writing";
