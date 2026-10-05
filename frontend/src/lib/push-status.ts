export type PushStatus = "idle" | "disabled" | "permission" | "denied" | "unsupported" | "setup_required" | "error" | "ready";
let status: PushStatus = "idle";
const listeners = new Set<() => void>();
export const getPushStatus = () => status;
export const subscribePushStatus = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function setPushStatus(next: PushStatus) {
  if (next !== status) { status = next; listeners.forEach(listener => listener()); }
}
