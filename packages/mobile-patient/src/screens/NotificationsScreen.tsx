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
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { ScreenHeader } from "../components/ScreenHeader";

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

const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  pending: { bg: "#FEF3C7", fg: "#D97706" },
  sent: { bg: "#DCFCE7", fg: "#15803D" },
  failed: { bg: "#FEE2E2", fg: "#B91C1C" },
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
      <ScreenHeader
        title="Notifications"
        subtitle={`${items.length} ${items.length === 1 ? "message" : "messages"}`}
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
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isPending}
              onRefresh={() => void query.refetch()}
              tintColor={palette.brand700}
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
                  { backgroundColor: STATUS_COLOR[item.status].bg },
                ]}
              >
                <Text
                  style={[styles.pillText, { color: STATUS_COLOR[item.status].fg }]}
                >
                  {item.status}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space[6],
  },
  error: { color: semantic.danger, textAlign: "center" },
  muted: { color: semantic.textMuted, fontSize: 14 },
  list: { padding: space[4], gap: space[3] },
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
  channelBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.brand50,
    justifyContent: "center",
    alignItems: "center",
  },
  channelIcon: { color: palette.brand700, fontSize: 18 },
  rowMain: { flex: 1 },
  template: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  when: { color: semantic.textMuted, fontSize: 12, marginTop: 2 },
  errorMessage: { color: semantic.danger, fontSize: 12, marginTop: 4 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
