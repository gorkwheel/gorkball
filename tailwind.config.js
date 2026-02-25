/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        gork: {
          bg: "#080C10",
          surface: "#0D1117",
          border: "#1C2330",
          accent: "#00E5FF",
          "accent-dim": "#00B8CC",
          muted: "#64748B",
          text: "#E2E8F0",
          "text-dim": "#94A3B8",
          green: "#22C55E",
          red: "#EF4444",
          yellow: "#F59E0B",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      animation: {
        pulse_slow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        spin_slow: "spin 8s linear infinite",
      },
    },
  },
  plugins: [],
};
