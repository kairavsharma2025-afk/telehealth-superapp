// Brand identity — single source for product name, tagline, and the
// SVG logo mark used by the web apps. Mobile renders an equivalent via
// react-native-svg; both share the same path data so the visual is
// pixel-identical.

export const brand = {
  name: "Vela Health",
  shortName: "Vela",
  tagline: "Care that travels with you.",
  domain: "vela.health",
  supportEmail: "support@vela.health",
} as const;

// The logo mark is a stylised "V" formed by a heartbeat pulse line —
// upstroke, plateau, the spike, recovery — closing back into a "V".
// Built on a 24x24 viewBox so it scales cleanly at any size.
//
// Mobile and web both consume `LOGO_PATH`. Web uses `LOGO_SVG` directly
// in markup; mobile passes `LOGO_PATH` to <Path d={...} /> from
// react-native-svg.

export const LOGO_PATH =
  "M2 7 L6 7 L8 11 L11 4 L13 18 L16 11 L18 14 L22 14";

export function logoSvg(size = 24, color = "#0F766E"): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`,
    ` viewBox="0 0 24 24" fill="none" stroke="${color}"`,
    ` stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">`,
    `<path d="${LOGO_PATH}" /></svg>`,
  ].join("");
}
