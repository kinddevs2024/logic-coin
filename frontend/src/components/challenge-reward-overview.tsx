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
  if (offer.isPending) return <ActivityIndicator color="#D8D1FF" />;
  if (offer.isError) return <Pressable accessibilityRole="button" onPress={() => void offer.refetch()}><Text style={styles.body}>{c.failed} · {c.retry}</Text></Pressable>;
  return <View style={styles.list}>
    <Text style={styles.title}>{c.title}</Text><Text style={styles.body}>{c.login}</Text>
    <View style={styles.grid}>{offer.data.daily.map(day => <Pressable key={day.day} accessibilityRole="button" accessibilityLabel={`${c.day} ${day.day}, ${day.coins} coin, ${c[day.status === "available" ? "claim" : day.status]}`} disabled={day.status !== "available" || claim.isPending} onPress={() => claim.mutate("daily")} style={[styles.tile, day.status === "available" && styles.available, day.status === "claimed" && styles.claimed]}>
      <Text style={styles.day}>{c.day} {day.day}</Text>
      <Ionicons name={day.status === "claimed" ? "checkmark-circle" : day.status === "available" ? "gift" : "lock-closed-outline"} size={28} color={day.status === "claimed" ? "#63E0B6" : "#F1CD65"} />
      <Text style={styles.amount}>+{day.coins}</Text>
      <Text style={styles.status}>{claim.isPending && day.status === "available" ? c.wait : c[day.status === "available" ? "claim" : day.status]}</Text>
    </Pressable>)}</View>
    <Text style={styles.body}>{c.rule}</Text>
    <View style={styles.periods}>{([offer.data.weekly, offer.data.monthly]).map(reward => <Pressable key={reward.kind} accessibilityRole="button" disabled={reward.status !== "available" || claim.isPending} onPress={() => claim.mutate(reward.kind)} style={[styles.period, reward.status === "available" && styles.available]}>
      <Text style={styles.day}>{reward.kind === "week" ? c.weekly : c.monthly}</Text>
      <Ionicons name={reward.status === "claimed" ? "checkmark-circle" : "gift-outline"} size={32} color="#F1CD65" />
      <Text style={styles.amount}>+{reward.coins} coin</Text>
      <Text style={styles.body}>{reward.activeDays}/{reward.totalDays}</Text>
      <Text style={styles.status}>{reward.from} — {reward.to}</Text>
      <Text style={styles.action}>{reward.status === "available" && claim.isPending ? c.wait : c[reward.status === "available" ? "claim" : reward.status]}</Text>
    </Pressable>)}</View>
    {claim.error ? <Text style={styles.error}>{claim.error instanceof Error ? claim.error.message : c.failed}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  list: { gap: 12 }, title: { color: "#FFF", fontSize: 18, fontWeight: "800" }, body: { color: "#D2D3E0", fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, tile: { width: "22%", flexGrow: 1, minWidth: 70, minHeight: 120, padding: 10, borderRadius: 18, alignItems: "center", gap: 8, backgroundColor: "rgba(124,92,255,0.14)", borderWidth: 1, borderColor: "rgba(168,154,255,0.24)" },
  available: { backgroundColor: "rgba(124,92,255,0.35)", borderColor: "#D8D1FF" }, claimed: { backgroundColor: "rgba(60,180,140,0.12)", borderColor: "#63E0B6" },
  day: { color: "#FFF", fontWeight: "700", fontSize: 12 }, amount: { color: "#FFE08A", fontWeight: "900", fontSize: 18 }, status: { color: "#D2D3E0", fontSize: 10, textAlign: "center" },
  periods: { flexDirection: "row", gap: 10 }, period: { flex: 1, padding: 14, borderRadius: 20, alignItems: "center", gap: 10, backgroundColor: "rgba(124,92,255,0.14)", borderWidth: 1, borderColor: "rgba(168,154,255,0.24)" }, action: { color: "#D8D1FF", fontWeight: "700", fontSize: 12 }, error: { color: "#FF9AA8", fontSize: 12 },
});
