import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        panel: "var(--color-panel)",
        line: "var(--color-line)",
        accent: "var(--color-accent)",
        muted: "var(--color-muted)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        value: [
          "var(--font-value)",
          "var(--font-sans)",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.28)",
      },
      borderRadius: {
        "portal-surface": "var(--portal-radius-surface)",
        "portal-chip": "var(--portal-radius-chip)",
        "portal-control": "var(--portal-radius-control)",
        "portal-panel": "var(--portal-radius-panel)",
        "portal-modal": "var(--portal-radius-modal)",
        shell: "var(--portal-radius-modal)",
      },
    },
  },
  plugins: [],
};

export default config;
