import type { DayType } from "@prisma/client";

// All wall-clock computations use the server time zone (set TZ in .env, e.g. TZ=Indian/Reunion).

export const dayTypeOf = (date: Date): DayType => {
  const day = date.getDay();
  return day === 0 ? "SUNDAY" : day === 6 ? "SATURDAY" : "WEEKDAY";
};

// "HH:MM" in local time
export const toHHMM = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const minutesToHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// F39: unambiguous, human-readable slot label, e.g. "jeudi 8 octobre 2026, 09:00 – 09:30"
export const formatSlotLabel = (start: Date, end: Date, locale = "fr") => {
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(start);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time.format(start)} – ${time.format(end)}`;
};

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// iCalendar UTC timestamp: 20261008T070000Z
export const toIcsDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
