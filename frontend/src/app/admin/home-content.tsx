import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminDataState } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { homeApi, type HomeOverview } from "@/lib/api";
import { useAppTheme } from "@/hooks/use-app-theme";

function ContentEditor({ initial, token }: { initial: HomeOverview["content"]; token: string }) {
  const [content, setContent] = useState(initial);
  const theme = useAppTheme();
  const save = useMutation({ mutationFn: () => homeApi.saveContent(token, content) });
  const labels = { rules: "Правила игры", weeklyDetails: "Подробнее: неделя", monthlyDetails: "Подробнее: месяц", instagramUrl: "Instagram (https://instagram.com/…)", telegramUrl: "Telegram (https://t.me/…)" };
  return <View style={{ gap: 14 }}><AppText variant="heading">Главный экран</AppText>{(Object.keys(labels) as (keyof typeof labels)[]).map(key => <View key={key} style={{ gap: 5 }}><AppText>{labels[key]}</AppText><TextInput accessibilityLabel={labels[key]} value={content[key]} multiline={key.endsWith("Details") || key === "rules"} maxLength={key.endsWith("Url") ? 500 : 12000} onChangeText={value => setContent(old => ({ ...old, [key]: value }))} style={{ color: theme.text, backgroundColor: theme.surfaceRaised, padding: 12, borderRadius: 12, minHeight: key.endsWith("Url") ? 46 : 100 }} /></View>)}
    {save.isError ? <AppText>Не удалось сохранить. Проверьте ссылки и повторите.</AppText> : null}{save.isSuccess ? <AppText>Сохранено</AppText> : null}
    <AppButton loading={save.isPending} onPress={() => save.mutate()}>Сохранить</AppButton>
  </View>;
}
export default function HomeContentScreen() {
  const { adminToken } = useAdminSession();
  const query = useQuery({ queryKey: ["admin", "home-content", adminToken], queryFn: () => homeApi.content(adminToken) });
  if (query.isPending) return <AdminDataState loading />;
  if (query.isError) return <AdminDataState error={query.error} onRetry={() => void query.refetch()} />;
  return <ContentEditor initial={query.data} token={adminToken} />;
}
