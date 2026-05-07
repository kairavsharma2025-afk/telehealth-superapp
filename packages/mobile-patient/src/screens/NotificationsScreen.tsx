import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatRelative } from "../lib/countdown";

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

function listNotifications(): Promise<ListResult> {
  return api<ListResult>("/notifications");
}

function markRead(id: string): Promise<NotificationItem> {
  return api<NotificationItem>(`/notifications/${id}/read`, { method: "POST" });
}

function markAllRead(): Promise<{ updated: number }> {
  return api<{ updated: number }>("/notifications/read-all", { method: "POST" });
}

const CHANNEL_ICON: Record<Channel, string> = {
  email: "✉",
  sms: "✆",
  push: "◉",
};

// Surface friendly title for known templates. Anything else falls back
// to humanising the template slug.
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
        : "Message from your care team";
    default:
      return template
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function NotificationsScreen() {
  const qc = useQueryClient();

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });

  // Optimistic mark-as-read — flip readAt locally before the round-trip
  // so the UI is responsive to the tap.
  const markReadMut = useMutation<
    NotificationItem,
    ApiError,
    string,
    { previous: ListResult | undefined }
  >({
    mutationFn: markRead,
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
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["notifications"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMut = useMutation<{ updated: number }, ApiError>({
    mutationFn: markAllRead,
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = query.data?.items ?? [];
  const unreadCount = useMemo(
    () => items.filter((n) => !n.readAt).length,
    [items],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unreadCount === 0
            ? "All caught up."
            : `${unreadCount} unread of ${items.length}`
        }
        trailing={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand700} />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load: {query.error.message}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space[2] }} />}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isPending}
              onRefresh={() => void query.refetch()}
              tintColor={palette.brand700}
            />
          }
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <TouchableOpacity
                style={[styles.row, unread && styles.rowUnread]}
                onPress={() => {
                  if (unread) markReadMut.mutate(item.id);
                }}
                activeOpacity={0.85}
              >
                {unread ? <View style={styles.unreadDot} /> : null}
                <View style={styles.channelBadge}>
                  <Text style={styles.channelIcon}>
                    {CHANNEL_ICON[item.channel]}
                  </Text>
                </View>
                <View style={styles.rowMain}>
                  <Text
                    style={[styles.template, unread && styles.templateUnread]}
                    numberOfLines={1}
                  >
                    {templateTitle(item.template, item.payload)}
                  </Text>
                  <Text style={styles.when}>
                    {formatRelative(new Date(item.sentAt ?? item.createdAt))} ·{" "}
                    {item.channel}
                  </Text>
                  {item.status === "failed" && item.errorMessage ? (
                    <Text style={styles.errorMessage} numberOfLines={2}>
                      {item.errorMessage}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.brand50,
    borderRadius: radius.md,
  },
  markAllText: {
    color: palette.brand800,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space[6],
  },
  error: { color: semantic.danger, textAlign: "center" },
  muted: { color: semantic.textMuted, fontSize: 14 },
  list: { padding: space[4], gap: space[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[3],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  rowUnread: {
    backgroundColor: palette.brand50,
    borderColor: palette.brand100,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.brand700,
  },
  channelBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.white,
    justifyContent: "center",
    alignItems: "center",
  },
  channelIcon: { color: palette.brand700, fontSize: 18 },
  rowMain: { flex: 1 },
  template: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.medium,
  },
  templateUnread: { fontWeight: fontWeight.bold },
  when: { color: semantic.textMuted, fontSize: 12, marginTop: 2 },
  errorMessage: { color: semantic.danger, fontSize: 12, marginTop: 4 },
});
