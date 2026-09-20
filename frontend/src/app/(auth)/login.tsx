import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { StyledInput } from "@/components/styled-input";
import { SocialButtons } from "@/components/social-buttons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError, authApi, meApi, type AuthResult } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

type TelegramWindow = Window & {
  Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ telegram_token?: string; next?: string; email?: string; ref?: string }>();
  const authenticate = useAppStore((state) => state.authenticate);
  const hydrated = useAppStore((state) => state.hydrated);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const selectedCountryCode = useAppStore((state) => state.user.countryCode);
  const updateUser = useAppStore((state) => state.updateUser);
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const telegramStarted = useRef(false);
  const redirectedAuthenticatedUser = useRef(false);

  useEffect(() => {
    if (
      !hydrated ||
      authMode !== "authenticated" ||
      !accessToken ||
      redirectedAuthenticatedUser.current
    ) {
      return;
    }
    redirectedAuthenticatedUser.current = true;
    const next = params.next;
    const destination = next && next.startsWith("/") && next !== "/login"
      ? next
      : "/(tabs)";
    router.replace(destination as never);
  }, [accessToken, authMode, hydrated, params.next, router]);

  const complete = useCallback((result: AuthResult) => {
    authenticate({
      user: result.user,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      balanceUnits: result.user.wallet?.availableUnits,
    });
    if (!result.user.countryCode && selectedCountryCode) {
      void meApi.updateProfile({ countryCode: selectedCountryCode }, result.tokens.accessToken)
        .then((user) => updateUser(user))
        .catch(() => {});
    }
    router.replace(result.user.role === "admin" ? "/admin" : "/(tabs)");
  }, [authenticate, router, selectedCountryCode, updateUser]);

  const emailFlow = useMutation({
    mutationFn: () => authApi.startEmail(email.trim()),
    onSuccess: (result) => {
      if (result.mode === "password") {
        setStep("password");
        return;
      }
      setPendingRegistrationToken(result.flowToken);
      router.push({
        pathname: "/verify",
        params: {
          email: result.email,
          cooldown: String(result.verification?.resendAvailableInSeconds ?? 60),
          sends: String(result.verification?.sendsRemaining ?? 2),
          ...(params.next ? { next: params.next } : {}),
        },
      });
    },
  });

  const passwordFlow = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password }),
    onSuccess: complete,
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

  const error = emailFlow.error ?? passwordFlow.error ?? telegramFlow.error;
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());
  const errorMessage = error instanceof ApiError && error.code === "invalid_credentials"
    ? t("auth.invalidCredentials")
    : error instanceof Error
      ? error.message
      : t("auth.invalid");

  if (!hydrated || (authMode === "authenticated" && accessToken)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={String(theme.primary)} />
      </View>
    );
  }

  return (
    <AuthScaffold
      title={step === "password" ? t("auth.passwordTitle") : undefined}
      subtitle={step === "password" ? email.trim() : undefined}
      headerAction={step === "password" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => { setStep("email"); setPassword(""); passwordFlow.reset(); }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={String(theme.primary)} />
        </Pressable>
      ) : undefined}
    >
      <View style={styles.form}>
        {step === "email" ? (
          <>
            <StyledInput
              label={t("auth.email")}
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="name@example.com"
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
          </>
        ) : (
          <>
            <StyledInput
              label={t("auth.password")}
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              secureTextEntry
              required
            />
            <AppButton
              onPress={() => passwordFlow.mutate()}
              loading={passwordFlow.isPending}
              disabled={password.length < 8}
              icon="log-in-outline"
            >
              {t("auth.login")}
            </AppButton>
          </>
        )}
      </View>
      {step === "email" ? <SocialButtons onAuthenticated={complete} /> : null}
      {error ? (
        <AppText
          variant="caption"
          color={String(theme.danger)}
          style={styles.error}
        >
          {errorMessage}
        </AppText>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  form: { gap: 10 },
  backButton: { padding: 8, marginLeft: -8 },
  error: { textAlign: "center", paddingHorizontal: 8 },
});
