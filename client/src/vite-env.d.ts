/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API calls. "/api" (default) goes through the Express gateway. */
  readonly VITE_API_BASE_URL?: string;
  /** Legacy name for VITE_API_BASE_URL — a direct AI-service URL. */
  readonly VITE_AI_SERVICE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
