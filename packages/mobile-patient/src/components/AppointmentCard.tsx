import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fontWeight, nativeShadow, palette, radius, semantic, space } from "../theme";
import { StatusPill, type AppointmentStatus } from "./StatusPill";

export interface AppointmentItem {
  id: string;
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  reason: string | null;
}

interface AppointmentCardProps {
  appointment: AppointmentItem;
  onPress?: () => void;
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export function AppointmentCard({ appointment, onPress }: AppointmentCardProps) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.timeChip}>
        <Text style={styles.timeChipDay}>{dayFmt.format(start).toUpperCase()}</Text>
        <Text style={styles.timeChipTime}>{timeFmt.format(start)}</Text>
        <Text style={styles.timeChipDate}>{monthDayFmt.format(start)}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.headline} numberOfLines={1}>
          Dr. #{appointment.doctorId.slice(0, 8)}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {appointment.reason ?? "No reason provided"}
        </Text>
        <Text style={styles.subtle}>
          {timeFmt.format(start)} – {timeFmt.format(end)}
        </Text>
        <View style={styles.statusRow}>
          <StatusPill status={appointment.status} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[4],
    ...nativeShadow.sm,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  timeChip: {
    backgroundColor: palette.brand50,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipDay: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: palette.brand800,
    letterSpacing: 0.6,
  },
  timeChipTime: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    color: palette.brand800,
    marginTop: 2,
  },
  timeChipDate: {
    fontSize: 11,
    color: palette.brand700,
    marginTop: 2,
  },
  body: {
    flex: 1,
    gap: 4,
    justifyContent: "center",
  },
  headline: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: semantic.text,
  },
  meta: {
    fontSize: 13,
    color: semantic.textMuted,
  },
  subtle: {
    fontSize: 12,
    color: semantic.textSubtle,
    marginTop: 2,
  },
  statusRow: {
    marginTop: space[2],
  },
});
