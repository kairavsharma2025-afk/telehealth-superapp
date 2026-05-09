import { useMemo, useState, type ReactNode } from "react";
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
        <Alert>Failed to load: {query.error.message}</Alert>
      ) : null}
      {openMutation.isError ? (
        <Alert>Could not fetch download URL: {openMutation.error.message}</Alert>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        {query.isPending ? (
          <div className="px-5 py-12 text-center text-[13px] text-ink-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
              </svg>
            }
            title="No patient documents yet"
            description="Documents your patients share will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-[#FBFCFD]">
                  <Th>Uploaded</Th>
                  <Th>Patient</Th>
                  <Th>File</Th>
                  <Th>Category</Th>
                  <Th>Size</Th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const owner = ownerLookup.get(u.ownerUserId);
                  const isOpening = openingId === u.id && openMutation.isPending;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border last:border-b-0 transition hover:bg-[#FBFCFD]"
                    >
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted tabular-nums">
                        {dateFmt.format(new Date(u.createdAt))}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {displayName(u.ownerUserId, owner, "patient")}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        <span className="inline-flex items-center gap-2">
                          <FileIcon />
                          <span className="truncate max-w-[280px]">{u.filename}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted">
                        {u.category ? CATEGORY_LABEL[u.category] ?? u.category : "—"}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-muted tabular-nums">
                        {formatSize(u.sizeBytes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          disabled={isOpening}
                          onClick={() => {
                            setOpeningId(u.id);
                            openMutation.mutate(u.id);
                          }}
                          className="rounded-md border border-border bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink transition hover:bg-[#F6F8FA] disabled:opacity-60"
                        >
                          {isOpening ? "Opening…" : "Open"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </th>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-danger/20 bg-danger-subtle px-3.5 py-2.5 text-[13px] text-danger">
      {children}
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className="flex-shrink-0 text-ink-subtle" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
    </svg>
  );
}
