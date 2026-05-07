import { useCallback } from "react";
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
import { formatTimeRange } from "../lib/format";

type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
}

interface ListResult {
  items: Appointment[];
}

function listAppointments(): Promise<ListResult> {
  return api<ListResult>("/appointments");
}

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  scheduled: "#f59e0b",
  confirmed: "#3b82f6",
  completed: "#10b981",
  cancelled: "#ef4444",
};

export function AppointmentsScreen() {
  const { user, logout } = useAuth();

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: listAppointments,
  });

  const onRefresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const items = query.data?.items ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>
        <TouchableOpacity onPress={() => void logout()}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
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
          <Text style={styles.muted}>No appointments yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching && !query.isPending}
              onRefresh={onRefresh}
              tintColor="#2563eb"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.when}>
                  {formatTimeRange(item.startAt, item.endAt)}
                </Text>
                <Text style={styles.who}>
                  doctor {item.doctorId.slice(0, 8)}…
                </Text>
                {item.reason ? (
                  <Text style={styles.reason}>{item.reason}</Text>
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
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
  },
  email: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  role: {
    color: "#22d3ee",
    fontSize: 12,
    marginTop: 2,
  },
  signOut: {
    color: "#f87171",
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  error: {
    color: "#f87171",
    textAlign: "center",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    alignItems: "flex-start",
    gap: 12,
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  when: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  who: {
    color: "#94a3b8",
    fontSize: 13,
  },
  reason: {
    color: "#cbd5e1",
    fontSize: 13,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
