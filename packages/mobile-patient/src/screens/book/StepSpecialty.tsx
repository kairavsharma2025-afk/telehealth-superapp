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
import {
  BabyIcon,
  BoneIcon,
  BrainIcon,
  CheckIcon,
  EarIcon,
  HeartIcon,
  SearchIcon,
  SparklesIcon,
  StethoscopeIcon,
  VenusIcon,
} from "../../components/Icons";
import { hoverable, SPECIALTIES, type Specialty } from "./shared";

interface StepSpecialtyProps {
  selected: string | null;
  onSelect: (key: string) => void;
  onContinue: () => void;
}

// Per-specialty visual: pastel background tile + a deeper-shade
// lucide icon. Picked to feel like a friendly clinic (warm but
// distinct), not a chart of specialties.
const SPECIALTY_THEME: Record<
  string,
  {
    Icon: (p: { size?: number; color?: string }) => React.JSX.Element;
    iconColor: string;
    pastelBg: string;
  }
> = {
  "General Medicine": { Icon: StethoscopeIcon, iconColor: "#0D9E89", pastelBg: "#DCFCE7" },
  Cardiology:        { Icon: HeartIcon,        iconColor: "#DC2626", pastelBg: "#FEE2E2" },
  Dermatology:       { Icon: SparklesIcon,     iconColor: "#EA580C", pastelBg: "#FFEDD5" },
  Pediatrics:        { Icon: BabyIcon,         iconColor: "#0891B2", pastelBg: "#DBEAFE" },
  Psychiatry:        { Icon: BrainIcon,        iconColor: "#7C3AED", pastelBg: "#EDE9FE" },
  Orthopedics:       { Icon: BoneIcon,         iconColor: "#16A34A", pastelBg: "#DCFCE7" },
  Gynecology:        { Icon: VenusIcon,        iconColor: "#DB2777", pastelBg: "#FCE7F3" },
  ENT:               { Icon: EarIcon,          iconColor: "#CA8A04", pastelBg: "#FEF3C7" },
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
          style={hoverable((hovered) => {
            const base: ViewStyle[] = [styles.continueBtn];
            if (!selected) base.push(styles.continueBtnDisabled);
            if (hovered && selected) base.push(styles.continueBtnHover);
            // Gradient + soft brand-tinted shadow on web
            const webPolish = selected
              ? {
                  backgroundImage:
                    "linear-gradient(135deg, #0d9e89, #0a7a6a)",
                  boxShadow: "0 4px 14px rgba(13,158,137,0.35)",
                  cursor: "pointer",
                }
              : { cursor: "not-allowed" };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            base.push(webPolish as any);
            return base;
          })}
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
  const theme = SPECIALTY_THEME[spec.key] ?? {
    Icon: StethoscopeIcon,
    iconColor: palette.brand700,
    pastelBg: palette.brand50,
  };
  const Icon = theme.Icon;
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
        // Web-only inline polish: shadow + lift on hover, smooth
        // transitions. RN's ViewStyle types don't include these
        // CSS props, so we apply via a cast.
        const webPolish = {
          boxShadow: hovered
            ? "0 8px 20px rgba(13,158,137,0.15), 0 2px 4px rgba(0,0,0,0.04)"
            : "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          transform: hovered ? "translateY(-3px)" : "translateY(0)",
          transitionProperty: "transform, box-shadow, border-color, background-color",
          transitionDuration: "200ms",
          transitionTimingFunction: "ease",
          cursor: "pointer",
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        out.push(webPolish as any);
        return out;
      })}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: theme.pastelBg }]}>
          <Icon size={26} color={theme.iconColor} />
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
    flexBasis: "calc(50% - 8px)" as unknown as number, // 2 cols on web with our gap
    minWidth: 220,
    flexGrow: 1,
    backgroundColor: semantic.surface,
    borderWidth: 2,
    borderColor: semantic.border,
    borderRadius: radius.xl,
    padding: 18,
    gap: 12,
    // Native shadow — web ignores this in favor of the inline boxShadow
    // we set via the Pressable.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
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
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  continueBtnHover: {
    backgroundColor: palette.brand800,
  },
  continueBtnDisabled: {
    backgroundColor: semantic.border,
  },
  continueText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
});
