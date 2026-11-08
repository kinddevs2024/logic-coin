import { useUiCopy } from "@/components/localized-native";

import { useMemo } from "react";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { ThemeTokens } from "@/constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/hooks/use-translation";
import { giftsApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
const copy = {
  ru: { title: "Заходи каждый день", day: "День", claim: "Получить", claimed: "Получено", locked: "Недоступно", missed: "Пропущено", weekly: "За неделю", monthly: "За месяц", rule: "Заверши хотя бы одну игру в день. Награда доступна в конце периода.", login: "100 коинов за каждый день входа. Пропустишь день — серия начнётся заново.", retry: "Повторить", failed: "Не удалось загрузить подарки", wait: "Подождите…" },
  en: { title: "Come back every day", day: "Day", claim: "Claim", claimed: "Claimed", locked: "Locked", missed: "Missed", weekly: "Weekly activity", monthly: "Monthly activity", rule: "Finish at least one game a day. The reward unlocks at the end of the period.", login: "100 coins for each login day. Skip a day and the streak restarts.", retry: "Retry", failed: "Could not load gifts", wait: "Please wait…" },
  uz: { title: "Har kuni kiring", day: "Kun", claim: "Olish", claimed: "Olindi", locked: "Yopiq", missed: "O‘tkazib yuborildi", weekly: "Haftalik faollik", monthly: "Oylik faollik", rule: "Har kuni kamida bitta o‘yinni yakunlang. Mukofot davr oxirida ochiladi.", login: "Har kirgan kuningiz uchun 100 coin. Bir kunni qoldirsangiz, ketma-ketlik qaytadan boshlanadi.", retry: "Qayta urinish", failed: "Sovg‘alar yuklanmadi", wait: "Kutib turing…" },
};
export function ChallengeRewardOverview({ token }: { token: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { copyContent, formatCopy } = useUiCopy();
  const { language } = useTranslation();
  const c = copy[language];
  const client = useQueryClient();
  const offer = useQuery({ queryKey: ["coin-rewards", token], queryFn: () => giftsApi.coinRewards(token), staleTime: 0, refetchInterval: 30_000, retry: 1 });
  const claim = useMutation({
    mutationFn: (kind: "daily" | "week" | "month") => giftsApi.claimCoinReward(kind, token),
    onSuccess: async result => {
      useAppStore.getState().setCoinBalance(result.coins.balance);
      await Promise.all([client.invalidateQueries({ queryKey: ["coin-rewards"] }), client.invalidateQueries({ queryKey: ["bootstrap"] }), client.invalidateQueries({ queryKey: ["challenges"] })]);
    },
  });
  if (offer.isPending) return <ActivityIndicator color={String(theme.primary)} />;
  if (offer.isError) return <Pressable accessibilityRole="button" onPress={() => void offer.refetch()}><Text style={styles.body}>{copyContent(c.failed)} · {copyContent(c.retry)}</Text></Pressable>;
  return <View style={styles.list}>
    <View style={styles.grid}>{offer.data.daily.map(day => <Pressable key={day.day} accessibilityRole="button" accessibilityLabel={formatCopy("{0} {1}, {2} coin, {3}", [c.day, day.day, day.coins, c[day.status === "available" ? "claim" : day.status]])} disabled={day.status !== "available" || claim.isPending} onPress={() => claim.mutate("daily")} style={[styles.tile, day.status === "available" && styles.available, day.status === "claimed" && styles.claimed]}>
      <Text numberOfLines={2} style={styles.day}>{copyContent(c.day)} {copyContent(day.day)}</Text>
      {claim.isPending && day.status === "available" ? <ActivityIndicator color={String(theme.primary)} /> : <Ionicons name={day.status === "claimed" ? "checkmark-circle" : day.status === "available" ? "gift" : "lock-closed-outline"} size={28} color={day.status === "claimed" ? String(theme.primary) : String(theme.textMuted)} />}
      <Text style={styles.amount}>+{copyContent(day.coins)}</Text>
    </Pressable>)}
    {([offer.data.weekly, offer.data.monthly]).map(reward => <Pressable key={reward.kind} accessibilityRole="button" accessibilityLabel={formatCopy("{0}, {1} coin, {2}/{3}, {4}", [reward.kind === "week" ? c.weekly : c.monthly, reward.coins, reward.activeDays, reward.totalDays, c[reward.status === "available" ? "claim" : reward.status]])} disabled={reward.status !== "available" || claim.isPending} onPress={() => claim.mutate(reward.kind)} style={[styles.tile, reward.status === "available" && styles.available, reward.status === "claimed" && styles.claimed]}>
      <Text numberOfLines={2} style={styles.day}>{copyContent(reward.kind === "week" ? c.weekly : c.monthly)}</Text>
      {reward.status === "available" && claim.isPending ? <ActivityIndicator color={String(theme.primary)} /> : <Ionicons name={reward.status === "claimed" ? "checkmark-circle" : reward.status === "available" ? "gift-outline" : "lock-closed-outline"} size={28} color={reward.status === "claimed" ? String(theme.primary) : String(theme.textMuted)} />}
      <Text style={styles.amount}>+{copyContent(reward.coins)}</Text>
    </Pressable>)}</View>
    {claim.error ? <Text style={styles.error}>{copyContent(claim.error instanceof Error ? claim.error.message : c.failed)}</Text> : null}
  </View>;
}
const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  list: { gap: 12 }, title: { color: theme.text, fontSize: 18, fontWeight: "800" }, body: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 }, tile: { width: "31.5%", aspectRatio: 1, padding: 6, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  available: { backgroundColor: theme.primarySoft, borderColor: theme.primary }, claimed: { backgroundColor: theme.primarySoft, borderColor: theme.primary },
  day: { color: theme.text, fontWeight: "700", fontSize: 11, lineHeight: 14, height: 28, textAlign: "center", textAlignVertical: "center" }, amount: { color: theme.text, fontWeight: "900", fontSize: 18 }, status: { color: theme.textMuted, fontSize: 10, textAlign: "center" },
  periods: { flexDirection: "row", gap: 10 }, period: { flex: 1, padding: 14, borderRadius: 20, alignItems: "center", gap: 10, backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border }, action: { color: theme.primary, fontWeight: "700", fontSize: 12 }, error: { color: theme.danger, fontSize: 12 },
});
