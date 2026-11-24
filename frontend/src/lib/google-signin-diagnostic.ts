import { API_URL } from "./api";
export type GoogleSignInCategory = "developer_error" | "network_error" | "play_services_unavailable" | "in_progress" | "sign_in_required" | "cancelled" | "missing_id_token" | "other";
export function googleSignInCategory(error: unknown): GoogleSignInCategory {
  const code = error && typeof error === "object" && "code" in error ? String((error as {code?: unknown}).code).toUpperCase() : "";
  if (code === "10" || code === "DEVELOPER_ERROR") return "developer_error";
  if (code === "7" || code === "NETWORK_ERROR") return "network_error";
  if (code === "PLAY_SERVICES_NOT_AVAILABLE") return "play_services_unavailable";
  if (code === "IN_PROGRESS") return "in_progress";
  if (code === "SIGN_IN_REQUIRED") return "sign_in_required";
  if (code === "SIGN_IN_CANCELLED" || code === "12501") return "cancelled";
  if (code === "MISSING_ID_TOKEN") return "missing_id_token";
  return "other";
}
export function reportGoogleSignInError(error: unknown): void {
  const category = googleSignInCategory(error);
  if (category === "cancelled") return;
  // Deliberately sends no identifier, token, email or original error text.
  void fetch(`${API_URL}/auth/google/client-diagnostic`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category})}).catch(() => undefined);
}
export function withGoogleSignInCategory(error: unknown): Error {
  const result = new Error("Google sign-in failed");
  Object.assign(result, { googleAuthCategory: googleSignInCategory(error) });
  if (error && typeof error === "object" && "code" in error) Object.assign(result, { code: (error as {code?: unknown}).code });
  return result;
}
