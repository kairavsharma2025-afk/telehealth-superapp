import { StyleSheet, Text, View } from "react-native";
import { fontWeight, palette, semantic, space } from "../../theme";
import { CheckIcon } from "../../components/Icons";
import type { Step } from "./shared";

interface StepBarProps {
  current: Step;
}

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Choose Specialty" },
  { n: 2, label: "Find a Doctor & Time" },
  { n: 3, label: "Review & Pay" },
];

export function StepBar({ current }: StepBarProps) {
  return (
    <View
      style={styles.row}
      accessibilityLabel={`Step ${current} of 3: ${STEPS[current - 1]?.label}`}
    >
      {STEPS.map((s, i) => {
        const completed = current > s.n;
        const active = current === s.n;
        return (
          <View key={s.n} style={styles.cell}>
            <View style={styles.cellInner}>
              <View
                style={[
                  styles.circle,
                  active && styles.circleActive,
                  completed && styles.circleDone,
                ]}
              >
                {completed ? (
                  <CheckIcon size={14} color="#fff" strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.circleNum,
                      active && styles.circleNumActive,
                    ]}
                  >
                    {s.n}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  (active || completed) && styles.labelOn,
                ]}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? (
              <View style={[styles.connector, completed && styles.connectorDone]} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    backgroundColor: semantic.surface,
    borderRadius: 12,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderColor: semantic.border,
    marginBottom: space[4],
  },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cellInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: semantic.surfaceMuted,
    borderWidth: 1,
    borderColor: semantic.border,
    alignItems: "center",
    justifyContent: "center",
  },
  circleActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  circleDone: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  circleNum: {
    color: semantic.textMuted,
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
  circleNumActive: {
    color: "#fff",
  },
  label: {
    color: semantic.textMuted,
    fontSize: 13,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  labelOn: {
    color: semantic.text,
    fontWeight: fontWeight.semibold,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: semantic.border,
    marginHorizontal: 12,
  },
  connectorDone: {
    backgroundColor: palette.brand700,
  },
});
