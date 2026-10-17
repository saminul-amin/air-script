import { motion } from "framer-motion";
import type { Language } from "../types";
import { useMotion, DUR } from "../motion";

interface LanguageSwitchProps {
  value: Language;
  disabled?: boolean;
  onChange: (language: Language) => void;
}

const OPTIONS: { value: Language; label: string; title: string; className?: string }[] = [
  { value: "en", label: "English", title: "Recognise Latin letters and digits (EMNIST Balanced, 47 classes) with spelling correction" },
  { value: "bn", label: "বাংলা", title: "Recognise Bengali letters, digits and 24 compound characters (BanglaLekha-Isolated, 84 classes). No correction in Bengali yet.", className: "font-bengali" },
];

/** English / বাংলা, the same segmented control as Write / Draw. */
export default function LanguageSwitch({ value, disabled, onChange }: LanguageSwitchProps) {
  const { t } = useMotion();
  return (
    <div role="radiogroup" aria-label="Script" className="relative flex items-center rounded-lg bg-desk-2 p-0.5">
      {OPTIONS.map(({ value: v, label, title, className }) => {
        const active = value === v;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(v)}
            title={title}
            lang={v}
            className={`relative z-10 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-ui disabled:opacity-40 ${
              active ? "text-text-0" : "text-text-2 hover:text-text-1"
            } ${className ?? ""}`}
          >
            {active && (
              <motion.span
                layoutId="language-thumb"
                transition={t(DUR.base)}
                className="absolute inset-0 -z-10 rounded-md bg-desk-0 shadow-[inset_0_0_0_1px_var(--line-strong)]"
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
