import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";
import { brand } from "../theme";

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-[#F6F8FA]"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center p-5"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-8">
          <View className="flex-row items-center gap-2.5">
            <View className="h-8 w-8 rounded-lg bg-brand-700 items-center justify-center">
              <Logo size={18} color="#fff" />
            </View>
            <Text className="text-[15px] font-semibold text-ink tracking-tight">
              {brand.name}
            </Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-line overflow-hidden">
          <View className="h-[3px] bg-brand-700" />

          <View className="px-6 pt-7 pb-2">
            <Text className="text-[20px] font-semibold text-ink tracking-tight">
              Sign in
            </Text>
            <Text className="text-[13px] text-ink-muted mt-1.5">
              Continue your care.
            </Text>
          </View>

          <View className="px-6 pb-6 pt-4 gap-4">
            <View className="gap-1.5">
              <Text className="text-[12px] font-medium text-ink">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                placeholder="you@example.com"
                placeholderTextColor="#94A3B8"
                className="bg-white border border-line rounded-md px-3 py-2.5 text-[14px] text-ink"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[12px] font-medium text-ink">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                className="bg-white border border-line rounded-md px-3 py-2.5 text-[14px] text-ink"
              />
            </View>

            {error ? (
              <View className="bg-danger-subtle border border-danger/20 rounded-md px-3 py-2">
                <Text className="text-[13px] text-danger">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={() => void onSubmit()}
              disabled={!canSubmit}
              activeOpacity={0.85}
              className={`rounded-md py-3 items-center justify-center mt-1 ${
                canSubmit ? "bg-brand-700" : "bg-ink-subtle"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-[14px] font-semibold">Sign in</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="border-t border-line bg-[#FBFCFD] px-6 py-3">
            <Text className="text-[11px] text-ink-muted">
              Encrypted in transit · Session signed
            </Text>
          </View>
        </View>

        <Text className="text-[11px] text-ink-muted text-center mt-6">
          Need help?{" "}
          <Text className="text-brand-700 font-semibold">{brand.supportEmail}</Text>
        </Text>

        <Text className="text-[10.5px] text-ink-subtle text-center mt-6">
          © {new Date().getFullYear()} {brand.name}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
