import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { brand } from "../theme";
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { Logo } from "./Logo";
import { useAuth } from "../lib/auth";
import { useTabRouter, type WebTab } from "../navigation/router";

interface NavItem {
  key: WebTab;
  label: string;
  group: "primary" | "secondary";
  icon: string;
}

const NAV: readonly NavItem[] = [
  { key: "Home", label: "Dashboard", group: "primary", icon: "▥" },
  { key: "Appointments", label: "Appointments", group: "primary", icon: "🗓" },
  { key: "Book", label: "Book a doctor", group: "primary", icon: "➕" },
  { key: "Documents", label: "Documents", group: "secondary", icon: "📄" },
  { key: "Notifications", label: "Notifications", group: "secondary", icon: "🔔" },
  { key: "Profile", label: "Profile", group: "secondary", icon: "👤" },
];

interface WebShellProps {
  children: React.ReactNode;
}

export function WebShell({ children }: WebShellProps) {
  const { user } = useAuth();
  const { tab, navigate } = useTabRouter();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const handle = user?.email?.split("@")[0] ?? "patient";
  const primary = NAV.filter((n) => n.group === "primary");
  const secondary = NAV.filter((n) => n.group === "secondary");

  return (
    <View style={styles.shell}>
      <View style={styles.sidebar}>
        <View style={styles.brandBlock}>
          <Logo size={28} color={palette.brand700} />
          <View>
            <Text style={styles.brandName}>{brand.name}</Text>
            <Text style={styles.brandSub}>Patient Console</Text>
          </View>
        </View>

        <View style={styles.navList}>
          <Text style={styles.navGroupLabel}>Care</Text>
          {primary.map((item) => (
            <NavRow
              key={item.key}
              item={item}
              active={tab === item.key}
              onPress={() => navigate(item.key)}
            />
          ))}

          <Text style={[styles.navGroupLabel, { marginTop: space[4] }]}>
            Records
          </Text>
          {secondary.map((item) => (
            <NavRow
              key={item.key}
              item={item}
              active={tab === item.key}
              onPress={() => navigate(item.key)}
            />
          ))}
        </View>

        <View style={styles.foot}>
          <Text style={styles.footEmail} numberOfLines={1}>
            {user?.email ?? "Signed out"}
          </Text>
          {user ? (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{user.role}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.topTitle}>{labelFor(tab)}</Text>
            <Text style={styles.topMeta}>
              {greeting}, {handle}.
            </Text>
          </View>
          <Text style={styles.topMeta}>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

function NavRow({
  item,
  active,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // react-native-web types Pressable's style state differently from
      // react-native. Read hovered defensively; on native it's
      // always undefined which collapses to the inactive style.
      style={(state) => {
        const hovered =
          "hovered" in state && (state as { hovered?: boolean }).hovered === true;
        const out: ViewStyle[] = [styles.navRow];
        if (hovered && !active) out.push(styles.navRowHover);
        if (active) out.push(styles.navRowActive);
        return out;
      }}
    >
      <Text
        style={[
          styles.navIcon,
          active && { color: palette.brand800 },
        ]}
      >
        {item.icon}
      </Text>
      <Text
        style={[
          styles.navLabel,
          active && { color: palette.brand800, fontWeight: fontWeight.semibold },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function labelFor(tab: WebTab): string {
  switch (tab) {
    case "Home": return "Dashboard";
    case "Appointments": return "Appointments";
    case "Book": return "Book a doctor";
    case "Documents": return "Documents";
    case "Notifications": return "Notifications";
    case "Profile": return "Profile & settings";
  }
}

const SIDEBAR_W = 240;
const TOPBAR_H = 64;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: semantic.bg,
  },
  sidebar: {
    width: SIDEBAR_W,
    height: "100%",
    backgroundColor: semantic.surface,
    borderRightWidth: 1,
    borderRightColor: semantic.border,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    gap: space[5],
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
  },
  brandName: {
    color: semantic.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  brandSub: {
    color: semantic.textMuted,
    fontSize: 11,
  },
  navList: { flex: 1, gap: 2 },
  navGroupLabel: {
    color: semantic.textSubtle,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: space[2],
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  navRowHover: { backgroundColor: semantic.surfaceMuted },
  navRowActive: { backgroundColor: palette.brand50 },
  navIcon: {
    color: semantic.textMuted,
    fontSize: 16,
    width: 18,
    textAlign: "center",
  },
  navLabel: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  foot: {
    backgroundColor: semantic.surfaceMuted,
    borderRadius: radius.md,
    padding: 12,
  },
  footEmail: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: palette.brand50,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rolePillText: {
    color: palette.brand800,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  main: { flex: 1, height: "100%" },
  topbar: {
    height: TOPBAR_H,
    backgroundColor: semantic.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantic.border,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: semantic.text,
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  topMeta: { color: semantic.textMuted, fontSize: 13 },
  content: { flex: 1 },
});
