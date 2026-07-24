import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function YandexCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const authenticate = useAppStore((store) => store.authenticate);

  const exchange = useMutation({
    mutationFn: () =>
      authApi.yandexExchange({
        code: params.code!,
        state: params.state!,
      }),
    onSuccess: (result) => {
      authenticate({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        balanceUnits: result.user.wallet?.availableUnits,
      });
      router.replace("/(tabs)");
    },
  });

  useEffect(() => {
    if (params.code && params.state && exchange.isIdle) {
      exchange.mutate();
    }
  }, [exchange, params.code, params.state]);

  const error =
    params.error ||
    (!params.code || !params.state ? t("auth.invalid") : exchange.error?.message);

  return (
    <AuthScaffold title={t("auth.yandex")} subtitle={t("auth.subtitle")}>
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 8 }}>
        {error ? (
          <>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                backgroundColor: `${String(theme.danger)}17`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={String(theme.danger)}
              />
            </View>
            <AppText
              color={String(theme.danger)}
              style={{ textAlign: "center" }}
            >
              {error}
            </AppText>
            <AppButton variant="secondary" onPress={() => router.replace("/login")}>
              {t("common.back")}
            </AppButton>
          </>
        ) : (
          <>
            <ActivityIndicator color={String(theme.primary)} size="large" />
            <AppText muted>{t("auth.login")}…</AppText>
          </>
        )}
      </View>
    </AuthScaffold>
  );
}
