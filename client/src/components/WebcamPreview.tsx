import { useRef, useEffect, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMotion, DUR } from "../motion";

interface WebcamPreviewProps {
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
  visible: boolean;
}

/** Small mirrored preview in the paper's corner. The stream never leaves the browser. */
export default function WebcamPreview({ sourceVideoRef, visible }: WebcamPreviewProps) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const { rise } = useMotion();

  useEffect(() => {
    if (visible && sourceVideoRef?.current && previewRef.current) {
      const stream = sourceVideoRef.current.srcObject;
      if (stream) previewRef.current.srcObject = stream;
    }
  }, [visible, sourceVideoRef]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          {...rise(8, DUR.slow)}
          className="absolute bottom-3 right-3 w-36 overflow-hidden rounded-lg border border-desk-0/40 shadow-lg"
          style={{ aspectRatio: "4/3" }}
        >
          <video ref={previewRef} className="h-full w-full -scale-x-100 object-cover" autoPlay playsInline muted />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
