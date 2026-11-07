import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { ScreenHeader } from "@/components/screen-header";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { chatApi } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
import { formatMoney } from "@/lib/format";
import { ChatAction } from "@/components/chat/chat-sheet";
export default function PlayerProfileScreen() {
  const c = useChatCopy(),
    theme = useAppTheme(),
    router = useRouter(),
    params = useLocalSearchParams<{ id: string }>(),
    token = useAppStore((s) => s.accessToken),
    ownId = useAppStore((s) => s.user.id);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const id = typeof params.id === "string" ? params.id : "";
  const query = useQuery({
    queryKey: ["chat-profile", token, id],
    enabled: Boolean(token && /^[a-f\d]{24}$/i.test(id)),
    queryFn: () => chatApi.profile(token!, id),
  });
  const p = query.data;
  const write = async () => {
    if (!token) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (p?.friendship !== "friends") {
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
      <ScreenHeader title={c.profile} onBack={() => router.back()} />
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
          <Avatar name={p.name} avatarUrl={p.avatarUrl} size={100} />
          <AppText variant="title">{p.name}</AppText>
          {p.username ? (
            <AppText color={String(theme.primary)}>@{p.username}</AppText>
          ) : null}
          <AppText selectable variant="caption" muted>
            ID: {p.id}
          </AppText>
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
                disabled={busy || p.friendship === "outgoing" || p.blocked}
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
                  {p.friendship === "friends" ? c.newChat : p.friendship === "incoming" ? c.acceptFriend : p.friendship === "outgoing" ? c.requestSent : c.friendRequest}
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
