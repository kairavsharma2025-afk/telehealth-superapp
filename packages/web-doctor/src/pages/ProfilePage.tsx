import { useEffect, useMemo, useState, type ReactNode } from "react";
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

  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  const save = useMutation<Profile, ApiError>({
    mutationFn: () =>
      saveProfile({
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth.trim() || null,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["me"], data);
      setJustSaved(true);
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

  const saveLabel = save.isPending
    ? "Saving…"
    : justSaved
      ? "Saved ✓"
      : "Save changes";

  const initials = initialsFor(
    query.data ?? { fullName: null, phone: null, dateOfBirth: null },
    user?.email,
  );
  const displayName = query.data?.fullName ?? user?.email?.split("@")[0] ?? "Doctor";

  return (
    <Layout title="Profile">
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-[16px] font-semibold text-brand-800">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-semibold tracking-tight text-ink">
            Dr. {displayName}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-ink-muted">
            {user?.email ?? "—"}
          </div>
          <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-emerald-700 ring-1 ring-emerald-200">
            {user?.role ?? "doctor"}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader title="Your details" hint="Visible to patients you see." />
        <div className="space-y-4 p-5">
          <Field id="fullName" label="Full name">
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Aarav Sharma"
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            />
          </Field>
          <Field id="phone" label="Phone">
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-subtle outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            />
          </Field>
          <Field id="dob" label="Date of birth">
            <input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="block w-full rounded-md border border-border bg-white px-3 py-2 text-[14px] text-ink outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-500/15"
            />
          </Field>
          <button
            onClick={() => save.mutate()}
            disabled={(!dirty && !justSaved) || save.isPending}
            className="rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLabel}
          </button>
        </div>
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader title="About" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-5 text-[13px] sm:grid-cols-[120px_1fr]">
            <Dt>Product</Dt>
            <Dd>{brand.name}</Dd>
            <Dt>Tagline</Dt>
            <Dd>{brand.tagline}</Dd>
            <Dt>Version</Dt>
            <Dd>0.1.0</Dd>
            <Dt>Support</Dt>
            <Dd>
              <a
                href={`mailto:${brand.supportEmail}`}
                className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
              >
                {brand.supportEmail}
              </a>
            </Dd>
          </dl>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader title="Session" />
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-[13.5px] font-semibold text-ink">
                Sign out of the doctor console
              </div>
              <div className="mt-1 text-[12.5px] text-ink-muted">
                You&apos;ll need to sign in again to access patients and appointments.
              </div>
            </div>
            <a
              href="/signout.html"
              className="rounded-md border border-rose-200 bg-white px-3.5 py-2 text-[13px] font-medium text-rose-700 transition hover:bg-rose-50"
            >
              Sign out
            </a>
          </div>
        </Card>
      </div>
    </Layout>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
      {children}
    </div>
  );
}

function CardHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border px-5 py-3.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      {hint ? <span className="text-[12px] text-ink-muted">{hint}</span> : null}
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

function Dt({ children }: { children: ReactNode }) {
  return (
    <dt className="text-[11.5px] font-medium uppercase tracking-wider text-ink-subtle">
      {children}
    </dt>
  );
}
function Dd({ children }: { children: ReactNode }) {
  return <dd className="text-ink">{children}</dd>;
}
