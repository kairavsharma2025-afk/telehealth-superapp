// Minimal RFC 5545 .ics generator for "Add to Calendar". Web triggers
// a download via Blob + anchor click; native falls back to a data URL
// open through Linking. We only emit the few fields a patient needs —
// no recurrence rules, no attendees, no reminders.

import { Linking, Platform } from "react-native";

interface IcsInput {
  uid: string;
  startAt: string; // ISO
  endAt: string; // ISO
  title: string;
  description?: string;
  location?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// 2026-05-08T14:30:00.000Z → 20260508T143000Z (UTC, no separators).
function toIcsDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(input: IcsInput): string {
  const dtstamp = toIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vela Health//Patient Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@velahealth`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsDate(input.startAt)}`,
    `DTEND:${toIcsDate(input.endAt)}`,
    `SUMMARY:${escape(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escape(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escape(input.location)}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

// Trigger a download (web) or hand the URL off to the system (native).
export function downloadIcs(filename: string, ics: string): void {
  if (Platform.OS === "web") {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    return;
  }
  // Native — open as a data URL so the OS calendar import sheet appears.
  const dataUrl =
    "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
  void Linking.openURL(dataUrl);
}
