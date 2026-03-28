import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sand: {
          50: "var(--sand-50)",
          100: "var(--sand-100)",
          300: "var(--sand-300)",
          500: "var(--sand-500)",
          700: "var(--sand-700)",
        },
        control: {
          400: "var(--control-400)",
          500: "var(--control-500)",
        },
        urge: {
          400: "var(--urge-400)",
          500: "var(--urge-500)",
        },
        ink: {
          50: "var(--ink-50)",
          100: "var(--ink-100)",
          300: "var(--ink-300)",
          500: "var(--ink-500)",
          700: "var(--ink-700)",
          900: "var(--ink-900)",
        },
      },
      boxShadow: {
        glow: "0 0 40px rgba(212, 160, 23, 0.18)",
        control: "0 20px 60px rgba(0, 200, 83, 0.12)",
        urge: "0 20px 60px rgba(255, 107, 45, 0.16)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
};

export default config;
