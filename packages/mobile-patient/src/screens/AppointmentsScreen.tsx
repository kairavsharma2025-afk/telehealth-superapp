import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  AppointmentCard,
  type AppointmentItem,
} from "../components/AppointmentCard";
import { EmptyState } from "../components/EmptyState";
import { Logo } from "../components/Logo";
import { ScreenHeader } from "../components/ScreenHeader";
import { fontWeight, palette, radius, semantic, space } from "../theme";

interface ListResult {
  items: AppointmentItem[];
}

type Tab = "upcoming" | "completed";

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

function isUpcoming(a: AppointmentItem): boolean {
  if (a.status === "cancelled" || a.status === "completed") return false;
  return new Date(a.endAt) >= new Date();
}

export function AppointmentsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("upcoming");

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const onRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const buckets = useMemo(() => {
    const all = query.data?.items ?? [];
    return {
      upcoming: all
        .filter(isUpcoming)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
      completed: all
        .filter((a) => a.status === "completed" || a.status === "cancelled")
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    };
  }, [query.data]);

  const visible = buckets[tab];
  const greetName = user?.email?.split("@")[0] ?? "there";

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Your appointments"
        subtitle={`Hi ${greetName}, here's your care schedule.`}
        trailing={
          <View style={styles.brandPill}>
            <Logo size={20} color={palette.brand700} />
          </View>
        }
      />

      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          <TabButton
            label="Upcoming"
            count={buckets.upcoming.length}
            active={tab === "upcoming"}
            onPress={() => setTab("upcoming")}
          />
          <TabButton
            label="Past"
            count={buckets.completed.length}
            active={tab === "completed"}
            onPress={() => setTab("completed")}
          />
        </View>
      </View>

      {query.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand700} />
        </View>
      ) : query.isError ? (
        <View style={styles.center}>
          <EmptyState
            icon={<IconAlert />}
            title="We couldn't load your appointments"
            description={query.error.message}
            action={
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            }
          />
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <EmptyState
            icon={<IconCalendar />}
            title={tab === "upcoming" ? "No appointments yet" : "Nothing here yet"}
            description={
              tab === "upcoming"
                ? "Tap the Book tab to schedule your first visit with a doctor."
                : "Past visits will show up here once they're completed."
            }
          />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isPending}
              onRefresh={onRefresh}
              tintColor={palette.brand700}
            />
          }
          renderItem={({ item }) => <AppointmentCard appointment={item} />}
        />
      )}
    </View>
  );
}

function TabButton({
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
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      <View style={[styles.countBubble, active && styles.countBubbleActive]}>
        <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function IconCalendar() {
  return (
    <View>
      <Text style={{ fontSize: 28 }}>📅</Text>
    </View>
  );
}
function IconAlert() {
  return (
    <View>
      <Text style={{ fontSize: 28 }}>⚠️</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  brandPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsWrap: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: semantic.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: semantic.surfaceMuted,
    padding: 4,
    borderRadius: radius.md,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: space[3],
    borderRadius: 6,
    gap: 6,
  },
  tabActive: {
    backgroundColor: semantic.surface,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: fontWeight.medium,
    color: semantic.textMuted,
  },
  tabLabelActive: {
    color: semantic.text,
  },
  countBubble: {
    backgroundColor: semantic.borderStrong,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 9999,
    minWidth: 20,
    alignItems: "center",
  },
  countBubbleActive: {
    backgroundColor: palette.brand700,
  },
  countText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: semantic.textMuted,
  },
  countTextActive: {
    color: palette.white,
  },
  list: {
    padding: space[4],
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryBtn: {
    backgroundColor: palette.brand700,
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    borderRadius: radius.md,
  },
  retryText: {
    color: palette.white,
    fontWeight: fontWeight.semibold,
    fontSize: 14,
  },
});
