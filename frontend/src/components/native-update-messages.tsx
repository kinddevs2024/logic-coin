import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, ToastAndroid } from "react-native";
import { announceUpdateMessage, createUpdateDownloadCheck, selectUpdateMessage, updateMessageCopy } from "@/lib/update-message";
import { notifyUpdateState } from "@/lib/notifications";
import { useAppStore } from "@/store/app-store";

export function NativeUpdateMessages() {
  const hydrated = useAppStore(state => state.hydrated);
  const language = useAppStore(state => state.language) ?? "ru";
  const pathname = usePathname();
  const status = Updates.useUpdates();
  const [appState, setAppState] = useState(AppState.currentState);
  const [check] = useState(() => createUpdateDownloadCheck(Updates));
  const latest = useRef({ status, pathname, language });
  useEffect(() => { latest.current = { status, pathname, language }; }, [status, pathname, language]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hydrated || !Updates.isEnabled) return;
    let disposed = false;
    const eligible = () => !disposed && AppState.currentState === "active" && !latest.current.pathname.startsWith("/play/");
    const tick = () => {
      const state = latest.current.status;
      if (state.isStartupProcedureRunning || state.isChecking || state.isDownloading || state.isUpdatePending) return;
      void check(eligible).catch(() => { /* Retry on a later foreground check, never disrupt the app. */ });
    };
    tick();
    const timer = setInterval(tick, 120_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") tick(); });
    return () => { disposed = true; clearInterval(timer); subscription.remove(); };
  }, [hydrated, check, pathname]);

  const pendingId = status.isUpdatePending ? status.downloadedUpdate?.updateId : null;
  const settled = !status.isStartupProcedureRunning && !status.isChecking && !status.isDownloading;
  const message = useMemo(() => selectUpdateMessage({
    enabled: Updates.isEnabled,
    pendingId,
    runningId: settled ? Updates.updateId : null,
    embedded: Updates.isEmbeddedLaunch,
  }), [pendingId, settled]);

  useEffect(() => {
    if (!hydrated || !message || (appState === "active" && pathname.startsWith("/play/"))) return;
    void announceUpdateMessage(message, AsyncStorage, async candidate => {
      const state = useAppStore.getState();
      const sent = await notifyUpdateState(candidate, state.language ?? "ru").catch(() => false);
      if (!sent && AppState.currentState === "active" && !latest.current.pathname.startsWith("/play/")) {
        ToastAndroid.show(updateMessageCopy[latest.current.language][candidate.kind], ToastAndroid.LONG);
        return true;
      }
      return sent;
    }).catch(() => { /* Delivery/storage failure does not block startup and can retry. */ });
  }, [appState, hydrated, language, message, pathname]);
  return null;
}
