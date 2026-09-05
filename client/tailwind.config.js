/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        desk: { 0: "var(--desk-0)", 1: "var(--desk-1)", 2: "var(--desk-2)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        paper: { DEFAULT: "var(--paper)", edge: "var(--paper-edge)" },
        ink: { DEFAULT: "var(--ink)", soft: "var(--ink-soft)" },
        text: { 0: "var(--text-0)", 1: "var(--text-1)", 2: "var(--text-2)" },
        accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", soft: "var(--accent-soft)" },
        ok: "var(--ok)",
        warn: "var(--warn)",
        danger: "var(--danger)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        fast: "140ms",
        base: "200ms",
        slow: "260ms",
      },
    },
  },
  plugins: [],
};
