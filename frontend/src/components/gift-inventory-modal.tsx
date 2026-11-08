import { useUiCopy } from "@/components/localized-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { ThemeTokens } from "@/constants/theme";
import { giftsApi } from "@/lib/api";
import { ChallengeRewardOverview } from "@/components/challenge-reward-overview";
import { useAppStore } from "@/store/app-store";
import type { GiftItem, GiftUseEffect } from "@/types";

type GiftInventoryModalProps = {
  visible: boolean;
  viewOnly?: boolean;
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
  if (gift.activationMode === "next_challenge") return false;
  if (gift.kind === "coin") return true;
  if (gift.kind === "replay") return context.completed && context.hasGame;
  if (gift.kind === "hint") return false; // Hints are redeemed by the supported game's lamp button.
  return isTimeGift(gift) && context.sessionReady && context.hasGame && context.supportsTimeExtension;
}

function giftPresentation(gift: GiftItem) {
  if (gift.kind === "hint") return { icon: "bulb-outline" as const, title: "Подсказка ×1", fallback: "Открывает букву. Применяется кнопкой лампочки в игре", accessibility: "Подаренная подсказка для игры" };
  if (gift.kind === "coin") {
    const nextChallenge = gift.activationMode === "next_challenge";
    return {
      icon: "cash-outline" as const,
      title: `+${gift.coinAmount ?? 0} coin`,
      fallback: nextChallenge ? "Автоматически активируются в следующем челлендже" : "Монеты сразу поступят на баланс",
      accessibility: nextChallenge ? `${gift.coinAmount ?? 0} coin на следующий челлендж` : `Получить ${gift.coinAmount ?? 0} coin`,
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
  if (gift.kind === "hint") return "В игре";
  if (gift.activationMode === "next_challenge") return "Следующий челлендж";
  if (usable) return gift.kind === "coin" ? "Получить" : "Применить";
  if (gift.kind === "replay") return "После игры";
  if (isTimeGift(gift) && !context.supportsTimeExtension) return "Игра без таймера";
  return "Запустите";
}

export function GiftInventoryModal({ visible, viewOnly = false, sessionReady = false, completed = false, supportsTimeExtension = false, gameKey, onClose, onUse }: GiftInventoryModalProps) {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [motion] = useState(() => new Animated.Value(1));
  const closing = useRef(false);
  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    motion.setValue(1);
    const entrance = reduceMotion
      ? Animated.timing(motion, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== "web" })
      : Animated.spring(motion, { toValue: 0, damping: 22, stiffness: 190, mass: 0.9, useNativeDriver: Platform.OS !== "web" });
    entrance.start();
    return () => { motion.stopAnimation(); };
  }, [motion, reduceMotion, visible]);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(motion, { toValue: 1, duration: reduceMotion ? 0 : 210, useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
      if (finished) onClose();
      else closing.current = false;
    });
  };
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = useAppStore((state) => state.authMode) === "authenticated" && Boolean(accessToken);
  const queryClient = useQueryClient();
  const queryKey = ["gifts", accessToken] as const;
  const context: GiftContext = { sessionReady, completed, hasGame: Boolean(gameKey), supportsTimeExtension };
  const gifts = useQuery({ queryKey, queryFn: () => giftsApi.list(accessToken!), enabled: visible && authenticated, staleTime: 10_000, retry: 1 });
  const useGift = useMutation({
    mutationFn: (gift: GiftItem) => {
      if (viewOnly || !canUseGift(gift, context)) throw new Error("gift_not_available_in_this_state");
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)", opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: "clamp" }) }]} />
        <Pressable accessibilityLabel={copyText("Закрыть подарки")} style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View style={{ maxHeight: "82%", transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }] }}>
        <BlurView intensity={68} tint={theme.mode === "dark" ? "dark" : "light"} style={[styles.sheet, { maxHeight: "100%", flexShrink: 1, paddingBottom: Math.max(18, insets.bottom + 8) }]}>
          <LinearGradient pointerEvents="none" colors={[String(theme.glassTint), String(theme.surface)]} style={StyleSheet.absoluteFill} />
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleGroup}><View style={styles.giftIcon}><Ionicons name="gift" color={String(theme.onPrimary)} size={23} /></View><View><Text style={styles.title}>{copyText("Подарки")}</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel={copyText("Закрыть")} onPress={close} style={styles.close}><Ionicons name="close" color={String(theme.textMuted)} size={22} /></Pressable>
          </View>

{!authenticated ? <View style={styles.empty}><Ionicons name="lock-closed-outline" size={34} color={String(theme.primary)} /><Text style={styles.emptyTitle}>{copyText("Подарки хранятся в аккаунте")}</Text><Text style={styles.emptyText}>{copyText("Войдите, чтобы получать и использовать бонусы.")}</Text></View> : gifts.isLoading && !viewOnly ? <View style={styles.loading}><ActivityIndicator color={String(theme.primary)} /><Text style={styles.emptyText}>{copyText("Загружаем подарки")}</Text></View> : gifts.isError && !viewOnly ? <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={34} color={String(theme.danger)} /><Text style={styles.emptyTitle}>{copyText("Не удалось загрузить")}</Text><Pressable onPress={() => void gifts.refetch()} style={styles.retry}><Text style={styles.retryText}>{copyText("Повторить")}</Text></Pressable></View> : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {viewOnly && visible ? <ChallengeRewardOverview token={accessToken!} /> : null}
              {available.length ? <Text style={styles.sectionLabel}>{copyText("ДОСТУПНО · ")}{copyContent(available.length)}</Text> : null}
              
              {available.map((gift) => <GiftCard key={gift.id} gift={gift} viewOnly={viewOnly} usable={canUseGift(gift, context)} context={context} busy={useGift.isPending && useGift.variables?.id === gift.id} onUse={() => useGift.mutate(gift)} />)}
              {!available.length && !viewOnly ? <View style={styles.empty}><Ionicons name="gift-outline" size={36} color={String(theme.textMuted)} /><Text style={styles.emptyTitle}>{copyText("Пока пусто")}</Text></View> : null}
              {used.length ? <Text style={[styles.sectionLabel, styles.usedLabel]}>{copyText("ИСПОЛЬЗОВАНО · ")}{copyContent(used.length)}</Text> : null}
              {used.map((gift) => <GiftCard key={gift.id} gift={gift} viewOnly={viewOnly} disabled />)}
            </ScrollView>
          )}
          {useGift.error ? <Text style={styles.errorText}>{copyText("Подарок не применился. Попробуйте ещё раз.")}</Text> : null}
        </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function GiftCard({ gift, viewOnly = false, busy = false, disabled = false, usable = true, context, onUse }: { gift: GiftItem; viewOnly?: boolean; busy?: boolean; disabled?: boolean; usable?: boolean; context?: GiftContext; onUse?: () => void }) {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const unavailable = disabled || gift.status !== "available";
  const presentation = giftPresentation(gift);
  const actionEnabled = !unavailable && usable && !busy;
  return (
    <View style={[styles.card, unavailable && styles.cardUsed]}>
      <LinearGradient colors={[String(theme.primarySoft), String(theme.surfaceMuted)]} style={styles.cardIcon}><Ionicons name={presentation.icon} color={String(unavailable ? theme.textMuted : theme.primary)} size={28} /></LinearGradient>
      <View style={styles.cardInfo}><Text style={[styles.cardTitle, unavailable && styles.dimmed]}>{copyContent(presentation.title)}</Text><Text numberOfLines={2} style={styles.cardDescription}>{copyContent(gift.description || presentation.fallback)}</Text></View>
      {!viewOnly ? <Pressable accessibilityRole="button" accessibilityLabel={copyText(presentation.accessibility)} accessibilityState={{ disabled: !actionEnabled, busy }} disabled={!actionEnabled} onPress={onUse} style={({ pressed }) => [styles.useButton, (!usable || unavailable) && styles.useButtonUsed, pressed && styles.pressed]}>{busy ? <ActivityIndicator size="small" color={String(theme.onPrimary)} /> : <Text style={[styles.useText, (!usable || unavailable) && styles.useTextUsed]}>{copyContent(giftActionLabel(gift, usable, context ?? { sessionReady: false, completed: false, hasGame: false, supportsTimeExtension: false }))}</Text>}</Pressable> : null}
    </View>
  );
}

const createStyles = (theme: ThemeTokens) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { maxHeight: "82%", overflow: "hidden", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 18, paddingTop: 10 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  giftIcon: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.36, shadowRadius: 16 },
  title: { color: theme.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: theme.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: theme.surfaceMuted, borderWidth: 1, borderColor: theme.border },
  list: { gap: 10, paddingBottom: 12 },
  sectionLabel: { color: theme.primary, fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 2, marginBottom: 2 },
  usedLabel: { color: theme.textMuted, marginTop: 12 },
  card: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 22, backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border },
  cardUsed: { opacity: 0.62, borderColor: theme.surfaceMuted },
  cardIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: "900" },
  dimmed: { color: theme.textMuted },
  cardDescription: { color: theme.textMuted, fontSize: 11, lineHeight: 15, marginTop: 3 },
  useButton: { minWidth: 68, minHeight: 40, paddingHorizontal: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary },
  useButtonUsed: { backgroundColor: theme.surfaceRaised },
  useText: { color: theme.onPrimary, fontSize: 11, fontWeight: "900" },
  useTextUsed: { color: theme.textMuted },
  pressed: { transform: [{ scale: 0.95 }] },
  empty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 26 },
  loading: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptyText: { color: theme.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retry: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.surfaceMuted },
  retryText: { color: theme.text, fontSize: 12, fontWeight: "800" },
  errorText: { color: theme.danger, fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
});

export default GiftInventoryModal;
