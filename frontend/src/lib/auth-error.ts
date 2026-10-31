import type { Language } from "@/types";

export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return ["network_unavailable", "connection_unavailable", "NETWORK_ERROR", "7"].includes(String(code)) ||
    (typeof message === "string" && /network error|network request failed|failed to fetch|ERR_INTERNET_DISCONNECTED|unable to resolve host|no internet connection/i.test(message));
}

export const authErrorCopy: Record<Language, { connectionTitle: string; connectionBody: string; title: string; body: string; retry: string; close: string }> = {
  ru: { connectionTitle: "Нет соединения", connectionBody: "Проверьте Wi-Fi или мобильный интернет и попробуйте ещё раз.", title: "Не удалось войти", body: "Попробуйте ещё раз чуть позже или выберите другой способ входа.", retry: "Повторить", close: "Закрыть" },
  uz: { connectionTitle: "Ulanish yo‘q", connectionBody: "Wi-Fi yoki mobil internetni tekshiring va qayta urinib ko‘ring.", title: "Kirish amalga oshmadi", body: "Birozdan so‘ng qayta urinib ko‘ring yoki boshqa kirish usulini tanlang.", retry: "Qayta urinish", close: "Yopish" },
  en: { connectionTitle: "No connection", connectionBody: "Check Wi-Fi or mobile data, then try again.", title: "Couldn’t sign in", body: "Try again in a moment or choose another sign-in method.", retry: "Try again", close: "Close" },
};

// Check our own public endpoint before opening Google's native account UI.
// Unreachable service is not proof that the device's internet is switched off.
export async function checkAuthConnection(apiUrl: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${apiUrl}/health`, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw Object.assign(new Error("Service unavailable"), { code: "service_unavailable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "service_unavailable") throw error;
    throw Object.assign(new Error("Connection unavailable"), { code: "connection_unavailable" });
  } finally { clearTimeout(timer); }
}
