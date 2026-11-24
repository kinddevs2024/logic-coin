import { useUiCopy } from "@/components/localized-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { PinInput } from "@/components/pin-input";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useSignInCompletion } from "@/hooks/use-sign-in-completion";
import { ApiError, authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function VerifyScreen() {
  const { copyContent } = useUiCopy();
  const params = useLocalSearchParams<{ email?: string; next?: string; cooldown?: string; sends?: string }>();
  const email = params.email ?? "";
  const { t, language } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const registrationToken = useAppStore(
    (state) => state.pendingRegistrationToken,
  );
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const completeSignIn = useSignInCompletion();
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(() => Math.max(0, Number(params.cooldown ?? 60) || 0));
  const [sendsRemaining, setSendsRemaining] = useState(() => Math.max(0, Number(params.sends ?? 2) || 0));

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1_000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const verify = useMutation({
    mutationFn: () => {
      if (!registrationToken) throw new Error(t("auth.invalid"));
      return authApi.verifyEmailCode({
        email,
        code,
        flowToken: registrationToken,
      });
    },
    onSuccess: (result) => {
      setPendingRegistrationToken(null);
      completeSignIn(result);
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendCode(email),
    onSuccess: (result) => {
      setCode("");
      verify.reset();
      setCooldown(result.verification?.resendAvailableInSeconds ?? 60);
      setSendsRemaining(result.verification?.sendsRemaining ?? Math.max(0, sendsRemaining - 1));
    },
  });
  const verifyErrorCode = verify.error instanceof ApiError ? verify.error.code : undefined;
  const shouldRestart = !registrationToken || verifyErrorCode === "invalid_email_flow";

  return (
    <AuthScaffold
      title={t("auth.verifyTitle")}
      subtitle={email.startsWith("@") ? ({ru: "Код отправлен на почту, привязанную к этому аккаунту.", uz: "Kod ushbu hisobga bog‘langan emailga yuborildi.", en: "The code was sent to the email linked to this account."})[language] : `${t("auth.verifyBody")} ${email}`}
      headerAction={
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={String(theme.primary)} />
        </Pressable>
      }
    >
      <PinInput
        value={code}
        onChangeValue={setCode}
        length={6}
      />
      {verify.error ? (
        <AppText
          variant="caption"
          color={String(theme.danger)}
          style={{ textAlign: "center" }}
        >
          {copyContent(verify.error.message || t("auth.invalid"))}
        </AppText>
      ) : null}
      {shouldRestart ? <AppButton onPress={() => router.replace({ pathname: "/login", params: { email, ...(params.next ? { next: params.next } : {}) } })}>
        {({ ru: "Запросить новый код", uz: "Yangi kod so‘rash", en: "Request a new code" })[language]}
      </AppButton> : <AppButton
        onPress={() => verify.mutate()}
        disabled={code.length !== 6}
        loading={verify.isPending}
        icon="checkmark-circle-outline"
        glow
      >
        {copyContent(t("auth.verify"))}
      </AppButton>}
      <Pressable
        onPress={() => resend.mutate()}
        disabled={resend.isPending || shouldRestart || cooldown > 0 || sendsRemaining <= 0}
        style={[styles.resend, (cooldown > 0 || sendsRemaining <= 0) && styles.resendDisabled]}
      >
        <AppText variant="label" color={String(theme.primary)}>
          {copyContent(sendsRemaining <= 0
            ? "Лимит писем исчерпан"
            : cooldown > 0
              ? `Отправить через 00:${String(cooldown).padStart(2, "0")} · осталось ${sendsRemaining}`
              : `${t("auth.resend")} · осталось ${sendsRemaining}`)}
        </AppText>
      </Pressable>
      {resend.error ? (
        <AppText variant="caption" color={String(theme.danger)} style={{ textAlign: "center" }}>
          {copyContent(resend.error.message)}
        </AppText>
      ) : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  resend: {
    alignItems: "center",
    paddingVertical: 3,
  },
  resendDisabled: { opacity: 0.55 },
});
