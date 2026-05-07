import Svg, { Path } from "react-native-svg";
import { LOGO_PATH, palette } from "../theme";

interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 28, color = palette.brand700 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={LOGO_PATH}
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
