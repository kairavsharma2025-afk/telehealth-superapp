import { Layout } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";

export function DocumentsPage() {
  return (
    <Layout title="Documents" meta={<span>Read-only · Phase 7</span>}>
      <div className="card">
        <EmptyState
          icon={
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />
            </svg>
          }
          title="Patient documents — coming with Phase 7"
          description={
            "Patients upload labs, prescriptions, and imaging from the mobile " +
            "app. Surfacing them on the doctor side needs an explicit sharing " +
            "model (link uploads to an appointment, gate access by role) — " +
            "shipping with the cloud rollout."
          }
        />
      </div>
    </Layout>
  );
}
