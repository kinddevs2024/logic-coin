export function youtubeVideoId(value: string): string | null {
  try { const u = new URL(value); if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    const id = host === "youtu.be" ? u.pathname.slice(1) : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host) ? u.searchParams.get("v") ?? u.pathname.match(/^\/(?:live|embed)\/([^/]+)\/?$/)?.[1] : null;
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export function countdownMilestone(startsAt: Date, now: Date): number | null {
  const seconds = Math.ceil((startsAt.getTime() - now.getTime()) / 1000);
  return seconds > 0 && (seconds <= 10 || seconds <= 60 && seconds % 10 === 0) ? seconds : null;
}
export function raffleEligible(days: readonly string[], allowedDays: readonly string[], lastSeenAt: Date, now: Date): boolean {
  return new Set(days.filter(day => allowedDays.includes(day))).size >= 6 && lastSeenAt.getTime() >= now.getTime() - 20000 && lastSeenAt <= now;
}
