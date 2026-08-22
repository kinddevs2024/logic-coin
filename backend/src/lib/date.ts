const DAY_MS = 86_400_000;

export interface GraceStreak {
  activeDays: number;
  calendarSpanDays: number;
  graceDaysUsed: number;
  lastActiveDay: string | null;
}

function partsInTimeZone(date: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDayKey(date: Date, timeZone: string): string {
  const parts = partsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partsInTimeZone(date, timeZone);
  const hours = Number(parts.hour ?? 0);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hours === 24 ? 0 : hours,
    Number(parts.minute ?? 0),
    Number(parts.second ?? 0)
  );
  return asUtc - date.getTime();
}

export function dayBoundsInTimeZone(
  dayKey: string,
  timeZone: string
): { from: Date; to: Date } {
  const day = parseDayKey(dayKey);
  const nextDay = parseDayKey(addDays(dayKey, 1));
  const convert = (value: Date) => {
    let timestamp = value.getTime();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      timestamp = value.getTime() - timeZoneOffsetMs(new Date(timestamp), timeZone);
    }
    return new Date(timestamp);
  };
  return { from: convert(day), to: convert(nextDay) };
}

export function parseDayKey(dayKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    throw new Error(`Invalid day key: ${dayKey}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid day key: ${dayKey}`);
  }
  return date;
}

export function addDays(dayKey: string, amount: number): string {
  const date = parseDayKey(dayKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromDayKey: string, toDayKey: string): number {
  return Math.round((parseDayKey(toDayKey).getTime() - parseDayKey(fromDayKey).getTime()) / DAY_MS);
}

export function isoWeekKey(dayKey: string): string {
  const date = parseDayKey(dayKey);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${week.toString().padStart(2, "0")}`;
}

export function monthKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function currentWeekBounds(dayKey: string): { from: string; to: string } {
  const date = parseDayKey(dayKey);
  const weekday = date.getUTCDay() || 7;
  return {
    from: addDays(dayKey, 1 - weekday),
    to: addDays(dayKey, 7 - weekday)
  };
}

export function currentMonthBounds(dayKey: string): { from: string; to: string } {
  const date = parseDayKey(dayKey);
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

/**
 * Counts a streak backwards from today. One missing calendar day is allowed
 * in each ISO week. Today is treated as still available until it is active.
 */
export function calculateGraceStreak(activeDayKeys: readonly string[], todayDayKey: string): GraceStreak {
  const active = new Set(activeDayKeys.filter((day) => day <= todayDayKey));
  if (active.size === 0) {
    return { activeDays: 0, calendarSpanDays: 0, graceDaysUsed: 0, lastActiveDay: null };
  }

  const sorted = [...active].sort();
  const lastActiveDay = sorted[sorted.length - 1] ?? null;
  if (!lastActiveDay) {
    return { activeDays: 0, calendarSpanDays: 0, graceDaysUsed: 0, lastActiveDay: null };
  }

  let cursor = active.has(todayDayKey) ? todayDayKey : addDays(todayDayKey, -1);
  if (lastActiveDay < cursor && daysBetween(lastActiveDay, cursor) > 1) {
    cursor = lastActiveDay;
  }

  const missesByWeek = new Map<string, number>();
  let activeDays = 0;
  let calendarSpanDays = 0;
  let graceDaysUsed = 0;
  const earliest = sorted[0]!;

  while (cursor >= earliest) {
    if (active.has(cursor)) {
      activeDays += 1;
    } else {
      const week = isoWeekKey(cursor);
      const misses = (missesByWeek.get(week) ?? 0) + 1;
      if (misses > 1) {
        break;
      }
      missesByWeek.set(week, misses);
      graceDaysUsed += 1;
    }
    calendarSpanDays += 1;
    cursor = addDays(cursor, -1);
  }

  return { activeDays, calendarSpanDays, graceDaysUsed, lastActiveDay };
}
