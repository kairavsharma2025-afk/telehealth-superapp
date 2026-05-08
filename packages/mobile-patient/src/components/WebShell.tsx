import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { brand } from "../theme";
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { Logo } from "./Logo";
import {
  BellIcon,
  CalendarDaysIcon,
  FileTextIcon,
  PlusCircleIcon,
  UserIcon,
} from "./Icons";
import { useAuth } from "../lib/auth";
import { useTabRouter, type WebTab } from "../navigation/router";

// Hover/active palette per spec — light teal #e6f4f1 hover, slightly
// darker #d0ece8 active. Locally defined so we don't pollute the design
// tokens with keyboard-state-only colors.
const HOVER_BG = "#e6f4f1";
const ACTIVE_BG = "#d0ece8";

interface NavItem {
  key: WebTab;
  label: string;
  Icon: (p: { size?: number; color?: string }) => React.JSX.Element;
}

const NAV: readonly NavItem[] = [
  { key: "Appointments", label: "Appointments", Icon: CalendarDaysIcon },
  { key: "Book", label: "Book a Doctor", Icon: PlusCircleIcon },
  { key: "Documents", label: "Documents", Icon: FileTextIcon },
  { key: "Notifications", label: "Notifications", Icon: BellIcon },
  { key: "Profile", label: "Profile", Icon: UserIcon },
];

interface WebShellProps {
  children: React.ReactNode;
  unreadNotifications?: number;
}

// Mobile-vs-desktop breakpoint per spec: below 768px we ditch the
// sidebar and show a bottom tab bar instead.
const MOBILE_BREAKPOINT = 768;

export function WebShell({ children, unreadNotifications = 0 }: WebShellProps) {
  const { user } = useAuth();
  const { tab, navigate } = useTabRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const handle = user?.email?.split("@")[0] ?? "patient";

  // Keep <title> aligned with the active tab so the browser tab + history
  // entries are meaningful, and never read "undefined".
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${labelFor(tab)} · Vela Health`;
    }
  }, [tab]);

  if (isMobile) {
    return (
      <View style={styles.mobileShell}>
        <View style={styles.mobileTopbar}>
          <Logo size={24} color={palette.brand700} />
          <Text style={styles.mobileTitle}>{labelFor(tab)}</Text>
        </View>
        <View style={styles.mobileContent} nativeID="vela-main">
          {children}
        </View>
        <View style={styles.bottomBar}>
          {NAV.map((item) => (
            <BottomTab
              key={item.key}
              item={item}
              active={tab === item.key}
              badgeCount={item.key === "Notifications" ? unreadNotifications : 0}
              onPress={() => navigate(item.key)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      {/* Skip link — first focusable element on the page; visible only
          when keyboard-focused (CSS in skipLinkVisible state via web focus). */}
      <a
        href="#vela-main"
        style={{
          position: "absolute",
          left: -9999,
          top: 8,
          padding: "8px 12px",
          background: palette.brand700,
          color: "#fff",
          borderRadius: 6,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
          zIndex: 1000,
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLElement).style.left = "8px";
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLElement).style.left = "-9999px";
        }}
      >
        Skip to main content
      </a>

      <View style={styles.sidebar}>
        <View style={styles.brandBlock}>
          <Logo size={28} color={palette.brand700} />
          <View>
            <Text style={styles.brandName}>{brand.name}</Text>
            <Text style={styles.brandSub}>Patient Console</Text>
          </View>
        </View>

        {/* Flat nav list — no group labels, per spec. */}
        <View style={styles.navList}>
          {NAV.map((item) => (
            <NavRow
              key={item.key}
              item={item}
              active={tab === item.key}
              badgeCount={item.key === "Notifications" ? unreadNotifications : 0}
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
        {/* nativeID lets the skip-link target #vela-main work on web. */}
        <View style={styles.content} nativeID="vela-main">
          {children}
        </View>
      </View>
    </View>
  );
}

function NavRow({
  item,
  active,
  badgeCount,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  onPress: () => void;
}) {
  const Icon = item.Icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      style={(state) => {
        const hovered =
          "hovered" in state && (state as { hovered?: boolean }).hovered === true;
        const focused =
          "focused" in state && (state as { focused?: boolean }).focused === true;
        const out: ViewStyle[] = [styles.navRow];
        if (hovered && !active) out.push({ backgroundColor: HOVER_BG });
        if (active) out.push({ backgroundColor: ACTIVE_BG });
        if (focused) out.push(styles.navRowFocused);
        return out;
      }}
    >
      <Icon
        size={18}
        color={active ? palette.brand800 : semantic.textMuted}
      />
      <Text
        style={[
          styles.navLabel,
          active && { color: palette.brand800, fontWeight: fontWeight.semibold },
        ]}
      >
        {item.label}
      </Text>
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function BottomTab({
  item,
  active,
  badgeCount,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  badgeCount: number;
  onPress: () => void;
}) {
  const Icon = item.Icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      style={styles.bottomTab}
    >
      <View>
        <Icon
          size={22}
          color={active ? palette.brand700 : semantic.textMuted}
        />
        {badgeCount > 0 ? (
          <View style={styles.bottomBadge}>
            <Text style={styles.bottomBadgeText}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[
          styles.bottomLabel,
          active && { color: palette.brand700, fontWeight: fontWeight.semibold },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function labelFor(tab: WebTab): string {
  switch (tab) {
    case "Appointments": return "Appointments";
    case "Book": return "Book a Doctor";
    case "Documents": return "Documents";
    case "Notifications": return "Notifications";
    case "Profile": return "Profile & Settings";
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
  navList: { flex: 1, gap: 4 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  navRowFocused: {
    // 2px teal focus ring per spec — drawn as outline via web style.
    // RN Web honors these CSS-style outline props; on native they're
    // ignored. RN's StyleSheet types accept them so no override needed.
    outlineStyle: "solid" as unknown as undefined,
    outlineColor: palette.brand700 as unknown as undefined,
    outlineWidth: 2 as unknown as undefined,
    outlineOffset: 2 as unknown as undefined,
  },
  navLabel: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.medium,
    flex: 1,
  },
  badge: {
    backgroundColor: semantic.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: fontWeight.bold,
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
  // Mobile (<768px): collapse sidebar, show bottom tab bar.
  mobileShell: {
    flex: 1,
    backgroundColor: semantic.bg,
  },
  mobileTopbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: semantic.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantic.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mobileTitle: {
    color: semantic.text,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.2,
  },
  mobileContent: { flex: 1 },
  bottomBar: {
    flexDirection: "row",
    backgroundColor: semantic.surface,
    borderTopWidth: 1,
    borderTopColor: semantic.border,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 4,
  },
  bottomLabel: {
    fontSize: 11,
    color: semantic.textMuted,
  },
  bottomBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: semantic.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
