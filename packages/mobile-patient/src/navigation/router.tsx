import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Tiny tab router used on web only. The native build still uses
// react-navigation's bottom-tab navigator; on web we replace it with a
// sidebar layout driven by a piece of state. This context keeps that
// state + a navigate() helper so any screen can change tab.

export type WebTab =
  | "Home"
  | "Appointments"
  | "Book"
  | "Documents"
  | "Notifications"
  | "Profile";

interface TabRouter {
  tab: WebTab;
  navigate: (next: WebTab) => void;
}

const TabRouterContext = createContext<TabRouter | null>(null);

export function TabRouterProvider({
  initial,
  children,
}: {
  initial?: WebTab;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<WebTab>(initial ?? "Home");
  const value = useMemo<TabRouter>(
    () => ({ tab, navigate: (next) => setTab(next) }),
    [tab],
  );
  return (
    <TabRouterContext.Provider value={value}>{children}</TabRouterContext.Provider>
  );
}

// On native we never wrap in TabRouterProvider, so navigate() is a
// no-op fallback. Screens that need real cross-tab navigation use
// react-navigation's useNavigation() directly.
export function useTabRouter(): TabRouter {
  const ctx = useContext(TabRouterContext);
  if (ctx) return ctx;
  return { tab: "Home", navigate: () => undefined };
}
