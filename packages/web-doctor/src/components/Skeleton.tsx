export function Skeleton({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="animate-pulse bg-slate-100"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function AppointmentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <Skeleton width={76} height={56} radius={8} />
      <div className="flex-1 space-y-2">
        <Skeleton width="40%" height={14} />
        <Skeleton width="60%" height={12} />
      </div>
      <Skeleton width={88} height={20} radius={9999} />
    </div>
  );
}
