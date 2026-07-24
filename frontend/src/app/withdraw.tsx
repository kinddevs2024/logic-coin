import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { ChoiceChip } from "@/components/choice-chip";
import { FormField } from "@/components/form-field";
import { ProgressBar } from "@/components/progress-bar";
import { ScreenHeader } from "@/components/screen-header";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { formatMoney } from "@/lib/format";
import { withdrawalsApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { Withdrawal } from "@/types";

const MINIMUM = 1000;

export default function WithdrawScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const localBalance = useAppStore((state) => state.balanceUnits);
  const setBalance = useAppStore((state) => state.setBalance);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const overviewQuery = useQuery({
    queryKey: ["withdrawals", accessToken],
    queryFn: () => withdrawalsApi.overview(accessToken!),
    enabled: authenticated,
    staleTime: 15_000,
  });
  const overview = overviewQuery.data;
  const balance = authenticated
    ? (overview?.wallet.availableCents ?? localBalance)
    : localBalance;
  const minimum = authenticated ? (overview?.minimumCents ?? MINIMUM) : MINIMUM;
  const eligible = authenticated
    ? (overview?.eligible ?? balance >= minimum)
    : balance >= minimum;
  const missing = Math.max(0, minimum - balance);
  const [method, setMethod] = useState<"card" | "wallet">("card");
  const [guestWithdrawals, setGuestWithdrawals] = useState<Withdrawal[]>([]);
  const [amount, setAmount] = useState(
    eligible ? (minimum / 100).toFixed(2) : "",
  );
  const createWithdrawal = useMutation({
    mutationFn: (amountCents: number) =>
      withdrawalsApi.create(
        {
          amountCents,
          accountLabel: `${method === "card" ? "Bank card" : "Digital wallet"} (sandbox)`,
        },
        accessToken!,
      ),
    onSuccess: (result) => {
      setBalance(result.wallet.availableUnits);
      void queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      Alert.alert(t("withdraw.title"), `✓ ${t("withdraw.submit")} · Sandbox`);
    },
    onError: (error) => {
      Alert.alert(
        t("withdraw.title"),
        error instanceof Error ? error.message : "Sandbox request failed",
      );
    },
  });

  const submit = () => {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < minimum || cents > balance) {
      Alert.alert(t("withdraw.title"), t("withdraw.minimum"));
      return;
    }
    if (authenticated) {
      createWithdrawal.mutate(cents);
      return;
    }
    setGuestWithdrawals((items) => [
      {
        id: `guest-${Date.now()}`,
        amountCents: cents,
        amountUnits: cents,
        method: "sandbox",
        accountLabel: `${method} · local demo`,
        status: "sandbox_pending",
        requestedAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setBalance(Math.max(0, localBalance - cents));
    Alert.alert(
      t("withdraw.title"),
      `✓ ${t("withdraw.submit")} · Demo sandbox`,
    );
  };
  const withdrawals = authenticated
    ? (overview?.withdrawals ?? [])
    : guestWithdrawals;

  return (
    <AppFrame>
      <ScreenHeader
        title={t("withdraw.title")}
        onBack={() => router.back()}
      />

      <LinearGradient
        colors={
          eligible
            ? ["#12B76A", "#087F5B"]
            : ["#0866FF", "#155DD8", "#5945E8"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.balanceCard, { shadowColor: theme.primary }]}
      >
        <View style={styles.walletIcon}>
          <Ionicons name="wallet" size={27} color="#FFFFFF" />
        </View>
        <AppText variant="caption" color="rgba(255,255,255,0.72)">
          {t("withdraw.available")}
        </AppText>
        <AppText
          variant="display"
          color="#FFFFFF"
          style={{ fontSize: 44, lineHeight: 51 }}
        >
          {formatMoney(balance)}
        </AppText>
        <View style={styles.status}>
          <Ionicons
            name={eligible ? "checkmark-circle" : "lock-closed"}
            size={16}
            color="#FFFFFF"
          />
          <AppText variant="caption" color="#FFFFFF">
            {eligible ? t("withdraw.ready") : t("withdraw.minimum")} ·{" "}
            {authenticated ? "Sandbox" : "Demo sandbox"}
          </AppText>
        </View>
      </LinearGradient>

      {!eligible ? (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.lockRow}>
            <View
              style={[
                styles.lockIcon,
                { backgroundColor: theme.primarySoft },
              ]}
            >
              <Ionicons
                name="trending-up"
                size={24}
                color={String(theme.primary)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label">{t("withdraw.locked")}</AppText>
              <AppText variant="title" color={String(theme.primary)}>
                {formatMoney(missing)}
              </AppText>
            </View>
          </View>
          <ProgressBar value={balance / MINIMUM} height={10} />
          <AppButton
            icon="flash-outline"
            onPress={() => router.replace("/tasks")}
            glow
          >
            {t("home.earn")}
          </AppButton>
        </View>
      ) : (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.formSection}>
            <AppText variant="label">{t("withdraw.method")}</AppText>
            <View style={styles.choices}>
              <ChoiceChip
                label={t("withdraw.card")}
                selected={method === "card"}
                onPress={() => setMethod("card")}
              />
              <ChoiceChip
                label={t("withdraw.wallet")}
                selected={method === "wallet"}
                onPress={() => setMethod("wallet")}
              />
            </View>
          </View>
          <FormField
            label={`${t("withdraw.amount")} · USD`}
            icon="cash-outline"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="10.00"
          />
          <AppButton
            icon="send-outline"
            glow
            onPress={submit}
            loading={createWithdrawal.isPending}
          >
            {t("withdraw.submit")}
          </AppButton>
        </View>
      )}

      <View
        style={[
          styles.history,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.historyTitle}>
          <AppText variant="heading">{t("withdraw.history")}</AppText>
          <Ionicons
            name="receipt-outline"
            size={21}
            color={String(theme.textMuted)}
          />
        </View>
        {withdrawals.length ? (
          withdrawals.map((withdrawal) => (
            <View
              key={withdrawal.id}
              style={[
                styles.historyRow,
                { borderTopColor: theme.border },
              ]}
            >
              <View style={styles.historyMeta}>
                <AppText variant="label">
                  {formatMoney(withdrawal.amountCents)}
                </AppText>
                <AppText variant="caption" muted>
                  {new Date(withdrawal.requestedAt).toLocaleDateString()} ·{" "}
                  {withdrawal.accountLabel ?? "Sandbox"}
                </AppText>
              </View>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: theme.primarySoft },
                ]}
              >
                <AppText variant="caption" color={String(theme.primary)}>
                  {withdrawal.status.replaceAll("_", " ")}
                </AppText>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: theme.surfaceMuted }]}
            >
              <Ionicons
                name="time-outline"
                size={28}
                color={String(theme.textMuted)}
              />
            </View>
            <AppText variant="caption" muted>
              {overviewQuery.isLoading
                ? "Loading sandbox history…"
                : t("withdraw.empty")}
            </AppText>
          </View>
        )}
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: radii.xl,
    padding: 24,
    alignItems: "center",
    shadowOpacity: 0.27,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 13 },
    elevation: 9,
  },
  walletIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  status: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 11,
  },
  card: {
    marginTop: 16,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: 18,
    gap: 18,
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lockIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  formSection: {
    gap: 10,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  history: {
    marginTop: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  historyTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyRow: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyMeta: {
    flex: 1,
    gap: 2,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  empty: {
    alignItems: "center",
    gap: 9,
    paddingVertical: 16,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
