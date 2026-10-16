/**
 * Client configuration. Everything comes from Vite env vars (see .env.example);
 * nothing here is a secret.
 */

const rawBase =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_AI_SERVICE_URL?.trim() ||
  "/api";

/** Base URL for every request. Default "/api" → Express gateway (proxied by Vite in dev). */
export const API_BASE_URL = rawBase.replace(/\/+$/, "");

/** True when the client talks straight to the FastAPI service (e.g. a Hugging Face Space). */
export const TALKS_TO_AI_DIRECTLY = /^https?:\/\//i.test(API_BASE_URL) && !/\/api$/i.test(API_BASE_URL);

/** True when the backend is a Hugging Face Space, which sleeps when idle. */
export const BACKEND_MAY_SLEEP = /\.hf\.space/i.test(API_BASE_URL);

// ── On-device recognition ─────────────────────────────────────────────────
// The ONNX model is imported as an asset so Vite hashes it (long-lived caching,
// and a new export is a new URL). Swap the file with VITE_LOCAL_MODEL=fp32.
import modelInt8Url from "../models/emnist_cnn.int8.onnx?url";
import modelFp32Url from "../models/emnist_cnn.onnx?url";

function queryParam(name: string): string | null {
  return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(name) : null;
}

// ?model=fp32 (or int8) overrides the build-time choice, for measuring both.
const modelChoice = (queryParam("model") || import.meta.env.VITE_LOCAL_MODEL?.trim() || "int8").toLowerCase();
export const LOCAL_MODEL_URL = modelChoice === "fp32" ? modelFp32Url : modelInt8Url;

/**
 * Where characters are recognised. "device" (default) runs ONNX Runtime Web in
 * the browser and only falls back to the server if that fails to load.
 * "server" skips on-device recognition entirely: set VITE_RECOGNITION=server,
 * or add ?recognition=server to the URL to try the fallback path.
 */
function recognitionMode(): "device" | "server" {
  const value = (queryParam("recognition") || import.meta.env.VITE_RECOGNITION || "device").trim().toLowerCase();
  return value === "server" ? "server" : "device";
}
export const RECOGNITION_MODE = recognitionMode();

/** Drawing surface size in canvas pixels (matches the MediaPipe camera frame). */
export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;
