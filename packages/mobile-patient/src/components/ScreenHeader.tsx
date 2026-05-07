import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontWeight, semantic, space } from "../theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}

export function ScreenHeader({ title, subtitle, trailing }: ScreenHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[3],
    backgroundColor: semantic.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border,
  },
  title: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: semantic.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: semantic.textMuted,
  },
});
