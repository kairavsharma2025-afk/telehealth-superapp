import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";

type Channel = "email" | "sms" | "push";
type Status = "pending" | "sent" | "failed";

interface NotificationItem {
  id: string;
  channel: Channel;
  template: string;
  status: Status;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
}

interface ListResult {
  items: NotificationItem[];
}

function listNotifications(): Promise<ListResult> {
  return api<ListResult>("/notifications");
}

const STATUS_COLOR: Record<Status, string> = {
  pending: "#f59e0b",
  sent: "#10b981",
  failed: "#ef4444",
};

const CHANNEL_ICON: Record<Channel, string> = {
  email: "✉",
  sms: "✆",
  push: "◉",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationsScreen() {
  const query = useQuery<ListResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });

  const items = query.data?.items ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2563eb" />
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
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isPending}
              onRefresh={() => void query.refetch()}
              tintColor="#2563eb"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.channelBadge}>
                <Text style={styles.channelIcon}>{CHANNEL_ICON[item.channel]}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.template}>{item.template}</Text>
                <Text style={styles.when}>
                  {formatWhen(item.sentAt ?? item.createdAt)} · {item.channel}
                </Text>
                {item.status === "failed" && item.errorMessage ? (
                  <Text style={styles.errorMessage} numberOfLines={2}>
                    {item.errorMessage}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: STATUS_COLOR[item.status] },
                ]}
              >
                <Text style={styles.pillText}>{item.status}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    padding: 16,
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
  },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#f87171", textAlign: "center" },
  muted: { color: "#64748b", fontSize: 14 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  channelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  channelIcon: { color: "#60a5fa", fontSize: 18 },
  rowMain: { flex: 1 },
  template: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  when: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  errorMessage: { color: "#fca5a5", fontSize: 12, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
});
