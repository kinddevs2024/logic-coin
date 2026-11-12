import { useUiCopy , Alert, CopyTextInput as TextInput } from "@/components/localized-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AdminPageHeader } from "@/components/admin/admin-ui";
import { WinnerReplies } from "@/components/admin/winner-replies";
import { useAdminSession } from "@/components/admin/admin-session";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi } from "@/lib/api";

const PRESETS = [
  { title: "Новый челлендж доступен", body: "Шесть новых игр уже ждут вас в Logic Coin." },
  { title: "Итоги челленджа готовы", body: "Челлендж завершён. Откройте Logic Coin: ваш результат и приз уже готовы." },
  { title: "Новая игра доступна", body: "В Logic Coin появилась новая игра. Попробуйте её прямо сейчас!" },
];

export default function AdminNotificationsScreen() {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const { adminToken } = useAdminSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userName, setUserName] = useState("");
  const [review, setReview] = useState(false);
  const [sent, setSent] = useState("");
  const send = useMutation({
    mutationFn: () => adminApi.sendNotification({ title: title.trim(), body: body.trim(), ...(userName.trim() ? { userName: userName.trim() } : {}) }, adminToken),
    onSuccess: ({ notification }) => {
      const target = notification.recipientName ? notification.recipientName : `${notification.targetCount} устройств`;
      setSent(`Системное сообщение сохранено. ${notification.recipientName ? `Получатель: ${notification.recipientName}.` : "Получатели: все пользователи."} Push: ${notification.sentCount} из ${notification.targetCount}.`); setReview(false);
      setTitle(""); setBody(""); setUserName("");
    },
    onError: (error) => Alert.alert("Не удалось отправить", error instanceof Error ? error.message : "Повторите попытку"),
  });
  const valid = title.trim().length > 0 && body.trim().length > 0;

  return <View style={styles.page}>

    <AdminPageHeader title="Системные сообщения" description="Сообщение от администрации во вкладке «Системные» — всем игрокам или одному получателю." />
    <GlassSurface intensity={72} variant="strong" style={styles.card}>
      <View style={styles.iconLine}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><Ionicons name="notifications" size={22} color={String(theme.primary)} /></View><View><AppText variant="heading">{copyText("Новое системное сообщение")}</AppText><AppText variant="caption" muted>{copyText("Сохранится внутри приложения. Если уведомления разрешены, дополнительно придёт push.")}</AppText></View></View>
      <Field label="Кому (необязательно)" value={userName} onChangeText={setUserName} placeholder={copyText("Имя пользователя или email; пусто — всем")} theme={theme} />
      <Field label="Заголовок" value={title} onChangeText={setTitle} placeholder={copyText("Например: Новый челлендж")} theme={theme} maxLength={120} />
      <Field label="Сообщение" value={body} onChangeText={setBody} placeholder={copyText("Текст уведомления")} theme={theme} multiline maxLength={500} />
      <AppText variant="caption" muted>{copyContent("Команды в заголовке и сообщении: {name} — имя получателя, {country} — его страна на языке приложения. Пример: Привет, {name}! Как дела в стране {country}? Если данных нет, появится «Игрок» или «Страна не указана».")}</AppText>
      {sent?<AppText accessibilityRole="alert">{sent}</AppText>:null}
      {review?<View style={{gap:10,padding:16,borderRadius:16,backgroundColor:theme.surfaceRaised}}><AppText variant="label">{userName.trim()?`Получатель: ${userName.trim()}`:"Получатели: все пользователи"}</AppText><AppText variant="heading">{title.trim()}</AppText><AppText>{body.trim()}</AppText><AppButton icon="send" loading={send.isPending} disabled={!valid} onPress={()=>send.mutate()}>Отправить системное сообщение</AppButton><AppButton disabled={send.isPending} onPress={()=>setReview(false)}>Назад к редактированию</AppButton></View>:<AppButton disabled={!valid} onPress={()=>{setSent("");setReview(true);}}>Посмотреть перед отправкой</AppButton>}
    </GlassSurface>
    <View style={styles.presets}>{PRESETS.map((preset) => <Pressable key={preset.title} accessibilityRole="button" onPress={() => { setTitle(preset.title); setBody(preset.body); }} style={({ pressed }) => [styles.preset, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }, pressed && styles.pressed]}><Ionicons name="flash-outline" size={17} color={String(theme.primary)} /><View style={{ flex: 1 }}><AppText variant="label">{copyContent(preset.title)}</AppText><AppText variant="caption" muted numberOfLines={2}>{copyContent(preset.body)}</AppText></View></Pressable>)}</View>
  </View>;
}

function Field({ label, theme, multiline, ...props }: { label: string; theme: ReturnType<typeof useAppTheme>; multiline?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string; maxLength?: number }) {
  const { copyContent } = useUiCopy();
  return <View style={styles.field}><AppText variant="caption" muted>{copyContent(label)}</AppText><TextInput {...props} multiline={multiline} placeholderTextColor={String(theme.textMuted)} style={[styles.input, multiline && styles.bodyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]} /></View>;
}

const styles = StyleSheet.create({ page: { gap: 16 }, card: { borderRadius: 28, padding: 18, gap: 15 }, iconLine: { flexDirection: "row", gap: 11, alignItems: "center" }, icon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" }, field: { gap: 6 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontSize: 15, fontWeight: "600" }, bodyInput: { minHeight: 112, paddingTop: 13, textAlignVertical: "top" }, presets: { gap: 9 }, preset: { borderWidth: 1, borderRadius: 19, padding: 13, flexDirection: "row", gap: 10, alignItems: "flex-start" }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] } });
