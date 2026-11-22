import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          canvas: "#09090B",
          surface: "#121216",
          elevated: "#18181D",
          card: "#19191C",
          border: "#27272A",
        },
        vermilion: {
          DEFAULT: "#FF4F28",
          glow: "#FF7859",
          soft: "#FFB4A4",
          dark: "#B72400",
        },
        solar: {
          DEFAULT: "#F59E0B",
          soft: "#FCD34D",
        },
        jade: {
          DEFAULT: "#10B981",
          soft: "#9BFFCE",
        },
        crimson: {
          DEFAULT: "#EF4444",
          soft: "#FCA5A5",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
