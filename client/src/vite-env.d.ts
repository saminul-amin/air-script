/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API calls. "/api" (default) goes through the Express gateway. */
  readonly VITE_API_BASE_URL?: string;
  /** Legacy name for VITE_API_BASE_URL — a direct AI-service URL. */
  readonly VITE_AI_SERVICE_URL?: string;
  /** Which ONNX export the browser runs: "int8" (default) or "fp32". */
  readonly VITE_LOCAL_MODEL?: string;
  /** "device" (default) or "server": where characters are recognised. */
  readonly VITE_RECOGNITION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.onnx?url" {
  const url: string;
  export default url;
}

declare module "*.wasm?url" {
  const url: string;
  export default url;
}
