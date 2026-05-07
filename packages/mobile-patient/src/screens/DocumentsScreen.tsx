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
import { fontWeight, palette, radius, semantic, space } from "../theme";
import { ScreenHeader } from "../components/ScreenHeader";

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

const STATUS_COLOR: Record<UploadStatus, { bg: string; fg: string }> = {
  pending: { bg: "#FEF3C7", fg: "#D97706" },
  uploaded: { bg: "#DCFCE7", fg: "#15803D" },
  deleted: { bg: "#F1F5F9", fg: "#64748B" },
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
      <ScreenHeader
        title="Documents"
        subtitle="Lab reports, scans, and prescriptions you've shared with your care team."
        trailing={
          <TouchableOpacity
            style={[styles.addButton, upload.isPending && styles.addButtonBusy]}
            onPress={() => upload.mutate()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <ActivityIndicator color={palette.white} />
            ) : (
              <Text style={styles.addButtonText}>+ Upload</Text>
            )}
          </TouchableOpacity>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {list.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand700} />
        </View>
      ) : list.isError ? (
        <View style={styles.center}>
          <Text style={styles.error}>Couldn&apos;t load: {list.error.message}</Text>
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
              tintColor={palette.brand700}
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
                  { backgroundColor: STATUS_COLOR[item.status].bg },
                ]}
              >
                <Text
                  style={[styles.pillText, { color: STATUS_COLOR[item.status].fg }]}
                >
                  {item.status}
                </Text>
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
  root: { flex: 1, backgroundColor: semantic.bg },
  addButton: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  addButtonBusy: { backgroundColor: palette.slate400 },
  addButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: space[6],
  },
  error: { color: semantic.danger, padding: space[4], textAlign: "center" },
  muted: { color: semantic.textMuted, fontSize: 14 },
  list: { padding: space[4], gap: space[3] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: semantic.surface,
    borderRadius: radius.lg,
    padding: space[3],
    gap: space[3],
    borderWidth: 1,
    borderColor: semantic.border,
  },
  rowMain: { flex: 1 },
  filename: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  meta: { color: semantic.textMuted, fontSize: 12, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  pillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: semantic.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: semantic.danger,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
});
