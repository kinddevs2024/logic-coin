import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { giftsApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { GiftItem, GiftUseEffect } from "@/types";

type GiftInventoryModalProps = {
  visible: boolean;
  sessionReady?: boolean;
  completed?: boolean;
  supportsTimeExtension?: boolean;
  gameKey?: string;
  onClose: () => void;
  onUse?: (gift: GiftItem, effect: GiftUseEffect) => void;
};

type GiftContext = {
  sessionReady: boolean;
  completed: boolean;
  hasGame: boolean;
  supportsTimeExtension: boolean;
};

function isTimeGift(gift: GiftItem) {
  return gift.kind === "time_extension" || gift.kind === "extra_time";
}

function canUseGift(gift: GiftItem, context: GiftContext) {
  if (gift.status !== "available") return false;
  if (gift.kind === "coin") return true;
  if (gift.kind === "replay") return context.completed && context.hasGame;
  return isTimeGift(gift) && context.sessionReady && context.hasGame && context.supportsTimeExtension;
}

function giftPresentation(gift: GiftItem) {
  if (gift.kind === "coin") {
    return {
      icon: "cash-outline" as const,
      title: `+${gift.coinAmount ?? 0} coin`,
      fallback: "Монеты сразу поступят на баланс",
      accessibility: `Получить ${gift.coinAmount ?? 0} coin`,
    };
  }
  if (gift.kind === "replay") {
    return {
      icon: "refresh" as const,
      title: `Повтор ×${gift.replayCount ?? 1}`,
      fallback: "Ещё одна попытка в завершённом челлендже",
      accessibility: "Использовать подарок для повтора игры",
    };
  }
  return {
    icon: "time-outline" as const,
    title: `+${gift.amountSeconds ?? 0} секунд`,
    fallback: "Дополнительное время для текущей попытки",
    accessibility: `Добавить ${gift.amountSeconds ?? 0} секунд`,
  };
}

function giftActionLabel(gift: GiftItem, usable: boolean, context: GiftContext) {
  if (gift.status === "used") return "Готово";
  if (usable) return gift.kind === "coin" ? "Получить" : "Применить";
  if (gift.kind === "replay") return "После игры";
  if (isTimeGift(gift) && !context.supportsTimeExtension) return "Игра без таймера";
  return "Запустите";
}

export function GiftInventoryModal({ visible, sessionReady = false, completed = false, supportsTimeExtension = false, gameKey, onClose, onUse }: GiftInventoryModalProps) {
  const insets = useSafeAreaInsets();
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = useAppStore((state) => state.authMode) === "authenticated" && Boolean(accessToken);
  const queryClient = useQueryClient();
  const queryKey = ["gifts", accessToken] as const;
  const context: GiftContext = { sessionReady, completed, hasGame: Boolean(gameKey), supportsTimeExtension };
  const gifts = useQuery({ queryKey, queryFn: () => giftsApi.list(accessToken!), enabled: visible && authenticated, staleTime: 10_000, retry: 1 });
  const useGift = useMutation({
    mutationFn: (gift: GiftItem) => {
      if (!canUseGift(gift, context)) throw new Error("gift_not_available_in_this_state");
      return giftsApi.use(gift.id, accessToken!, gift.kind === "coin" ? undefined : gameKey);
    },
    onSuccess: ({ gift, effect }) => {
      queryClient.setQueryData<GiftItem[]>(queryKey, (items = []) => items.map((item) => item.id === gift.id ? gift : item));
      void queryClient.invalidateQueries({ queryKey: ["challenges"] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onUse?.(gift, effect);
    },
  });
  const available = (gifts.data ?? []).filter((gift) => gift.status === "available");
  const used = (gifts.data ?? []).filter((gift) => gift.status === "used");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Закрыть подарки" style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={68} tint="dark" style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 8) }]}>
          <LinearGradient pointerEvents="none" colors={["rgba(124,92,255,0.22)", "rgba(255,255,255,0.02)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleGroup}><View style={styles.giftIcon}><Ionicons name="gift" color="#FFFFFF" size={23} /></View><View><Text style={styles.title}>Подарки</Text><Text style={styles.subtitle}>Бонусы аккаунта</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose} style={styles.close}><Ionicons name="close" color="rgba(255,255,255,0.78)" size={22} /></Pressable>
          </View>

          {!authenticated ? <View style={styles.empty}><Ionicons name="lock-closed-outline" size={34} color="#A89AFF" /><Text style={styles.emptyTitle}>Подарки хранятся в аккаунте</Text><Text style={styles.emptyText}>Войдите, чтобы получать и использовать бонусы.</Text></View> : gifts.isLoading ? <View style={styles.loading}><ActivityIndicator color="#A89AFF" /><Text style={styles.emptyText}>Загружаем подарки</Text></View> : gifts.isError ? <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={34} color="#FF8B9A" /><Text style={styles.emptyTitle}>Не удалось загрузить</Text><Pressable onPress={() => void gifts.refetch()} style={styles.retry}><Text style={styles.retryText}>Повторить</Text></Pressable></View> : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {available.length ? <Text style={styles.sectionLabel}>ДОСТУПНО · {available.length}</Text> : null}
              {available.map((gift) => <GiftCard key={gift.id} gift={gift} usable={canUseGift(gift, context)} context={context} busy={useGift.isPending && useGift.variables?.id === gift.id} onUse={() => useGift.mutate(gift)} />)}
              {!available.length ? <View style={styles.empty}><Ionicons name="gift-outline" size={36} color="rgba(255,255,255,0.34)" /><Text style={styles.emptyTitle}>Пока пусто</Text><Text style={styles.emptyText}>Новые подарки появятся после активностей и серий входа.</Text></View> : null}
              {used.length ? <Text style={[styles.sectionLabel, styles.usedLabel]}>ИСПОЛЬЗОВАНО · {used.length}</Text> : null}
              {used.map((gift) => <GiftCard key={gift.id} gift={gift} disabled />)}
            </ScrollView>
          )}
          {useGift.error ? <Text style={styles.errorText}>Подарок не применился. Попробуйте ещё раз.</Text> : null}
        </BlurView>
      </View>
    </Modal>
  );
}

function GiftCard({ gift, busy = false, disabled = false, usable = true, context, onUse }: { gift: GiftItem; busy?: boolean; disabled?: boolean; usable?: boolean; context?: GiftContext; onUse?: () => void }) {
  const unavailable = disabled || gift.status !== "available";
  const presentation = giftPresentation(gift);
  const actionEnabled = !unavailable && usable && !busy;
  return (
    <View style={[styles.card, unavailable && styles.cardUsed]}>
      <LinearGradient colors={unavailable ? ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.025)"] : ["rgba(124,92,255,0.28)", "rgba(55,189,248,0.10)"]} style={styles.cardIcon}><Ionicons name={presentation.icon} color={unavailable ? "rgba(255,255,255,0.34)" : "#D8D1FF"} size={28} /></LinearGradient>
      <View style={styles.cardInfo}><Text style={[styles.cardTitle, unavailable && styles.dimmed]}>{presentation.title}</Text><Text numberOfLines={2} style={styles.cardDescription}>{gift.description || presentation.fallback}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={presentation.accessibility} accessibilityState={{ disabled: !actionEnabled, busy }} disabled={!actionEnabled} onPress={onUse} style={({ pressed }) => [styles.useButton, (!usable || unavailable) && styles.useButtonUsed, pressed && styles.pressed]}>{busy ? <ActivityIndicator size="small" color="#0A0910" /> : <Text style={[styles.useText, (!usable || unavailable) && styles.useTextUsed]}>{giftActionLabel(gift, usable, context ?? { sessionReady: false, completed: false, hasGame: false, supportsTimeExtension: false })}</Text>}</Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,5,15,0.55)" },
  sheet: { maxHeight: "82%", overflow: "hidden", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(10,14,30,0.92)", paddingHorizontal: 18, paddingTop: 10 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.24)", marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  giftIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#7357F6", shadowColor: "#7357F6", shadowOpacity: 0.36, shadowRadius: 16 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: "rgba(255,255,255,0.44)", fontSize: 11, fontWeight: "700", marginTop: 2 },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  list: { gap: 10, paddingBottom: 12 },
  sectionLabel: { color: "#A89AFF", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 2, marginBottom: 2 },
  usedLabel: { color: "rgba(255,255,255,0.30)", marginTop: 12 },
  card: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(168,154,255,0.24)" },
  cardUsed: { opacity: 0.62, borderColor: "rgba(255,255,255,0.08)" },
  cardIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  dimmed: { color: "rgba(255,255,255,0.48)" },
  cardDescription: { color: "rgba(255,255,255,0.44)", fontSize: 11, lineHeight: 15, marginTop: 3 },
  useButton: { minWidth: 68, minHeight: 40, paddingHorizontal: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#D8D1FF" },
  useButtonUsed: { backgroundColor: "rgba(255,255,255,0.07)" },
  useText: { color: "#0A0910", fontSize: 11, fontWeight: "900" },
  useTextUsed: { color: "rgba(255,255,255,0.34)" },
  pressed: { transform: [{ scale: 0.95 }] },
  empty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 26 },
  loading: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptyText: { color: "rgba(255,255,255,0.44)", fontSize: 12, lineHeight: 18, textAlign: "center" },
  retry: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.1)" },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  errorText: { color: "#FF9AA8", fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
});

export default GiftInventoryModal;
