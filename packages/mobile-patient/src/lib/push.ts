import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { api, ApiError } from "./api";

// Push registration: ask for permission, get an Expo push token, send it
// to the notification-service so it can target this device. Idempotent —
// the backend ON CONFLICT (token) DO UPDATE re-binds the token to the
// current user, so calling on every app start is cheap.
//
// Phase 6 stops here: the token sits in the push_tokens table waiting to
// be used. Phase 7 wires the notification-service `push` channel to
// Expo's push API / FCM / APNs and starts actually delivering.

// Show banner + sound + badge for incoming notifications received while
// the app is foregrounded. Without this handler the system suppresses
// foreground notifications by default.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

export interface RegistrationResult {
  token: string;
  platform: "ios" | "android" | "web";
}

export async function registerPushToken(): Promise<RegistrationResult | null> {
  // Simulators / emulators can't get a real push token. expo-device.isDevice
  // is false on simulators — bail rather than throw.
  if (!Device.isDevice) return null;

  // Android 8+ requires a notification channel before tokens are valid.
  // No-op on iOS.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // PermissionResponse has both .status (enum) and .granted (boolean) —
  // we use the boolean to sidestep the enum vs string-literal comparison.
  let granted = (await Notifications.getPermissionsAsync()).granted;
  if (!granted) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  let tokenData;
  try {
    tokenData = await Notifications.getExpoPushTokenAsync();
  } catch {
    // Standalone builds without an EAS projectId fail here. Expo Go works.
    // The user-facing impact is identical (no pushes) — just don't crash.
    return null;
  }

  const platform: "ios" | "android" | "web" =
    Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

  try {
    await api("/notifications/push-tokens", {
      method: "POST",
      body: { token: tokenData.data, platform },
    });
  } catch (err: unknown) {
    // A 401 here is fine — caller hasn't logged in yet (registration is
    // gated by user state, but a race is possible). Anything else gets
    // logged but doesn't break the app.
    if (!(err instanceof ApiError) || err.status !== 401) {
      console.warn("push token registration failed:", err);
    }
    return null;
  }

  return { token: tokenData.data, platform };
}

export async function unregisterPushToken(token: string): Promise<void> {
  try {
    await api("/notifications/push-tokens", {
      method: "DELETE",
      body: { token },
    });
  } catch {
    // Best-effort — sign-out continues regardless.
  }
}
