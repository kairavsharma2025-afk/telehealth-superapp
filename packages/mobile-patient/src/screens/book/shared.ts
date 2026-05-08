import type { StyleProp, ViewStyle } from "react-native";

// Shared types + helpers for the 3-step Book a Doctor wizard.

// Pressable's style callback type doesn't include `hovered` because RN
// itself doesn't have hover. react-native-web does — reading it
// defensively keeps both runtimes happy and TS quiet.
export function hoverable(
  build: (hovered: boolean) => StyleProp<ViewStyle>,
): (state: object) => StyleProp<ViewStyle> {
  return (state) => {
    const hovered =
      "hovered" in state && (state as { hovered?: boolean }).hovered === true;
    return build(hovered);
  };
}

export type Step = 1 | 2 | 3;

export type Duration = 30 | 45 | 60;

export type AppointmentType = "in_person" | "video";

export interface Specialty {
  key: string;
  name: string;
  description: string;
  iconKey: SpecialtyIconKey;
}

export type SpecialtyIconKey =
  | "stethoscope"
  | "heart"
  | "skin"
  | "baby"
  | "brain"
  | "bone"
  | "female"
  | "ear";

export const SPECIALTIES: readonly Specialty[] = [
  {
    key: "General Medicine",
    name: "General Medicine",
    description: "Everyday checkups, common illness, referrals",
    iconKey: "stethoscope",
  },
  {
    key: "Cardiology",
    name: "Cardiology",
    description: "Heart & circulatory system",
    iconKey: "heart",
  },
  {
    key: "Dermatology",
    name: "Dermatology",
    description: "Skin, hair & nails",
    iconKey: "skin",
  },
  {
    key: "Pediatrics",
    name: "Pediatrics",
    description: "Babies, kids & adolescents",
    iconKey: "baby",
  },
  {
    key: "Psychiatry",
    name: "Psychiatry",
    description: "Mental health & behavioral wellness",
    iconKey: "brain",
  },
  {
    key: "Orthopedics",
    name: "Orthopedics",
    description: "Bones, joints & sports injury",
    iconKey: "bone",
  },
  {
    key: "Gynecology",
    name: "Gynecology",
    description: "Women's health & reproductive care",
    iconKey: "female",
  },
  {
    key: "ENT",
    name: "ENT",
    description: "Ear, nose, throat & sinus",
    iconKey: "ear",
  },
];

export interface AvailableDoctor {
  id: string;
  fullName: string | null;
  specialty: string | null;
  // Server returns one suggested slot; we expand it client-side into
  // up to 4 candidate slots (suggested + offsets) so the UI can show
  // multiple time options on the doctor card.
  suggestedStartAt: string;
  suggestedEndAt: string;
}

export interface DoctorSlot {
  startAt: string; // ISO
  endAt: string; // ISO
}

export interface AvailabilityResult {
  items: AvailableDoctor[];
}

export interface CreatedAppointment {
  id: string;
  startAt: string;
  endAt: string;
}

// Title-case a name. Reused across all 3 steps so doctors render
// consistently as "Dr. Aarav Sharma" everywhere.
export function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function doctorDisplayName(d: { fullName: string | null; id: string }): string {
  if (d.fullName?.trim()) return `Dr. ${titleCase(d.fullName.trim())}`;
  return `Doctor #${d.id.slice(0, 8)}`;
}

export function initialsOf(name: string): string {
  return name
    .replace(/^Dr\.\s+/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// Deterministic fake data keyed off doctor id — keeps the UI feeling
// real (different ratings, years, bios per doctor) without needing a
// reviews/profiles backend. Replace when those APIs ship.
export function fakeStatsFor(id: string): {
  rating: number;
  reviews: number;
  years: number;
  tagline: string;
  feeUsd: number;
  avatarColor: string;
} {
  const hash = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const rating = 4.2 + ((hash % 8) / 10); // 4.2 — 4.9
  const reviews = 40 + (hash % 360); // 40 — 400
  const years = 3 + (hash % 22); // 3 — 25
  const taglines = [
    "Patient-first, evidence-led care.",
    "Quietly thorough — never rushed.",
    "Big on prevention, small on jargon.",
    "Listens carefully, explains clearly.",
    "Calm, considered, second-opinion ready.",
    "Plain English, plain action plans.",
    "Long-term care for whole-family health.",
    "Spends the time the textbook didn't budget for.",
  ];
  const colors = ["#1a7a6b", "#4f46e5", "#dc2626", "#ea580c", "#7c3aed", "#0891b2", "#16a34a", "#ca8a04"];
  const fees = [40, 50, 60, 75, 90, 110, 125];
  return {
    rating: Math.round(rating * 10) / 10,
    reviews,
    years,
    tagline: taglines[hash % taglines.length] ?? taglines[0]!,
    feeUsd: fees[hash % fees.length]!,
    avatarColor: colors[hash % colors.length]!,
  };
}

// Clinic-hours window the patient UI restricts itself to. Server
// availability ignores hours of the day (the seed scatters
// appointments across all 24h), so without this clamp the slot pills
// would offer 11 PM / 1 AM / 3 AM bookings — clearly not real.
const BUSINESS_HOUR_START = 9; // 9:00 AM
const BUSINESS_HOUR_END = 18; // 6:00 PM (last accepted START)

// Snap a Date to the next moment that lies within business hours.
// If it's already in-window we return it unchanged; before 9 AM bumps
// to 9 AM same day; at/after 6 PM bumps to 9 AM next day.
function clampToBusinessHours(d: Date): Date {
  const out = new Date(d);
  const hour = out.getHours();
  if (hour < BUSINESS_HOUR_START) {
    out.setHours(BUSINESS_HOUR_START, 0, 0, 0);
  } else if (hour >= BUSINESS_HOUR_END) {
    out.setDate(out.getDate() + 1);
    out.setHours(BUSINESS_HOUR_START, 0, 0, 0);
  }
  return out;
}

// Expand the server's single suggested slot into up to 4 candidate
// slots offset by 60/120/180 min, all clamped to clinic hours
// (9 AM – 6 PM). The `bookAppointment` API will still validate
// against real availability when the user submits.
export function expandSlots(d: AvailableDoctor, duration: Duration): DoctorSlot[] {
  const base = clampToBusinessHours(new Date(d.suggestedStartAt));
  const offsets = [0, 60, 120, 180];
  const slots: DoctorSlot[] = [];
  for (const min of offsets) {
    const s = new Date(base.getTime() + min * 60_000);
    // If the offset pushes past 6 PM, drop it rather than offer a
    // late-evening slot. Better to show 2 valid options than 4 with
    // bogus midnight times.
    if (s.getHours() >= BUSINESS_HOUR_END) continue;
    const e = new Date(s.getTime() + duration * 60_000);
    slots.push({ startAt: s.toISOString(), endAt: e.toISOString() });
  }
  return slots;
}

export const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const longDateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

export const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
