import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { PinInput } from "@/components/pin-input";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? "";
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const authenticate = useAppStore((state) => state.authenticate);
  const registrationToken = useAppStore(
    (state) => state.pendingRegistrationToken,
  );
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  const verify = useMutation({
    mutationFn: () => {
      if (!registrationToken) throw new Error(t("auth.invalid"));
      return authApi.completeEmail({
        email,
        code,
        flowToken: registrationToken,
      });
    },
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

  const resend = useMutation({
    mutationFn: () => authApi.startEmail(email),
    onSuccess: (result) => {
      setPendingRegistrationToken(result.flowToken);
      setResent(true);
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
        disabled={resend.isPending}
        style={styles.resend}
      >
        <AppText variant="label" color={String(theme.primary)}>
          {resent ? "✓ " : ""}
          {t("auth.resend")}
        </AppText>
      </Pressable>
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
});
