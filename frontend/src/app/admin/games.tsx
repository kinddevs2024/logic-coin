import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Switch, TextInput, View } from "react-native";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { adminApi, type AdminGame, type AdminGameInput } from "@/lib/api";

const fresh = (): AdminGameInput => ({ key: "", slug: "", title: { ru: "", en: "", uz: "" }, description: { ru: "", en: "", uz: "" }, icon: "game-controller-outline", color: "#0866FF", engine: "native", enabled: false, practiceEnabled: true, challengeEnabled: false, sortOrder: 0, difficulty: "medium", scoring: { higherIsBetter: true, maxCoins: 1000 } });

export default function AdminGamesScreen() {
  const { adminToken } = useAdminSession();
  const theme = useAppTheme();
  const client = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminGameInput>(fresh);
  const [message, setMessage] = useState("");
  const games = useQuery({ queryKey: ["admin", "games"], queryFn: () => adminApi.games(adminToken) });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin", "games"] });
    await client.invalidateQueries({ queryKey: ["games"] });
  };
  const save = useMutation({
    mutationFn: () => {
      if (editing) { const { key: _key, ...patch } = draft; return adminApi.updateGame(editing, patch, adminToken); }
      return adminApi.createGame(draft, adminToken);
    },
    onSuccess: async () => { await refresh(); setMessage("Сохранено"); },
    onError: error => setMessage(error instanceof Error ? error.message : "Не удалось сохранить"),
  });
  const archive = useMutation({ mutationFn: (key: string) => adminApi.archiveGame(key, adminToken), onSuccess: async () => { await refresh(); setMessage("Игра снята с публикации. История сохранена."); }, onError: error => setMessage(error instanceof Error ? error.message : "Не удалось убрать игру") });
  const select = (game: AdminGame) => {
    setEditing(game.key);
    setDraft({ ...fresh(), key: game.key, slug: game.slug, title: game.titleI18n ?? { ru: game.title, en: game.title, uz: game.title }, description: game.descriptionI18n ?? { ru: game.description, en: game.description, uz: game.description }, icon: game.icon, color: game.color, engine: game.engine, difficulty: game.difficulty, enabled: game.enabled ?? true, practiceEnabled: game.practiceEnabled, challengeEnabled: game.challengeEnabled, sortOrder: game.sortOrder ?? 0, scoring: game.scoring, clientPath: game.clientPath ?? undefined, assetPath: game.assetPath ?? undefined });
    setMessage("");
  };
  const field = (label: string, value: string, change: (value: string) => void, editable = true) => <View style={styles.field}><AppText variant="caption">{label}</AppText><TextInput accessibilityLabel={label} value={value} editable={editable} onChangeText={change} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /></View>;
  const busy = save.isPending || archive.isPending;
  return <View style={styles.page}>
    <AdminPageHeader title="Игры" description="Каталог с сервера. Новая механика требует публикации совместимого обновления кода." />
    <AppButton onPress={() => { setEditing(null); setDraft(fresh()); setMessage(""); }}>Добавить игру</AppButton>
    {games.isPending ? <AppText>Загрузка…</AppText> : null}
    {games.isError ? <AppText>{games.error.message}</AppText> : null}
    {games.data?.map(game => <GlassSurface key={game.key} style={styles.card}><AppText variant="heading">{game.title}</AppText><AppText muted>{game.key} · {game.enabled === false ? "Не опубликована" : "Опубликована"}</AppText><AppButton disabled={busy} onPress={() => select(game)}>Редактировать</AppButton></GlassSurface>)}
    <GlassSurface style={styles.card}>
      <AppText variant="heading">{editing ? "Редактирование" : "Новая игра"}</AppText>
      {field("Ключ игры", draft.key, key => setDraft(d => ({ ...d, key, slug: key })), !editing)}
      {field("Адрес в каталоге", draft.slug, slug => setDraft(d => ({ ...d, slug })))}
      {(["ru", "en", "uz"] as const).map(language => <View key={language} style={styles.field}>
        {field(`Название (${language})`, draft.title[language], value => setDraft(d => ({ ...d, title: { ...d.title, [language]: value } })))}
        {field(`Описание (${language})`, draft.description[language], value => setDraft(d => ({ ...d, description: { ...d.description, [language]: value } })))}
      </View>)}
      {field("Иконка", draft.icon, icon => setDraft(d => ({ ...d, icon })))}
      {field("Цвет HEX", draft.color, color => setDraft(d => ({ ...d, color })))}
      {field("Порядок", String(draft.sortOrder ?? 0), value => setDraft(d => ({ ...d, sortOrder: Number(value) || 0 })))}
      <View style={styles.toggle}><AppText>Веб-движок</AppText><Switch value={draft.engine === "webview"} onValueChange={value => setDraft(d => ({ ...d, engine: value ? "webview" : "native" }))} /></View>
      {(["easy", "medium", "hard"] as const).map(difficulty => <AppButton key={difficulty} onPress={() => setDraft(d => ({ ...d, difficulty }))}>{`${draft.difficulty === difficulty ? "✓ " : ""}${difficulty}`}</AppButton>)}
      {field("Максимальная награда челленджа", String(draft.scoring?.maxCoins ?? 1000), value => setDraft(d => ({ ...d, scoring: { higherIsBetter: d.scoring?.higherIsBetter ?? true, maxCoins: Math.max(1, Math.min(1000, Number(value) || 1)) } })))}
      <View style={styles.toggle}><AppText>Больше счёт — лучше</AppText><Switch value={draft.scoring?.higherIsBetter ?? true} onValueChange={higherIsBetter => setDraft(d => ({ ...d, scoring: { maxCoins: d.scoring?.maxCoins ?? 1000, higherIsBetter } }))} /></View>
      {field("Путь игрового экрана", draft.clientPath ?? "", clientPath => setDraft(d => ({ ...d, clientPath })))}
      {field("Путь изображения", draft.assetPath ?? "", assetPath => setDraft(d => ({ ...d, assetPath })))}
      {(["enabled", "practiceEnabled", "challengeEnabled"] as const).map(key => <View key={key} style={styles.toggle}><AppText>{({ enabled: "Опубликована", practiceEnabled: "Обычная игра", challengeEnabled: "Челленджи" })[key]}</AppText><Switch accessibilityLabel={key} value={Boolean(draft[key])} onValueChange={value => setDraft(d => ({ ...d, [key]: value }))} /></View>)}
      {message ? <AppText accessibilityRole="alert">{message}</AppText> : null}
      <AppButton loading={save.isPending} disabled={busy || !draft.key || Object.values(draft.title).some(value => !value.trim())} onPress={() => save.mutate()}>Сохранить</AppButton>
      {editing ? <AppButton disabled={busy} onPress={() => archive.mutate(editing)}>Убрать из каталога (сохранить историю)</AppButton> : null}
    </GlassSurface>
  </View>;
}
const styles = StyleSheet.create({ page: { gap: 16 }, card: { padding: 18, borderRadius: 24, gap: 12 }, field: { gap: 6 }, input: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 }, toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
