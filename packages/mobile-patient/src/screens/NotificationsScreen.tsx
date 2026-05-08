import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatRelative } from "../lib/countdown";
import { BellIcon } from "../components/Icons";

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

interface LookupItem {
  id: string;
  fullName: string | null;
  role: "patient" | "doctor" | "admin";
}
interface LookupResult {
  items: LookupItem[];
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

function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function doctorName(id: string, info: LookupItem | undefined): string {
  const name = info?.fullName?.trim();
  if (name) return `Dr. ${titleCase(name)}`;
  return `Doctor #${id.slice(0, 8)}`;
}

// Friendly title for each template — reuses the existing copy.
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

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type FilterKey = "all" | "unread";

export function NotificationsScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });

  const items = query.data?.items ?? [];

  // Resolve doctor names referenced by notification payloads in one
  // batched lookup. Cached by react-query so navigating back doesn't
  // refetch immediately.
  const doctorIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of items) {
      const id = n.payload["doctorId"];
      if (typeof id === "string" && id.length > 0) set.add(id);
    }
    return Array.from(set).sort();
  }, [items]);

  const lookupQuery = useQuery<LookupResult, ApiError>({
    queryKey: ["notifications-lookup", doctorIds.join(",")],
    queryFn: () =>
      api<LookupResult>(
        `/users/lookup?ids=${encodeURIComponent(doctorIds.join(","))}`,
      ),
    enabled: doctorIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const lookupMap = useMemo(() => {
    const m = new Map<string, LookupItem>();
    for (const it of lookupQuery.data?.items ?? []) m.set(it.id, it);
    return m;
  }, [lookupQuery.data]);

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

  const unreadCount = useMemo(
    () => items.filter((n) => !n.readAt).length,
    [items],
  );

  const filtered = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.readAt) : items),
    [items, filter],
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
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              onPress={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* All / Unread filter toggle */}
      <View style={styles.filterRow}>
        <FilterPill
          label="All"
          count={items.length}
          active={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <FilterPill
          label="Unread"
          count={unreadCount}
          active={filter === "unread"}
          onPress={() => setFilter("unread")}
        />
      </View>

      {query.isPending ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.row, styles.skeleton]}>
              <View style={styles.skelDot} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skelLine, { width: "50%" }]} />
                <View style={[styles.skelLine, { width: "75%" }]} />
              </View>
            </View>
          ))}
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load: {query.error.message}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyCircle}>
            <BellIcon size={32} color={palette.brand700} />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </Text>
          <Text style={styles.emptySub}>
            {filter === "unread"
              ? "You're all caught up — switch to All to see history."
              : "Booking confirmations and reminders will appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
            const docId =
              typeof item.payload["doctorId"] === "string"
                ? (item.payload["doctorId"] as string)
                : null;
            const docInfo = docId ? lookupMap.get(docId) : undefined;
            const startAt =
              typeof item.payload["startAt"] === "string"
                ? (item.payload["startAt"] as string)
                : null;
            return (
              <TouchableOpacity
                style={[styles.row, unread && styles.rowUnread]}
                accessibilityRole="button"
                accessibilityLabel={`${templateTitle(item.template, item.payload)}${unread ? " — unread" : ""}`}
                onPress={() => {
                  if (unread) markReadMut.mutate(item.id);
                }}
                activeOpacity={0.85}
              >
                {unread ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
                <View style={styles.iconBubble}>
                  <BellIcon size={18} color={palette.brand700} />
                </View>
                <View style={styles.rowMain}>
                  <Text
                    style={[styles.template, unread && styles.templateUnread]}
                    numberOfLines={1}
                  >
                    {templateTitle(item.template, item.payload)}
                  </Text>
                  {docId ? (
                    <Text style={styles.detail} numberOfLines={1}>
                      {doctorName(docId, docInfo)}
                      {docInfo?.role === "doctor" && item.payload["specialty"]
                        ? ` · ${item.payload["specialty"] as string}`
                        : ""}
                    </Text>
                  ) : null}
                  {startAt ? (
                    <Text style={styles.when}>
                      {dateFmt.format(new Date(startAt))}
                    </Text>
                  ) : (
                    <Text style={styles.when}>
                      {formatRelative(new Date(item.sentAt ?? item.createdAt))}
                    </Text>
                  )}
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

      {query.isFetching && query.data ? (
        <ActivityIndicator
          color={palette.brand700}
          style={{ position: "absolute", bottom: 16, alignSelf: "center" }}
        />
      ) : null}
    </View>
  );
}

function FilterPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} (${count})`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={(state) => {
        const hovered =
          "hovered" in state && (state as { hovered?: boolean }).hovered === true;
        const out: ViewStyle[] = [styles.filterPill];
        if (active) out.push(styles.filterPillActive);
        else if (hovered) out.push(styles.filterPillHover);
        return out;
      }}
    >
      <Text
        style={[styles.filterPillText, active && styles.filterPillTextActive]}
      >
        {label}
        <Text style={[styles.filterPillCount, active && styles.filterPillCountActive]}>
          {"  "}
          {count}
        </Text>
      </Text>
    </Pressable>
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
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: space[4],
    paddingTop: 4,
    paddingBottom: space[2],
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  filterPillHover: { backgroundColor: "#e6f4f1" },
  filterPillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  filterPillText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  filterPillTextActive: { color: "#fff" },
  filterPillCount: {
    color: semantic.textMuted,
    fontWeight: fontWeight.regular,
  },
  filterPillCountActive: { color: "rgba(255,255,255,0.85)" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space[6],
    gap: 6,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: semantic.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  emptySub: {
    color: semantic.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
  },
  error: { color: semantic.danger, textAlign: "center" },
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
  unreadDotSpacer: {
    width: 8,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.white,
    justifyContent: "center",
    alignItems: "center",
  },
  rowMain: { flex: 1, gap: 2 },
  template: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  templateUnread: { fontWeight: fontWeight.bold },
  detail: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  when: { color: semantic.textMuted, fontSize: 12 },
  errorMessage: { color: semantic.danger, fontSize: 12, marginTop: 4 },
  skeleton: { gap: 12 },
  skelDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: semantic.surfaceMuted,
  },
  skelLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: semantic.surfaceMuted,
  },
});
