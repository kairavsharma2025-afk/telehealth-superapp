import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { tokenStore } from "./src/lib/tokenStore";
import { AppointmentsScreen } from "./src/screens/AppointmentsScreen";
import { BookScreen } from "./src/screens/BookScreen";
import { DocumentsScreen } from "./src/screens/DocumentsScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";

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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTitleStyle: { color: "#f8fafc" },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#60a5fa",
        tabBarInactiveTintColor: "#64748b",
      }}
    >
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Book" component={BookScreen} />
      <Tab.Screen
        name="Documents"
        component={DocumentsScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
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
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
});
