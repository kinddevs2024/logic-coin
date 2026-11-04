import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "@/components/app-text";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session";
import { ChatAction } from "@/components/chat/chat-sheet";
import { chatAdminApi } from "@/lib/chat-api";
export default function AdminChatsScreen() {
  const { adminToken } = useAdminSession(),
    router = useRouter(),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["admin-chat-reports", adminToken],
    queryFn: () => chatAdminApi.reports(adminToken),
    refetchInterval: 30_000,
  });
  const resolve = async (id: string, remove: boolean) => {
    try {
      await chatAdminApi.resolve(adminToken, id, remove);
      await query.refetch();
    } catch {
      setError("Не удалось обработать жалобу");
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <AdminPageHeader
        title="Сообщения и жалобы"
        description="Поддержка приходит личными переписками в аккаунт администратора. Здесь — сообщения, на которые пожаловались пользователи."
      />
      <ChatAction
        title="Открыть переписки"
        icon="chatbubbles-outline"
        onPress={() => router.push("/messages" as never)}
      />
      {error || query.isError ? (
        <AppText>{error || "Не удалось загрузить жалобы"}</AppText>
      ) : null}
      {query.data?.reports.length === 0 ? (
        <AppText muted>Жалоб пока нет</AppText>
      ) : null}
      {query.data?.reports.map((report) => (
        <View
          key={report._id}
          style={{
            padding: 16,
            gap: 9,
            borderRadius: 20,
            backgroundColor: "rgba(0,122,87,.08)",
          }}
        >
          <AppText variant="label">
            {report.userId?.name ?? "Пользователь"} ·{" "}
            {new Date(report.createdAt).toLocaleString()}
          </AppText>
          <AppText>{report.reason}</AppText>
          <AppText selectable muted>
            {report.messageId?.text ?? "Сообщение удалено"}
          </AppText>
          {report.resolvedAt ? (
            <AppText muted>Обработано</AppText>
          ) : (
            <>
              <ChatAction
                title="Закрыть жалобу"
                onPress={() => {
                  void resolve(report._id, false);
                }}
              />
              <ChatAction
                title="Удалить сообщение и закрыть"
                danger
                onPress={() => {
                  void resolve(report._id, true);
                }}
              />
            </>
          )}
        </View>
      ))}
    </View>
  );
}
