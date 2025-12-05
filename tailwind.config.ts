import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      fontSize: {
        "senior-sm": ["1rem", { lineHeight: "1.5" }],
        "senior-base": ["1.125rem", { lineHeight: "1.6" }],
        "senior-lg": ["1.25rem", { lineHeight: "1.6" }],
        "senior-xl": ["1.5rem", { lineHeight: "1.5" }],
        "senior-2xl": ["1.875rem", { lineHeight: "1.4" }],
        "senior-3xl": ["2.25rem", { lineHeight: "1.3" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        coral: {
          DEFAULT: "hsl(var(--coral))",
          light: "hsl(var(--coral-light))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          light: "hsl(var(--teal-light))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        // Health Monster Battle animations
        "monster-hit": {
          "0%, 100%": { transform: "translateX(0) scale(1)" },
          "10%": {
            transform: "translateX(-10px) scale(1.05)",
            filter: "brightness(1.5) hue-rotate(-10deg)",
          },
          "20%": {
            transform: "translateX(10px) scale(1.05)",
            filter: "brightness(1.5) hue-rotate(-10deg)",
          },
          "30%": { transform: "translateX(-8px) scale(1.02)" },
          "40%": { transform: "translateX(8px) scale(1.02)" },
          "50%": { transform: "translateX(-5px) scale(1)" },
          "60%": { transform: "translateX(5px) scale(1)" },
          "70%": { transform: "translateX(-2px)" },
          "80%": { transform: "translateX(2px)" },
        },
        "monster-idle-threat": {
          "0%, 100%": { transform: "scale(1) rotate(0deg)" },
          "25%": { transform: "scale(1.02) rotate(-1deg)" },
          "50%": { transform: "scale(1.04) rotate(0deg)" },
          "75%": { transform: "scale(1.02) rotate(1deg)" },
        },
        "monster-idle-battle": {
          "0%, 100%": { transform: "scale(1) translateY(0)" },
          "50%": { transform: "scale(0.98) translateY(3px)" },
        },
        "monster-flee": {
          "0%": {
            transform: "scale(1) rotate(0deg) translateY(0)",
            opacity: "1",
          },
          "50%": {
            transform: "scale(0.8) rotate(-10deg) translateY(-10px)",
            opacity: "0.8",
          },
          "100%": {
            transform: "scale(0.6) rotate(15deg) translateY(-20px)",
            opacity: "0.6",
          },
        },
        "monster-victory": {
          "0%": { transform: "scale(1)" },
          "20%": { transform: "scale(1.2) rotate(-5deg)" },
          "40%": { transform: "scale(1.1) rotate(5deg)" },
          "60%": { transform: "scale(1.15) rotate(-3deg)" },
          "80%": { transform: "scale(1.05) rotate(3deg)" },
          "100%": { transform: "scale(1) rotate(0deg)" },
        },
        "damage-float": {
          "0%": {
            transform: "translateX(-50%) translateY(0) scale(1)",
            opacity: "1",
          },
          "30%": {
            transform: "translateX(-50%) translateY(-30px) scale(1.2)",
            opacity: "1",
          },
          "100%": {
            transform: "translateX(-50%) translateY(-80px) scale(0.8)",
            opacity: "0",
          },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "float-particle-1": {
          "0%, 100%": { transform: "translate(20%, 80%)", opacity: "0" },
          "25%": { opacity: "1" },
          "50%": { transform: "translate(80%, 20%)", opacity: "0.5" },
          "75%": { opacity: "0.8" },
        },
        "float-particle-2": {
          "0%, 100%": { transform: "translate(70%, 90%)", opacity: "0" },
          "33%": { opacity: "0.7" },
          "66%": { transform: "translate(30%, 10%)", opacity: "0.4" },
        },
        "float-particle-3": {
          "0%, 100%": { transform: "translate(40%, 70%)", opacity: "0" },
          "40%": { opacity: "0.6" },
          "80%": { transform: "translate(60%, 30%)", opacity: "0.2" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        // Health Monster Battle animations
        "monster-hit": "monster-hit 0.5s ease-out",
        "monster-idle-threat": "monster-idle-threat 2s ease-in-out infinite",
        "monster-idle-battle": "monster-idle-battle 1.5s ease-in-out infinite",
        "monster-flee": "monster-flee 2s ease-out forwards",
        "monster-victory": "monster-victory 0.8s ease-in-out",
        "damage-float": "damage-float 1.5s ease-out forwards",
        shimmer: "shimmer 2s infinite",
        "float-particle-1": "float-particle-1 4s ease-in-out infinite",
        "float-particle-2": "float-particle-2 5s ease-in-out infinite 1s",
        "float-particle-3": "float-particle-3 6s ease-in-out infinite 2s",
      },
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
