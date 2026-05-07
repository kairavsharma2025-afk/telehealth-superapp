import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { tokenStore } from "./src/lib/tokenStore";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function RootNavigator() {
  const { user } = useAuth();
  return (
    <Stack.Navigator>
      {user ? (
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Telehealth" }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
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
