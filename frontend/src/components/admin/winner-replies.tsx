import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { AppText } from "@/components/app-text";
import { useAdminSession } from "@/components/admin/admin-session";
import { inboxApi } from "@/lib/api";

export function WinnerReplies() {
  const { adminToken } = useAdminSession();
  const query = useQuery({ queryKey: ["admin-winner-replies", adminToken], enabled: Boolean(adminToken),
    queryFn: () => inboxApi.winnerReplies(adminToken), refetchInterval: 10_000 });
  return <View style={{ gap: 12 }}>
    <AppText variant="heading">Ответы победителей 🏆</AppText>
    {query.isError ? <AppText>Не удалось загрузить ответы.</AppText> : null}
    {query.data?.replies.length === 0 ? <AppText muted>Пока нет ответов. Новые сообщения появятся здесь автоматически.</AppText> : null}
    {query.data?.replies.map(reply => <View key={reply.id} style={{ padding: 16, borderRadius: 18, backgroundColor: "rgba(0,122,87,.08)", gap: 6 }}>
      <AppText variant="label">{reply.user?.name ?? "Победитель"} · Telegram ID: {reply.telegramId}</AppText>
      <AppText selectable>{reply.text}</AppText>
      <AppText variant="caption" muted>{new Date(reply.createdAt).toLocaleString()} · {reply.forwarded ? "Доставлено в сообщения администратора" : "Сохранено в администрации"}</AppText>
    </View>)}
  </View>;
}
