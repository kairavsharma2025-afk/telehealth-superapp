import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import {
  fontWeight,
  palette,
  radius,
  semantic,
  space,
} from "../../theme";
import { CheckIcon, SearchIcon } from "../../components/Icons";
import { hoverable, SPECIALTIES, type Specialty } from "./shared";

interface StepSpecialtyProps {
  selected: string | null;
  onSelect: (key: string) => void;
  onContinue: () => void;
}

const SPECIALTY_COLORS: Record<string, string> = {
  "General Medicine": "#1a7a6b",
  Cardiology: "#dc2626",
  Dermatology: "#ea580c",
  Pediatrics: "#0891b2",
  Psychiatry: "#7c3aed",
  Orthopedics: "#16a34a",
  Gynecology: "#db2777",
  ENT: "#ca8a04",
};

export function StepSpecialty({
  selected,
  onSelect,
  onContinue,
}: StepSpecialtyProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SPECIALTIES;
    return SPECIALTIES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <SearchIcon size={18} color={semantic.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search specialties (e.g. heart, skin, kids)"
          placeholderTextColor={semantic.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Search specialties"
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing matches “{search}”.</Text>
          <Text style={styles.emptySub}>
            Try a broader term like “skin” or pick from the list above.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((s) => (
            <SpecialtyCard
              key={s.key}
              spec={s}
              selected={selected === s.key}
              onPress={() => onSelect(s.key)}
            />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to choose a doctor and time"
          onPress={onContinue}
          disabled={!selected}
          style={hoverable((hovered) => [
            styles.continueBtn,
            !selected && styles.continueBtnDisabled,
            hovered && selected && styles.continueBtnHover,
          ])}
        >
          <Text style={styles.continueText}>Continue →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SpecialtyCard({
  spec,
  selected,
  onPress,
}: {
  spec: Specialty;
  selected: boolean;
  onPress: () => void;
}) {
  const color = SPECIALTY_COLORS[spec.key] ?? palette.brand700;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spec.name}: ${spec.description}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={hoverable((hovered) => {
        const out: ViewStyle[] = [styles.card];
        if (hovered) out.push(styles.cardHover);
        if (selected) out.push(styles.cardSelected);
        return out;
      })}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: color }]}>
          <Text style={styles.iconLetter}>
            {spec.name === "ENT" ? "ENT" : spec.name.charAt(0)}
          </Text>
        </View>
        {selected ? (
          <View style={styles.checkBadge}>
            <CheckIcon size={14} color="#fff" strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle}>{spec.name}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {spec.description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: semantic.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: semantic.text,
    fontSize: 14,
    paddingVertical: 0,
    // remove default web outline so our focus styles can take over
    outlineStyle: "none" as unknown as undefined,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[3],
  },
  card: {
    flexBasis: "calc(50% - 6px)" as unknown as number, // 2 cols on web with our gap
    minWidth: 220,
    flexGrow: 1,
    backgroundColor: semantic.surface,
    borderWidth: 2,
    borderColor: semantic.border,
    borderRadius: radius.lg,
    padding: 18,
    gap: 8,
  },
  cardHover: {
    borderColor: palette.brand500,
  },
  cardSelected: {
    borderColor: palette.brand700,
    backgroundColor: palette.brand50,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLetter: {
    color: "#fff",
    fontSize: 16,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  cardDesc: {
    color: semantic.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
  emptyTitle: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  emptySub: {
    color: semantic.textMuted,
    fontSize: 13,
  },
  footer: {
    alignItems: "flex-end",
    paddingTop: space[2],
  },
  continueBtn: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  continueBtnHover: {
    backgroundColor: palette.brand800,
  },
  continueBtnDisabled: {
    backgroundColor: semantic.border,
  },
  continueText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
});
