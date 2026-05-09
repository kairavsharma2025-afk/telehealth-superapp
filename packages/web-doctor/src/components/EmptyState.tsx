import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[#F6F8FA] text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-[13px] text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
