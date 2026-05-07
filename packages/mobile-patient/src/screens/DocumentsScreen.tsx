import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api, ApiError } from "../lib/api";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

type UploadStatus = "pending" | "uploaded" | "deleted";

interface UploadRow {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  createdAt: string;
}

interface ListResult {
  items: UploadRow[];
}

interface CreateResponse {
  id: string;
  uploadUrl: string;
}

interface DetailResponse {
  id: string;
  filename: string;
  status: UploadStatus;
  downloadUrl: string | null;
}

function listUploads(): Promise<ListResult> {
  return api<ListResult>("/uploads");
}

function deleteUpload(id: string): Promise<void> {
  return api<void>(`/uploads/${id}`, { method: "DELETE" });
}

async function uploadFile(asset: {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}): Promise<UploadRow> {
  // 1. Create the row + get a presigned PUT URL.
  const created = await api<CreateResponse>("/uploads", {
    method: "POST",
    body: {
      filename: asset.name,
      contentType: asset.mimeType,
      sizeBytes: asset.size,
    },
  });
  // 2. Stream the file directly to S3/MinIO. The Content-Type MUST match
  // what we declared at create time — the presigned URL is signed against
  // it, so any mismatch here makes S3 reject the PUT.
  const result = await FileSystem.uploadAsync(created.uploadUrl, asset.uri, {
    httpMethod: "PUT",
    headers: { "Content-Type": asset.mimeType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`S3 PUT failed (${result.status})`);
  }
  // 3. Mark complete — the service HEADs the object, verifies size, flips
  // status to 'uploaded', and returns the persisted row.
  return api<UploadRow>(`/uploads/${created.id}/complete`, { method: "POST" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_COLOR: Record<UploadStatus, string> = {
  pending: "#f59e0b",
  uploaded: "#10b981",
  deleted: "#64748b",
};

export function DocumentsScreen() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const list = useQuery<ListResult, ApiError>({
    queryKey: ["uploads"],
    queryFn: listUploads,
  });

  const upload = useMutation<UploadRow, Error, void>({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...ALLOWED_TYPES],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) throw new Error("cancelled");
      const asset = picked.assets[0];
      if (!asset) throw new Error("No file selected");
      if (!asset.mimeType || !ALLOWED_TYPES.includes(asset.mimeType as (typeof ALLOWED_TYPES)[number])) {
        throw new Error(`Unsupported type: ${asset.mimeType ?? "unknown"}`);
      }
      if (typeof asset.size !== "number") {
        throw new Error("File size unknown");
      }
      return uploadFile({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["uploads"] });
    },
    onError: (err) => {
      // Cancellation is normal user behaviour — don't surface as error.
      if (err.message === "cancelled") return;
      setError(err instanceof ApiError ? err.message : err.message);
    },
  });

  const remove = useMutation<void, ApiError, string>({
    mutationFn: deleteUpload,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uploads"] }),
    onError: (err) => setError(err.message),
  });

  const onOpen = useCallback(async (id: string) => {
    try {
      const detail = await api<DetailResponse>(`/uploads/${id}`);
      if (!detail.downloadUrl) {
        Alert.alert("Not ready", "This upload isn't viewable yet.");
        return;
      }
      const supported = await Linking.canOpenURL(detail.downloadUrl);
      if (!supported) {
        Alert.alert("Cannot open", "No app can open this URL.");
        return;
      }
      await Linking.openURL(detail.downloadUrl);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Failed to open";
      Alert.alert("Error", message);
    }
  }, []);

  const items = list.data?.items ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Documents</Text>
        <TouchableOpacity
          style={[styles.addButton, upload.isPending && styles.addButtonBusy]}
          onPress={() => upload.mutate()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>+ Upload</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {list.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2563eb" />
        </View>
      ) : list.isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Failed to load: {list.error.message}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No documents yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isPending}
              onRefresh={() => void list.refetch()}
              tintColor="#2563eb"
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() => void onOpen(item.id)}
                disabled={item.status !== "uploaded"}
              >
                <Text style={styles.filename} numberOfLines={1}>
                  {item.filename}
                </Text>
                <Text style={styles.meta}>
                  {item.contentType} · {formatSize(item.sizeBytes)}
                </Text>
              </TouchableOpacity>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: STATUS_COLOR[item.status] },
                ]}
              >
                <Text style={styles.pillText}>{item.status}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Delete?", item.filename, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => remove.mutate(item.id),
                    },
                  ])
                }
                style={styles.deleteButton}
                disabled={remove.isPending}
              >
                <Text style={styles.deleteText}>×</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f172a" },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomColor: "#1e293b",
    borderBottomWidth: 1,
  },
  title: { color: "#f8fafc", fontSize: 20, fontWeight: "700" },
  addButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonBusy: { backgroundColor: "#475569" },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  error: { color: "#f87171", padding: 16, textAlign: "center" },
  muted: { color: "#64748b", fontSize: 14 },
  list: { padding: 16, gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowMain: { flex: 1 },
  filename: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  meta: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: { color: "#f87171", fontSize: 18, fontWeight: "700", lineHeight: 20 },
});
