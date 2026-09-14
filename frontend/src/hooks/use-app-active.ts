import { useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";

function subscribe(callback: () => void) {
  if (Platform.OS === "web") {
    document.addEventListener("visibilitychange", callback);
    return () => document.removeEventListener("visibilitychange", callback);
  }
  const subscription = AppState.addEventListener("change", callback);
  return () => subscription.remove();
}
function current() {
  return Platform.OS === "web" ? document.visibilityState !== "hidden" : AppState.currentState === "active";
}
export function useAppActive() {
  return useSyncExternalStore(subscribe, current, () => true);
}
