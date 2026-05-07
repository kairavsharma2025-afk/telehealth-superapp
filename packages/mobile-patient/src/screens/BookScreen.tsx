import { createElement, useCallback, useState } from "react";
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
import { fontWeight, palette, radius, semantic, space } from "../theme";

const isWeb = Platform.OS === "web";

const SPECIALTIES = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Psychiatry",
  "Orthopedics",
  "Gynecology",
  "ENT",
] as const;

const DURATIONS = [30, 45, 60] as const;
type Duration = (typeof DURATIONS)[number];

interface AvailableDoctor {
  id: string;
  fullName: string | null;
  specialty: string | null;
  suggestedStartAt: string;
  suggestedEndAt: string;
}

interface AvailabilityResult {
  window: { start: string; end: string; duration: number };
  items: AvailableDoctor[];
}

interface CreatedAppointment {
  id: string;
  startAt: string;
  endAt: string;
}

function fetchAvailability(params: {
  windowStart: Date;
  windowEnd: Date;
  specialty: string | null;
  duration: Duration;
}): Promise<AvailabilityResult> {
  const qs = new URLSearchParams();
  qs.set("start", params.windowStart.toISOString());
  qs.set("end", params.windowEnd.toISOString());
  qs.set("duration", String(params.duration));
  if (params.specialty) qs.set("specialty", params.specialty);
  return api<AvailabilityResult>(`/users/doctors/availability?${qs.toString()}`);
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

function defaultWindowEnd(start: Date): Date {
  const d = new Date(start);
  d.setHours(d.getHours() + 8);
  return d;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function BookScreen() {
  const qc = useQueryClient();

  const [windowStart, setWindowStart] = useState<Date>(() => nextRoundedHour());
  const [windowEnd, setWindowEnd] = useState<Date>(() =>
    defaultWindowEnd(nextRoundedHour()),
  );
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [duration, setDuration] = useState<Duration>(30);
  const [pickingForNative, setPickingForNative] = useState<
    "start" | "end" | null
  >(null);

  const [doctor, setDoctor] = useState<AvailableDoctor | null>(null);
  const [reason, setReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search key — incremented when the user hits "Find availability".
  // Driving the query off this rather than the form fields keeps results
  // stable while they tweak the window, and avoids spamming the backend
  // on every keystroke in the web datetime input.
  const [searchKey, setSearchKey] = useState(0);

  const availability = useQuery<AvailabilityResult, ApiError>({
    queryKey: [
      "availability",
      searchKey,
      windowStart.toISOString(),
      windowEnd.toISOString(),
      specialty,
      duration,
    ],
    queryFn: () => fetchAvailability({ windowStart, windowEnd, specialty, duration }),
    enabled: searchKey > 0,
  });

  const onPickerChange = useCallback(
    (which: "start" | "end") =>
      (event: DateTimePickerEvent, selected?: Date) => {
        setPickingForNative(null);
        if (event.type === "set" && selected) {
          if (which === "start") {
            setWindowStart(selected);
            if (selected.getTime() >= windowEnd.getTime()) {
              setWindowEnd(defaultWindowEnd(selected));
            }
          } else {
            setWindowEnd(selected);
          }
        }
      },
    [windowEnd],
  );

  const book = useMutation<CreatedAppointment, ApiError, void>({
    mutationFn: () => {
      if (!doctor) throw new ApiError(400, "Pick a doctor first");
      return bookAppointment({
        doctorId: doctor.id,
        startAt: doctor.suggestedStartAt,
        endAt: doctor.suggestedEndAt,
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (created) => {
      setSubmitError(null);
      setSuccess(
        `Booked ${dateFmt.format(new Date(created.startAt))} – ${timeFmt.format(new Date(created.endAt))}.`,
      );
      setReason("");
      setDoctor(null);
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      void qc.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err) => {
      setSuccess(null);
      setSubmitError(err.message);
    },
  });

  const items = availability.data?.items ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.h1}>Find a slot that fits you</Text>
      <Text style={styles.lede}>
        Pick when you&apos;re free and what kind of doctor you need — we&apos;ll
        show who&apos;s available.
      </Text>

      <Text style={styles.sectionLabel}>Your availability window</Text>
      <View style={styles.row}>
        <DateTimeField
          label="Earliest"
          value={windowStart}
          onPress={() => setPickingForNative("start")}
          onWebChange={(d) => {
            setWindowStart(d);
            if (d.getTime() >= windowEnd.getTime()) {
              setWindowEnd(defaultWindowEnd(d));
            }
          }}
        />
        <DateTimeField
          label="Latest"
          value={windowEnd}
          onPress={() => setPickingForNative("end")}
          onWebChange={(d) => setWindowEnd(d)}
        />
      </View>
      {!isWeb && pickingForNative ? (
        <DateTimePicker
          value={pickingForNative === "start" ? windowStart : windowEnd}
          mode="datetime"
          onChange={onPickerChange(pickingForNative)}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={pickingForNative === "end" ? windowStart : new Date()}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Duration</Text>
      <View style={styles.segmented}>
        {DURATIONS.map((d) => {
          const active = d === duration;
          return (
            <TouchableOpacity
              key={d}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setDuration(d)}
            >
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
              >
                {d} min
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Specialty</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.specRow}
      >
        <SpecialtyPill
          label="Any"
          active={specialty === null}
          onPress={() => setSpecialty(null)}
        />
        {SPECIALTIES.map((s) => (
          <SpecialtyPill
            key={s}
            label={s}
            active={specialty === s}
            onPress={() => setSpecialty((cur) => (cur === s ? null : s))}
          />
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.searchBtn, availability.isFetching && styles.searchBtnBusy]}
        onPress={() => {
          setDoctor(null);
          setSuccess(null);
          setSubmitError(null);
          setSearchKey((k) => k + 1);
        }}
        disabled={availability.isFetching}
      >
        {availability.isFetching ? (
          <ActivityIndicator color={palette.white} />
        ) : (
          <Text style={styles.searchBtnText}>
            {searchKey === 0 ? "Find available doctors" : "Refresh results"}
          </Text>
        )}
      </TouchableOpacity>

      {availability.isError ? (
        <Text style={styles.errorMsg}>{availability.error.message}</Text>
      ) : null}

      {searchKey > 0 && !availability.isFetching && !availability.isError ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {items.length} {items.length === 1 ? "doctor" : "doctors"} available
          </Text>
          <Text style={styles.resultsHint}>
            Sorted by earliest slot in your window
          </Text>
        </View>
      ) : null}

      {searchKey > 0 && !availability.isFetching && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing fits in that window</Text>
          <Text style={styles.emptyDesc}>
            Try a wider window, a different specialty, or a shorter duration.
          </Text>
        </View>
      ) : null}

      {items.slice(0, 30).map((d) => {
        const selected = d.id === doctor?.id;
        const start = new Date(d.suggestedStartAt);
        const end = new Date(d.suggestedEndAt);
        return (
          <TouchableOpacity
            key={d.id}
            style={[styles.docCard, selected && styles.docCardSelected]}
            onPress={() => setDoctor(d)}
            activeOpacity={0.85}
          >
            <View style={styles.docMain}>
              <Text style={styles.docName}>
                {d.fullName ?? "Unnamed doctor"}
              </Text>
              <Text style={styles.docSpec}>{d.specialty ?? "—"}</Text>
            </View>
            <View style={styles.docSlot}>
              <Text style={styles.docSlotLabel}>Earliest slot</Text>
              <Text style={styles.docSlotTime}>{dateFmt.format(start)}</Text>
              <Text style={styles.docSlotRange}>
                {timeFmt.format(start)} – {timeFmt.format(end)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {doctor ? (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmHeading}>
            Confirm with {doctor.fullName ?? "this doctor"}
          </Text>
          <Text style={styles.confirmSubhead}>
            {dateFmt.format(new Date(doctor.suggestedStartAt))} –{" "}
            {timeFmt.format(new Date(doctor.suggestedEndAt))} · {duration} min
          </Text>

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

          {submitError ? <Text style={styles.errorMsg}>{submitError}</Text> : null}

          <TouchableOpacity
            style={[styles.bookBtn, book.isPending && styles.bookBtnBusy]}
            disabled={book.isPending}
            onPress={() => book.mutate()}
          >
            {book.isPending ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.bookBtnText}>Book this slot</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {success ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DateTimeField(props: {
  label: string;
  value: Date;
  onPress: () => void;
  onWebChange: (d: Date) => void;
}) {
  if (isWeb) {
    // react-native-web's <TextInput> filters unknown HTML attrs (type,
    // step, min, max), so even with a spread cast it renders as
    // <input type="text"> — no calendar picker. Drop straight to the
    // DOM via createElement, which on web goes through ReactDOM and
    // renders a real <input type="datetime-local">. Behind isWeb so
    // it's never reached at runtime on native.
    const inputStyle: React.CSSProperties = {
      width: "100%",
      marginTop: 4,
      padding: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: semantic.text,
      fontSize: 15,
      fontWeight: 600,
      fontFamily: "inherit",
    };
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{props.label}</Text>
        {createElement("input", {
          type: "datetime-local",
          value: toLocalDatetimeString(props.value),
          onChange: (e: { target: { value: string } }) => {
            const next = new Date(e.target.value);
            if (!Number.isNaN(next.getTime())) props.onWebChange(next);
          },
          style: inputStyle,
        })}
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.field} onPress={props.onPress}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <Text style={styles.fieldValue}>{dateFmt.format(props.value)}</Text>
    </TouchableOpacity>
  );
}

function SpecialtyPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.specPill, active && styles.specPillActive]}
    >
      <Text style={[styles.specPillText, active && styles.specPillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  content: { padding: space[4], paddingBottom: space[10], gap: space[2] },

  h1: {
    color: semantic.text,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
  },
  lede: {
    color: semantic.textMuted,
    fontSize: 14,
    marginBottom: space[3],
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

  row: { flexDirection: "row", gap: space[3] },
  field: {
    flex: 1,
    backgroundColor: semantic.surface,
    borderColor: semantic.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space[3],
  },
  fieldLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValue: {
    color: semantic.text,
    fontSize: 15,
    marginTop: 4,
    fontWeight: fontWeight.semibold,
  },
  fieldInput: {
    color: semantic.text,
    fontSize: 15,
    marginTop: 4,
    fontWeight: fontWeight.semibold,
    paddingVertical: 0,
  },

  segmented: {
    flexDirection: "row",
    backgroundColor: semantic.surfaceMuted,
    padding: 4,
    borderRadius: radius.md,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  segmentText: {
    color: semantic.textMuted,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  segmentTextActive: {
    color: semantic.text,
    fontWeight: fontWeight.semibold,
  },

  specRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  specPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  specPillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  specPillText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  specPillTextActive: {
    color: palette.white,
    fontWeight: fontWeight.semibold,
  },

  searchBtn: {
    backgroundColor: palette.brand700,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: space[5],
  },
  searchBtnBusy: { backgroundColor: palette.slate400 },
  searchBtnText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },

  resultsHeader: {
    marginTop: space[5],
    marginBottom: space[2],
  },
  resultsCount: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  resultsHint: {
    color: semantic.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  empty: {
    marginTop: space[5],
    padding: space[6],
    alignItems: "center",
    backgroundColor: semantic.surfaceMuted,
    borderRadius: radius.lg,
    gap: 4,
  },
  emptyTitle: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  emptyDesc: {
    color: semantic.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },

  docCard: {
    flexDirection: "row",
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    padding: space[4],
    gap: space[3],
    marginTop: space[2],
    alignItems: "center",
  },
  docCardSelected: {
    backgroundColor: palette.brand50,
    borderColor: palette.brand700,
  },
  docMain: { flex: 1, gap: 2 },
  docName: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  docSpec: {
    color: palette.brand700,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docSlot: {
    alignItems: "flex-end",
  },
  docSlotLabel: {
    color: semantic.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  docSlotTime: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    marginTop: 2,
  },
  docSlotRange: {
    color: semantic.textMuted,
    fontSize: 11,
    marginTop: 1,
  },

  confirmBox: {
    marginTop: space[6],
    padding: space[4],
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.brand700,
  },
  confirmHeading: {
    color: semantic.text,
    fontSize: 17,
    fontWeight: fontWeight.bold,
  },
  confirmSubhead: {
    color: semantic.textMuted,
    fontSize: 13,
    marginTop: 2,
  },

  reasonInput: {
    backgroundColor: semantic.bg,
    color: semantic.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: semantic.borderStrong,
    padding: space[3],
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
  },
  errorMsg: {
    color: semantic.danger,
    fontSize: 13,
    marginTop: space[2],
  },
  bookBtn: {
    backgroundColor: palette.brand700,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: space[3],
  },
  bookBtnBusy: { backgroundColor: palette.slate400 },
  bookBtnText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  successBox: {
    marginTop: space[5],
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space[3],
  },
  successText: {
    color: "#15803D",
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
});
