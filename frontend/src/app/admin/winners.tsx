import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useAdminSession } from "@/components/admin/admin-session";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { RaffleWinnerSystemMessage } from "@/components/chat/raffle-winner-system-message";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { playerProfileRoute } from "@/lib/player-profile-navigation";
import { parsePrizeCents, winnerAnnouncementsApi, type WinnerDraft, type WinnerRecipient } from "@/lib/winner-announcements";

export default function AdminWinnersScreen() {
  const { adminToken } = useAdminSession(), theme = useAppTheme(), router = useRouter(), { isDesktop } = useResponsiveLayout();
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState("");
  const [recipient, setRecipient] = useState<WinnerRecipient | null>(null);
  const [title, setTitle] = useState(""), [prizeType, setPrizeType] = useState<"cash" | "item">("cash"), [amount, setAmount] = useState(""), [prizeText, setPrizeText] = useState("");
  const [language, setLanguage] = useState<"ru" | "uz" | "en">("ru"), [notice, setNotice] = useState("");
  const operation = useRef<string | null>(null);
  const [previewTime] = useState(() => new Date().toISOString());
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const searchReady = search.trim() === debounced && debounced.length >= 2;
  const recipients = useQuery({ queryKey: ["admin", "winner-recipients", debounced, adminToken], queryFn: () => winnerAnnouncementsApi.recipients(debounced, adminToken), enabled: !recipient && searchReady });
  const history = useQuery({ queryKey: ["admin", "winner-announcements", adminToken], queryFn: () => winnerAnnouncementsApi.list(adminToken) });
  const publish = useMutation({ mutationFn: (draft: WinnerDraft) => winnerAnnouncementsApi.publish(draft, adminToken), onSuccess: () => {
    operation.current = null; setNotice("Опубликовано в общем канале и комьюнити."); setRecipient(null); setSearch(""); setTitle(""); setAmount(""); setPrizeText(""); void history.refetch();
  } });
  const cents = parsePrizeCents(amount);
  const valid = Boolean(recipient && title.trim() && (prizeType === "cash" ? cents !== null : prizeText.trim()));
  const input = [styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }];
  const changed = () => { operation.current = null; setNotice(""); publish.reset(); };
  const submit = () => {
    if (!valid || !recipient || publish.isPending) return;
    operation.current ??= Crypto.randomUUID();
    const base = { operationId: operation.current, recipientId: recipient.id, raffleTitle: title.trim() };
    publish.mutate(prizeType === "cash" ? { ...base, prizeType, amountCents: cents! } : { ...base, prizeType, prizeText: prizeText.trim() });
  };
  const openProfile = (id: string) => { if (recipient) router.push(playerProfileRoute(id) as never); };
  return <View style={styles.page}>
    <AdminPageHeader title="Объявить победителя" description="Системный пост о результате розыгрыша в общем канале и комьюнити." />
    <View style={[styles.columns, isDesktop && styles.desktop]}>
      <GlassSurface variant="strong" style={[styles.form, isDesktop && { flex: 1 }]}>
        <AppText variant="heading">Победитель и приз</AppText>
        <AppText variant="caption" muted>Выберите пользователя</AppText>
        {recipient ? <View style={[styles.selected, { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}>
          <AppText variant="label">{recipient.name}</AppText><AppText variant="caption" muted>{recipient.username ? `@${recipient.username}` : recipient.referralCode}</AppText>
          <AppButton variant="secondary" disabled={publish.isPending} onPress={() => { changed(); setRecipient(null); setSearch(""); }}>Сменить пользователя</AppButton>
        </View> : <>
          <TextInput accessibilityLabel="Поиск победителя" placeholder="Имя, @ник или код приглашения" placeholderTextColor={String(theme.textMuted)} style={input} value={search} maxLength={100} editable={!publish.isPending} onChangeText={value => { changed(); setSearch(value.replace(/^@/, "")); }} />
          {recipients.isFetching ? <ActivityIndicator color={String(theme.primary)} /> : null}
          {recipients.error ? <><AppText color={String(theme.danger)}>Не удалось найти пользователей.</AppText><AppButton variant="secondary" onPress={() => { void recipients.refetch(); }}>Повторить поиск</AppButton></> : null}
          {searchReady && recipients.data?.users.length === 0 ? <AppText muted>Пользователи не найдены.</AppText> : null}
          {searchReady ? recipients.data?.users.map(user => <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`Выбрать победителя: ${user.name}`} disabled={publish.isPending} onPress={() => { changed(); setRecipient(user); }} style={({ pressed }) => [styles.result, { borderColor: theme.border, opacity: pressed ? 0.65 : 1 }]}><AppText variant="label">{user.name}</AppText><AppText variant="caption" muted>{user.username ? `@${user.username}` : user.referralCode}</AppText></Pressable>) : null}
        </>}
        <AppText variant="caption" muted>В каком розыгрыше выиграл</AppText>
        <TextInput accessibilityLabel="Название розыгрыша" placeholder="Например: Еженедельный розыгрыш" placeholderTextColor={String(theme.textMuted)} style={input} value={title} maxLength={160} editable={!publish.isPending} onChangeText={value => { changed(); setTitle(value); }} />
        <View style={styles.choices}>{([['cash','Деньги, $'],['item','Другой приз']] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: prizeType === value }} disabled={publish.isPending} onPress={() => { changed(); setPrizeType(value); }} style={[styles.choice, { borderColor: prizeType === value ? theme.primary : theme.border, backgroundColor: prizeType === value ? theme.primarySoft : theme.surface }]}><AppText>{label}</AppText></Pressable>)}</View>
        {prizeType === "cash" ? <><AppText variant="caption" muted>Сумма выигрыша в долларах</AppText><TextInput accessibilityLabel="Сумма выигрыша" placeholder="10.00" placeholderTextColor={String(theme.textMuted)} style={input} keyboardType="decimal-pad" maxLength={12} value={amount} editable={!publish.isPending} onChangeText={value => { changed(); setAmount(value); }} />{amount && cents === null ? <AppText color={String(theme.danger)} variant="caption">Введите положительную сумму, не более двух знаков после запятой.</AppText> : null}</> : <><AppText variant="caption" muted>Что выиграл</AppText><TextInput accessibilityLabel="Название приза" placeholder="Например: iPhone" placeholderTextColor={String(theme.textMuted)} style={input} maxLength={160} value={prizeText} editable={!publish.isPending} onChangeText={value => { changed(); setPrizeText(value); }} /></>}
        <AppText variant="caption" muted>Публикация объявляет результат. Деньги на баланс она не начисляет.</AppText>
        {notice ? <AppText accessibilityRole="alert" color={String(theme.success)}>{notice}</AppText> : null}
        {publish.error ? <AppText accessibilityRole="alert" color={String(theme.danger)}>{publish.error instanceof Error ? publish.error.message : "Не удалось опубликовать. Повторите попытку."}</AppText> : null}
        <AppButton accessibilityLabel="Опубликовать в канал и чат" icon="send-outline" disabled={!valid} loading={publish.isPending} onPress={submit}>Опубликовать в канал и чат</AppButton>
      </GlassSurface>
      <GlassSurface variant="strong" style={[styles.preview, isDesktop && { flex: 1 }]}>
        <AppText variant="heading">Предпросмотр</AppText>
        <AppText variant="caption" muted>Общий канал + комьюнити · без отправителя</AppText>
        <View style={styles.choices}>{([['ru','Русский'],['uz','O‘zbekcha'],['en','English']] as const).map(([value,label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: language === value }} onPress={() => setLanguage(value)} style={[styles.language, { borderColor: language === value ? theme.primary : theme.border }]}><AppText variant="caption">{label}</AppText></Pressable>)}</View>
        <View style={[styles.previewChat, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <RaffleWinnerSystemMessage event={{ kind: "raffle_winner", recipientId: recipient?.id ?? "", recipientName: recipient?.name ?? "Имя победителя", raffleTitle: title.trim() || "Название розыгрыша", ...(prizeType === "cash" ? { amountCents: cents ?? 0 } : { prizeText: prizeText.trim() || "Название приза" }) }} createdAt={previewTime} onProfile={openProfile} language={language} />
        </View>
        <AppText variant="caption" muted>Имя в опубликованном посте открывает профиль победителя.</AppText>
      </GlassSurface>
    </View>
    <GlassSurface variant="strong" style={styles.history}>
      <AppText variant="heading">Последние публикации</AppText>
      {history.isPending ? <ActivityIndicator color={String(theme.primary)} /> : null}
      {history.error ? <><AppText color={String(theme.danger)}>Не удалось загрузить историю.</AppText><AppButton variant="secondary" onPress={() => { void history.refetch(); }}>Повторить загрузку</AppButton></> : null}
      {history.data?.items.length === 0 ? <AppText muted>Объявлений пока нет.</AppText> : null}
      {history.data?.items.map(item => <View key={item.id} style={[styles.historyRow, { borderColor: theme.border }]}><AppText variant="label">{item.recipientName} · {item.prizeType === "cash" ? `$${((item.amountCents ?? 0) / 100).toFixed(2)}` : item.prizeText}</AppText><AppText>{item.raffleTitle}</AppText><AppText variant="caption" muted>{new Date(item.createdAt).toLocaleString("ru-RU")} · Канал и комьюнити</AppText></View>)}
    </GlassSurface>
  </View>;
}
const styles = StyleSheet.create({
  page: { gap: 16 }, columns: { gap: 16 }, desktop: { flexDirection: "row", alignItems: "flex-start" },
  form: { minWidth: 0, width: "100%", padding: 20, borderRadius: 22, gap: 12 },
  preview: { minWidth: 0, width: "100%", padding: 18, borderRadius: 22, gap: 14 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 46 },
  selected: { borderWidth: 1, padding: 12, borderRadius: 12, gap: 7 },
  result: { borderWidth: 1, padding: 12, borderRadius: 12, gap: 2 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { flexGrow: 1, borderWidth: 1, borderRadius: 12, minHeight: 44, padding: 10, alignItems: "center" },
  language: { padding: 9, borderWidth: 1, borderRadius: 99 },
  previewChat: { borderWidth: 1, borderRadius: 18, paddingVertical: 26, minWidth: 0 },
  history: { padding: 20, gap: 14, borderRadius: 22 }, historyRow: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
});
