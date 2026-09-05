import { useEffect, useRef, useState } from "react";
import type { Hands as HandsType, Results as HandsResults } from "@mediapipe/hands";
import type { Camera as CameraType } from "@mediapipe/camera_utils";
import type { HandLandmarks, TrackingState } from "../types";

// MediaPipe's npm packages do not bundle correctly with Vite/Rollup for
// production, so the runtime scripts are loaded from a CDN in index.html and
// reached through window. The type-only imports above are erased at build time.
type HandsCtor = new (config: { locateFile: (file: string) => string }) => HandsType;
type CameraCtor = new (
  video: HTMLVideoElement,
  options: { onFrame: () => Promise<void>; width: number; height: number },
) => CameraType;

function getMediaPipe(): { Hands: HandsCtor; Camera: CameraCtor } | null {
  const w = window as unknown as { Hands?: HandsCtor; Camera?: CameraCtor };
  if (!w.Hands || !w.Camera) return null;
  return { Hands: w.Hands, Camera: w.Camera };
}

/**
 * useHandTracking — runs MediaPipe Hands entirely in the browser and exposes
 * the latest landmarks. Nothing from the camera leaves the page; only stroke
 * coordinates are ever sent to the server.
 *
 * The camera is only opened while `enabled` is true, so the app can start
 * without asking for permission.
 */
export default function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [landmarks, setLandmarks] = useState<HandLandmarks | null>(null);
  const [status, setStatus] = useState<TrackingState>("off");
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraType | null>(null);
  const handsRef = useRef<HandsType | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!enabled || !videoEl) {
      setStatus("off");
      setLandmarks(null);
      return;
    }

    const mp = getMediaPipe();
    if (!mp) {
      setStatus("error");
      setError("Hand-tracking library did not load. Check your connection and reload.");
      return;
    }

    let cancelled = false;
    setStatus("starting");
    setError(null);

    const hands = new mp.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results: HandsResults) => {
      if (cancelled) return;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setLandmarks(results.multiHandLandmarks[0]);
      } else {
        setLandmarks(null);
      }
      setStatus("ready");
    });

    const camera = new mp.Camera(videoEl, {
      onFrame: async () => {
        try {
          await hands.send({ image: videoEl });
        } catch {
          // Ignore transient send errors
        }
      },
      width: 640,
      height: 480,
    });
    cameraRef.current = camera;

    Promise.resolve(camera.start()).catch((err: unknown) => {
      if (cancelled) return;
      const name = err instanceof Error ? err.name : "";
      setStatus("error");
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. You can keep drawing with the mouse or touch."
          : name === "NotFoundError"
          ? "No camera was found on this device."
          : "The camera could not be started.",
      );
    });

    return () => {
      cancelled = true;
      try {
        camera.stop();
      } catch {
        // already stopped
      }
      hands.close();
      const stream = videoEl.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      videoEl.srcObject = null;
      setLandmarks(null);
    };
  }, [videoRef, enabled]);

  return { landmarks, status, error, isLoaded: status === "ready" };
}
