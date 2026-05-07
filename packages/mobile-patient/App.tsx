import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import { AppointmentsScreen } from "./src/screens/AppointmentsScreen";
import { BookScreen } from "./src/screens/BookScreen";
import { DocumentsScreen } from "./src/screens/DocumentsScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { fontWeight, palette, semantic } from "./src/theme";

export type MainTabParamList = {
  Appointments: undefined;
  Book: undefined;
  Documents: undefined;
  Notifications: undefined;
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

// Tab icons — small unicode glyphs in branded colour. A real app would
// swap to react-native-svg icons, but glyphs render consistently across
// platforms and weigh ~0KB. The active state uses the brand colour so
// the highlight matches the label.
function tabIcon(glyph: string) {
  function TabIcon({ color, size }: { color: string; size: number }) {
    return <Text style={{ color, fontSize: size, lineHeight: size + 2 }}>{glyph}</Text>;
  }
  return TabIcon;
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ tabBarIcon: tabIcon("🗓") }}
      />
      <Tab.Screen
        name="Book"
        component={BookScreen}
        options={{ tabBarIcon: tabIcon("➕") }}
      />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ tabBarIcon: tabIcon("📄") }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarIcon: tabIcon("🔔") }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user } = useAuth();
  return user ? <MainTabs /> : <LoginScreen />;
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
