import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AuthScaffold } from "@/components/auth-scaffold";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import { FormField } from "@/components/form-field";
import { SocialButtons } from "@/components/social-buttons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { authApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const authenticate = useAppStore((state) => state.authenticate);
  const continueAsGuest = useAppStore((state) => state.continueAsGuest);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => authApi.login({ email: email.trim(), password }),
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

  const valid = email.includes("@") && password.length >= 6;

  return (
    <AuthScaffold title={t("auth.welcome")} subtitle={t("auth.subtitle")}>
      <View style={styles.form}>
        <FormField
          label={t("auth.email")}
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="name@example.com"
        />
        <FormField
          label={t("auth.password")}
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
          placeholder="••••••••"
        />
        {login.error ? (
          <AppText
            variant="caption"
            color={String(theme.danger)}
            style={{ textAlign: "center" }}
          >
            {login.error.message || t("auth.invalid")}
          </AppText>
        ) : null}
        <AppButton
          onPress={() => login.mutate()}
          loading={login.isPending}
          disabled={!valid}
          icon="arrow-forward"
          glow
        >
          {t("auth.login")}
        </AppButton>
      </View>

      <View style={styles.or}>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
        <AppText variant="caption" muted>
          {t("auth.or")}
        </AppText>
        <View style={[styles.line, { backgroundColor: theme.border }]} />
      </View>
      <SocialButtons />

      <Pressable
        onPress={() => {
          continueAsGuest();
          router.replace("/(tabs)");
        }}
        style={styles.guest}
      >
        <AppText variant="label" color={String(theme.primary)}>
          {t("auth.guest")}
        </AppText>
        <AppText variant="caption" muted style={{ textAlign: "center" }}>
          {t("auth.guestHint")}
        </AppText>
      </Pressable>

      <View style={styles.switch}>
        <AppText muted>{t("auth.noAccount")}</AppText>
        <Pressable onPress={() => router.push("/register")}>
          <AppText variant="label" color={String(theme.primary)}>
            {t("auth.register")}
          </AppText>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 15,
  },
  or: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  line: {
    flex: 1,
    height: 1,
  },
  guest: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
  },
  switch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
  },
});
