import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo } from "../components/Logo";
import { brand, fontWeight, palette, radius, semantic, space } from "../theme";

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
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <View style={styles.logoMark}>
            <Logo size={36} color={palette.white} />
          </View>
          <Text style={styles.brandName}>{brand.name}</Text>
          <Text style={styles.brandTagline}>{brand.tagline}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your care.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@example.com"
              placeholderTextColor={semantic.textSubtle}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="At least 8 characters"
              placeholderTextColor={semantic.textSubtle}
              style={styles.input}
            />
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Trouble signing in? Contact{" "}
            <Text style={styles.link}>{brand.supportEmail}</Text>
          </Text>
        </View>

        <Text style={styles.footer}>
          © {new Date().getFullYear()} {brand.name}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: semantic.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: space[5],
    gap: space[5],
  },
  brandBlock: {
    alignItems: "center",
    gap: space[2],
    marginTop: space[4],
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space[2],
  },
  brandName: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: semantic.text,
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 14,
    color: semantic.textMuted,
  },
  card: {
    backgroundColor: semantic.surface,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.semibold,
    color: semantic.text,
  },
  subtitle: {
    fontSize: 14,
    color: semantic.textMuted,
    marginBottom: space[3],
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: fontWeight.medium,
    color: semantic.text,
  },
  input: {
    backgroundColor: semantic.surface,
    borderColor: semantic.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: 11,
    fontSize: 15,
    color: semantic.text,
  },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  errorText: {
    color: semantic.danger,
    fontSize: 13,
  },
  button: {
    backgroundColor: palette.brand700,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space[2],
  },
  buttonDisabled: {
    backgroundColor: palette.slate400,
  },
  buttonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: fontWeight.semibold,
  },
  helpText: {
    fontSize: 12,
    color: semantic.textMuted,
    textAlign: "center",
    marginTop: space[2],
  },
  link: {
    color: palette.brand700,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    fontSize: 12,
    color: semantic.textSubtle,
    textAlign: "center",
  },
});
