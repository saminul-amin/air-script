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

/** Drawing surface size in canvas pixels (matches the MediaPipe camera frame). */
export const CANVAS_WIDTH = 640;
export const CANVAS_HEIGHT = 480;
