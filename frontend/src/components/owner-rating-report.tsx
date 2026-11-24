import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, TextInput, View } from "react-native";
import { AppText } from "@/components/app-text";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { request } from "@/lib/api";

type Row = { userId: string; rank: number; totalCoins: number; completedGamesCount: number; profile: { name: string; username?: string } | null };
type Board = { settled: boolean; more: boolean; items: Row[] };
type Detail = { events: { id: string; kind: string; amount: number; description: string; at: string }[] };

export function OwnerRatingReport({ token, day }: { token: string; day: string }) {
  const theme = useAppTheme();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day);
  const board = useQuery({ queryKey: ["owner-rating", token, day, search, page], enabled: valid, queryFn: () => request<Board>(`/owner/rating/${day}?q=${encodeURIComponent(search)}&page=${page}`, { token }) });
  const detail = useQuery({ queryKey: ["owner-rating-detail", token, day, selected?.userId], enabled: valid && !!selected, queryFn: () => request<Detail>(`/owner/rating/${day}/${selected!.userId}`, { token }) });
  return <View style={{ gap: 12 }}>
    <AppText variant="heading">Рейтинг и начисления за {day}</AppText>
    <AppText muted>Поиск игрока и история начислений доступны только для просмотра.</AppText>
    <TextInput accessibilityLabel="Поиск игрока в рейтинге" value={search} onChangeText={value => { setSearch(value); setPage(0); setSelected(null); }} placeholder="Имя или никнейм" placeholderTextColor={String(theme.textMuted)} style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12 }} />
    {board.isLoading ? <AppText>Загрузка рейтинга…</AppText> : null}
    {board.error ? <AppText color={String(theme.danger)}>Не удалось загрузить рейтинг.</AppText> : null}
    <GlassSurface style={{ padding: 16, borderRadius: 20, gap: 10 }}>
      <AppText muted>{board.data?.settled ? "Итоговый рейтинг" : "Предварительный рейтинг"}</AppText>
      {board.data?.items.map(row => <Pressable key={row.userId} accessibilityRole="button" disabled={!row.profile} onPress={() => setSelected(row)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border }}><AppText>#{row.rank} · {row.profile?.name ?? "Удалённый игрок"}{row.profile?.username ? ` @${row.profile.username}` : ""}</AppText><AppText muted>{row.totalCoins.toLocaleString()} coin · {row.completedGamesCount}/6 игр</AppText></Pressable>)}
      {board.data && !board.data.items.length ? <AppText muted>Нет записей за выбранную дату.</AppText> : null}
      <View style={{ flexDirection: "row", gap: 20 }}><Pressable accessibilityRole="button" disabled={!page} onPress={() => { setPage(page - 1); setSelected(null); }}><AppText color={String(theme.primary)}>← Назад</AppText></Pressable><AppText>{page + 1}</AppText><Pressable accessibilityRole="button" disabled={!board.data?.more} onPress={() => { setPage(page + 1); setSelected(null); }}><AppText color={String(theme.primary)}>Далее →</AppText></Pressable></View>
    </GlassSurface>
    {selected ? <GlassSurface style={{ padding: 16, borderRadius: 20, gap: 10 }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><AppText variant="label">Начисления: {selected.profile?.name}</AppText><Pressable accessibilityRole="button" onPress={() => setSelected(null)}><AppText color={String(theme.primary)}>Закрыть</AppText></Pressable></View>{detail.isLoading ? <AppText>Загрузка…</AppText> : null}{detail.error ? <AppText color={String(theme.danger)}>Не удалось загрузить начисления.</AppText> : null}{detail.data?.events.map(event => <View key={`${event.kind}-${event.id}`}><AppText>{event.description} · {event.amount > 0 ? "+" : ""}{event.amount} coin</AppText><AppText muted>{new Date(event.at).toLocaleString()}</AppText></View>)}{detail.data && !detail.data.events.length ? <AppText muted>Начислений не найдено.</AppText> : null}</GlassSurface> : null}
  </View>;
}
