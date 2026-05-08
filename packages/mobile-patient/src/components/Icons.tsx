import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { semantic } from "../theme";

// Lucide-style stroke icons drawn as inline SVG. Avoids the
// lucide-react-native dep (which has rolled native peers we don't need on
// web). Same 24×24 viewBox + 2px stroke as lucide so swapping later is a
// drop-in.

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const SHARED = {
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Frame({
  size = 20,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {children}
    </Svg>
  );
}

export function CalendarDaysIcon({
  size = 20,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={3}
        y={4}
        width={18}
        height={18}
        rx={2}
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Line x1={16} y1={2} x2={16} y2={6} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={8} y1={2} x2={8} y2={6} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M8 14h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M12 14h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M16 14h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M8 18h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M12 18h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M16 18h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function PlusCircleIcon({
  size = 20,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={8} y1={12} x2={16} y2={12} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={12} y1={8} x2={12} y2={16} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function FileTextIcon({
  size = 20,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Polyline
        points="14 2 14 8 20 8"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Line x1={8} y1={13} x2={16} y2={13} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={8} y1={17} x2={16} y2={17} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function BellIcon({
  size = 20,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Path
        d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function UserIcon({
  size = 20,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function CheckIcon({
  size = 16,
  color = "#fff",
  strokeWidth = 3,
}: IconProps) {
  return (
    <Frame size={size}>
      <Polyline
        points="20 6 9 17 4 12"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function ChevronRightIcon({
  size = 16,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Polyline
        points="9 18 15 12 9 6"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function SearchIcon({
  size = 18,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function CloseIcon({
  size = 18,
  color = semantic.textMuted,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Frame size={size}>
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

// ─── Specialty icons (lucide paths) ─────────────────────────────────

export function StethoscopeIcon({ size = 26, color = "#0D9E89", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M11 2v2" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M5 2v2" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M8 15a6 6 0 0 0 12 0v-3" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Circle cx={20} cy={10} r={2} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function HeartIcon({ size = 26, color = "#DC2626", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function SparklesIcon({ size = 26, color = "#EA580C", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Path d="M20 3v4" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M22 5h-4" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M4 17v2" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M5 18H3" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function BabyIcon({ size = 26, color = "#0891B2", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M9 12h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M15 12h.01" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path
        d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function BrainIcon({ size = 26, color = "#7C3AED", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Path
        d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function BoneIcon({ size = 26, color = "#16A34A", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}

export function VenusIcon({ size = 26, color = "#DB2777", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx={12} cy={9} r={6} stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M12 15v7" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
      <Path d="M9 19h6" stroke={color} strokeWidth={strokeWidth} {...SHARED} />
    </Frame>
  );
}

export function EarIcon({ size = 26, color = "#CA8A04", strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
      <Path
        d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"
        stroke={color}
        strokeWidth={strokeWidth}
        {...SHARED}
      />
    </Frame>
  );
}
