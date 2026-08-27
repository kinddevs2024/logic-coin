import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { useAppTheme } from "@/hooks/use-app-theme";
import { challengesApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type {
  ContestRewardResult,
  ContestRewardType,
} from "@/types";

const rouletteKinds = [
  "coin",
  "replay",
  "extra_time",
  "coin",
  "extra_time",
  "replay",
  "coin",
] as const;

const confetti = Array.from({ length: 22 }, (_, index) => ({
  left: `${(index * 37) % 96}%` as `${number}%`,
  delay: (index % 7) * 65,
  rotate: (index * 71) % 240,
  color: ["#1183F7", "#7A5AF8", "#FFCA3A", "#22C77A", "#FF5C8A"][index % 5]!,
}));

function rewardLabel(result: ContestRewardResult) {
  if (result.rewardType === "cash") return formatMoney(result.cashUnits);
  if (result.rewardType === "box") return "Бокс с 3 подарками";
  if (result.rewardType === "random") return "Случайный подарок";
  if (result.rewardType === "coins") return `${result.coinAmount} coin`;
  return "Подарок";
}

function rewardIcon(type: ContestRewardType) {
  if (type === "cash") return "wallet" as const;
  if (type === "box") return "gift" as const;
  if (type === "random") return "sparkles" as const;
  return "diamond" as const;
}

function RouletteItem({ kind }: { kind: (typeof rouletteKinds)[number] }) {
  const icon = kind === "coin" ? "diamond" : kind === "replay" ? "refresh" : "time";
  const label = kind === "coin" ? "COIN" : kind === "replay" ? "ПОВТОР" : "ВРЕМЯ";
  return (
    <View style={styles.rouletteItem}>
      <Ionicons name={icon} size={25} color="#FFFFFF" />
      <AppText style={styles.rouletteLabel}>{label}</AppText>
    </View>
  );
}

function ResultContents({ result }: { result: ContestRewardResult }) {
  if (result.rewardType === "box") {
    return (
      <View style={styles.contentsRow}>
        <PrizeChip icon="diamond" value={`${result.coinAmount} coin`} />
        <PrizeChip icon="refresh" value={`×${result.replayCount}`} />
        <PrizeChip icon="time" value={`+${result.extraTimeSeconds} сек`} />
      </View>
    );
  }
  if (result.rewardType === "random" && result.giftKind) {
    return (
      <View style={styles.contentsRow}>
        <PrizeChip
          icon={result.giftKind === "coin" ? "diamond" : result.giftKind === "replay" ? "refresh" : "time"}
          value={
            result.giftKind === "coin"
              ? `${result.coinAmount} coin`
              : result.giftKind === "replay"
                ? `×${result.replayCount}`
                : `+${result.extraTimeSeconds} сек`
          }
        />
      </View>
    );
  }
  return null;
}

function PrizeChip({ icon, value }: { icon: "diamond" | "refresh" | "time"; value: string }) {
  return (
    <View style={styles.prizeChip}>
      <Ionicons name={icon} size={17} color="#FFFFFF" />
      <AppText style={styles.prizeChipText}>{value}</AppText>
    </View>
  );
}

export function ContestRewardModal() {
  const theme = useAppTheme();
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = useAppStore((state) => state.authMode === "authenticated" && Boolean(state.accessToken));
  const setBalance = useAppStore((state) => state.setBalance);
  const setCoinBalance = useAppStore((state) => state.setCoinBalance);
  const queryClient = useQueryClient();
  const [claimedResult, setClaimedResult] = useState<{ sourceId: string; result: ContestRewardResult } | null>(null);
  const [showResultId, setShowResultId] = useState<string | null>(null);
  const [entrance] = useState(() => new Animated.Value(0));
  const [celebration] = useState(() => new Animated.Value(0));
  const [roulette] = useState(() => new Animated.Value(0));
  const [fly] = useState(() => new Animated.Value(0));

  const query = useQuery({
    queryKey: ["contest-reward", "pending", accessToken],
    queryFn: () => challengesApi.pendingReward(accessToken!),
    enabled: authenticated,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const reward = query.data;
  const visible = Boolean(reward);
  const result =
    claimedResult && claimedResult.sourceId === reward?.result.id
      ? claimedResult.result
      : reward?.result ?? null;
  const showResult = showResultId === reward?.result.id;
  const selectedRouletteIndex = useMemo(() => {
    if (!result?.giftKind) return 0;
    for (let index = rouletteKinds.length - 1; index >= 0; index -= 1) {
      if (rouletteKinds[index] === result.giftKind) return index;
    }
    return 0;
  }, [result]);
  const flightItems = useMemo(() => {
    if (!result) return [];
    if (result.rewardType === "cash") {
      return [{ icon: "wallet" as const, x: -150, y: -360, color: "#1183F7" }];
    }
    if (result.rewardType === "box") {
      return [
        { icon: "diamond" as const, x: 150, y: -350, color: "#F3B61F" },
        { icon: "refresh" as const, x: -145, y: -300, color: "#7A5AF8" },
        { icon: "time" as const, x: 145, y: 300, color: "#22C77A" },
      ];
    }
    if (result.giftKind === "replay") return [{ icon: "refresh" as const, x: -145, y: -330, color: "#7A5AF8" }];
    if (result.giftKind === "extra_time") return [{ icon: "time" as const, x: 145, y: 300, color: "#22C77A" }];
    return [{ icon: "diamond" as const, x: 150, y: -350, color: "#F3B61F" }];
  }, [result]);

  useEffect(() => {
    if (!visible) return;
    entrance.setValue(0);
    celebration.setValue(0);
    roulette.setValue(0);
    fly.setValue(0);
    Animated.parallel([
      Animated.spring(entrance, {
        toValue: 1,
        damping: 20,
        stiffness: 185,
        mass: 0.85,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(celebration, {
        toValue: 1,
        duration: 1_050,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [celebration, entrance, fly, roulette, visible]);

  const claim = useMutation({
    mutationFn: () => challengesApi.claimReward(reward!.result.id, accessToken!),
    onSuccess: (payload) => {
      setClaimedResult({ sourceId: reward!.result.id, result: payload.result });
      if (payload.wallet) setBalance(payload.wallet.availableUnits);
      if (payload.coins) setCoinBalance(payload.coins.balance);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (payload.result.rewardType === "random") {
        setShowResultId(reward!.result.id);
        Animated.timing(roulette, {
          toValue: selectedRouletteIndex,
          duration: 2_350,
          useNativeDriver: Platform.OS !== "web",
        }).start(() => finishClaim());
      } else {
        setShowResultId(reward!.result.id);
        finishClaim();
      }
    },
  });

  const finishClaim = () => {
    celebration.setValue(0);
    Animated.parallel([
      Animated.timing(celebration, {
        toValue: 1,
        duration: 900,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(fly, {
          toValue: 1,
          duration: 720,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    ]).start(({ finished }) => {
      if (!finished) return;
      queryClient.setQueryData(["contest-reward", "pending", accessToken], null);
      void queryClient.invalidateQueries({ queryKey: ["gifts"] });
      void queryClient.invalidateQueries({ queryKey: ["challenges"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    });
  };

  if (!result || !reward) return null;

  const rouletteTranslate = roulette.interpolate({
    inputRange: [0, Math.max(1, rouletteKinds.length - 1)],
    outputRange: [92, 92 - Math.max(1, rouletteKinds.length - 1) * 88],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <BlurView tint={theme.mode === "dark" ? "dark" : "light"} intensity={54} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        {confetti.map((particle, index) => (
          <Animated.View
            key={index}
            pointerEvents="none"
            style={[
              styles.confetti,
              {
                left: particle.left,
                backgroundColor: particle.color,
                opacity: celebration.interpolate({ inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateY: celebration.interpolate({ inputRange: [0, 1], outputRange: [-80 - particle.delay / 4, 720 + particle.delay] }) },
                  { rotate: `${particle.rotate}deg` },
                ],
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
        >
          <GlassSurface intensity={90} variant="strong" style={styles.card}>
            <LinearGradient colors={["rgba(17,131,247,0.22)", "rgba(122,90,248,0.08)", "rgba(255,255,255,0.02)"]} style={StyleSheet.absoluteFill} />
            <View style={[styles.heroIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name={rewardIcon(result.rewardType)} size={31} color="#FFFFFF" />
            </View>
            <AppText style={styles.eyebrow}>ИТОГИ ЧЕЛЛЕНДЖА</AppText>
            <AppText style={styles.title}>Вы заняли {result.rank} место</AppText>
            <AppText style={[styles.rewardValue, { color: theme.primary }]}>{rewardLabel(result)}</AppText>

            {result.rewardType === "random" && showResult ? (
              <View style={styles.rouletteWindow}>
                <Animated.View style={[styles.rouletteTrack, { transform: [{ translateX: rouletteTranslate }] }]}>
                  {rouletteKinds.map((kind, index) => <RouletteItem key={`${kind}-${index}`} kind={kind} />)}
                </Animated.View>
                <View pointerEvents="none" style={[styles.rouletteMarker, { backgroundColor: theme.primary }]} />
              </View>
            ) : null}

            {showResult ? <ResultContents result={result} /> : null}

            <View style={styles.standingsHeader}>
              <AppText variant="label">Результаты игроков</AppText>
              <AppText variant="caption" muted>{reward.standings.length}</AppText>
            </View>
            <ScrollView style={styles.standings} contentContainerStyle={styles.standingsContent} showsVerticalScrollIndicator={false}>
              {reward.standings.map((entry) => (
                <View key={entry.id} style={[styles.standingRow, entry.userId === result.userId && { backgroundColor: theme.primarySoft }]}>
                  <AppText style={[styles.rank, { color: entry.rank <= 3 ? "#F3B61F" : theme.textMuted }]}>{entry.rank}</AppText>
                  <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size={34} />
                  <View style={styles.person}>
                    <AppText style={styles.personName} numberOfLines={1}>{entry.name}</AppText>
                    {entry.countryCode ? <CountryFlagBadge countryCode={entry.countryCode} size={13} /> : null}
                  </View>
                  <AppText style={styles.standingReward}>{rewardLabel(entry)}</AppText>
                </View>
              ))}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Забрать приз"
              disabled={claim.isPending || showResult}
              onPress={() => claim.mutate()}
              style={({ pressed }) => [styles.claimButton, { backgroundColor: theme.primary }, pressed && styles.pressed, (claim.isPending || showResult) && styles.disabled]}
            >
              {claim.isPending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="gift" size={20} color="#FFFFFF" /><AppText color="#FFFFFF" variant="label">Забрать</AppText></>}
            </Pressable>
            {claim.isError ? <AppText style={styles.error}>Не удалось забрать приз. Попробуйте ещё раз.</AppText> : null}
          </GlassSurface>
        </Animated.View>

        {showResult ? flightItems.map((item, index) => (
          <Animated.View
            key={`${item.icon}-${index}`}
            pointerEvents="none"
            style={[
              styles.flyingPrize,
              {
                backgroundColor: item.color,
                opacity: fly.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, item.x] }) },
                  { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, item.y] }) },
                  { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${index % 2 ? -32 : 32}deg`] }) },
                  { scale: fly.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.7, 1.25, 0.5] }) },
                ],
              },
            ]}
          >
            <Ionicons name={item.icon} size={28} color="#FFFFFF" />
          </Animated.View>
        )) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 70 },
  dim: { backgroundColor: "rgba(3,12,30,0.38)" },
  confetti: { position: "absolute", top: 0, width: 8, height: 18, borderRadius: 3, zIndex: 3 },
  cardWrap: { width: "100%", maxWidth: 560, maxHeight: "82%", zIndex: 8 },
  card: { overflow: "hidden", borderRadius: 34, padding: 18, alignItems: "center", maxHeight: "100%" },
  heroIcon: { width: 64, height: 64, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 9, shadowColor: "#1183F7", shadowOpacity: 0.35, shadowRadius: 20 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 2, opacity: 0.54 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: "900", textAlign: "center", marginTop: 5 },
  rewardValue: { fontSize: 28, lineHeight: 34, fontWeight: "900", textAlign: "center", marginTop: 2 },
  contentsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 7, marginTop: 9 },
  prizeChip: { minHeight: 35, paddingHorizontal: 10, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(17,131,247,0.80)" },
  prizeChipText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  rouletteWindow: { width: "100%", height: 84, overflow: "hidden", borderRadius: 22, backgroundColor: "rgba(5,18,42,0.88)", marginTop: 12, justifyContent: "center" },
  rouletteTrack: { flexDirection: "row", gap: 8, width: 680 },
  rouletteItem: { width: 80, height: 66, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", gap: 4 },
  rouletteLabel: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  rouletteMarker: { position: "absolute", top: 5, bottom: 5, left: "50%", width: 3, marginLeft: -2, borderRadius: 2 },
  standingsHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 6 },
  standings: { width: "100%", maxHeight: 210 },
  standingsContent: { gap: 5, paddingBottom: 5 },
  standingRow: { minHeight: 48, borderRadius: 17, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  rank: { width: 24, fontWeight: "900", textAlign: "center" },
  person: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 },
  personName: { flexShrink: 1, fontSize: 13, fontWeight: "800" },
  standingReward: { maxWidth: 120, fontSize: 11, fontWeight: "900", textAlign: "right" },
  claimButton: { width: "100%", minHeight: 56, borderRadius: 21, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 11, shadowColor: "#1183F7", shadowOpacity: 0.28, shadowRadius: 16 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  disabled: { opacity: 0.62 },
  error: { color: "#D63A55", fontSize: 11, fontWeight: "800", marginTop: 7, textAlign: "center" },
  flyingPrize: { position: "absolute", zIndex: 20, width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
