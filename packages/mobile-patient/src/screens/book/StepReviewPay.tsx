import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, ApiError } from "../../lib/api";
import {
  fontWeight,
  palette,
  radius,
  semantic,
  space,
} from "../../theme";
import { CheckIcon } from "../../components/Icons";
import {
  doctorDisplayName,
  fakeStatsFor,
  hoverable,
  initialsOf,
  longDateFmt,
  timeFmt,
  type AppointmentType,
  type AvailableDoctor,
  type CreatedAppointment,
  type DoctorSlot,
  type Duration,
} from "./shared";

interface StepReviewPayProps {
  doctor: AvailableDoctor;
  slot: DoctorSlot;
  duration: Duration;
  onBack: () => void;
  onAnotherBooking: () => void;
  onViewAppointments: () => void;
}

interface BookInput {
  doctorId: string;
  startAt: string;
  endAt: string;
  reason?: string | undefined;
}

function bookAppointment(input: BookInput): Promise<CreatedAppointment> {
  const body: Record<string, unknown> = {
    doctorId: input.doctorId,
    startAt: input.startAt,
    endAt: input.endAt,
  };
  if (input.reason) body["reason"] = input.reason;
  return api<CreatedAppointment>("/appointments", { method: "POST", body });
}

export function StepReviewPay({
  doctor,
  slot,
  duration,
  onBack,
  onAnotherBooking,
  onViewAppointments,
}: StepReviewPayProps) {
  const [reason, setReason] = useState("");
  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>("video");
  const [confirmed, setConfirmed] = useState(false);

  const stats = fakeStatsFor(doctor.id);
  const docName = doctorDisplayName(doctor);
  const initials = initialsOf(docName);

  const mutation = useMutation<CreatedAppointment, ApiError, void>({
    mutationFn: () => {
      const input: BookInput = {
        doctorId: doctor.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
      };
      if (reason.trim()) input.reason = reason.trim();
      return bookAppointment(input);
    },
    onSuccess: () => {
      setConfirmed(true);
    },
  });

  if (confirmed) {
    return (
      <SuccessView
        doctorName={docName}
        slot={slot}
        appointmentType={appointmentType}
        onAnotherBooking={onAnotherBooking}
        onViewAppointments={onViewAppointments}
      />
    );
  }

  // Use the SELECTED slot's date — fixes the previous bug where the
  // confirmation panel showed today's date instead of the booked one.
  const startDate = new Date(slot.startAt);
  const endDate = new Date(slot.endAt);

  return (
    <View style={styles.wrap}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={[styles.avatar, { backgroundColor: stats.avatarColor }]}>
          <Text style={styles.avatarText}>{initials || "Dr"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docName}>{docName}</Text>
          {doctor.specialty ? (
            <Text style={styles.docSpec}>{doctor.specialty}</Text>
          ) : null}
          <View style={{ height: 8 }} />
          <SummaryRow label="Date" value={longDateFmt.format(startDate)} />
          <SummaryRow
            label="Time"
            value={`${timeFmt.format(startDate)} – ${timeFmt.format(endDate)}`}
          />
          <SummaryRow label="Duration" value={`${duration} minutes`} />
          <SummaryRow
            label="Type"
            value={appointmentType === "video" ? "Video Call" : "In-Person"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appointment type</Text>
        <View style={styles.toggleRow}>
          <ToggleBtn
            label="Video Call"
            active={appointmentType === "video"}
            onPress={() => setAppointmentType("video")}
          />
          <ToggleBtn
            label="In-Person"
            active={appointmentType === "in_person"}
            onPress={() => setAppointmentType("in_person")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reason for visit</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Follow-up on lab results"
          placeholderTextColor={semantic.textMuted}
          multiline
          numberOfLines={3}
          style={styles.textarea}
          accessibilityLabel="Reason for visit (optional)"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Confirm booking"
        disabled={mutation.isPending}
        onPress={() => mutation.mutate()}
        style={hoverable((hovered) => [
          styles.payBtn,
          mutation.isPending && styles.payBtnDisabled,
          hovered && !mutation.isPending && styles.payBtnHover,
        ])}
      >
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payText}>Confirm Booking</Text>
        )}
      </Pressable>

      {mutation.isError ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>
            Couldn't book this slot: {mutation.error.message}
          </Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to doctor selection"
          onPress={onBack}
          style={hoverable((hovered) => [
            styles.backBtn,
            hovered && { backgroundColor: semantic.surfaceMuted },
          ])}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ToggleBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={hoverable((hovered) => [
        styles.toggleBtn,
        active && styles.toggleBtnActive,
        hovered && !active && { backgroundColor: "#e6f4f1" },
      ])}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CardInput({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={semantic.textMuted}
        maxLength={maxLength}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SuccessView({
  doctorName,
  slot,
  appointmentType,
  onAnotherBooking,
  onViewAppointments,
}: {
  doctorName: string;
  slot: DoctorSlot;
  appointmentType: AppointmentType;
  onAnotherBooking: () => void;
  onViewAppointments: () => void;
}) {
  const start = new Date(slot.startAt);
  return (
    <View style={styles.successWrap}>
      <View style={styles.successCheck}>
        <CheckIcon size={48} color="#fff" strokeWidth={4} />
      </View>
      <Text style={styles.successHeading}>Booking Confirmed!</Text>
      <Text style={styles.successDoctor}>{doctorName}</Text>
      <Text style={styles.successWhen}>
        {longDateFmt.format(start)} · {timeFmt.format(start)}
      </Text>
      <Text style={styles.successType}>
        {appointmentType === "video" ? "Video Call" : "In-Person"}
      </Text>

      <View style={styles.successActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View my appointments"
          onPress={onViewAppointments}
          style={hoverable((hovered) => [
            styles.successPrimary,
            hovered && { backgroundColor: palette.brand800 },
          ])}
        >
          <Text style={styles.successPrimaryText}>View My Appointments</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Book another appointment"
          onPress={onAnotherBooking}
          style={hoverable((hovered) => [
            styles.successSecondary,
            hovered && { backgroundColor: semantic.surfaceMuted },
          ])}
        >
          <Text style={styles.successSecondaryText}>Book Another Appointment</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4], paddingBottom: 60 },
  summary: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[4],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },
  docName: {
    color: semantic.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  docSpec: {
    color: semantic.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: {
    color: semantic.textMuted,
    fontSize: 13,
  },
  summaryValue: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  section: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[4],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  sectionTitle: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: palette.brand50,
    borderColor: palette.brand700,
  },
  toggleText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  toggleTextActive: { color: palette.brand800 },
  textarea: {
    minHeight: 78,
    color: semantic.text,
    fontSize: 13,
    backgroundColor: semantic.bg,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    outlineStyle: "none" as unknown as undefined,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: palette.brand50,
    borderRadius: radius.md,
    marginBottom: 14,
  },
  feeLabel: {
    color: palette.brand800,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  feeValue: {
    color: palette.brand800,
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputLabel: {
    color: semantic.textMuted,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    marginBottom: 4,
  },
  input: {
    color: semantic.text,
    fontSize: 14,
    backgroundColor: semantic.bg,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    outlineStyle: "none" as unknown as undefined,
  },
  payBtn: {
    backgroundColor: palette.brand700,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: 6,
  },
  payBtnHover: { backgroundColor: palette.brand800 },
  payBtnDisabled: { backgroundColor: semantic.border },
  payText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  trust: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  trustEmoji: {
    fontSize: 12,
  },
  trustText: {
    color: semantic.textMuted,
    fontSize: 12,
  },
  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  backText: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  // Success
  successWrap: {
    alignItems: "center",
    paddingVertical: space[6],
    gap: 4,
  },
  successCheck: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    boxShadow: "0 8px 24px rgba(22,163,74,0.3)" as unknown as undefined,
  },
  successHeading: {
    color: semantic.text,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    marginBottom: 12,
  },
  successDoctor: {
    color: semantic.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  successWhen: {
    color: semantic.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  successType: {
    color: palette.brand800,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    marginTop: 4,
    backgroundColor: palette.brand50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  successActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 32,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  successPrimary: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  successPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  successSecondary: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  successSecondaryText: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
