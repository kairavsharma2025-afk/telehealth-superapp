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
