import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { api, ApiError } from "../../lib/api";
import {
  fontWeight,
  palette,
  radius,
  semantic,
  space,
} from "../../theme";
import { CheckIcon, CloseIcon, SearchIcon } from "../../components/Icons";
import {
  doctorDisplayName,
  expandSlots,
  fakeStatsFor,
  hoverable,
  initialsOf,
  timeFmt,
  type AvailabilityResult,
  type AvailableDoctor,
  type DoctorSlot,
} from "./shared";

// Default consultation length used when expanding the server's
// suggested slot into multiple time options. The duration picker UI
// was dropped per product spec; if the patient wants longer they
// rebook.
const DEFAULT_DURATION_MIN = 30 as const;

type WindowKey = "today" | "tomorrow" | "week" | "custom";

interface StepDoctorAndTimeProps {
  specialty: string;
  selectedDoctorId: string | null;
  selectedSlot: DoctorSlot | null;
  selectedDoctorName: string;
  onChangeSpecialty: () => void;
  onSelect: (doctor: AvailableDoctor, slot: DoctorSlot) => void;
  onContinue: () => void;
  onBack: () => void;
}

function nextRoundedHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function windowFor(key: WindowKey): { start: Date; end: Date } {
  const start = nextRoundedHour();
  switch (key) {
    case "today": {
      const end = new Date(start);
      end.setHours(23, 0, 0, 0);
      return { start, end };
    }
    case "tomorrow": {
      const ts = new Date();
      ts.setDate(ts.getDate() + 1);
      ts.setHours(9, 0, 0, 0);
      const te = new Date(ts);
      te.setHours(17, 0, 0, 0);
      return { start: ts, end: te };
    }
    case "week":
    case "custom": {
      const end = new Date(start);
      const daysUntilSunday = (7 - end.getDay()) % 7;
      end.setDate(end.getDate() + (daysUntilSunday || 7));
      end.setHours(23, 0, 0, 0);
      return { start, end };
    }
  }
}

export function StepDoctorAndTime({
  specialty,
  selectedDoctorId,
  selectedSlot,
  selectedDoctorName,
  onChangeSpecialty,
  onSelect,
  onContinue,
  onBack,
}: StepDoctorAndTimeProps) {
  const [windowKey, setWindowKey] = useState<WindowKey>("week");
  const [search, setSearch] = useState("");

  const { start, end } = windowFor(windowKey);

  const query = useQuery<AvailabilityResult, ApiError>({
    queryKey: ["availability", specialty, windowKey],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set("specialty", specialty);
      qs.set("start", start.toISOString());
      qs.set("end", end.toISOString());
      qs.set("duration", String(DEFAULT_DURATION_MIN));
      return api<AvailabilityResult>(`/users/doctors/availability?${qs.toString()}`);
    },
  });

  const doctors = useMemo(() => {
    const items = query.data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) =>
      doctorDisplayName(d).toLowerCase().includes(q),
    );
  }, [query.data, search]);

  return (
    <View style={styles.wrap}>
      {/* Breadcrumb chip */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Selected specialty ${specialty}, tap to change`}
        onPress={onChangeSpecialty}
        style={hoverable((hovered) => [
          styles.crumb,
          hovered && styles.crumbHover,
        ])}
      >
        <Text style={styles.crumbText}>{specialty}</Text>
        <CloseIcon size={14} color={palette.brand800} />
      </Pressable>

      <View style={styles.grid}>
        {/* LEFT — filters */}
        <View style={styles.left}>
          <Text style={styles.sectionLabel}>When are you free?</Text>
          <View style={styles.pillRow}>
            {(
              [
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["week", "This week"],
              ] as const
            ).map(([key, label]) => (
              <PillBtn
                key={key}
                label={label}
                active={windowKey === key}
                onPress={() => setWindowKey(key)}
              />
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: space[4] }]}>
            Search by name
          </Text>
          <View style={styles.searchBox}>
            <SearchIcon size={16} color={semantic.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="e.g. Dr. Sharma"
              placeholderTextColor={semantic.textMuted}
              style={styles.searchInput}
              accessibilityLabel="Search doctors by name"
            />
          </View>
        </View>

        {/* RIGHT — doctor list */}
        <View style={styles.right}>
          {query.isPending ? (
            <View style={{ gap: space[3] }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonCard}>
                  <View style={styles.skeletonRow}>
                    <View style={styles.skeletonAvatar} />
                    <View style={{ flex: 1, gap: 8 }}>
                      <View style={[styles.skeletonLine, { width: "60%" }]} />
                      <View style={[styles.skeletonLine, { width: "40%" }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : query.isError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Couldn't load doctors</Text>
              <Text style={styles.emptySub}>{query.error.message}</Text>
            </View>
          ) : doctors.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔎</Text>
              <Text style={styles.emptyTitle}>
                No doctors in {specialty} match these filters
              </Text>
              <Text style={styles.emptySub}>
                Try widening the time window or clearing the name search.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.countLine}>
                {doctors.length} {doctors.length === 1 ? "doctor" : "doctors"} available
              </Text>
              <View style={{ gap: space[3] }}>
                {doctors.map((d) => (
                  <DoctorCard
                    key={d.id}
                    doctor={d}
                    isPickedDoctor={selectedDoctorId === d.id}
                    selectedSlot={
                      selectedDoctorId === d.id ? selectedSlot : null
                    }
                    onPickSlot={(slot) => onSelect(d, slot)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      {/* Sticky continue bar — appears once a doctor + slot are selected */}
      {selectedDoctorId && selectedSlot ? (
        <View style={styles.stickyBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyDoctor}>{selectedDoctorName}</Text>
            <Text style={styles.stickyTime}>
              {timeFmt.format(new Date(selectedSlot.startAt))} ·{" "}
              {new Date(selectedSlot.startAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to choose specialty"
            onPress={onBack}
            style={hoverable((hovered) => [
              styles.backBtn,
              hovered && { backgroundColor: semantic.surfaceMuted },
            ])}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to review and pay"
            onPress={onContinue}
            style={hoverable((hovered) => [
              styles.continueBtn,
              hovered && { backgroundColor: palette.brand800 },
            ])}
          >
            <Text style={styles.continueText}>Continue →</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to choose specialty"
            onPress={onBack}
            style={hoverable((hovered) => [
              styles.backBtn,
              hovered && { backgroundColor: semantic.surfaceMuted },
            ])}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DoctorCard({
  doctor,
  isPickedDoctor,
  selectedSlot,
  onPickSlot,
}: {
  doctor: AvailableDoctor;
  isPickedDoctor: boolean;
  selectedSlot: DoctorSlot | null;
  onPickSlot: (slot: DoctorSlot) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const stats = fakeStatsFor(doctor.id);
  const name = doctorDisplayName(doctor);
  const initials = initialsOf(name);

  const allSlots = expandSlots(doctor, DEFAULT_DURATION_MIN);
  const visibleSlots = showAll ? allSlots : allSlots.slice(0, 4);

  return (
    <View
      style={[
        styles.docCard,
        isPickedDoctor && selectedSlot && styles.docCardActive,
      ]}
    >
      <View style={styles.docHeader}>
        <View style={[styles.avatar, { backgroundColor: stats.avatarColor }]}>
          <Text style={styles.avatarText}>{initials || "Dr"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.docName} numberOfLines={1}>
              {name}
            </Text>
            {isPickedDoctor && selectedSlot ? (
              <View style={styles.checkBadge}>
                <CheckIcon size={12} color="#fff" strokeWidth={3} />
              </View>
            ) : null}
          </View>
          {doctor.specialty ? (
            <View style={styles.specBadge}>
              <Text style={styles.specBadgeText}>{doctor.specialty}</Text>
            </View>
          ) : null}
          <Text style={styles.metaLine}>
            ★ {stats.rating}{" "}
            <Text style={styles.metaMuted}>
              ({stats.reviews} reviews) · {stats.years} yrs experience
            </Text>
          </Text>
          <Text style={styles.tagline}>{stats.tagline}</Text>
        </View>
      </View>

      <View style={styles.slots}>
        {visibleSlots.map((s) => {
          const active =
            isPickedDoctor && selectedSlot?.startAt === s.startAt;
          const d = new Date(s.startAt);
          const label = `${d.toLocaleDateString(undefined, {
            weekday: "short",
          })} ${timeFmt.format(d)}`;
          return (
            <SlotPill
              key={s.startAt}
              label={label}
              active={active}
              onPress={() => onPickSlot(s)}
            />
          );
        })}
        {!showAll && allSlots.length > 4 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show more time slots"
            onPress={() => setShowAll(true)}
            style={hoverable((hovered) => [
              styles.moreBtn,
              hovered && { backgroundColor: semantic.surfaceMuted },
            ])}
          >
            <Text style={styles.moreText}>+ more</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PillBtn({
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
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={hoverable((hovered) => {
        const out: ViewStyle[] = [styles.pill];
        if (active) out.push(styles.pillActive);
        else if (hovered) out.push(styles.pillHover);
        return out;
      })}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SlotPill({
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
      accessibilityLabel={`Select slot ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={hoverable((hovered) => {
        const out: ViewStyle[] = [styles.slotPill];
        if (active) out.push(styles.slotPillActive);
        else if (hovered) out.push(styles.slotPillHover);
        return out;
      })}
    >
      <Text style={[styles.slotPillText, active && styles.slotPillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4], paddingBottom: 80 },
  crumb: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: palette.brand50,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.brand500,
  },
  crumbHover: {
    backgroundColor: "#d0ece8",
  },
  crumbText: {
    color: palette.brand800,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  grid: {
    flexDirection: "row",
    gap: space[4],
    flexWrap: "wrap",
  },
  left: {
    flexBasis: 260,
    flexGrow: 0,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: space[4],
  },
  right: {
    flex: 1,
    minWidth: 320,
    gap: space[3],
  },
  sectionLabel: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: semantic.surfaceMuted,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  pillHover: {
    backgroundColor: "#e6f4f1",
  },
  pillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  pillText: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  pillTextActive: { color: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: semantic.bg,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: semantic.text,
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: "none" as unknown as undefined,
  },
  countLine: {
    color: semantic.textMuted,
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  docCard: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[3],
  },
  docCardActive: {
    borderColor: palette.brand700,
    borderWidth: 2,
  },
  docHeader: {
    flexDirection: "row",
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  docName: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  specBadge: {
    alignSelf: "flex-start",
    backgroundColor: palette.brand50,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  specBadgeText: {
    color: palette.brand800,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  metaLine: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  metaMuted: {
    color: semantic.textMuted,
    fontWeight: fontWeight.regular,
  },
  tagline: {
    color: semantic.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  slots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  slotPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.brand500,
    backgroundColor: palette.brand50,
  },
  slotPillHover: {
    backgroundColor: "#d0ece8",
  },
  slotPillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  slotPillText: {
    color: palette.brand800,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  slotPillTextActive: { color: "#fff" },
  moreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: semantic.border,
    backgroundColor: semantic.surface,
  },
  moreText: {
    color: semantic.textMuted,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  skeletonCard: {
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: space[4],
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: semantic.surfaceMuted,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: semantic.surfaceMuted,
  },
  empty: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[6],
    borderWidth: 1,
    borderColor: semantic.border,
    gap: 6,
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  emptyTitle: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  emptySub: {
    color: semantic.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  stickyBar: {
    position: "sticky" as unknown as undefined,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)" as unknown as undefined,
  },
  stickyDoctor: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  stickyTime: {
    color: semantic.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingTop: space[2],
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
  continueBtn: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  continueText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
