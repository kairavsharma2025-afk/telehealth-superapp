import { LOGO_PATH } from "@telehealth/design";

interface LogoProps {
  size?: number;
  color?: string;
  title?: string;
}

export function Logo({ size = 28, color = "currentColor", title = "Vela Health" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <path d={LOGO_PATH} />
    </svg>
  );
}
