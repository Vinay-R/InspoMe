/**
 * InspoMe v2 design tokens — single source of truth for non-CSS consumers
 * (the Expo app). The web app's globals.css mirrors these values; if you
 * change a color here, change it there too (and vice versa).
 *
 * OKLCH values from globals.css are pre-resolved to hex here because React
 * Native has no oklch() support.
 */

export const brand = {
  DEFAULT: "#f58057",
  hover: "#f06d3f",
  press: "#e15a2c",
  /** brand at 15% over transparent — use with a light/dark aware background */
  softAlpha: 0.15,
  softBorderAlpha: 0.3,
} as const;

export const light = {
  background: "#fcfcfc",
  card: "#ffffff",
  foreground: "#2b2320",
  secondary: "#f4f0ea",
  muted: "#f4f0ea",
  mutedForeground: "#767a80",
  accent: "#f2ebe2",
  border: "#e3dcd2",
  destructive: "#a83c22",
  success: "#3d9968",
  warning: "#f59e0b",
} as const;

export const dark = {
  background: "#141414",
  card: "#1c1c1c",
  foreground: "#f7f7f7",
  secondary: "#2b2b2b",
  muted: "#2b2b2b",
  mutedForeground: "#9c9c9c",
  accent: "#303030",
  border: "#404040",
  destructive: "#b0492e",
  success: "#4aa876",
  warning: "#fbbf24",
} as const;

export const chart = {
  1: brand.DEFAULT,
  2: "#c4bcb0",
  3: "#98917f",
  4: "#6b6353",
  5: "#453f34",
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/** Font families — loaded via next/font on web, expo-font on mobile. */
export const fonts = {
  sans: "Inter",
  display: "Space Grotesk",
  mono: "Geist Mono",
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;
