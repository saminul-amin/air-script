import { RefObject } from "react";

interface WebcamProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Webcam component – renders the <video> element that MediaPipe reads from.
 * The video is mirrored so it feels natural (like a mirror).
 */
export default function Webcam({ videoRef }: WebcamProps) {
  return (
    <video
      ref={videoRef}
      className="absolute top-0 left-0 w-full h-full object-cover -scale-x-100"
      autoPlay
      playsInline
      muted
    />
  );
}
