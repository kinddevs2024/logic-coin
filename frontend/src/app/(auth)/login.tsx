import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { StyledInput } from "@/components/styled-input";
import { SocialButtons } from "@/components/social-buttons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi, type AuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ telegram_token?: string }>();
  const authenticate = useAppStore((state) => state.authenticate);
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const [email, setEmail] = useState("");
  const telegramStarted = useRef(false);

  const complete = useCallback((result: AuthResult) => {
    authenticate({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      balanceUnits: result.user.wallet?.availableUnits,
    });
    router.replace("/(tabs)");
  }, [authenticate, router]);

  const emailFlow = useMutation({
    mutationFn: () => authApi.startEmail(email.trim()),
    onSuccess: (result) => {
      setPendingRegistrationToken(result.flowToken);
      router.push({ pathname: "/verify", params: { email: result.email } });
    },
  });

  const telegramFlow = useMutation({
    mutationFn: async (input: { resumeToken?: string; initData?: string }) => {
      if (input.resumeToken) return authApi.telegramComplete(input.resumeToken);
      if (input.initData) return authApi.telegramMiniApp(input.initData);
      throw new Error(t("auth.invalid"));
    },
    onSuccess: complete,
  });

  useEffect(() => {
    if (telegramStarted.current) return;
    const resumeToken = params.telegram_token;
    const webApp =
      Platform.OS === "web"
        ? (window as TelegramWindow).Telegram?.WebApp
        : undefined;
    const initData = webApp?.initData;
    if (!resumeToken && !initData) return;
    telegramStarted.current = true;
    webApp?.ready?.();
    webApp?.expand?.();
    telegramFlow.mutate({
      ...(resumeToken ? { resumeToken } : {}),
      ...(!resumeToken && initData ? { initData } : {}),
    });
  }, [params.telegram_token, telegramFlow]);

  const error = emailFlow.error ?? telegramFlow.error;
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <AuthScaffold>
      <View style={styles.form}>
        <StyledInput
          label={t("auth.email")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="olivia@untitledui.com"
          required
        />
        <AppButton
          onPress={() => emailFlow.mutate()}
          loading={emailFlow.isPending || telegramFlow.isPending}
          disabled={!valid}
          icon="arrow-forward"
        >
          {t("common.next")}
        </AppButton>
      </View>
      <SocialButtons onAuthenticated={complete} />
      {error ? (
        <AppText
          variant="caption"
          color={String(theme.danger)}
          style={styles.error}
        >
          {error instanceof Error ? error.message : t("auth.invalid")}
        </AppText>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  error: { textAlign: "center", paddingHorizontal: 8 },
});
