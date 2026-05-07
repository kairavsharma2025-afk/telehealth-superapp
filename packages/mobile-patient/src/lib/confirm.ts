import { Alert, Platform } from "react-native";

// Cross-platform confirmation dialog. RN's Alert.alert silently ignores
// its buttons on react-native-web (only the title/message render —
// sometimes), so destructive actions on the web preview look broken
// because the user's "Sign out" tap reaches a no-op. Branch to
// window.confirm on web and keep the native Alert flow elsewhere.

export function confirmAction(opts: {
  title: string;
  message?: string;
  destructive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}): void {
  const confirmLabel = opts.confirmLabel ?? "Confirm";
  const cancelLabel = opts.cancelLabel ?? "Cancel";

  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(`${opts.title}\n\n${opts.message ?? ""}`.trim())
        : true;
    if (ok) opts.onConfirm();
    return;
  }

  Alert.alert(opts.title, opts.message ?? "", [
    { text: cancelLabel, style: "cancel" },
    {
      text: confirmLabel,
      style: opts.destructive ? "destructive" : "default",
      onPress: opts.onConfirm,
    },
  ]);
}
