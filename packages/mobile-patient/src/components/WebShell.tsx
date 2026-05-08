import { useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { brand } from "../theme";
import { fontWeight, palette, radius, semantic } from "../theme";
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

// Sidebar uses a deep teal gradient on web — defined inline so callers
// don't need to import expo-linear-gradient (RN Web reads
// `backgroundImage` from styles directly).
const SIDEBAR_GRADIENT =
  "linear-gradient(160deg, #0d2b2b 0%, #0a3d35 60%, #0d4a40 100%)";

// Translucent overlays for nav-row hover / active on the dark sidebar.
const NAV_HOVER_BG = "rgba(255,255,255,0.07)";
const NAV_ACTIVE_BG = "rgba(255,255,255,0.12)";

// Inject Inter font + custom scrollbar + page-enter animation once on
// mount. Cheaper and more reliable than reaching into the Expo HTML
// template; runs only on web because document is undefined on native.
function ensureGlobalStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById("vela-global-styles")) return;

  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(fontLink);

  const style = document.createElement("style");
  style.id = "vela-global-styles";
  style.textContent = `
    html, body, #root { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    body { background: #f4f6f9; }
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-thumb { background: #c8e6e2; border-radius: 999px; }
    *::-webkit-scrollbar-track { background: transparent; }
    @keyframes velaFadeSlideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .vela-fade-slide { animation: velaFadeSlideUp 300ms ease forwards; }
    @keyframes velaPulse {
      0%   { box-shadow: 0 0 0 0 rgba(13,158,137,0.5); }
      70%  { box-shadow: 0 0 0 10px rgba(13,158,137,0); }
      100% { box-shadow: 0 0 0 0 rgba(13,158,137,0); }
    }
    .vela-pulse { animation: velaPulse 1.6s ease infinite; }
  `;
  document.head.appendChild(style);
}

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

  useEffect(() => {
    ensureGlobalStyles();
  }, []);

  // Keep <title> aligned with the active tab so the browser tab + history
  // entries are meaningful, and never read "undefined".
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${labelFor(tab)} · Vela Health`;
    }
  }, [tab]);

  // Ref used to retrigger the page-enter animation on tab change.
  const contentRef = useRef<View | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const node = contentRef.current as unknown as HTMLElement | null;
    if (!node) return;
    node.classList.remove("vela-fade-slide");
    // force reflow to restart the animation
    void node.offsetWidth;
    node.classList.add("vela-fade-slide");
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

      <View
        style={[
          styles.sidebar,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { backgroundImage: SIDEBAR_GRADIENT } as any,
        ]}
      >
        <View style={styles.brandBlock}>
          <View
            style={[
              styles.brandLogoBg,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { filter: "drop-shadow(0 0 8px rgba(255,255,255,0.15))" } as any,
            ]}
          >
            <Logo size={30} color="#fff" />
          </View>
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
          <View style={styles.footAvatar}>
            <Text style={styles.footAvatarText}>
              {user?.email?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.footEmail} numberOfLines={1}>
              {user?.email ?? "Signed out"}
            </Text>
            {user ? (
              <Text style={styles.footRole}>{user.role}</Text>
            ) : null}
          </View>
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
          <Text style={styles.topDate}>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>
        {/* Thin teal accent strip below the topbar */}
        <View
          style={[
            styles.accentStrip,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { backgroundImage: "linear-gradient(90deg, #0d9e89, #6ee7df, transparent)" } as any,
          ]}
        />
        {/* nativeID lets the skip-link target #vela-main work on web. */}
        <View
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={contentRef as any}
          style={styles.content}
          nativeID="vela-main"
        >
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
        if (hovered && !active) out.push({ backgroundColor: NAV_HOVER_BG });
        if (active) out.push(styles.navRowActive);
        if (focused) out.push(styles.navRowFocused);
        return out;
      }}
    >
      <Icon
        size={18}
        color={active ? palette.brand400 : "rgba(255,255,255,0.6)"}
      />
      <Text
        style={[
          styles.navLabel,
          active && { color: "#fff", fontWeight: fontWeight.semibold },
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

const SIDEBAR_W = 260;
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
    // backgroundImage is applied inline (not StyleSheet) since RN's
    // ViewStyle types don't include it. On native, the
    // backgroundColor fallback below is what renders.
    backgroundColor: "#0d2b2b",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 20,
    gap: 0,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  brandLogoBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.2,
  },
  brandSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    marginTop: 2,
  },
  navList: { flex: 1, gap: 4 },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  navRowActive: {
    backgroundColor: NAV_ACTIVE_BG,
    borderLeftColor: palette.brand700,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  navRowFocused: {
    outlineStyle: "solid" as unknown as undefined,
    outlineColor: palette.brand400 as unknown as undefined,
    outlineWidth: 2 as unknown as undefined,
    outlineOffset: 2 as unknown as undefined,
  },
  navLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: fontWeight.medium,
    flex: 1,
    marginLeft: 10, // 10px gap between icon and text per spec
  },
  badge: {
    backgroundColor: palette.accent500,
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
    marginTop: "auto" as unknown as number,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  footAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  footAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  footEmail: {
    color: "#fff",
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  footRole: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    fontWeight: fontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  main: { flex: 1, height: "100%", backgroundColor: semantic.bg },
  topbar: {
    height: TOPBAR_H,
    backgroundColor: semantic.surface,
    borderBottomWidth: 1,
    borderBottomColor: semantic.border,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: {
    color: semantic.text,
    fontSize: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  topMeta: {
    color: semantic.textMuted,
    fontSize: 14,
    fontWeight: fontWeight.regular,
    lineHeight: 14 * 1.6,
  },
  topDate: {
    color: palette.slate400,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
  // The accent strip stays in the JSX but rendered transparent so the
  // topbar's bottom-border is the only divider — per "remove the thick
  // colored line under the header".
  accentStrip: {
    height: 0,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    // Centered content lane on big screens. Per-screen views still set
    // their own internal padding (existing ScreenHeader / list pads),
    // so we don't double-pad here.
    maxWidth: 960,
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
  },
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
