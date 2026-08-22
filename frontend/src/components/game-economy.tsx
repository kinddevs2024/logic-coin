import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/app-text";
import { cosmeticFor, cosmeticsFor } from "@/games/cosmetics";
import { gameProgressFor, type GameId, useGameProgressStore } from "@/games/progress-store";
import { useClientReady } from "@/hooks/use-client-ready";

export function GameEconomyHud({
  gameId,
  tone = "dark",
  onOpen,
}: {
  gameId: GameId;
  tone?: "dark" | "light";
  onOpen: () => void;
}) {
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, gameId));
  const ready = useClientReady();
  const progress = ready ? saved : gameProgressFor({}, gameId);
  const cosmetic = cosmeticFor(gameId, progress.selectedCosmetic);
  const color = tone === "dark" ? "#272A39" : "#FFFFFF";
  const surface = tone === "dark" ? "rgba(255,255,255,0.76)" : "rgba(24,24,32,0.66)";

  return (
    <View style={styles.hudGroup}>
      <Pressable accessibilityRole="button" accessibilityLabel="Монеты и скины" onPress={onOpen} style={({ pressed }) => [styles.coinPill, { backgroundColor: surface }, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="hexagon-multiple" size={18} color="#F5B800" />
        <AppText style={[styles.coinValue, { color }]}>{progress.coins}</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Открыть скины" onPress={onOpen} style={({ pressed }) => [styles.hudIcon, { backgroundColor: surface }, pressed && styles.pressed]}>
        <MaterialCommunityIcons name={cosmetic.icon} size={20} color={tone === "dark" ? cosmetic.primary : "#FFFFFF"} />
      </Pressable>
    </View>
  );
}

export function GameEconomyModal({
  gameId,
  visible,
  onClose,
}: {
  gameId: GameId;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const saved = useGameProgressStore((state) => gameProgressFor(state.games, gameId));
  const ready = useClientReady();
  const progress = ready ? saved : gameProgressFor({}, gameId);
  const purchaseCosmetic = useGameProgressStore((state) => state.purchaseCosmetic);
  const selectCosmetic = useGameProgressStore((state) => state.selectCosmetic);
  const [notice, setNotice] = useState("");
  const [pendingSkinId, setPendingSkinId] = useState<string | null>(null);
  const skins = useMemo(() => cosmeticsFor(gameId), [gameId]);
  const pendingSkin = skins.find((skin) => skin.id === pendingSkinId) ?? null;

  const close = () => {
    setPendingSkinId(null);
    setNotice("");
    onClose();
  };

  const chooseSkin = (id: string, price: number) => {
    if (progress.unlockedCosmetics.includes(id)) {
      selectCosmetic(gameId, id);
      setNotice("Выбрано");
      setPendingSkinId(null);
      return;
    }
    setPendingSkinId(id);
    setNotice(progress.coins < price ? "Недостаточно coin" : "");
  };

  const confirmPurchase = () => {
    if (!pendingSkin) return;
    const purchased = purchaseCosmetic(gameId, pendingSkin.id, pendingSkin.price);
    setNotice(purchased ? `${pendingSkin.name} куплен и выбран` : "Недостаточно coin");
    if (purchased) setPendingSkinId(null);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={close}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={close} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
          <View style={styles.sheetTop}>
            <View style={styles.walletTitle}>
              <MaterialCommunityIcons name="hexagon-multiple" size={23} color="#F5B800" />
              <AppText style={styles.sheetTitle}>{progress.coins} coin</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={close} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#282936" />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skinRow}>
            {skins.map((skin) => {
              const unlocked = progress.unlockedCosmetics.includes(skin.id);
              const selected = progress.selectedCosmetic === skin.id;
              return (
                <Pressable key={skin.id} accessibilityRole="button" accessibilityLabel={`${skin.name}${unlocked ? "" : `, ${skin.price} coin`}`} onPress={() => chooseSkin(skin.id, skin.price)} style={({ pressed }) => [styles.skinCard, selected && { borderColor: skin.primary, borderWidth: 3 }, pressed && styles.pressed]}>
                  <View style={[styles.skinPreview, { backgroundColor: skin.secondary }]}>
                    <MaterialCommunityIcons name={skin.icon} size={34} color={skin.primary} />
                  </View>
                  <AppText numberOfLines={1} style={styles.skinName}>{skin.name}</AppText>
                  <View style={styles.skinPrice}>
                    {unlocked ? <Ionicons name={selected ? "checkmark-circle" : "checkmark"} size={14} color="#16A34A" /> : <MaterialCommunityIcons name="hexagon-multiple" size={13} color="#E5A900" />}
                    <AppText style={styles.skinPriceText}>{unlocked ? (selected ? "Выбран" : "Открыт") : skin.price}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {pendingSkin ? (
            <Animated.View entering={FadeIn.duration(140)} style={styles.confirmCard}>
              <View style={[styles.confirmPreview, { backgroundColor: pendingSkin.secondary }]}>
                <MaterialCommunityIcons name={pendingSkin.icon} size={32} color={pendingSkin.primary} />
              </View>
              <View style={styles.confirmCopy}>
                <AppText style={styles.confirmTitle}>Купить «{pendingSkin.name}»?</AppText>
                <AppText style={styles.confirmMeta}>{pendingSkin.price} coin · останется {Math.max(0, progress.coins - pendingSkin.price)}</AppText>
              </View>
              <View style={styles.confirmActions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Отменить покупку" onPress={() => setPendingSkinId(null)} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                  <AppText style={styles.cancelText}>Отмена</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Купить ${pendingSkin.name} за ${pendingSkin.price} coin`} disabled={progress.coins < pendingSkin.price} onPress={confirmPurchase} style={({ pressed }) => [styles.buyButton, { backgroundColor: pendingSkin.primary }, progress.coins < pendingSkin.price && styles.disabled, pressed && styles.pressed]}>
                  <Ionicons name="bag-check-outline" size={17} color="#FFFFFF" />
                  <AppText style={styles.buyText}>Купить</AppText>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          <View style={styles.cosmeticNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color="#705CF6" />
            <View style={styles.cosmeticNoteCopy}>
              <AppText style={styles.cosmeticNoteTitle}>Игровые coin</AppText>
              <AppText style={styles.cosmeticNoteText}>Используются только для скинов. Конкурсные coins и деньги хранятся отдельно.</AppText>
            </View>
          </View>
          {notice ? <AppText style={styles.notice}>{notice}</AppText> : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hudGroup: { flexDirection: "row", alignItems: "center", gap: 7 },
  coinPill: { minHeight: 40, borderRadius: 13, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  coinValue: { fontSize: 13, lineHeight: 16, fontWeight: "900" },
  hudIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.46)" },
  backdrop: { flex: 1, backgroundColor: "rgba(11,13,20,0.46)", justifyContent: "flex-end" },
  sheet: { width: "100%", maxWidth: 720, alignSelf: "center", borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#F7F7FA", paddingTop: 14, paddingHorizontal: 16, shadowColor: "#000000", shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } },
  sheetTop: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  walletTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { color: "#20222E", fontSize: 21, lineHeight: 26, fontWeight: "900" },
  closeButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#E9EAF0", alignItems: "center", justifyContent: "center" },
  skinRow: { gap: 10, paddingBottom: 14 },
  skinCard: { width: 116, minHeight: 142, borderRadius: 21, borderWidth: 1, borderColor: "#E0E1E8", backgroundColor: "#FFFFFF", padding: 9, alignItems: "center", gap: 6 },
  skinPreview: { width: 74, height: 66, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  skinName: { color: "#262833", fontSize: 12, lineHeight: 15, fontWeight: "900", maxWidth: "100%" },
  skinPrice: { minHeight: 21, borderRadius: 999, paddingHorizontal: 8, backgroundColor: "#F0F1F5", flexDirection: "row", alignItems: "center", gap: 4 },
  skinPriceText: { color: "#555866", fontSize: 9, lineHeight: 12, fontWeight: "900" },
  confirmCard: { marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: "#D9DBE5", backgroundColor: "#FFFFFF", padding: 11, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  confirmPreview: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  confirmCopy: { flex: 1, minWidth: 160, gap: 2 },
  confirmTitle: { color: "#20222E", fontSize: 14, lineHeight: 18, fontWeight: "900" },
  confirmMeta: { color: "#737685", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  confirmActions: { width: "100%", flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  cancelButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#ECEEF4" },
  cancelText: { color: "#454855", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  buyButton: { minHeight: 40, borderRadius: 13, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  buyText: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  cosmeticNote: { minHeight: 64, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: "#EEEAFE", flexDirection: "row", alignItems: "center", gap: 10 },
  cosmeticNoteCopy: { flex: 1, gap: 2 },
  cosmeticNoteTitle: { color: "#3B2E73", fontSize: 12, lineHeight: 15, fontWeight: "900" },
  cosmeticNoteText: { color: "#6F6888", fontSize: 10, lineHeight: 14, fontWeight: "700" },
  notice: { color: "#236A42", fontSize: 11, lineHeight: 14, fontWeight: "900", textAlign: "center", marginTop: 4 },
  disabled: { opacity: 0.38 },
  pressed: { transform: [{ scale: 0.97 }] },
});
