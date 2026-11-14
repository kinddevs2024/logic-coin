import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "@/components/app-text";
import { useAppStore } from "@/store/app-store";
import { useAppTheme } from "@/hooks/use-app-theme";
import { chatApi } from "@/lib/chat-api";
import { useChatCopy } from "@/lib/chat-copy";
export function ChatUsernameSettings() {
  const c = useChatCopy(),
    theme = useAppTheme(),
    token = useAppStore((s) => s.accessToken),
    user = useAppStore((s) => s.user),
    client = useQueryClient();
  const [draft, setValue] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const profile = useQuery({
    queryKey: ["chat-profile", user.id],
    enabled: Boolean(token && user.id),
    queryFn: () => chatApi.profile(token!, user.id!),
    staleTime: 60_000,
  });
  const value = draft ?? profile.data?.username ?? user.username ?? "";
  const save = async () => {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await chatApi.username(token, value);
      useAppStore.setState((state) => ({
        user: { ...state.user, username: result.username },
      }));
      await client.invalidateQueries({ queryKey: ["chat-profile", user.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : c.error);
    } finally {
      setBusy(false);
    }
  };
  if (!token) return null;
  return (
    <View
      style={{
        padding: 18,
        marginVertical: 16,
        gap: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <AppText variant="heading">{c.username}</AppText>
      <AppText variant="caption" muted>
        {c.usernameHint}
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <TextInput
          accessibilityLabel={c.username}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={25}
          value={value}
          onChangeText={setValue}
          placeholder="@username"
          placeholderTextColor={theme.textMuted}
          style={{
            flex: 1,
            borderRadius: 20,
            padding: 13,
            minHeight: 46,
            color: theme.text,
            backgroundColor: theme.surfaceRaised,
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void save();
          }}
          style={{
            padding: 14,
            borderRadius: 20,
            backgroundColor: theme.primary,
          }}
        >
          <AppText color={String(theme.onPrimary)}>{c.save}</AppText>
        </Pressable>
      </View>
      {error ? <AppText color={String(theme.danger)}>{error}</AppText> : null}
    </View>
  );
}
