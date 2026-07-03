import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          background: "#05070a",
          panel: "#0b1118",
          border: "#1f2a37",
          text: "#d7dde8",
          muted: "#7d8aa0",
          accent: "#35d08f",
          danger: "#ff5a5f"
        }
      }
    }
  },
  plugins: []
};

export default config;
