import { useUiCopy } from "@/components/localized-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { StyledInput } from "@/components/styled-input";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function SetPasswordScreen() {
  const { copyText, copyContent } = useUiCopy();
  const params = useLocalSearchParams<{ email?: string; next?: string; source?: string; accountLabel?: string }>();
  const email = params.email ?? "";
  const router = useRouter();
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const authenticate = useAppStore((state) => state.authenticate);
  const setupToken = useAppStore((state) => state.pendingPasswordSetupToken);
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () => {
      if (!setupToken) throw new Error(t("auth.invalid"));
      if (params.source === "social") return authApi.setSocialPassword({ password, setupToken });
      if (!email) throw new Error(t("auth.invalid"));
      return authApi.setPassword({ email, password, setupToken });
    },
    onSuccess: (result) => {
      authenticate({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        balanceUnits: result.user.wallet?.availableUnits,
      });
      const setupUserId = useAppStore.getState().postAuthLanguageUserId;
      const destination = result.user.role === "admin"
        ? "/admin"
        : !result.user.countryCode
          ? setupUserId === result.user.id ? "/country" : "/language"
          : "/(tabs)";
      router.replace(destination as never);
    },
  });

  return (
    <AuthScaffold
      title={t("auth.createPasswordTitle")}
      subtitle={params.source === "social" ? params.accountLabel : email}
      headerAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copyText(t("common.back"))}
          onPress={() => router.replace("/login")}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={String(theme.primary)} />
        </Pressable>
      )}
    >
      {params.source === "social" ? (
        <AppText variant="caption" muted style={styles.error}>
          {({ ru: "Аккаунт подтверждён. Создайте пароль для входа по почте или @нику.", uz: "Hisob tasdiqlandi. Email yoki @nikneym orqali kirish uchun parol yarating.", en: "Account verified. Create a password to sign in with your email or @username." })[language]}
        </AppText>
      ) : null}
      <StyledInput
        label={t("auth.password")}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        secureTextEntry
        hint={t("auth.passwordHint")}
        required
      />
      {save.error ? (
        <AppText variant="caption" color={String(theme.danger)} style={styles.error}>
          {copyContent(save.error.message || t("auth.invalid"))}
        </AppText>
      ) : null}
      <AppButton
        onPress={() => save.mutate()}
        disabled={password.length < 8}
        loading={save.isPending}
        icon="checkmark-circle-outline"
        glow
      >
        {copyContent(t("common.save"))}
      </AppButton>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  backButton: { padding: 8, marginLeft: -8 },
  error: { textAlign: "center" },
});
