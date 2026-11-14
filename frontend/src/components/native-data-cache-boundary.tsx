import { beginCacheBoot } from "@/lib/cache-boot";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Platform, Text, View } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/api";
import { nativeDataCache, dataCacheScope } from "@/lib/native-data-cache";
import { restoreQueries, snapshotQueries } from "@/lib/query-snapshots";
import { useAppStore } from "@/store/app-store";

export function NativeDataCacheBoundary({ client, children }: { client: QueryClient; children: ReactNode }) {
  const hydrated = useAppStore(s => s.hydrated);
  const accountId = useAppStore(s => s.user.id);
  const language = useAppStore(s => s.language) ?? "uz";
  const token = useAppStore(s => s.accessToken);
  const scope = accountId && token ? dataCacheScope(API_URL, accountId, language) : null;
  const [readyScope, setReadyScope] = useState<string | null | undefined>(undefined);
  const [readyAccount, setReadyAccount] = useState<string | undefined>(undefined);
  const previousAccount = useRef<string | undefined>(undefined);
  const opened = useRef(false);
  const tokens = useRef(new Set<string>());
  const priorToken = useRef<string | null>(null);
  const currentToken = useRef(token);
  useEffect(() => { currentToken.current = token; }, [token]);

  useEffect(() => {
    if (Platform.OS === "web" || !hydrated) return;
    let disposed = false;
    const accountChanged = previousAccount.current !== accountId;
    previousAccount.current = accountId;
    if (accountChanged || !opened.current) {
      client.clear();
      tokens.current.clear();
      priorToken.current = null;
    }
    opened.current = true;
    const save = () => nativeDataCache.setQueries(snapshotQueries(client, tokens.current));
    let unsubscribe: (() => void) | undefined;
    const showApp = () => { if (!disposed) { setReadyScope(scope); setReadyAccount(accountId); } };
    const stopBoot = beginCacheBoot(() => nativeDataCache.open(scope), (entries, timedOut) => {
      if (disposed) return;
      const activeToken = currentToken.current;
      if (activeToken) {
        tokens.current.add(activeToken);
        priorToken.current = activeToken;
        if (!timedOut) restoreQueries(client, entries, activeToken);
      }
      unsubscribe = client.getQueryCache().subscribe(save);
      if (!accountChanged) void client.invalidateQueries({ refetchType: "active" });
    }, showApp);
    const appState = AppState.addEventListener("change", state => {
      if (!nativeDataCache.ready) return;
      if (state === "active") void client.invalidateQueries({ refetchType: "active" });
      else { save(); void nativeDataCache.flush(); }
    });
    return () => { disposed = true; stopBoot(); unsubscribe?.(); appState.remove(); };
  }, [client, hydrated, scope, accountId]);

  useEffect(() => {
    if (Platform.OS === "web" || !token || readyScope !== scope || priorToken.current === token) return;
    const saved = snapshotQueries(client, tokens.current);
    tokens.current.add(token);
    priorToken.current = token;
    restoreQueries(client, saved, token);
  }, [client, token, readyScope, scope]);

  const sameAccount = Boolean(token && accountId && readyAccount === accountId);
  return Platform.OS === "web" || (hydrated && (readyScope === scope || sameAccount)) ? children : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F1F7EF" }}><ActivityIndicator color="#007A57" /><Text style={{ color: "#183C2C" }}>{language === "ru" ? "Открываем приложение…" : language === "uz" ? "Ilova ochilmoqda…" : "Opening app…"}</Text></View>;
}
