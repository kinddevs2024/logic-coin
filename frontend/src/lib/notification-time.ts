export function formatNotificationTime(value: string, options: {
  now?: Date; language?: "ru" | "en" | "uz"; uses24hourClock?: boolean | null;
} = {}) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const now = options.now ?? new Date();
  const language = options.language ?? "ru";
  const uses24 = options.uses24hourClock ?? !new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
  const hours = date.getHours();
  const time = `${uses24 ? String(hours).padStart(2, "0") : hours % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}${uses24 ? "" : hours < 12 ? " AM" : " PM"}`;
  // Compare local calendar days, not 24-hour durations (DST and midnight).
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;
  const days = day(now) - day(date);
  if (days === 0) return time;
  const labels = { ru: "Вчера", en: "Yesterday", uz: "Kecha" };
  if (days === 1) return `${labels[language]}, ${time}`;
  const parts = new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }).formatToParts(date);
  const calendarDate = `${date.getDate()} ${parts.find(part => part.type === "month")?.value ?? ""}`;
  return `${calendarDate}${date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ""}, ${time}`;
}
