// Tiny inline-SVG icon set so we don't ship a whole icon library for
// the few glyphs we actually use. All draw on currentColor and inherit
// font-size for sizing flexibility.

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
