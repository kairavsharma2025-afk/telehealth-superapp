import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
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
import { confirmAction } from "../lib/confirm";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

type Category = "lab_report" | "prescription" | "imaging" | "insurance" | "other";

const CATEGORY_OPTIONS: ReadonlyArray<{ value: Category; label: string; icon: string }> = [
  { value: "lab_report", label: "Lab report", icon: "🧪" },
  { value: "prescription", label: "Prescription", icon: "💊" },
  { value: "imaging", label: "Imaging / X-ray", icon: "🩻" },
  { value: "insurance", label: "Insurance", icon: "🛡️" },
  { value: "other", label: "Other", icon: "📄" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
);

type UploadStatus = "pending" | "uploaded" | "deleted";

interface UploadRow {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  category: Category | null;
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

interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

function listUploads(): Promise<ListResult> {
  return api<ListResult>("/uploads");
}

function deleteUpload(id: string): Promise<void> {
  return api<void>(`/uploads/${id}`, { method: "DELETE" });
}

async function uploadFile(asset: PickedAsset, category: Category): Promise<UploadRow> {
  const created = await api<CreateResponse>("/uploads", {
    method: "POST",
    body: {
      filename: asset.name,
      contentType: asset.mimeType,
      sizeBytes: asset.size,
      category,
    },
  });

  // expo-file-system's uploadAsync is native-only — on web it doesn't
  // stream the picked file to the presigned URL. Use the standard fetch
  // path on web (the picker hands us a blob:/data: URI we can re-fetch
  // into a Blob), and keep uploadAsync for iOS/Android where fetch can't
  // PUT a file:// URI directly.
  if (Platform.OS === "web") {
    const blob = await (await fetch(asset.uri)).blob();
    const res = await fetch(created.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": asset.mimeType },
      body: blob,
    });
    if (!res.ok) throw new Error(`S3 PUT failed (${res.status})`);
  } else {
    const result = await FileSystem.uploadAsync(created.uploadUrl, asset.uri, {
      httpMethod: "PUT",
      headers: { "Content-Type": asset.mimeType },
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`S3 PUT failed (${result.status})`);
    }
  }

  return api<UploadRow>(`/uploads/${created.id}/complete`, { method: "POST" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function categoryIcon(category: Category | null): string {
  if (!category) return "📄";
  const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
  return opt?.icon ?? "📄";
}

const STATUS_COLOR: Record<UploadStatus, { bg: string; fg: string }> = {
  pending: { bg: "#FEF3C7", fg: "#D97706" },
  uploaded: { bg: "#DCFCE7", fg: "#15803D" },
  deleted: { bg: "#F1F5F9", fg: "#64748B" },
};

export function DocumentsScreen() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingAsset, setPendingAsset] = useState<PickedAsset | null>(null);
  const [uploading, setUploading] = useState(false);

  const list = useQuery<ListResult, ApiError>({
    queryKey: ["uploads"],
    queryFn: listUploads,
  });

  // Pick the file first, then surface a modal to choose a category, then
  // do the actual upload. Splitting it like this keeps the picker dialog
  // and the category sheet from fighting for screen real-estate.
  const pickFile = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...ALLOWED_TYPES],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;
      if (
        !asset.mimeType ||
        !ALLOWED_TYPES.includes(asset.mimeType as (typeof ALLOWED_TYPES)[number])
      ) {
        setError(`Unsupported type: ${asset.mimeType ?? "unknown"}`);
        return;
      }
      if (typeof asset.size !== "number") {
        setError("File size unknown");
        return;
      }
      setError(null);
      setPendingAsset({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "File pick failed");
    }
  }, []);

  const finishUpload = useCallback(
    async (category: Category) => {
      if (!pendingAsset) return;
      setUploading(true);
      try {
        await uploadFile(pendingAsset, category);
        setError(null);
        setPendingAsset(null);
        void qc.invalidateQueries({ queryKey: ["uploads"] });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [pendingAsset, qc],
  );

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
        subtitle="Lab reports, prescriptions, and other care files."
        trailing={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => void pickFile()}
            disabled={uploading}
          >
            <Text style={styles.addButtonText}>+ Upload</Text>
          </TouchableOpacity>
        }
      />

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {list.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.brand700} />
        </View>
      ) : list.isError ? (
        <View style={styles.center}>
          <Text style={styles.errorBanner}>
            Couldn&apos;t load: {list.error.message}
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No documents yet — tap “Upload” to share one.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space[3] }} />}
          refreshControl={
            <RefreshControl
              refreshing={list.isFetching && !list.isPending}
              onRefresh={() => void list.refetch()}
              tintColor={palette.brand700}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.iconBubble}>
                <Text style={styles.iconBubbleText}>{categoryIcon(item.category)}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.filename} numberOfLines={1}>
                  {item.filename}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.category ? CATEGORY_LABEL[item.category] : "Other"} ·{" "}
                  {formatSize(item.sizeBytes)} · {formatWhen(item.createdAt)}
                </Text>
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: STATUS_COLOR[item.status].bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: STATUS_COLOR[item.status].fg },
                      ]}
                    >
                      {item.status === "uploaded" ? "Ready" : item.status}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[
                    styles.downloadBtn,
                    item.status !== "uploaded" && styles.downloadBtnDisabled,
                  ]}
                  onPress={() => void onOpen(item.id)}
                  disabled={item.status !== "uploaded"}
                >
                  <Text style={styles.downloadBtnText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    confirmAction({
                      title: "Delete this document?",
                      message: item.filename,
                      confirmLabel: "Delete",
                      destructive: true,
                      onConfirm: () => remove.mutate(item.id),
                    })
                  }
                  style={styles.deleteButton}
                  disabled={remove.isPending}
                >
                  <Text style={styles.deleteText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={pendingAsset !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !uploading && setPendingAsset(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Categorise this document</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {pendingAsset?.name ?? ""}
            </Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.categoryTile}
                  onPress={() => void finishUpload(opt.value)}
                  disabled={uploading}
                >
                  <Text style={styles.categoryTileIcon}>{opt.icon}</Text>
                  <Text style={styles.categoryTileLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {uploading ? (
              <View style={styles.modalBusy}>
                <ActivityIndicator color={palette.brand700} />
                <Text style={styles.modalBusyText}>Uploading…</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPendingAsset(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  errorBanner: {
    color: semantic.danger,
    padding: space[3],
    backgroundColor: "#FEE2E2",
    margin: space[4],
    marginBottom: 0,
    borderRadius: radius.md,
    fontSize: 13,
  },
  muted: { color: semantic.textMuted, fontSize: 14, textAlign: "center" },
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
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleText: { fontSize: 22 },
  rowMain: { flex: 1, gap: 4 },
  filename: {
    color: semantic.text,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  meta: { color: semantic.textMuted, fontSize: 12 },
  metaRow: { flexDirection: "row", marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  pillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  downloadBtn: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  downloadBtnDisabled: {
    backgroundColor: palette.slate400,
  },
  downloadBtnText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: space[4],
  },
  modalSheet: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: semantic.surface,
    borderRadius: radius.xl,
    padding: space[5],
    gap: space[3],
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: semantic.text,
  },
  modalSubtitle: { color: semantic.textMuted, fontSize: 13 },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
    marginTop: space[2],
  },
  categoryTile: {
    width: "48%",
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: semantic.bg,
    borderWidth: 1,
    borderColor: semantic.border,
    gap: 6,
  },
  categoryTileIcon: { fontSize: 22 },
  categoryTileLabel: {
    color: semantic.text,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  modalCancel: {
    marginTop: space[3],
    alignItems: "center",
    paddingVertical: 10,
  },
  modalCancelText: {
    color: semantic.textMuted,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  modalBusy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: space[3],
  },
  modalBusyText: { color: semantic.textMuted, fontSize: 13 },
});
