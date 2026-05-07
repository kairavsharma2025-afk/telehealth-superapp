import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ScreenHeader } from "../components/ScreenHeader";
import { StatusPill, type AppointmentStatus } from "../components/StatusPill";
import {
  fontWeight,
  nativeShadow,
  palette,
  radius,
  semantic,
  space,
} from "../theme";
import { formatRelative } from "../lib/countdown";
import { useTabRouter } from "../navigation/router";

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
interface MeResult {
  fullName: string | null;
}
interface DoctorRef {
  id: string;
  fullName: string | null;
  specialty: string | null;
}
interface DoctorsResult {
  items: DoctorRef[];
}
interface NotificationsResult {
  items: { id: string; readAt: string | null }[];
}
interface UploadsResult {
  items: { id: string }[];
}

function isUpcoming(a: Appointment): boolean {
  if (a.status === "cancelled" || a.status === "completed") return false;
  return new Date(a.endAt) >= new Date();
}

function isThisMonth(d: Date, now: Date): boolean {
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

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

function firstName(name: string): string {
  const f = name.trim().split(/\s+/)[0] ?? name;
  return f.charAt(0).toUpperCase() + f.slice(1);
}

export function HomeScreen() {
  const { user } = useAuth();
  const router = useTabRouter();

  const appointments = useQuery<ListResult, ApiError>({
    queryKey: ["appointments"],
    queryFn: () => api<ListResult>("/appointments"),
  });
  const doctors = useQuery<DoctorsResult, ApiError>({
    queryKey: ["doctors"],
    queryFn: () => api<DoctorsResult>("/users/doctors"),
    staleTime: 5 * 60_000,
  });
  const me = useQuery<MeResult, ApiError>({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });
  const notifs = useQuery<NotificationsResult, ApiError>({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationsResult>("/notifications"),
  });
  const uploads = useQuery<UploadsResult, ApiError>({
    queryKey: ["uploads"],
    queryFn: () => api<UploadsResult>("/uploads"),
  });

  const items = appointments.data?.items ?? [];
  const upcoming = items.filter(isUpcoming);
  const completed = items.filter((a) => a.status === "completed");
  const now = new Date();

  const kpis = useMemo(
    () => ({
      upcoming: upcoming.length,
      thisMonth: completed.filter((a) => isThisMonth(new Date(a.startAt), now))
        .length,
      documents: uploads.data?.items.length ?? 0,
      unread: notifs.data?.items.filter((n) => !n.readAt).length ?? 0,
    }),
    [upcoming.length, completed, uploads.data, notifs.data, now],
  );

  const nextUp = useMemo(
    () =>
      upcoming
        .slice()
        .sort(
          (a, b) =>
            new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        )[0],
    [upcoming],
  );

  const doctorMap = useMemo(() => {
    const m = new Map<string, DoctorRef>();
    for (const d of doctors.data?.items ?? []) m.set(d.id, d);
    return m;
  }, [doctors.data]);

  const greetName =
    (me.data?.fullName ? firstName(me.data.fullName) : null) ??
    user?.email?.split("@")[0] ??
    "there";

  const nextDoc = nextUp ? doctorMap.get(nextUp.doctorId) : null;
  const nextDocName = nextDoc?.fullName
    ? `Dr. ${capitalize(nextDoc.fullName)}`
    : nextUp
      ? `Doctor #${nextUp.doctorId.slice(0, 8)}`
      : null;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`Hi ${greetName} 👋`}
        subtitle="Here's what's coming up in your care."
      />

      <ScrollView contentContainerStyle={styles.content}>
        {nextUp ? (
          <View style={styles.heroCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Next up</Text>
              <Text style={styles.heroTitle}>{nextDocName}</Text>
              {nextDoc?.specialty ? (
                <Text style={styles.heroSpecialty}>{nextDoc.specialty}</Text>
              ) : null}
              <Text style={styles.heroMeta}>
                {nextUp.reason ? `${nextUp.reason} · ` : ""}
                {formatRelative(new Date(nextUp.startAt))} ·{" "}
                {new Date(nextUp.startAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </Text>
              <View style={{ marginTop: space[3] }}>
                <StatusPill status={nextUp.status} />
              </View>
            </View>
            <TouchableOpacity
              style={styles.heroCta}
              onPress={() => router.navigate("Appointments")}
            >
              <Text style={styles.heroCtaText}>View details</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.heroCard, styles.heroCardEmpty]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabelLight}>You&apos;re all caught up</Text>
              <Text style={styles.heroTitleLight}>No upcoming visits</Text>
              <Text style={styles.heroMetaLight}>
                Book a slot with a specialist when you&apos;re ready.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.heroCtaLight}
              onPress={() => router.navigate("Book")}
            >
              <Text style={styles.heroCtaLightText}>Book a doctor</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.kpiGrid}>
          <Kpi label="Upcoming" value={kpis.upcoming} brand />
          <Kpi label="Visits this month" value={kpis.thisMonth} />
          <Kpi label="Documents" value={kpis.documents} />
          <Kpi label="Unread alerts" value={kpis.unread} accent={kpis.unread > 0} />
        </View>

        <Text style={styles.sectionLabel}>Quick actions</Text>
        <View style={styles.quickRow}>
          <QuickAction
            label="Book a doctor"
            description="Find a slot in your window"
            onPress={() => router.navigate("Book")}
          />
          <QuickAction
            label="View appointments"
            description={`${upcoming.length} upcoming · ${completed.length} done`}
            onPress={() => router.navigate("Appointments")}
          />
          <QuickAction
            label="Share a document"
            description="Upload a lab or prescription"
            onPress={() => router.navigate("Documents")}
          />
        </View>

        {appointments.isPending ? (
          <View style={{ padding: space[6], alignItems: "center" }}>
            <ActivityIndicator color={palette.brand700} />
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: space[6] }]}>
          Recent activity
        </Text>
        {items.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Text style={styles.muted}>
              When you book or complete visits, they&apos;ll show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.activityCard}>
            {items
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.startAt).getTime() -
                  new Date(a.startAt).getTime(),
              )
              .slice(0, 5)
              .map((a, idx) => {
                const d = doctorMap.get(a.doctorId);
                const name = d?.fullName
                  ? `Dr. ${capitalize(d.fullName)}`
                  : `Doctor #${a.doctorId.slice(0, 8)}`;
                return (
                  <View
                    key={a.id}
                    style={[
                      styles.activityRow,
                      idx === 0 && { borderTopWidth: 0 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityName}>{name}</Text>
                      <Text style={styles.activityWhen}>
                        {formatRelative(new Date(a.startAt))} ·{" "}
                        {new Date(a.startAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    <StatusPill status={a.status} />
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function capitalize(name: string): string {
  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function Kpi({
  label,
  value,
  brand,
  accent,
}: {
  label: string;
  value: number | string;
  brand?: boolean;
  accent?: boolean;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text
        style={[
          styles.kpiValue,
          brand && { color: palette.brand700 },
          accent && { color: semantic.warning },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function QuickAction({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickDescription}>{description}</Text>
      <Text style={styles.quickArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  content: { padding: space[4], paddingBottom: space[10], gap: space[2] },

  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[4],
    backgroundColor: palette.brand700,
    borderRadius: radius.lg,
    padding: space[5],
    ...nativeShadow.md,
  },
  heroCardEmpty: { backgroundColor: semantic.surface, borderWidth: 1, borderColor: semantic.border },
  heroLabel: {
    color: palette.brand100,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: palette.white,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    marginTop: 4,
  },
  heroSpecialty: {
    color: palette.brand100,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  heroMeta: { color: palette.brand100, fontSize: 14, marginTop: 6 },
  heroCta: {
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: space[4],
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  heroCtaText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  heroLabelLight: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroTitleLight: {
    color: semantic.text,
    fontSize: 20,
    fontWeight: fontWeight.bold,
    marginTop: 4,
  },
  heroMetaLight: { color: semantic.textMuted, fontSize: 14, marginTop: 4 },
  heroCtaLight: {
    backgroundColor: palette.brand700,
    paddingHorizontal: space[4],
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  heroCtaLightText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },

  kpiGrid: {
    flexDirection: "row",
    gap: space[3],
    marginTop: space[5],
    flexWrap: "wrap",
  },
  kpi: {
    flexGrow: 1,
    flexBasis: 140,
    backgroundColor: semantic.surface,
    borderColor: semantic.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[4],
    ...nativeShadow.sm,
  },
  kpiLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  kpiValue: {
    color: semantic.text,
    fontSize: 30,
    fontWeight: fontWeight.bold,
    marginTop: 6,
    letterSpacing: -0.5,
  },

  sectionLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: space[6],
    marginBottom: space[2],
  },
  quickRow: { flexDirection: "row", gap: space[3], flexWrap: "wrap" },
  quick: {
    flexGrow: 1,
    flexBasis: 200,
    backgroundColor: semantic.surface,
    borderColor: semantic.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[4],
  },
  quickLabel: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  quickDescription: {
    color: semantic.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  quickArrow: {
    color: palette.brand700,
    fontSize: 18,
    marginTop: 8,
    fontWeight: fontWeight.bold,
  },

  activityCard: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    padding: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border,
  },
  activityName: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  activityWhen: { color: semantic.textMuted, fontSize: 12, marginTop: 2 },
  emptyActivity: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: space[6],
    alignItems: "center",
  },
  muted: {
    color: semantic.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});
