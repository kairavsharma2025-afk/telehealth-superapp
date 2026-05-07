import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { api, ApiError } from "../lib/api";
import { formatTimeRange } from "../lib/format";

interface Doctor {
  id: string;
  fullName: string | null;
}

interface DoctorsResult {
  items: Doctor[];
}

interface CreatedAppointment {
  id: string;
  startAt: string;
  endAt: string;
}

const SLOT_MINUTES = 30;

function listDoctors(): Promise<DoctorsResult> {
  return api<DoctorsResult>("/users/doctors");
}

function bookAppointment(input: {
  doctorId: string;
  startAt: string;
  endAt: string;
  reason?: string | undefined;
}): Promise<CreatedAppointment> {
  const body: Record<string, unknown> = {
    doctorId: input.doctorId,
    startAt: input.startAt,
    endAt: input.endAt,
  };
  if (input.reason) body["reason"] = input.reason;
  return api<CreatedAppointment>("/appointments", { method: "POST", body });
}

function nextRoundedHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function BookScreen() {
  const qc = useQueryClient();

  const doctors = useQuery<DoctorsResult, ApiError>({
    queryKey: ["doctors"],
    queryFn: listDoctors,
  });

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [startAt, setStartAt] = useState<Date>(nextRoundedHour);
  const [reason, setReason] = useState("");
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const endAt = new Date(startAt.getTime() + SLOT_MINUTES * 60_000);

  const onPickerChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      // Android dismisses the picker on every interaction; iOS spinners
      // fire `set` on each scroll. Closing here works for both.
      setPickerMode(null);
      if (event.type === "set" && selected) setStartAt(selected);
    },
    [],
  );

  const book = useMutation<CreatedAppointment, ApiError, void>({
    mutationFn: () => {
      if (!doctorId) throw new ApiError(400, "Pick a doctor first");
      return bookAppointment({
        doctorId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (created) => {
      setSubmitError(null);
      setSuccess(`Booked ${formatTimeRange(created.startAt, created.endAt)}`);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      setSuccess(null);
      setSubmitError(err.message);
    },
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>Book an appointment</Text>

      <Text style={styles.sectionLabel}>Doctor</Text>
      {doctors.isPending ? (
        <ActivityIndicator color="#2563eb" />
      ) : doctors.isError ? (
        <Text style={styles.error}>
          Failed to load doctors: {doctors.error.message}
        </Text>
      ) : (doctors.data?.items.length ?? 0) === 0 ? (
        <Text style={styles.muted}>No doctors available.</Text>
      ) : (
        <FlatList
          data={doctors.data?.items ?? []}
          keyExtractor={(d) => d.id}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const selected = item.id === doctorId;
            return (
              <TouchableOpacity
                onPress={() => setDoctorId(item.id)}
                style={[styles.doctorRow, selected && styles.doctorRowSelected]}
              >
                <Text style={styles.doctorName}>
                  {item.fullName ?? "Unnamed doctor"}
                </Text>
                <Text style={styles.doctorId}>{item.id.slice(0, 8)}…</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Text style={styles.sectionLabel}>When</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setPickerMode("date")}
        >
          <Text style={styles.pickerButtonLabel}>Date</Text>
          <Text style={styles.pickerButtonValue}>
            {startAt.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setPickerMode("time")}
        >
          <Text style={styles.pickerButtonLabel}>Time</Text>
          <Text style={styles.pickerButtonValue}>
            {startAt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.muted}>Slot is {SLOT_MINUTES} minutes.</Text>

      {pickerMode ? (
        <DateTimePicker
          value={startAt}
          mode={pickerMode}
          onChange={onPickerChange}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={new Date()}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Reason (optional)</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        style={styles.reasonInput}
        placeholder="e.g. Follow-up on lab results"
        placeholderTextColor="#475569"
      />

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!doctorId || book.isPending) && styles.submitButtonDisabled,
        ]}
        disabled={!doctorId || book.isPending}
        onPress={() => book.mutate()}
      >
        {book.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Book appointment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 48,
  },
  h1: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionLabel: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 6,
  },
  doctorRow: {
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  doctorRowSelected: {
    borderColor: "#2563eb",
  },
  doctorName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  doctorId: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
  },
  pickerButtonLabel: {
    color: "#94a3b8",
    fontSize: 11,
    textTransform: "uppercase",
  },
  pickerButtonValue: {
    color: "#f8fafc",
    fontSize: 16,
    marginTop: 2,
    fontWeight: "600",
  },
  reasonInput: {
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    minHeight: 70,
    textAlignVertical: "top",
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
  },
  error: {
    color: "#f87171",
    marginTop: 8,
  },
  success: {
    color: "#34d399",
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#475569",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
