import { StyleSheet, Text, View } from "react-native";
import { fontWeight, semantic } from "../theme";

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled";

const COLOR: Record<AppointmentStatus, { bg: string; fg: string }> = {
  scheduled: { bg: "#FEF3C7", fg: semantic.statusScheduled },
  confirmed: { bg: "#DBEAFE", fg: semantic.statusConfirmed },
  completed: { bg: "#DCFCE7", fg: semantic.statusCompleted },
  cancelled: { bg: "#FEE2E2", fg: semantic.statusCancelled },
};

const LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusPill({ status }: { status: AppointmentStatus }) {
  const c = COLOR[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.label, { color: c.fg }]}>{LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
