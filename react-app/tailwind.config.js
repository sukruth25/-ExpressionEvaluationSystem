/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#DCE8E2",
        alabaster: "#CFE0D8",
        ink: "#12211C",
        slate: "#4C6159",
        indigo: "#1F4854",
        ochre: "#C47521",
        sage: "#1F6B57",
        hairline: "#B7CBC2",
        rust: "#A8462E",
        ivory: "#F5F9F5",
        mint: "#E9F2EC",
        glacier: "#E2EBEF",
        reed: "#E8EFDF",
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Instrument Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      boxShadow: {
        paperlift: "0 18px 60px -40px rgba(18,33,28,0.32)",
      },
      keyframes: {
        "faint-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
        "edge-flow": {
          to: { strokeDashoffset: "-16" },
        },
        "soft-blink": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "faint-pulse": "faint-pulse 3.2s ease-in-out infinite",
        "edge-flow": "edge-flow 1.4s linear infinite",
        "soft-blink": "soft-blink 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
