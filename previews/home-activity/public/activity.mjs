const DAY = 86400000;
export const LIMITS = { week: 2, month: 4 };
export const dayKey = now => new Date(+now + 5 * 3600000).toISOString().slice(0, 10);
export const dayStart = key => Date.parse(key + 'T00:00:00+05:00');
export const addDays = (key, count) => dayKey(dayStart(key) + count * DAY);
export function periodBounds(kind, today) {
  const date = new Date(today + 'T12:00:00Z');
  if (kind === 'week') {
    const start = addDays(today, -((date.getUTCDay() + 6) % 7));
    return { start, next: addDays(start, 7), days: 7 };
  }
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  return { start: `${today.slice(0, 7)}-01`, next: new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10), days: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() };
}
export function activity(kind, now, completedDays) {
  const today = dayKey(now), bounds = periodBounds(kind, today), completed = new Set(completedDays);
  const closedDays = Math.round((dayStart(today) - dayStart(bounds.start)) / DAY);
  const cells = Array.from({ length: bounds.days }, (_, index) => {
    const key = addDays(bounds.start, index);
    return { key, state: completed.has(key) && key <= today ? 'complete' : key < today ? 'missed' : key === today ? 'today' : 'future' };
  });
  const misses = cells.filter(cell => cell.state === 'missed').length;
  const done = cells.filter(cell => cell.state === 'complete').length;
  return { ...bounds, end: dayStart(bounds.next), today, closedDays, misses, done, limit: LIMITS[kind], left: Math.max(0, LIMITS[kind] - misses), eligible: misses <= LIMITS[kind], cells, required: bounds.days - LIMITS[kind] };
}
export function scenario(name, realNow = Date.now()) {
  const realDay = dayKey(realNow), realWeek = periodBounds('week', realDay);
  let key = realDay, weekMisses = 0, monthMisses = 1;
  if (name === 'first-day') { key = realWeek.start; monthMisses = 0; }
  if (['week-limit', 'week-out', 'month-limit', 'both-out'].includes(name)) {
    // Use a Friday after the 8th so both counters have enough CLOSED days.
    key = realDay.slice(0, 7) + '-08';
    while (new Date(key + 'T12:00Z').getUTCDay() !== 5) key = addDays(key, 1);
    weekMisses = name === 'week-limit' || name === 'month-limit' ? 2 : 3;
    monthMisses = name === 'both-out' ? 5 : name === 'month-limit' ? 4 : weekMisses;
  }
  if (name === 'new-week') {
    key = realDay.slice(0, 7) + '-15';
    while (new Date(key + 'T12:00Z').getUTCDay() !== 1) key = addDays(key, 1);
    monthMisses = 5;
  }
  const now = name === 'active' ? +realNow : dayStart(key) + 12 * 3600000;
  const week = periodBounds('week', key), month = periodBounds('month', key);
  const start = week.start < month.start ? week.start : month.start;
  const closed = [];
  for (let cursor = start; cursor < key; cursor = addDays(cursor, 1)) closed.push(cursor);
  const weekDays = closed.filter(day => day >= week.start);
  const missed = new Set(weekDays.slice(-weekMisses || weekDays.length));
  // A week may cross a month boundary: only misses in this month affect it.
  const outsideWeek = closed.filter(day => day >= month.start && day < week.start);
  for (const day of outsideWeek) {
    if ([...missed].filter(day => day >= month.start).length >= monthMisses) break;
    missed.add(day);
  }
  return { now, completedDays: closed.filter(day => !missed.has(day)), demoDate: name !== 'active' };
}
export function remaining(end, now) {
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
