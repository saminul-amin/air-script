/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          50: "rgba(255,255,255,0.04)",
          100: "rgba(255,255,255,0.06)",
          200: "rgba(255,255,255,0.08)",
          300: "rgba(255,255,255,0.12)",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(99, 102, 241, 0.15)",
        "glow-cyan": "0 0 20px rgba(6, 182, 212, 0.2)",
        "glow-violet": "0 0 20px rgba(139, 92, 246, 0.2)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
