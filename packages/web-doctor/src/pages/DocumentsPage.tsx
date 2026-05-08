import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { api, ApiError } from "../lib/api";
import { displayName } from "../lib/queries";
import { useLookup } from "../lib/useLookup";

type UploadStatus = "pending" | "uploaded" | "deleted";

interface UploadRow {
  id: string;
  ownerUserId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: UploadStatus;
  category: string | null;
  createdAt: string;
}

interface ListResult {
  items: UploadRow[];
}

interface DownloadResult extends UploadRow {
  downloadUrl: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  lab_report: "Lab report",
  prescription: "Prescription",
  imaging: "Imaging",
  insurance: "Insurance",
  other: "Other",
};

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fetchDownloadUrl(id: string): Promise<DownloadResult> {
  return api<DownloadResult>(`/uploads/${id}`);
}

export function DocumentsPage() {
  const [openingId, setOpeningId] = useState<string | null>(null);

  const query = useQuery<ListResult, ApiError>({
    queryKey: ["uploads"],
    queryFn: () => api<ListResult>("/uploads"),
  });

  const items = query.data?.items ?? [];
  const visible = useMemo(
    () => items.filter((u) => u.status === "uploaded"),
    [items],
  );

  const ownerLookup = useLookup(visible.map((u) => u.ownerUserId));

  const openMutation = useMutation<DownloadResult, ApiError, string>({
    mutationFn: (id) => fetchDownloadUrl(id),
    onSuccess: (data) => {
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank", "noopener");
      setOpeningId(null);
    },
    onError: () => setOpeningId(null),
  });

  return (
    <Layout
      title="Documents"
      meta={<span>{visible.length} shared by patients</span>}
    >
      {query.isError ? (
        <div className="alert alert-error">
          Failed to load: {query.error.message}
        </div>
      ) : null}
      {openMutation.isError ? (
        <div className="alert alert-error">
          Could not fetch download URL: {openMutation.error.message}
        </div>
      ) : null}

      <div className="card">
        {query.isPending ? (
          <div className="muted" style={{ padding: 24 }}>
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
              </svg>
            }
            title="No patient documents yet"
            description="Documents your patients share will appear here."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Uploaded</th>
                <th>Patient</th>
                <th>File</th>
                <th>Category</th>
                <th>Size</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const owner = ownerLookup.get(u.ownerUserId);
                const isOpening = openingId === u.id && openMutation.isPending;
                return (
                  <tr key={u.id}>
                    <td>{dateFmt.format(new Date(u.createdAt))}</td>
                    <td>{displayName(u.ownerUserId, owner, "patient")}</td>
                    <td>{u.filename}</td>
                    <td className="muted">
                      {u.category ? CATEGORY_LABEL[u.category] ?? u.category : "—"}
                    </td>
                    <td className="muted">{formatSize(u.sizeBytes)}</td>
                    <td className="actions">
                      <button
                        disabled={isOpening}
                        onClick={() => {
                          setOpeningId(u.id);
                          openMutation.mutate(u.id);
                        }}
                      >
                        {isOpening ? "Opening…" : "Open"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
