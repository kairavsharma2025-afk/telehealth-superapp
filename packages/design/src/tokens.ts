// Vela Health design tokens — single source of truth for colour, type,
// space, radius, and shadow across the web + mobile apps. Keep this
// file dependency-free (no React, no DOM) so it imports cleanly into
// both Vite and Metro.

export const palette = {
  // Brand — deep teal evokes calm + medical trust without the over-used
  // tech-blue. Apollo / Practo / many telehealth brands use teal-greens.
  brand50: "#F0FDFA",
  brand100: "#CCFBF1",
  brand200: "#99F6E4",
  brand300: "#5EEAD4",
  brand400: "#2DD4BF",
  brand500: "#14B8A6",
  brand600: "#0D9488",
  brand700: "#0F766E",
  brand800: "#115E59",
  brand900: "#134E4A",

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
  slate900: "#0F172A",

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
  bg: palette.slate50,
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
    web: "0 1px 2px 0 rgba(15, 23, 42, 0.06)",
    native: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
  },
  md: {
    web: "0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
    native: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  lg: {
    web: "0 12px 32px -8px rgba(15, 23, 42, 0.16), 0 4px 8px -4px rgba(15, 23, 42, 0.08)",
    native: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
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
