// Vela Health design tokens — single source of truth for colour, type,
// space, radius, and shadow across the web + mobile apps. Keep this
// file dependency-free (no React, no DOM) so it imports cleanly into
// both Vite and Metro.

export const palette = {
  // Brand — Vela teal. brand700 is the "primary" color used for active
  // states, primary buttons, and accents. brand50 is the soft tint used
  // for hover/selected backgrounds; brand200 is the mid value used for
  // gradients (e.g. the appointment date chip).
  brand50: "#E6F7F5", // primary-light
  brand100: "#CCFBF1",
  brand200: "#B2E8E2", // primary-mid (gradient stop)
  brand300: "#5EEAD4",
  brand400: "#6EE7DF", // bright accent for sidebar active icon
  brand500: "#14B8A6",
  brand600: "#0D9488",
  brand700: "#0D9E89", // primary
  brand800: "#0A7A6A", // primary-dark
  brand900: "#0D2B2B", // sidebar gradient deep stop

  // Accent — warm coral for CTAs that need urgency (cancel, alert)
  accent500: "#F26B5B",
  accent50: "#FDECEA",

  // Neutrals — slate. Gives text depth without being pure grey.
  slate50: "#F8FAFC",
  slate100: "#F1F5F9",
  slate200: "#E2E8F0",
  slate300: "#CBD5E1",
  slate400: "#94A3B8",
  slate500: "#64748B",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1E293B",
  slate900: "#1A2332", // text-primary — slightly warmer than pure slate

  // Page canvas — soft blue-gray. White cards float on top.
  pageBg: "#F4F6F9",

  white: "#FFFFFF",
  black: "#000000",

  // Status — appointment / notification states. Tuned for AA contrast on
  // both white-card and dark-mode-ish surfaces.
  amber500: "#F59E0B",
  amber600: "#D97706",
  blue500: "#3B82F6",
  blue600: "#2563EB",
  green500: "#22C55E",
  green600: "#16A34A",
  red500: "#EF4444",
  red600: "#DC2626",
  violet500: "#8B5CF6",
} as const;

// Semantic aliases — what consumers reach for. Switching brand colour
// later means changing this map, not 80 component files.
export const semantic = {
  bg: palette.pageBg, // soft blue-gray canvas
  surface: palette.white,
  surfaceElevated: palette.white,
  surfaceMuted: palette.slate100,
  surfaceInverse: palette.slate900,

  border: palette.slate200,
  borderStrong: palette.slate300,
  borderFocus: palette.brand500,

  text: palette.slate900,
  textMuted: palette.slate500,
  textSubtle: palette.slate400,
  textInverse: palette.white,
  textOnBrand: palette.white,

  brand: palette.brand700,
  brandHover: palette.brand800,
  brandSubtle: palette.brand50,
  brandStrong: palette.brand900,

  success: palette.green600,
  successSubtle: "#DCFCE7",
  warning: palette.amber600,
  warningSubtle: "#FEF3C7",
  danger: palette.red600,
  dangerSubtle: "#FEE2E2",
  info: palette.blue600,
  infoSubtle: "#DBEAFE",

  // Appointment statuses — used as both pill bg and timeline dot.
  statusScheduled: palette.amber500,
  statusConfirmed: palette.blue600,
  statusCompleted: palette.green600,
  statusCancelled: palette.red600,
} as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
  12: 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  "2xl": 20,
  "3xl": 24,
  "4xl": 30,
  "5xl": 36,
  "6xl": 48,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const lineHeight = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

// Cross-platform shadow tokens. RN consumes the *.native fields,
// web consumes *.web (a CSS box-shadow string).
export const shadow = {
  sm: {
    web: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
  },
  md: {
    web: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  lg: {
    web: "0 10px 30px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.05)",
    native: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.10,
      shadowRadius: 30,
      elevation: 8,
    },
  },
  // Brand-tinted shadow used on cards/buttons for warmth
  card: {
    web: "0 2px 8px rgba(13,158,137,0.08)",
    native: {
      shadowColor: "#0D9E89",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
  },
} as const;

// Typography stack — Inter is the de-facto SaaS choice; system fallbacks
// keep it fast on first paint. The mobile app inherits the platform's
// default sans (San Francisco / Roboto) which already feel premium.
export const fontFamily = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
} as const;

export type Tokens = {
  palette: typeof palette;
  semantic: typeof semantic;
  space: typeof space;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  shadow: typeof shadow;
  fontFamily: typeof fontFamily;
};

export const tokens: Tokens = {
  palette,
  semantic,
  space,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  shadow,
  fontFamily,
};
