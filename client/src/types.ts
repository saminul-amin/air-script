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
  /** Per-point width for speed-sensitive ink; absent means constant `width`. */
  widths?: number[];
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
  top3_confidences?: number[];
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

/** Where strokes come from. Pointer (mouse / touch / pen) is the default; camera is opt-in. */
export type InputSource = "pointer" | "camera";

/** Lifecycle of the in-browser hand tracker. */
export type TrackingState = "off" | "starting" | "ready" | "error";

/** Backend reachability, including the cold-start of a sleeping free-tier service. */
export type ServiceState = "checking" | "waking" | "ready" | "degraded" | "offline";

export interface ServiceHealth {
  reachable: boolean;
  modelLoaded: boolean;
  /** True when the service predates weight reporting in /health. */
  legacy?: boolean;
  version?: string;
  error?: string | null;
}

/** A recorded stroke sequence that can be replayed through the pipeline. */
export interface SampleCharacter {
  /** What the strokes are meant to read as (for display only). */
  char: string;
  /** Strokes in screen coordinates on a CANVAS_WIDTH × CANVAS_HEIGHT surface. */
  strokes: Point[][];
}

export interface Sample {
  id: string;
  label: string;
  description: string;
  characters: SampleCharacter[];
}
