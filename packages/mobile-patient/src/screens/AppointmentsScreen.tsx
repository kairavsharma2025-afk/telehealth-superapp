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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useNavigation,
  type NavigationProp,
} from "@react-navigation/native";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  AppointmentCard,
  type AppointmentItem,
  type DoctorRef,
} from "../components/AppointmentCard";
import { EmptyState } from "../components/EmptyState";
import { Logo } from "../components/Logo";
import { ScreenHeader } from "../components/ScreenHeader";
import { fontWeight, nativeShadow, palette, radius, semantic, space } from "../theme";
import type { MainTabParamList } from "../../App";
import { useTabRouter } from "../navigation/router";

interface ListResult {
  items: AppointmentItem[];
}

interface Doctor {
  id: string;
  fullName: string | null;
  specialty: string | null;
}

interface DoctorsResult {
  items: Doctor[];
}

interface MeResult {
  fullName: string | null;
}

type Tab = "upcoming" | "completed";

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

function listDoctors(): Promise<DoctorsResult> {
  return api<DoctorsResult>("/users/doctors");
}

// Fetch profile, tolerating 404 (no profile row yet — happens for users
// who registered but never filled their profile in). Same shape either way.
async function fetchMe(): Promise<MeResult> {
  try {
    return await api<MeResult>("/users/me");
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return { fullName: null };
    }
    throw err;
  }
}

function patchStatus(id: string, status: AppointmentItem["status"]): Promise<AppointmentItem> {
  return api<AppointmentItem>(`/appointments/${id}`, {
    method: "PATCH",
    body: { status },
  });
}

function isUpcoming(a: AppointmentItem): boolean {
  if (a.status === "cancelled" || a.status === "completed") return false;
  return new Date(a.endAt) >= new Date();
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function AppointmentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const webRouter = useTabRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const appointments = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  // Doctor directory used to look up real names. Cached longer because
  // it changes rarely; we re-use the same query key as BookScreen so
  // the second tab to load doesn't pay the round-trip again.
  const doctors = useQuery<DoctorsResult, ApiError>({
    queryKey: ["doctors"],
    queryFn: listDoctors,
    staleTime: 5 * 60_000,
  });

  const me = useQuery<MeResult, ApiError>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  const doctorMap = useMemo(() => {
    const map = new Map<string, DoctorRef>();
    for (const d of doctors.data?.items ?? []) {
      map.set(d.id, { fullName: d.fullName, specialty: d.specialty });
    }
    return map;
  }, [doctors.data]);

  const cancelAppointment = useMutation<AppointmentItem, ApiError, string>({
    mutationFn: (id) => patchStatus(id, "cancelled"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const onRefresh = useCallback(() => {
    void appointments.refetch();
    void doctors.refetch();
  }, [appointments, doctors]);

  const buckets = useMemo(() => {
    const all = appointments.data?.items ?? [];
    return {
      upcoming: all
        .filter(isUpcoming)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
      completed: all
        .filter((a) => a.status === "completed" || a.status === "cancelled")
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    };
  }, [appointments.data]);

  const visible = buckets[tab];
  const greetName =
    (me.data?.fullName ? firstName(me.data.fullName) : null) ??
    (user?.email?.split("@")[0] ?? "there");

  const handleReschedule = useCallback(
    (id: string) => {
      cancelAppointment.mutate(id, {
        onSuccess: () => {
          // Send the patient to the Book tab to pick a new slot.
          navigation.navigate("Book");
        },
      });
    },
    [cancelAppointment, navigation],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`Hi ${greetName} 👋`}
        subtitle="Here's your care schedule."
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

      {appointments.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand700} />
        </View>
      ) : appointments.isError ? (
        <View style={styles.center}>
          <EmptyState
            icon={<IconAlert />}
            title="We couldn't load your appointments"
            description={appointments.error.message}
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
                ? "You don't have any visits scheduled. Book your first to get started."
                : "Past visits will show up here once they're completed."
            }
            action={
              tab === "upcoming" ? (
                <TouchableOpacity
                  style={styles.retryBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Book your first appointment"
                  onPress={() => {
                    // On web, the "navigation" prop is a stub (no
                    // react-navigation); use the WebShell tab router.
                    if (typeof window !== "undefined") {
                      webRouter.navigate("Book");
                    } else {
                      navigation.navigate("Book");
                    }
                  }}
                >
                  <Text style={styles.retryText}>Book your first appointment →</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>
      ) : (
        <FlatList
          data={visible}
          extraData={expandedId}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          refreshControl={
            <RefreshControl
              refreshing={appointments.isFetching && !appointments.isPending}
              onRefresh={onRefresh}
              tintColor={palette.brand700}
            />
          }
          renderItem={({ item }) => (
            <AppointmentCard
              appointment={item}
              doctor={doctorMap.get(item.doctorId) ?? null}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId((cur) => (cur === item.id ? null : item.id))
              }
              onCancel={() => cancelAppointment.mutate(item.id)}
              onReschedule={() => handleReschedule(item.id)}
              busy={cancelAppointment.isPending}
            />
          )}
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
  return <Text style={{ fontSize: 28 }}>📅</Text>;
}
function IconAlert() {
  return <Text style={{ fontSize: 28 }}>⚠️</Text>;
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
    borderRadius: 50,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: space[3],
    borderRadius: 50,
    gap: 8,
  },
  tabActive: {
    backgroundColor: semantic.surface,
    ...nativeShadow.sm,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: fontWeight.medium,
    color: semantic.textMuted,
  },
  tabLabelActive: {
    color: semantic.text,
    fontWeight: fontWeight.semibold,
  },
  countBubble: {
    backgroundColor: semantic.borderStrong,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countBubbleActive: {
    backgroundColor: palette.brand700,
  },
  countText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: semantic.textMuted,
    lineHeight: 14,
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
