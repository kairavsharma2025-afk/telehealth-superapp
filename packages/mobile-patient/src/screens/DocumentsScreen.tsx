import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { FileTextIcon } from "../components/Icons";

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

// Soft pastel + deeper-shade-icon palette per document category. Used
// for the 40×40 file-type tile shown next to each document row.
const CATEGORY_TILE: Record<
  Category,
  { bg: string; fg: string }
> = {
  lab_report:   { bg: "#DCFCE7", fg: "#16A34A" },
  prescription: { bg: "#DBEAFE", fg: "#2563EB" },
  imaging:      { bg: "#EDE9FE", fg: "#7C3AED" },
  insurance:    { bg: "#FEF3C7", fg: "#CA8A04" },
  other:        { bg: "#F1F5F9", fg: "#64748B" },
};

function categoryTile(category: Category | null) {
  return CATEGORY_TILE[category ?? "other"];
}

// Stored filenames are sometimes raw timestamps from older flows
// (e.g. "test-document-1778220473288.png"). When that's the case,
// surface a human-readable "<Category> – <Date>" instead. Real
// filenames (with letters and meaning) pass through untouched.
function friendlyName(
  filename: string,
  category: Category | null,
  createdAt: string,
): string {
  const isTimestampJunk = /^test-document-\d{13}\.\w+$/i.test(filename);
  if (!isTimestampJunk) return filename;
  const label = category ? CATEGORY_LABEL[category] : "Document";
  const when = new Date(createdAt).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${label} – ${when}`;
}

const CATEGORY_BADGE_COLOR: Record<Category, string> = {
  lab_report: "#0891b2",
  prescription: "#7c3aed",
  imaging: "#dc2626",
  insurance: "#16a34a",
  other: "#64748b",
};

type FilterKey = "all" | "lab_report" | "prescription" | "imaging";

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lab_report", label: "Lab Reports" },
  { key: "prescription", label: "Prescriptions" },
  { key: "imaging", label: "Imaging" },
];

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
  const [filter, setFilter] = useState<FilterKey>("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const allItems = list.data?.items ?? [];
  const items =
    filter === "all"
      ? allItems
      : allItems.filter((u) => u.category === filter);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Documents"
        subtitle="Lab reports, prescriptions, and other care files."
        trailing={
          <TouchableOpacity
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel="Upload a new document"
            onPress={() => void pickFile()}
            disabled={uploading}
          >
            <Text style={styles.addButtonText}>+ Upload</Text>
          </TouchableOpacity>
        }
      />

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* Type filter bar */}
      <View style={styles.filterRow}>
        {FILTER_PILLS.map((p) => {
          const active = filter === p.key;
          const count =
            p.key === "all"
              ? allItems.length
              : allItems.filter((u) => u.category === p.key).length;
          return (
            <TouchableOpacity
              key={p.key}
              accessibilityRole="button"
              accessibilityLabel={`${p.label} (${count})`}
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(p.key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  active && styles.filterPillTextActive,
                ]}
              >
                {p.label} · {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
          <View style={styles.emptyCircle}>
            <Text style={styles.emptyEmoji}>📄</Text>
          </View>
          <Text style={styles.emptyTitle}>
            {filter === "all"
              ? "No documents yet"
              : `No ${FILTER_PILLS.find((p) => p.key === filter)?.label.toLowerCase() ?? "documents"} here`}
          </Text>
          <Text style={styles.emptySub}>
            {filter === "all"
              ? "Lab reports, prescriptions, and imaging files you share will appear here."
              : "Try switching the filter to “All” or upload a new file."}
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            accessibilityRole="button"
            accessibilityLabel="Upload your first document"
            onPress={() => void pickFile()}
            disabled={uploading}
          >
            <Text style={styles.emptyCtaText}>+ Upload a document</Text>
          </TouchableOpacity>
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
          renderItem={({ item }) => {
            const display = friendlyName(item.filename, item.category, item.createdAt);
            const typeLabel = item.category ? CATEGORY_LABEL[item.category] : "Other";
            const typeColor = item.category
              ? CATEGORY_BADGE_COLOR[item.category]
              : CATEGORY_BADGE_COLOR.other;
            const isImage =
              item.contentType.startsWith("image/") && item.status === "uploaded";
            return (
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: categoryTile(item.category).bg },
                  ]}
                >
                  <FileTextIcon
                    size={22}
                    color={categoryTile(item.category).fg}
                  />
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.filename} numberOfLines={1}>
                    {display}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View
                      style={[styles.typeBadge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}
                    >
                      <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                        {typeLabel}
                      </Text>
                    </View>
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
                  <Text style={styles.meta} numberOfLines={1}>
                    {formatSize(item.sizeBytes)} · {formatWhen(item.createdAt)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {isImage ? (
                    <TouchableOpacity
                      style={[styles.downloadBtn, styles.previewBtn]}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview ${display}`}
                      onPress={async () => {
                        try {
                          const detail = await api<DetailResponse>(
                            `/uploads/${item.id}`,
                          );
                          if (detail.downloadUrl) setPreviewUrl(detail.downloadUrl);
                        } catch (err: unknown) {
                          setError(
                            err instanceof Error ? err.message : "Preview failed",
                          );
                        }
                      }}
                    >
                      <Text style={styles.previewBtnText}>Preview</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.downloadBtn,
                      item.status !== "uploaded" && styles.downloadBtnDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${display}`}
                    onPress={() => void onOpen(item.id)}
                    disabled={item.status !== "uploaded"}
                  >
                    <Text style={styles.downloadBtnText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${display}`}
                    onPress={() =>
                      confirmAction({
                        title: "Delete this document?",
                        message:
                          "Are you sure you want to delete this document? This cannot be undone.",
                        confirmLabel: "Delete",
                        destructive: true,
                        onConfirm: () => remove.mutate(item.id),
                      })
                    }
                    style={styles.deleteButton}
                    disabled={remove.isPending}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
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

      {/* Image preview lightbox */}
      <Modal
        visible={previewUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={styles.previewClose}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={() => setPreviewUrl(null)}
          >
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
              accessibilityLabel="Document preview"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg },
  addButton: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
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
    width: 40,
    height: 40,
    borderRadius: 10, // rounded square per spec
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleText: { fontSize: 20 },
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: {
    color: semantic.danger,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 50,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: semantic.border,
  },
  filterPillActive: {
    backgroundColor: palette.brand700,
    borderColor: palette.brand700,
  },
  filterPillText: {
    color: semantic.textMuted,
    fontSize: 13,
    fontWeight: fontWeight.medium,
  },
  filterPillTextActive: { color: palette.white },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 4,
    flexWrap: "wrap",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
  },
  previewBtn: {
    backgroundColor: palette.brand50,
  },
  previewBtnText: {
    color: palette.brand800,
    fontSize: 12,
    fontWeight: fontWeight.semibold,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.brand50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    color: semantic.text,
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    marginBottom: 8,
  },
  emptySub: {
    color: semantic.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyCta: {
    backgroundColor: palette.brand700,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  emptyCtaText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewClose: {
    position: "absolute",
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  previewCloseText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: fontWeight.bold,
  },
  previewImage: {
    width: "90%",
    height: "85%",
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
