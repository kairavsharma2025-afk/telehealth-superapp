// RN-side bridge to @telehealth/design. Re-exports the token primitives
// plus a few RN-specific helpers (shadows mapped to native style props,
// semantic colour aliases inlined for IntelliSense in StyleSheet calls).

export {
  palette,
  semantic,
  space,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  shadow,
  fontFamily,
  brand,
  LOGO_PATH,
} from "@telehealth/design";

import { shadow as _shadow } from "@telehealth/design";

// Native shadow tokens, ready to spread into a StyleSheet style object.
export const nativeShadow = {
  sm: _shadow.sm.native,
  md: _shadow.md.native,
  lg: _shadow.lg.native,
};
