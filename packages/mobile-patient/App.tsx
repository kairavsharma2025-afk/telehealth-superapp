import "./global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { tokenStore } from "./src/lib/tokenStore";
import { Logo } from "./src/components/Logo";
import { WebShell } from "./src/components/WebShell";
import { TabRouterProvider, useTabRouter } from "./src/navigation/router";
import { AppointmentsScreen } from "./src/screens/AppointmentsScreen";
import { BookScreen } from "./src/screens/BookScreen";
import { DocumentsScreen } from "./src/screens/DocumentsScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import {
  BellIcon,
  CalendarDaysIcon,
  FileTextIcon,
  PlusCircleIcon,
  UserIcon,
} from "./src/components/Icons";
import { fontWeight, palette, semantic } from "./src/theme";

const isWeb = Platform.OS === "web";

export type MainTabParamList = {
  Appointments: undefined;
  Book: undefined;
  Documents: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const navTheme: NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.brand700,
    background: semantic.bg,
    card: semantic.surface,
    text: semantic.text,
    border: semantic.border,
    notification: semantic.danger,
  },
};

const tabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: semantic.surface,
    borderTopColor: semantic.border,
    height: 64,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  tabBarActiveTintColor: palette.brand700,
  tabBarInactiveTintColor: semantic.textMuted,
};

// Native bottom-tab navigator. Used on iOS / Android / Expo Go AND on
// web below the responsive breakpoint (handled by WebShellRoot).
function NativeTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <CalendarDaysIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Book"
        component={BookScreen}
        options={{
          tabBarLabel: "Book",
          tabBarIcon: ({ color, size }) => <PlusCircleIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <FileTextIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <BellIcon size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <UserIcon size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Web sidebar layout — mirrors the doctor portal's chrome (sidebar +
// topbar) and routes between screens via a tiny in-memory state
// machine instead of react-navigation. Default tab is Appointments
// (the Dashboard was removed).
function WebContent() {
  const { tab } = useTabRouter();
  switch (tab) {
    case "Appointments":
      return <AppointmentsScreen />;
    case "Book":
      return <BookScreen />;
    case "Documents":
      return <DocumentsScreen />;
    case "Notifications":
      return <NotificationsScreen />;
    case "Profile":
      return <ProfileScreen />;
  }
}

function WebShellRoot() {
  return (
    <TabRouterProvider initial="Appointments">
      <WebShell>
        <WebContent />
      </WebShell>
    </TabRouterProvider>
  );
}

function RootNavigator() {
  const { user } = useAuth();
  if (!user) return <LoginScreen />;
  return isWeb ? <WebShellRoot /> : <NativeTabs />;
}

export default function App() {
  // tokenStore reads from secure storage asynchronously. Render a splash
  // until that finishes so the first render sees the actual stored
  // session — otherwise we'd flash the LoginScreen even for users with a
  // valid token already on disk.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void tokenStore.init().finally(() => {
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <View style={styles.splashLogo}>
          <Logo size={42} color={palette.white} />
        </View>
        <ActivityIndicator size="small" color={palette.brand700} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: semantic.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  splashLogo: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
});
