import { Ionicons } from "@expo/vector-icons";
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
  const params = useLocalSearchParams<{ email?: string; next?: string }>();
  const email = params.email ?? "";
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const authenticate = useAppStore((state) => state.authenticate);
  const setupToken = useAppStore((state) => state.pendingPasswordSetupToken);
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () => {
      if (!email || !setupToken) throw new Error(t("auth.invalid"));
      return authApi.setPassword({ email, password, setupToken });
    },
    onSuccess: (result) => {
      authenticate({
        user: result.user,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        balanceUnits: result.user.wallet?.availableUnits,
      });
      router.replace(result.user.role === "admin" ? "/admin" : "/(tabs)");
    },
  });

  return (
    <AuthScaffold
      title={t("auth.createPasswordTitle")}
      subtitle={email}
      headerAction={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.replace("/login")}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={String(theme.primary)} />
        </Pressable>
      )}
    >
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
          {save.error.message || t("auth.invalid")}
        </AppText>
      ) : null}
      <AppButton
        onPress={() => save.mutate()}
        disabled={password.length < 8}
        loading={save.isPending}
        icon="checkmark-circle-outline"
        glow
      >
        {t("common.save")}
      </AppButton>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  backButton: { padding: 8, marginLeft: -8 },
  error: { textAlign: "center" },
});
