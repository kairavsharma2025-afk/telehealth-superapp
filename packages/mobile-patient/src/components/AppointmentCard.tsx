import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { fontWeight, nativeShadow, palette, radius, semantic, space } from "../theme";
import { formatRelative } from "../lib/countdown";
import { confirmAction } from "../lib/confirm";
import { buildIcs, downloadIcs } from "../lib/ics";
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

export interface DoctorRef {
  fullName: string | null;
  specialty: string | null;
}

interface AppointmentCardProps {
  appointment: AppointmentItem;
  doctor: DoctorRef | null;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onReschedule: () => void;
  busy?: boolean;
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const fullDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function doctorName(doctor: DoctorRef | null, doctorId: string): string {
  if (doctor?.fullName) return `Dr. ${capitalizeWords(doctor.fullName)}`;
  return `Doctor #${doctorId.slice(0, 8)}`;
}

function capitalizeWords(name: string): string {
  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function AppointmentCard({
  appointment,
  doctor,
  expanded,
  onToggle,
  onCancel,
  onReschedule,
  busy,
}: AppointmentCardProps) {
  const start = new Date(appointment.startAt);
  const end = new Date(appointment.endAt);
  const isUpcoming =
    appointment.status !== "cancelled" &&
    appointment.status !== "completed" &&
    end.getTime() > Date.now();
  const isJoinable =
    appointment.status === "confirmed" &&
    start.getTime() - Date.now() < 15 * 60_000 &&
    end.getTime() > Date.now();
  const canCancel =
    appointment.status === "scheduled" || appointment.status === "confirmed";

  const handleCancel = () => {
    confirmAction({
      title: "Cancel appointment?",
      message: `${doctorName(doctor, appointment.doctorId)} on ${fullDateFmt.format(start)} at ${timeFmt.format(start)}.`,
      confirmLabel: "Cancel appointment",
      cancelLabel: "Keep it",
      destructive: true,
      onConfirm: onCancel,
    });
  };

  const handleAddToCalendar = () => {
    const docName = doctorName(doctor, appointment.doctorId);
    const ics = buildIcs({
      uid: appointment.id,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      title: `Appointment with ${docName}`,
      description: appointment.reason
        ? `Reason: ${appointment.reason}`
        : "Telehealth consultation booked via Vela Health.",
      location: `https://meet.jit.si/telehealth-${appointment.id}`,
    });
    downloadIcs(`vela-${appointment.id.slice(0, 8)}.ics`, ics);
  };

  const handleJoin = () => {
    // Public Jitsi room keyed by appointment id — both patient and doctor
    // landing on the same URL join the same call. Phase 7 will swap this
    // for a Twilio room minted server-side with an access token; the URL
    // shape stays the same so callers don't need to change.
    const roomUrl = `https://meet.jit.si/telehealth-${appointment.id}`;
    Linking.openURL(roomUrl).catch(() => {
      Alert.alert("Could not open consultation", "Please try again.");
    });
  };

  return (
    <TouchableOpacity
      style={[styles.card, expanded && styles.cardExpanded]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={styles.timeChip} aria-hidden>
          <Text style={styles.timeChipDay}>{dayFmt.format(start).toUpperCase()}</Text>
          <Text style={styles.timeChipTime}>{timeFmt.format(start)}</Text>
          <Text style={styles.timeChipDate}>{monthDayFmt.format(start)}</Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.headline} numberOfLines={1}>
            {doctorName(doctor, appointment.doctorId)}
          </Text>
          <Text style={styles.specialty} numberOfLines={1}>
            {doctor?.specialty ?? "Telehealth consultation"}
          </Text>
          <View style={styles.metaRow}>
            <StatusPill status={appointment.status} />
            {isUpcoming ? (
              <Text style={styles.countdown}>· {formatRelative(start)}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.chevron}>{expanded ? "▾" : "▸"}</Text>
      </View>

      {expanded ? (
        <View style={styles.expanded}>
          <View style={styles.detailsRow}>
            <Detail label="When" value={`${fullDateFmt.format(start)}`} />
            <Detail label="Time" value={`${timeFmt.format(start)} – ${timeFmt.format(end)}`} />
          </View>
          {appointment.reason ? (
            <Detail label="Reason for visit" value={appointment.reason} />
          ) : null}

          <View style={styles.actionsRow}>
            {isJoinable ? (
              <TouchableOpacity
                style={[styles.action, styles.actionPrimary]}
                onPress={handleJoin}
              >
                <Text style={styles.actionPrimaryText}>Join consultation</Text>
              </TouchableOpacity>
            ) : null}
            {canCancel && !isJoinable ? (
              <TouchableOpacity
                style={[styles.action, styles.actionPrimary]}
                onPress={onReschedule}
                disabled={busy}
              >
                <Text style={styles.actionPrimaryText}>Reschedule</Text>
              </TouchableOpacity>
            ) : null}
            {canCancel ? (
              <TouchableOpacity
                style={[styles.action, styles.actionDanger]}
                accessibilityRole="button"
                accessibilityLabel="Cancel this appointment"
                onPress={handleCancel}
                disabled={busy}
              >
                <Text style={styles.actionDangerText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
            {isUpcoming ? (
              <TouchableOpacity
                style={[styles.action, styles.actionSecondary]}
                accessibilityRole="button"
                accessibilityLabel="Add to calendar"
                onPress={handleAddToCalendar}
              >
                <Text style={styles.actionSecondaryText}>Add to Calendar</Text>
              </TouchableOpacity>
            ) : null}
            {!canCancel && !isJoinable ? (
              <Text style={styles.terminalNote}>
                {appointment.status === "completed"
                  ? "This visit is complete."
                  : "This appointment was cancelled."}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[4],
    borderWidth: 1,
    borderColor: semantic.border,
    ...nativeShadow.sm,
  },
  cardExpanded: {
    borderColor: palette.brand700,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space[4],
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
  specialty: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: palette.brand700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  countdown: {
    fontSize: 12,
    color: semantic.textMuted,
  },
  chevron: {
    color: semantic.textSubtle,
    fontSize: 18,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  expanded: {
    marginTop: space[4],
    paddingTop: space[4],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.border,
    gap: space[3],
  },
  detailsRow: {
    flexDirection: "row",
    gap: space[3],
    flexWrap: "wrap",
  },
  detail: {
    flex: 1,
    minWidth: 140,
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: semantic.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 14,
    color: semantic.text,
  },
  actionsRow: {
    flexDirection: "row",
    gap: space[2],
    flexWrap: "wrap",
    marginTop: space[2],
  },
  action: {
    paddingHorizontal: space[3],
    paddingVertical: 9,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  actionPrimary: {
    backgroundColor: palette.brand700,
  },
  actionPrimaryText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  actionDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  actionDangerText: {
    color: semantic.danger,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  actionSecondary: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  actionSecondaryText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  terminalNote: {
    color: semantic.textMuted,
    fontSize: 13,
    fontStyle: "italic",
  },
});
