import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon ?? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        )}
      </div>
      <div className="empty-state-title">{title}</div>
      {description ? (
        <div className="empty-state-desc">{description}</div>
      ) : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
