import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background:    "var(--background)",
        foreground:    "var(--foreground)",
        midnight:      "#0D1B2A",
        navy:          "#0D1B2A",
        "navy-light":  "#1B263B",
        "blue-dark":   "#1B263B",
        slate:         "#415A77",
        "blue-mid":    "#415A77",
        "slate-light": "#778DA9",
        "blue-light":  "#778DA9",
        offwhite:      "#E0E1DD",
        "page-bg":     "#E8ECF0",
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
      boxShadow: {
        card:     "0 1px 2px rgba(13,27,42,0.04), 0 4px 16px rgba(13,27,42,0.06)",
        elevated: "0 8px 32px rgba(13,27,42,0.12), 0 2px 8px rgba(13,27,42,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
