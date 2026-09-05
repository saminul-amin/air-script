import { motion } from "framer-motion";
import { Hand, MousePointer2 } from "lucide-react";
import type { InputSource, TrackingState } from "../types";
import { useMotion, DUR } from "../motion";

interface InputSourceSwitchProps {
  value: InputSource;
  trackingStatus: TrackingState;
  disabled?: boolean;
  onChange: (source: InputSource) => void;
}

/** Mouse/touch vs. hand tracking. Hand tracking is the upgrade, never the gate. */
export default function InputSourceSwitch({ value, trackingStatus, disabled, onChange }: InputSourceSwitchProps) {
  const { t } = useMotion();
  const handLabel =
    value !== "camera" ? "Hand" : trackingStatus === "starting" ? "Starting…" : trackingStatus === "ready" ? "Hand on" : "Hand";

  const options: { value: InputSource; label: string; Icon: typeof Hand; title: string }[] = [
    { value: "pointer", label: "Mouse / touch", Icon: MousePointer2, title: "Draw with the mouse, a pen or your finger" },
    { value: "camera", label: handLabel, Icon: Hand, title: "Use your hand in front of the webcam. Video stays in your browser." },
  ];

  return (
    <div role="radiogroup" aria-label="Input source" className="relative flex items-center rounded-lg bg-desk-2 p-0.5">
      {options.map(({ value: v, label, Icon, title }) => {
        const active = value === v;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(v)}
            title={title}
            className={`relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-ui disabled:opacity-40 ${
              active ? "text-text-0" : "text-text-2 hover:text-text-1"
            }`}
          >
            {active && (
              <motion.span
                layoutId="input-thumb"
                transition={t(DUR.base)}
                className={`absolute inset-0 -z-10 rounded-md shadow-[inset_0_0_0_1px_var(--line-strong)] ${
                  v === "camera" && trackingStatus === "ready" ? "bg-accent-soft" : "bg-desk-0"
                }`}
              />
            )}
            <Icon className={`h-3.5 w-3.5 ${active && v === "camera" && trackingStatus === "ready" ? "text-accent" : ""}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
