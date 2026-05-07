import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../lib/auth";

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in as</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>{user?.role}</Text>
      </View>

      <Text style={styles.placeholder}>
        Appointments, booking, documents, and notifications land in the next commits.
      </Text>

      <TouchableOpacity style={styles.button} onPress={() => void logout()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 12,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    textTransform: "uppercase",
  },
  email: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  role: {
    color: "#22d3ee",
    fontSize: 13,
    marginTop: 2,
  },
  placeholder: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#dc2626",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
