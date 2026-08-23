import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { FormField } from "@/components/form-field";
import { GlassSurface } from "@/components/glass-surface";
import { PaymentCard } from "@/components/payment-card";
import { ProgressBar } from "@/components/progress-bar";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { withdrawalsApi } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { detectCardBrand, digitsOnly, isValidCardNumber, isValidExpiration } from "@/lib/payment-card";
import { useAppStore } from "@/store/app-store";
import type { Withdrawal } from "@/types";

const MINIMUM = 1000;

function statusLabel(status: string) {
  if (status === "pending_review" || status === "sandbox_pending") return "На проверке";
  if (status === "approved") return "Одобрено";
  if (status === "paid" || status === "sandbox_completed") return "Выплачено";
  if (status === "rejected") return "Отклонено";
  return status.replaceAll("_", " ");
}

function CheckRow({ checked, label, onPress, detail }: { checked: boolean; label: string; onPress: () => void; detail?: string }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={23} color={String(checked ? theme.primary : theme.textMuted)} />
      <View style={styles.checkCopy}><AppText variant="label">{label}</AppText>{detail ? <AppText variant="caption" muted>{detail}</AppText> : null}</View>
    </Pressable>
  );
}

export default function WithdrawScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const localBalance = useAppStore((state) => state.balanceUnits);
  const setBalance = useAppStore((state) => state.setBalance);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const rememberedCard = useAppStore((state) => state.rememberedWithdrawalCard);
  const setRememberedCard = useAppStore((state) => state.setRememberedWithdrawalCard);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const overviewQuery = useQuery({ queryKey: ["withdrawals", accessToken], queryFn: () => withdrawalsApi.overview(accessToken!), enabled: authenticated, staleTime: 15_000 });
  const overview = overviewQuery.data;
  const balance = authenticated ? (overview?.wallet.availableCents ?? localBalance) : localBalance;
  const minimum = authenticated ? (overview?.minimumCents ?? MINIMUM) : MINIMUM;
  const eligible = authenticated ? (overview?.eligible ?? balance >= minimum) : balance >= minimum;
  const missing = Math.max(0, minimum - balance);
  const processingHours = overview?.processingTimeHours ?? 12;
  const [guestWithdrawals, setGuestWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState(eligible ? (minimum / 100).toFixed(2) : "");
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState(rememberedCard?.holderName ?? "");
  const [expiration, setExpiration] = useState(rememberedCard?.expiration ?? "");
  const [useSavedCard, setUseSavedCard] = useState(Boolean(rememberedCard));
  const [rememberCard, setRememberCard] = useState(Boolean(rememberedCard));
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const selectedCard = useMemo(() => {
    if (useSavedCard && rememberedCard) return rememberedCard;
    const digits = digitsOnly(cardNumber);
    return { brand: detectCardBrand(digits), last4: digits.slice(-4), holderName: holderName.trim(), expiration };
  }, [cardNumber, expiration, holderName, rememberedCard, useSavedCard]);
  const validCard = useSavedCard && rememberedCard ? true : isValidCardNumber(cardNumber) && holderName.trim().length >= 2 && isValidExpiration(expiration);

  const createWithdrawal = useMutation({
    mutationFn: (amountCents: number) => withdrawalsApi.create({ amountCents, card: selectedCard, agreementAccepted: true }, accessToken!),
    onSuccess: (result) => {
      setRememberedCard(rememberCard ? selectedCard : null);
      setBalance(result.wallet.availableUnits);
      void queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      Alert.alert(t("withdraw.title"), `Заявка отправлена. После проверки перевод поступит в течение ${processingHours} часов.`);
    },
    onError: (error) => Alert.alert(t("withdraw.title"), error instanceof Error ? error.message : "Не удалось отправить заявку"),
  });

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < minimum || cents > balance) { Alert.alert(t("withdraw.title"), t("withdraw.minimum")); return; }
    if (!validCard) { Alert.alert(t("withdraw.title"), "Проверьте номер карты, имя владельца и срок действия."); return; }
    if (!agreementAccepted) { Alert.alert(t("withdraw.title"), "Подтвердите согласие с условиями выплаты."); return; }
    if (authenticated) { createWithdrawal.mutate(cents); return; }
    setRememberedCard(rememberCard ? selectedCard : null);
    setGuestWithdrawals((items) => [{ id: `guest-${Date.now()}`, amountCents: cents, amountUnits: cents, method: "bank_card", accountLabel: `${selectedCard.brand.toUpperCase()} •••• ${selectedCard.last4}`, cardBrand: selectedCard.brand, cardLast4: selectedCard.last4, status: "pending_review", requestedAt: new Date().toISOString() }, ...items]);
    setBalance(Math.max(0, localBalance - cents));
    Alert.alert(t("withdraw.title"), `Заявка отправлена на проверку. Срок обработки — до ${processingHours} часов.`);
  };
  const withdrawals = authenticated ? (overview?.withdrawals ?? []) : guestWithdrawals;

  return (
    <AppFrame>
      <ScreenHeader title={t("withdraw.title")} onBack={() => router.back()} />
      <GlassSurface intensity={84} variant="strong" style={styles.balanceCard}>
        <View style={[styles.walletIcon, { backgroundColor: eligible ? theme.success : theme.primary }]}><Ionicons name="wallet" size={27} color="#FFFFFF" /></View>
        <AppText variant="caption" muted>{t("withdraw.available")}</AppText>
        <AppText variant="display" color={String(eligible ? theme.success : theme.primary)} style={styles.balanceValue}>{formatMoney(balance)}</AppText>
        <View style={[styles.status, { backgroundColor: theme.glassFillStrong, borderColor: theme.glassBorder }]}><Ionicons name={eligible ? "checkmark-circle" : "lock-closed"} size={16} color={String(eligible ? theme.success : theme.primary)} /><AppText variant="caption" color={String(eligible ? theme.success : theme.primary)}>{eligible ? t("withdraw.ready") : t("withdraw.minimum")}</AppText></View>
      </GlassSurface>

      {!eligible ? (
        <GlassSurface intensity={68} style={styles.card}>
          <View style={styles.lockRow}><View style={[styles.lockIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name="trending-up" size={24} color={String(theme.primary)} /></View><View style={styles.flex}><AppText variant="label">{t("withdraw.locked")}</AppText><AppText variant="title" color={String(theme.primary)}>{formatMoney(missing)}</AppText></View></View>
          <ProgressBar value={balance / minimum} height={10} />
          <AppButton icon="flash-outline" onPress={() => router.replace("/tasks")} glow>{t("home.earn")}</AppButton>
        </GlassSurface>
      ) : (
        <GlassSurface intensity={72} style={styles.card}>
          <View style={styles.formIntro}><View><AppText variant="heading">Карта для выплаты</AppText><AppText variant="caption" muted>Заполните данные прямо на карте</AppText></View><View style={[styles.timePill, { backgroundColor: theme.primarySoft }]}><Ionicons name="time-outline" size={16} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.primary)}>до {processingHours} ч</AppText></View></View>
          {rememberedCard ? <View style={[styles.savedRow, { borderColor: theme.border }]}><Pressable accessibilityRole="button" onPress={() => setUseSavedCard(true)} style={[styles.savedChoice, useSavedCard && { backgroundColor: theme.primarySoft }]}><Ionicons name="card-outline" size={18} color={String(theme.primary)} /><AppText variant="caption">•••• {rememberedCard.last4}</AppText></Pressable><Pressable accessibilityRole="button" onPress={() => { setUseSavedCard(false); setCardNumber(""); }} style={[styles.savedChoice, !useSavedCard && { backgroundColor: theme.primarySoft }]}><Ionicons name="add-outline" size={18} color={String(theme.primary)} /><AppText variant="caption">Другая карта</AppText></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Удалить сохранённую карту" onPress={() => { setRememberedCard(null); setUseSavedCard(false); setRememberCard(false); }} style={styles.forgetButton}><Ionicons name="trash-outline" size={18} color={String(theme.danger)} /></Pressable></View> : null}
          <PaymentCard cardNumber={cardNumber} holderName={useSavedCard && rememberedCard ? rememberedCard.holderName : holderName} expiration={useSavedCard && rememberedCard ? rememberedCard.expiration : expiration} savedLast4={useSavedCard ? rememberedCard?.last4 : undefined} savedBrand={useSavedCard ? rememberedCard?.brand : undefined} readOnly={useSavedCard && Boolean(rememberedCard)} onCardNumberChange={setCardNumber} onHolderNameChange={setHolderName} onExpirationChange={setExpiration} />
          <FormField label={`${t("withdraw.amount")} · USD`} icon="cash-outline" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="10.00" />
          <View style={styles.checks}>
            <CheckRow checked={rememberCard} onPress={() => setRememberCard((value) => !value)} label="Запомнить мою карту" detail="Сохраним только бренд, имя, срок и последние 4 цифры" />
            <View style={styles.agreementRow}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreementAccepted }} onPress={() => setAgreementAccepted((value) => !value)} style={({ pressed }) => [styles.agreementCheck, pressed && styles.pressed]}><Ionicons name={agreementAccepted ? "checkbox" : "square-outline"} size={23} color={String(agreementAccepted ? theme.primary : theme.textMuted)} /></Pressable><AppText variant="caption" style={styles.agreementCopy}>Я подтверждаю, что карта принадлежит мне, и принимаю </AppText><Pressable accessibilityRole="link" onPress={() => router.push("/withdrawal-agreement" as never)}><AppText variant="caption" color={String(theme.primary)} style={styles.agreementLink}>условия выплаты</AppText></Pressable></View>
          </View>
          <AppButton icon="send-outline" glow onPress={submit} loading={createWithdrawal.isPending} disabled={!validCard || !agreementAccepted}>{t("withdraw.submit")}</AppButton>
          <View style={[styles.securityNote, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={18} color={String(theme.primary)} /><AppText variant="caption" color={String(theme.textMuted)} style={styles.flex}>Полный номер не сохраняется в Logic Coin. Заявка содержит только маскированные данные карты.</AppText></View>
        </GlassSurface>
      )}

      <GlassSurface variant="soft" intensity={60} style={styles.history}>
        <View style={styles.historyTitle}><AppText variant="heading">{t("withdraw.history")}</AppText><Ionicons name="receipt-outline" size={21} color={String(theme.textMuted)} /></View>
        {withdrawals.length ? withdrawals.map((withdrawal) => <View key={withdrawal.id} style={[styles.historyRow, { borderTopColor: theme.border }]}><View style={styles.historyMeta}><AppText variant="label">{formatMoney(withdrawal.amountCents)}</AppText><AppText variant="caption" muted>{new Date(withdrawal.requestedAt).toLocaleDateString()} · {withdrawal.accountLabel ?? "Банковская карта"}</AppText></View><View style={[styles.statusChip, { backgroundColor: theme.primarySoft }]}><AppText variant="caption" color={String(theme.primary)}>{statusLabel(withdrawal.status)}</AppText></View></View>) : <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: theme.glassFillStrong }]}><Ionicons name="time-outline" size={28} color={String(theme.textMuted)} /></View><AppText variant="caption" muted>{overviewQuery.isLoading ? "Загружаем историю…" : t("withdraw.empty")}</AppText></View>}
      </GlassSurface>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  balanceCard: { borderRadius: radii.xl, padding: 24, alignItems: "center" },
  walletIcon: { width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  balanceValue: { fontSize: 44, lineHeight: 51 },
  status: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 11 },
  card: { marginTop: 16, borderRadius: radii.xl, borderWidth: 1, padding: 18, gap: 18 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  formIntro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  timePill: { minHeight: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  savedRow: { minHeight: 46, borderRadius: 17, borderWidth: 1, padding: 3, flexDirection: "row", alignItems: "center", gap: 3 },
  savedChoice: { flex: 1, minHeight: 38, borderRadius: 14, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  forgetButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  checks: { gap: 13 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkCopy: { flex: 1, gap: 2 },
  agreementRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  agreementCheck: { marginRight: 10 },
  agreementCopy: { lineHeight: 19 },
  agreementLink: { lineHeight: 19, fontWeight: "800" },
  securityNote: { borderRadius: 16, padding: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  history: { marginTop: 16, borderRadius: radii.lg, borderWidth: 1, padding: 16, gap: 14 },
  historyTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyRow: { borderTopWidth: 1, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  historyMeta: { flex: 1, gap: 2 },
  statusChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  empty: { alignItems: "center", gap: 9, paddingVertical: 16 },
  emptyIcon: { width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
});
