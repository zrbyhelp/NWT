import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./docs/**/*.md"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        accent: "hsl(var(--accent))",
        muted: "hsl(var(--muted))",
        ring: "hsl(var(--ring))"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        serif: ["var(--font-serif)", "serif"]
      },
      borderRadius: {
        md: "var(--radius)"
      }
    }
  },
  plugins: [animate]
};

export default config;

