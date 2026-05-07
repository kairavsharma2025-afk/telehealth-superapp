import { useMemo } from "react";
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

const CHANNEL_ICON: Record<Channel, string> = {
  email: "✉",
  sms: "✆",
  push: "◉",
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
            className="secondary"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            Mark all read
          </button>
        ) : (
          <span>All caught up</span>
        )
      }
    >
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Inbox</h2>
            <div className="muted" style={{ marginTop: 2 }}>
              {unreadCount > 0
                ? `${unreadCount} unread of ${items.length}`
                : `${items.length} ${items.length === 1 ? "message" : "messages"}`}
            </div>
          </div>
        </div>

        {query.isPending ? (
          <div className="card-pad">
            <span className="muted">Loading…</span>
          </div>
        ) : query.isError ? (
          <div className="card-pad">
            <div className="alert alert-error">
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
          <ul className="notif-list">
            {items.map((n) => {
              const unread = !n.readAt;
              return (
                <li
                  key={n.id}
                  className={`notif-row ${unread ? "unread" : ""}`}
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
                >
                  <div className="ch-badge">{CHANNEL_ICON[n.channel]}</div>
                  <div className="body">
                    <div className="title">
                      {templateTitle(n.template, n.payload)}
                    </div>
                    <div className="when">
                      {formatRelative(new Date(n.sentAt ?? n.createdAt))} ·{" "}
                      {n.channel}
                    </div>
                    {n.status === "failed" && n.errorMessage ? (
                      <div className="error" style={{ fontSize: 12, marginTop: 4 }}>
                        {n.errorMessage}
                      </div>
                    ) : null}
                  </div>
                  {unread ? <div className="unread-dot" aria-hidden="true" /> : null}
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
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
