import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, ToastAndroid } from "react-native";
import { announceAppliedUpdate } from "@/lib/applied-update-notice";
import { isExpoGo } from "@/lib/native-runtime";
import { useAppStore } from "@/store/app-store";

const copy = { ru: "Приложение обновлено", uz: "Ilova yangilandi", en: "App updated" };

export function AppliedUpdateNotice() {
  const hydrated = useAppStore(state => state.hydrated);
  const language = useAppStore(state => state.language) ?? "ru";
  const pathname = usePathname();
  const [appState, setAppState] = useState(AppState.currentState);
  const busy = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!hydrated || Platform.OS !== "android" || isExpoGo || appState !== "active" || pathname.startsWith("/play/") || busy.current) return;
    let active = true;
    // Never load the native update module in Expo Go or web.
    const updates: typeof import("expo-updates") = require("expo-updates");
    busy.current = true;
    void announceAppliedUpdate({ enabled: updates.isEnabled, embedded: updates.isEmbeddedLaunch, id: updates.updateId }, AsyncStorage, () => {
      if (!active || AppState.currentState !== "active") return false;
      ToastAndroid.show(copy[language], ToastAndroid.LONG);
      return true;
    }).catch(() => { /* Local storage failure must not interrupt startup. */ })
      .finally(() => { busy.current = false; });
    return () => { active = false; };
  }, [appState, hydrated, language, pathname]);
  return null;
}
