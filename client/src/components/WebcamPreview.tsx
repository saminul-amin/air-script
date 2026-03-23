import { useRef, useEffect, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface WebcamPreviewProps {
  sourceVideoRef: RefObject<HTMLVideoElement | null>;
  visible: boolean;
}

export default function WebcamPreview({ sourceVideoRef, visible }: WebcamPreviewProps) {
  const previewRef = useRef<HTMLVideoElement>(null);

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
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute top-3 right-3 z-20 w-40 rounded-2xl overflow-hidden border border-white/15 shadow-2xl shadow-black/30"
          style={{ aspectRatio: "4/3" }}
        >
          <video
            ref={previewRef}
            className="w-full h-full object-cover -scale-x-100"
            autoPlay
            playsInline
            muted
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
