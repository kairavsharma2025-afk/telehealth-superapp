import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brand } from "@telehealth/design";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Layout } from "../components/Layout";
import { useToast } from "../lib/toast";

interface Profile {
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
}

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
    return profile.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }
  return email?.charAt(0).toUpperCase() ?? "?";
}

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery<Profile, ApiError>({
    queryKey: ["me"],
    queryFn: fetchProfile,
    staleTime: 60_000,
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  useEffect(() => {
    if (query.data) {
      setFullName(query.data.fullName ?? "");
      setPhone(query.data.phone ?? "");
      setDateOfBirth(query.data.dateOfBirth ?? "");
    }
  }, [query.data]);

  const dirty = useMemo(() => {
    if (!query.data) return false;
    return (
      fullName !== (query.data.fullName ?? "") ||
      phone !== (query.data.phone ?? "") ||
      dateOfBirth !== (query.data.dateOfBirth ?? "")
    );
  }, [query.data, fullName, phone, dateOfBirth]);

  const save = useMutation<Profile, ApiError>({
    mutationFn: () =>
      saveProfile({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      toast.push({ tone: "success", title: "Profile saved." });
    },
    onError: (err) => {
      toast.push({
        tone: "error",
        title: "Couldn't save",
        description: err.message,
      });
    },
  });

  const initials = initialsFor(
    query.data ?? { fullName: null, phone: null, dateOfBirth: null },
    user?.email,
  );
  const displayName = query.data?.fullName ?? user?.email?.split("@")[0] ?? "Doctor";

  return (
    <Layout title="Profile">
      <div className="identity-card">
        <div className="avatar">{initials}</div>
        <div>
          <div className="who">Dr. {displayName}</div>
          <div className="email">{user?.email ?? "—"}</div>
          <span className="role-pill">{user?.role ?? "doctor"}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>Your details</h2>
          <span className="muted">Visible to patients you see.</span>
        </div>
        <div className="card-pad">
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>
          <div className="field">
            <label htmlFor="dob">Date of birth</label>
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2>About</h2>
        </div>
        <div className="card-pad">
          <dl className="prop-list">
            <dt>Product</dt>
            <dd>{brand.name}</dd>
            <dt>Tagline</dt>
            <dd>{brand.tagline}</dd>
            <dt>Version</dt>
            <dd>0.1.0</dd>
            <dt>Support</dt>
            <dd>
              <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
            </dd>
          </dl>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Session</h2>
        </div>
        <div className="card-pad row-spread">
          <div>
            <div style={{ fontWeight: 600 }}>Sign out of the doctor console</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              You&apos;ll need to sign in again to access patients and
              appointments.
            </div>
          </div>
          <a
            href="/signout.html"
            className="btn btn-danger"
            style={{ textDecoration: "none" }}
          >
            Sign out
          </a>
        </div>
      </div>
    </Layout>
  );
}
