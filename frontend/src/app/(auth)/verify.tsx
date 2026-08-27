import { Ionicons } from "@expo/vector-icons";
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
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string; next?: string; cooldown?: string; sends?: string }>();
  const email = params.email ?? "";
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const registrationToken = useAppStore(
    (state) => state.pendingRegistrationToken,
  );
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const setPendingPasswordSetupToken = useAppStore(
    (state) => state.setPendingPasswordSetupToken,
  );
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(() => Math.max(0, Number(params.cooldown ?? 60) || 60));
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
      setPendingPasswordSetupToken(result.setupToken);
      router.replace({
        pathname: "/set-password" as never,
        params: { email: result.email, ...(params.next ? { next: params.next } : {}) },
      });
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendCode(email),
    onSuccess: (result) => {
      setCooldown(result.verification?.resendAvailableInSeconds ?? 60);
      setSendsRemaining(result.verification?.sendsRemaining ?? Math.max(0, sendsRemaining - 1));
    },
  });

  return (
    <AuthScaffold
      title={t("auth.verifyTitle")}
      subtitle={`${t("auth.verifyBody")} ${email}`}
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
          {verify.error.message || t("auth.invalid")}
        </AppText>
      ) : null}
      <AppButton
        onPress={() => verify.mutate()}
        disabled={code.length !== 6}
        loading={verify.isPending}
        icon="checkmark-circle-outline"
        glow
      >
        {t("auth.verify")}
      </AppButton>
      <Pressable
        onPress={() => resend.mutate()}
        disabled={resend.isPending || cooldown > 0 || sendsRemaining <= 0}
        style={[styles.resend, (cooldown > 0 || sendsRemaining <= 0) && styles.resendDisabled]}
      >
        <AppText variant="label" color={String(theme.primary)}>
          {sendsRemaining <= 0
            ? "Лимит писем исчерпан"
            : cooldown > 0
              ? `Отправить через 00:${String(cooldown).padStart(2, "0")} · осталось ${sendsRemaining}`
              : `${t("auth.resend")} · осталось ${sendsRemaining}`}
        </AppText>
      </Pressable>
      {resend.error ? (
        <AppText variant="caption" color={String(theme.danger)} style={{ textAlign: "center" }}>
          {resend.error.message}
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
