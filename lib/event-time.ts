const BAHRAIN_TZ = "Asia/Bahrain";

export function toBahrainInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BAHRAIN_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromBahrainInput(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  // datetime-local has no offset. Bahrain is UTC+03 year-round.
  return new Date(`${text}:00+03:00`).toISOString();
}

export function formatEventRange(start?: string | null, end?: string | null): string {
  if (!start) return "Date and time not set";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const dateText = new Intl.DateTimeFormat("en-GB", {
    timeZone: BAHRAIN_TZ, day: "2-digit", month: "short", year: "numeric"
  }).format(startDate);
  const time = (d: Date) => new Intl.DateTimeFormat("en-GB", {
    timeZone: BAHRAIN_TZ, hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
  return `${dateText} · ${time(startDate)}${endDate ? ` – ${time(endDate)}` : ""}`;
}
