import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { fontWeight, palette, radius, semantic, space } from "../theme";

const isWeb = Platform.OS === "web";

interface Doctor {
  id: string;
  fullName: string | null;
  specialty: string | null;
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
  const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(null);

  // Group doctors by specialty for the filter pills + sectioned list.
  // "Other" bucket catches doctors with no specialty so the UI never
  // silently drops rows.
  const grouped = useMemo(() => {
    const items = doctors.data?.items ?? [];
    const map = new Map<string, Doctor[]>();
    for (const d of items) {
      const key = d.specialty ?? "Other";
      const list = map.get(key) ?? [];
      list.push(d);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [doctors.data]);

  const specialties = useMemo(() => grouped.map(([k]) => k), [grouped]);
  const visible = specialtyFilter
    ? grouped.filter(([k]) => k === specialtyFilter)
    : grouped;

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
          Couldn&apos;t load doctors — {doctors.error.message}
        </Text>
      ) : grouped.length === 0 ? (
        <Text style={styles.muted}>No doctors available.</Text>
      ) : (
        <>
          {/* Specialty filter pills — tap one to narrow, tap again to clear. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[
                styles.filterPill,
                !specialtyFilter && styles.filterPillActive,
              ]}
              onPress={() => setSpecialtyFilter(null)}
            >
              <Text style={styles.filterPillText}>All</Text>
            </TouchableOpacity>
            {specialties.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterPill,
                  specialtyFilter === s && styles.filterPillActive,
                ]}
                onPress={() =>
                  setSpecialtyFilter((prev) => (prev === s ? null : s))
                }
              >
                <Text style={styles.filterPillText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sectioned doctor list, scrolls inside a capped pane so the
              date/time + Book button below stay reachable. */}
          <ScrollView style={styles.doctorList} nestedScrollEnabled>
            {visible.map(([specialty, docs]) => (
              <View key={specialty}>
                <Text style={styles.sectionHeader}>
                  {specialty} · {docs.length}
                </Text>
                {docs.map((item) => {
                  const selected = item.id === doctorId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setDoctorId(item.id)}
                      style={[
                        styles.doctorRow,
                        selected && styles.doctorRowSelected,
                      ]}
                    >
                      <Text style={styles.doctorName}>
                        {item.fullName ?? "Unnamed doctor"}
                      </Text>
                      <Text style={styles.doctorId}>
                        {item.id.slice(0, 8)}…
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.sectionLabel}>When</Text>
      {isWeb ? (
        // datetimepicker has no web rendering. Use a single native HTML
        // datetime-local input via a hidden TextInput hack — simpler to
        // just inject the input directly. We render it as a styled
        // wrapper around an <input>.
        <WebDateTimeInput value={startAt} onChange={setStartAt} />
      ) : (
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
      )}
      <Text style={styles.muted}>Slot is {SLOT_MINUTES} minutes.</Text>

      {!isWeb && pickerMode ? (
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
        placeholderTextColor={semantic.textSubtle}
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
          <ActivityIndicator color={palette.white} />
        ) : (
          <Text style={styles.submitButtonText}>Book appointment</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  content: { padding: space[4], gap: 6, paddingBottom: space[9] },
  h1: {
    color: semantic.text,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  lede: {
    color: semantic.textMuted,
    fontSize: 14,
    marginBottom: space[2],
    lineHeight: 20,
  },
  sectionLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: space[5],
    marginBottom: space[2],
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  filterPillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  filterPillText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  doctorList: {
    maxHeight: 300,
    borderRadius: radius.lg,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
  },
  sectionHeader: {
    color: palette.brand700,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: space[2],
    marginBottom: space[1],
    paddingHorizontal: space[2],
  },
  doctorRow: {
    backgroundColor: semantic.surface,
    padding: space[3],
    borderRadius: radius.md,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  doctorRowSelected: {
    backgroundColor: palette.brand50,
    borderColor: palette.brand700,
  },
  doctorName: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  doctorId: {
    color: semantic.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  pickerRow: {
    flexDirection: "row",
    gap: space[3],
  },
  pickerButton: {
    flex: 1,
    backgroundColor: semantic.surface,
    padding: space[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  pickerButtonLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pickerButtonValue: {
    color: semantic.text,
    fontSize: 16,
    marginTop: 4,
    fontWeight: fontWeight.semibold,
  },
  reasonInput: {
    backgroundColor: semantic.surface,
    color: semantic.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.borderStrong,
    padding: space[3],
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
  },
  muted: {
    color: semantic.textMuted,
    fontSize: 13,
  },
  error: {
    color: semantic.danger,
    marginTop: space[2],
    fontSize: 13,
  },
  success: {
    color: semantic.success,
    marginTop: space[2],
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: palette.brand700,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: space[4],
  },
  submitButtonDisabled: {
    backgroundColor: palette.slate400,
  },
  submitButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
});

// Local datetime input for the web platform. Casts to `any` once at the
// boundary because react-native-web does forward `type` to the underlying
// <input>, but TextInput's TS surface doesn't expose it.
function WebDateTimeInput(props: { value: Date; onChange: (d: Date) => void }) {
  const local = toLocalDatetimeString(props.value);
  return (
    <TextInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ type: "datetime-local" } as any)}
      value={local}
      onChangeText={(text) => {
        const next = new Date(text);
        if (!Number.isNaN(next.getTime())) props.onChange(next);
      }}
      style={styles.reasonInput}
    />
  );
}

function toLocalDatetimeString(d: Date): string {
  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time,
  // not UTC. toISOString would produce UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
