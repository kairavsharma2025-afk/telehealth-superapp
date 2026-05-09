import { useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { Layout } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { formatRelative } from "../lib/countdown";
import { useToast } from "../lib/toast";

type Channel = "email" | "sms" | "push";
type Status = "pending" | "sent" | "failed";

interface NotificationItem {
  id: string;
  channel: Channel;
  template: string;
  status: Status;
  errorMessage: string | null;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}
interface ListResult {
  items: NotificationItem[];
}

const CHANNEL_ICON: Record<Channel, ReactNode> = {
  email: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  sms: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-12 7l-5 1 1.5-4.3A8 8 0 1 1 21 12Z" />
    </svg>
  ),
  push: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
};

function templateTitle(template: string, payload: Record<string, unknown>): string {
  switch (template) {
    case "appointment_confirmed":
      return "Appointment confirmed";
    case "appointment_reminder":
      return "Reminder: upcoming appointment";
    case "appointment_cancelled":
      return "Appointment cancelled";
    case "manual_message":
      return typeof payload["subject"] === "string"
        ? payload["subject"]
        : "Message from your team";
    default:
      return template
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function NotificationsPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: () => api<ListResult>("/notifications"),
  });

  const markRead = useMutation<
    NotificationItem,
    ApiError,
    string,
    { previous: ListResult | undefined }
  >({
    mutationFn: (id) =>
      api<NotificationItem>(`/notifications/${id}/read`, { method: "POST" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const previous = qc.getQueryData<ListResult>(["notifications"]);
      const now = new Date().toISOString();
      qc.setQueryData<ListResult>(["notifications"], (old) =>
        old
          ? {
              items: old.items.map((n) =>
                n.id === id && !n.readAt ? { ...n, readAt: now } : n,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["notifications"], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation<{ updated: number }, ApiError>({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] });
      const now = new Date().toISOString();
      qc.setQueryData<ListResult>(["notifications"], (old) =>
        old
          ? {
              items: old.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
            }
          : old,
      );
    },
    onSuccess: (data) => {
      toast.push({
        tone: "success",
        title: `Marked ${data.updated} as read.`,
      });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = query.data?.items ?? [];
  const unreadCount = useMemo(
    () => items.filter((n) => !n.readAt).length,
    [items],
  );

  return (
    <Layout
      title="Notifications"
      meta={
        unreadCount > 0 ? (
          <button
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="rounded-md border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink-muted transition hover:bg-[#F6F8FA] hover:text-ink disabled:opacity-60"
          >
            Mark all read
          </button>
        ) : (
          <span className="text-[12.5px] text-ink-muted">All caught up</span>
        )
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">Inbox</h2>
          <div className="mt-0.5 text-[12px] text-ink-muted">
            {unreadCount > 0
              ? `${unreadCount} unread of ${items.length}`
              : `${items.length} ${items.length === 1 ? "message" : "messages"}`}
          </div>
        </div>

        {query.isPending ? (
          <div className="px-5 py-8 text-[13px] text-ink-muted">Loading…</div>
        ) : query.isError ? (
          <div className="px-5 py-4">
            <div className="rounded-md border border-danger/20 bg-danger-subtle px-3 py-2 text-[13px] text-danger">
              Failed to load: {query.error.message}
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon />}
            title="Inbox is empty"
            description="Reminders and messages will arrive here as care happens."
          />
        ) : (
          <ul>
            {items.map((n) => {
              const unread = !n.readAt;
              return (
                <li
                  key={n.id}
                  onClick={() => {
                    if (unread) markRead.mutate(n.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (unread && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      markRead.mutate(n.id);
                    }
                  }}
                  className={
                    "flex items-center gap-3 border-b border-border px-4 py-3 transition last:border-b-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500/30 " +
                    (unread
                      ? "cursor-pointer bg-brand-50/30 hover:bg-brand-50/60"
                      : "hover:bg-[#FBFCFD]")
                  }
                >
                  <div
                    className={
                      "grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg " +
                      (unread ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-ink-muted")
                    }
                  >
                    {CHANNEL_ICON[n.channel]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium text-ink">
                      {templateTitle(n.template, n.payload)}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-muted">
                      {formatRelative(new Date(n.sentAt ?? n.createdAt))}
                      <span className="text-ink-subtle"> · </span>
                      <span className="capitalize">{n.channel}</span>
                    </div>
                    {n.status === "failed" && n.errorMessage ? (
                      <div className="mt-1 text-[11.5px] text-danger">
                        {n.errorMessage}
                      </div>
                    ) : null}
                  </div>
                  {unread ? (
                    <div
                      className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-600"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

function EmptyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
