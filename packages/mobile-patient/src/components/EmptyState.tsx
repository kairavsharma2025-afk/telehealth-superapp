import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fontWeight, palette, semantic, space } from "../theme";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    padding: space[8],
    gap: space[2],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[2],
  },
  title: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    color: semantic.text,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: semantic.textMuted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  actionWrap: {
    marginTop: space[3],
  },
});

// helper bg constant left here so EmptyState is the single ref
export const EMPTY_ICON_BG = palette.brand50;
export const EMPTY_ICON_FG = palette.brand700;
