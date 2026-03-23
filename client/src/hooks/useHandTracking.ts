import { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";
import type { HandLandmarks } from "../types";

/**
 * Custom hook that initialises MediaPipe Hands, connects to the webcam
 * via Camera util, and exposes the latest hand landmarks.
 */
export default function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [landmarks, setLandmarks] = useState<HandLandmarks | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const cameraRef = useRef<Camera | null>(null);
  const handsRef = useRef<Hands | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsRef.current = hands;

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setLandmarks(results.multiHandLandmarks[0]);
      } else {
        setLandmarks(null);
      }
      setIsLoaded(true);
    });

    const camera = new Camera(videoEl, {
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
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  return { landmarks, isLoaded };
}
