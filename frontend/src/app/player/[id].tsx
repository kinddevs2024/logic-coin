import {sourceChatRoute} from "@/lib/player-profile-navigation";
import { useCallback, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, BackHandler, Platform, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AdminUserEditor } from "@/components/admin/admin-user-editor";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ScreenHeader } from "@/components/screen-header";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { adminApi, type AdminUser } from "@/lib/api";
import { chatApi } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { formatMoney } from "@/lib/format";
import { ChatAction } from "@/components/chat/chat-sheet";

const managementCopy = {
  ru: { open: "Управление аккаунтом", loading: "Загружаем данные аккаунта…", error: "Не удалось открыть управление аккаунтом", retry: "Повторить", close: "Отмена" },
  uz: { open: "Hisobni boshqarish", loading: "Hisob ma’lumotlari yuklanmoqda…", error: "Hisob boshqaruvini ochib bo‘lmadi", retry: "Qayta urinish", close: "Bekor qilish" },
  en: { open: "Manage account", loading: "Loading account details…", error: "Could not open account management", retry: "Retry", close: "Cancel" },
};

export default function PlayerProfileScreen() {
  const c = useChatCopy(),
    theme = useAppTheme(),
    router = useRouter(),
    params = useLocalSearchParams<{ id: string; returnChat?: string; returnSearch?: string }>(),
    token = useAppStore((s) => s.accessToken),
    ownId = useAppStore((s) => s.user.id);
  const role = useAppStore((s) => s.user.role);
  const authMode = useAppStore((s) => s.authMode);
  const client = useQueryClient();
  const { language } = useTranslation();
  const manage = managementCopy[language];
  const sourceChat = useMemo(() => sourceChatRoute(params.returnChat, params.returnSearch), [params.returnChat, params.returnSearch]);
  const goBack = useCallback(() => {
    if (sourceChat) router.dismissTo(sourceChat as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/messages");
  }, [router, sourceChat]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS === "web" || !sourceChat) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => subscription.remove();
  }, [goBack, sourceChat]));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; token: string } | null>(null);
  const id = typeof params.id === "string" ? params.id.toLowerCase() : "";
  const validId = /^[a-f\d]{24}$/i.test(id);
  const canManage = authMode === "authenticated" && Boolean(token && validId) && (role === "admin" || role === "owner");
  const editorOpen = canManage && editing?.id === id && editing.token === token;
  const profileKey = ["chat-profile", token, id] as const;
  const query = useQuery({
    queryKey: profileKey,
    enabled: Boolean(token && validId),
    queryFn: () => chatApi.profile(token!, id),
  });
  const p = query.data;
  const accountChanged = (user: AdminUser | null) => {
    void client.invalidateQueries({ queryKey: ["admin", "users"] });
    void client.invalidateQueries({ queryKey: ["chat-list", token] });
    if (!user) {
      client.removeQueries({ queryKey: profileKey });
      setEditing(null);
      goBack();
      return;
    }
    void query.refetch();
  };
  const write = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (!p?.canMessage && p?.friendship !== "friends") {
        const result = p?.friendship === "incoming" ? await chatApi.answerFriend(token,id,true) : await chatApi.requestFriend(token,id);
        await query.refetch();
        if (!("id" in result) || !result.id) return;
      }
      const room = await chatApi.direct(token, id);
      router.push({
        pathname: "/messages",
        params: { chat: room.id },
      } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppFrame>
      <ScreenHeader title={c.profile} onBack={goBack} />
      {query.isPending && token ? (
        <ActivityIndicator color={String(theme.primary)} />
      ) : null}
      {p ? (
        <View
          style={{
            alignItems: "center",
            padding: 25,
            borderRadius: 28,
            backgroundColor: theme.surface,
            gap: 14,
          }}
        >
          <Avatar userId={p.id} name={p.name} avatarUrl={p.avatarUrl} size={100} />
          <AppText variant="title">{p.name}</AppText>
          {p.username ? (
            <AppText color={String(theme.primary)}>@{p.username}</AppText>
          ) : null}
          <View style={{ flexDirection: "row", gap: 28, paddingVertical: 15 }}>
            <View style={{ alignItems: "center", gap: 5 }}>
              <Ionicons name="diamond" size={22} color="#D5AA33" />
              <AppText variant="heading">
                {p.coinBalance.toLocaleString()}
              </AppText>
            </View>
            <View style={{ alignItems: "center", gap: 5 }}>
              <Ionicons name="wallet" size={22} color={String(theme.primary)} />
              <AppText variant="heading">{formatMoney(p.balanceUnits)}</AppText>
            </View>
          </View>
          {ownId === id ? (
            <ChatAction
              title={c.settings}
              onPress={() => router.push("/settings")}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                disabled={busy || (!p.canMessage && p.friendship === "outgoing") || p.blocked}
                onPress={() => {
                  void write();
                }}
                style={{
                  backgroundColor: theme.primary,
                  borderRadius: 25,
                  padding: 15,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <AppText color={String(theme.onPrimary)} variant="label">
                  {p.canMessage || p.friendship === "friends" ? c.newChat : p.friendship === "incoming" ? c.acceptFriend : p.friendship === "outgoing" ? c.requestSent : c.friendRequest}
                </AppText>
              </Pressable>
              <ChatAction
                title={p.blocked ? c.unblock : c.block}
                danger
                onPress={() => {
                  void chatApi
                    .block(token!, id, !p.blocked)
                    .then(() => query.refetch())
                    .catch(() => setError(c.error));
                }}
              />
            </>
          )}
        </View>
      ) : null}
      {canManage && token && (!query.isPending || p) ? (
        <ChatAction title={manage.open} icon="shield-checkmark-outline" onPress={() => setEditing({ id, token })} />
      ) : null}
      {editorOpen && token ? (
        <PlayerAccountEditor key={id} id={id} token={token} copy={manage}
          onClose={() => setEditing(null)} onChanged={accountChanged} />
      ) : null}
      {!token ? (
        <ChatAction title={c.newChat} onPress={() => router.push("/login")} />
      ) : null}
      {query.isError || error ? (
        <AppText accessibilityRole="alert" color={String(theme.danger)}>
          {error || c.error}
        </AppText>
      ) : null}
    </AppFrame>
  );
}

function PlayerAccountEditor({ id, token, copy, onClose, onChanged }: {
  id: string;
  token: string;
  copy: (typeof managementCopy)[keyof typeof managementCopy];
  onClose: () => void;
  onChanged: (user: AdminUser | null) => void;
}) {
  const theme = useAppTheme();
  const details = useQuery({
    queryKey: ["admin", "profile-editor", token, id],
    queryFn: () => adminApi.userDetails(id, token),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (details.data?.user._id === id) {
    return <AdminUserEditor user={details.data.user} token={token} onClose={onClose} onChanged={onChanged} />;
  }
  return (
    <View>
      {details.isFetching ? (
        <AppText accessibilityLiveRegion="polite" muted>{copy.loading}</AppText>
      ) : (
        <>
          <AppText accessibilityRole="alert" color={String(theme.danger)}>{copy.error}</AppText>
          <ChatAction title={copy.retry} icon="refresh-outline" onPress={() => void details.refetch()} />
        </>
      )}
      <ChatAction title={copy.close} onPress={onClose} />
    </View>
  );
}
