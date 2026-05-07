import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ScreenHeader } from "../components/ScreenHeader";
import { brand, fontWeight, palette, radius, semantic, space } from "../theme";

interface Profile {
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
}

interface Preferences {
  pushReminders: boolean;
  emailReminders: boolean;
  smsReminders: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  pushReminders: true,
  emailReminders: true,
  smsReminders: false,
};

async function fetchProfile(): Promise<Profile> {
  try {
    return await api<Profile>("/users/me");
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) {
      return { fullName: null, phone: null, dateOfBirth: null };
    }
    throw err;
  }
}

function saveProfile(input: Partial<Profile>): Promise<Profile> {
  return api<Profile>("/users/me", { method: "PUT", body: input });
}

function initialsFor(profile: Profile, email: string | undefined): string {
  if (profile.fullName) {
    const parts = profile.fullName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }
  return email?.charAt(0).toUpperCase() ?? "?";
}

const FIELD_HINT = "Tap any field to edit, then save.";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();

  const profileQuery = useQuery<Profile, ApiError>({
    queryKey: ["me"],
    queryFn: fetchProfile,
    staleTime: 60_000,
  });

  // Local edit buffer — fields stay disconnected from the cached profile
  // until "Save" so the user can revise without each keystroke triggering
  // a network round-trip.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.fullName ?? "");
      setPhone(profileQuery.data.phone ?? "");
      setDateOfBirth(profileQuery.data.dateOfBirth ?? "");
    }
  }, [profileQuery.data]);

  const dirty = useMemo(() => {
    const original = profileQuery.data;
    if (!original) return false;
    return (
      fullName !== (original.fullName ?? "") ||
      phone !== (original.phone ?? "") ||
      dateOfBirth !== (original.dateOfBirth ?? "")
    );
  }, [profileQuery.data, fullName, phone, dateOfBirth]);

  const save = useMutation<Profile, ApiError>({
    mutationFn: () =>
      saveProfile({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      setFeedback({ kind: "ok", msg: "Profile saved." });
    },
    onError: (err) => {
      setFeedback({ kind: "err", msg: err.message });
    },
  });

  // Notification preferences are stored client-only for now — Phase 7
  // will move them server-side alongside the SES/Twilio/FCM wiring.
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const togglePref = (key: keyof Preferences) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to enter your credentials again.", [
      { text: "Stay signed in", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  };

  const initials = initialsFor(profileQuery.data ?? { fullName: null, phone: null, dateOfBirth: null }, user?.email);
  const displayName = profileQuery.data?.fullName ?? user?.email?.split("@")[0] ?? "Patient";

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile & settings" subtitle="Manage your account." />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityBody}>
            <Text style={styles.identityName}>{displayName}</Text>
            <Text style={styles.identityEmail}>{user?.email ?? "—"}</Text>
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{user?.role ?? "patient"}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Your details</Text>
        <Text style={styles.fieldHint}>{FIELD_HINT}</Text>

        {profileQuery.isPending ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator color={palette.brand700} />
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Aniket Sharma"
              autoCapitalize="words"
            />
            <Field
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +91 98765 43210"
              keyboardType="phone-pad"
            />
            <Field
              label="Date of birth"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}

        {feedback ? (
          <Text
            style={feedback.kind === "ok" ? styles.feedbackOk : styles.feedbackErr}
          >
            {feedback.msg}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.saveBtn,
            (!dirty || save.isPending) && styles.saveBtnDisabled,
          ]}
          onPress={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.saveBtnText}>
              {dirty ? "Save changes" : "Saved"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Notification preferences</Text>
        <View style={styles.prefsCard}>
          <PrefRow
            label="Push reminders"
            description="Appointment reminders sent to this device."
            value={prefs.pushReminders}
            onToggle={() => togglePref("pushReminders")}
          />
          <PrefDivider />
          <PrefRow
            label="Email reminders"
            description={`To ${user?.email ?? "your inbox"}.`}
            value={prefs.emailReminders}
            onToggle={() => togglePref("emailReminders")}
          />
          <PrefDivider />
          <PrefRow
            label="SMS reminders"
            description="SMS to the phone number on file."
            value={prefs.smsReminders}
            onToggle={() => togglePref("smsReminders")}
          />
        </View>
        <Text style={styles.fieldHint}>
          Preferences sync with the platform once Phase 7 wires SES, Twilio, and
          push delivery. For now they live on this device.
        </Text>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.aboutCard}>
          <AboutRow label="Product" value={brand.name} />
          <PrefDivider />
          <AboutRow label="Tagline" value={brand.tagline} />
          <PrefDivider />
          <AboutRow label="Version" value="0.1.0" />
          <PrefDivider />
          <AboutRow label="Support" value={brand.supportEmail} />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={semantic.textSubtle}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        autoCorrect={props.autoCorrect ?? true}
        keyboardType={props.keyboardType ?? "default"}
        style={styles.fieldInput}
      />
    </View>
  );
}

function PrefRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefText}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: semantic.borderStrong, true: palette.brand700 }}
        thumbColor={palette.white}
      />
    </View>
  );
}

function PrefDivider() {
  return <View style={styles.prefDivider} />;
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  content: { padding: space[4], paddingBottom: space[10] },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: semantic.surface,
    borderRadius: radius.xl,
    padding: space[4],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.brand700,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: palette.white,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  identityBody: { flex: 1, gap: 4 },
  identityName: {
    color: semantic.text,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
  },
  identityEmail: { color: semantic.textMuted, fontSize: 13 },
  roleChip: {
    alignSelf: "flex-start",
    backgroundColor: palette.brand50,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginTop: 4,
  },
  roleChipText: {
    color: palette.brand800,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  sectionLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: space[6],
    marginBottom: space[2],
  },
  fieldHint: {
    color: semantic.textSubtle,
    fontSize: 12,
    marginBottom: space[3],
  },

  loaderRow: {
    paddingVertical: space[4],
    alignItems: "center",
  },
  fieldGroup: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
    overflow: "hidden",
  },
  field: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.border,
  },
  fieldLabel: {
    color: semantic.textMuted,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    color: semantic.text,
    fontSize: 16,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },

  feedbackOk: {
    color: semantic.success,
    fontSize: 13,
    marginTop: space[3],
    fontWeight: fontWeight.medium,
  },
  feedbackErr: {
    color: semantic.danger,
    fontSize: 13,
    marginTop: space[3],
  },

  saveBtn: {
    backgroundColor: palette.brand700,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: space[3],
  },
  saveBtnDisabled: { backgroundColor: palette.slate400 },
  saveBtnText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },

  prefsCard: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  prefText: { flex: 1 },
  prefLabel: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  prefDescription: {
    color: semantic.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  prefDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: semantic.border,
    marginLeft: space[4],
  },

  aboutCard: {
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: semantic.border,
  },
  aboutRow: {
    flexDirection: "row",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    gap: space[3],
  },
  aboutLabel: {
    color: semantic.textMuted,
    fontSize: 13,
    width: 96,
  },
  aboutValue: {
    color: semantic.text,
    fontSize: 13,
    fontWeight: fontWeight.medium,
    flex: 1,
  },

  signOutBtn: {
    marginTop: space[6],
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: semantic.surface,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  signOutText: {
    color: semantic.danger,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
});
