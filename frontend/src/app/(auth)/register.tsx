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

export default function RegisterScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const setPendingRegistrationToken = useAppStore(
    (state) => state.setPendingRegistrationToken,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = useMutation({
    mutationFn: () =>
      authApi.register({
        name: name.trim(),
        email: email.trim(),
        password,
      }),
    onSuccess: (result) => {
      setPendingRegistrationToken(result.registrationToken);
      router.push({
        pathname: "/verify",
        params: { email: email.trim(), name: name.trim() },
      });
    },
  });

  const valid =
    name.trim().length >= 2 && email.includes("@") && password.length >= 8;

  return (
    <AuthScaffold
      title={t("auth.register")}
      subtitle={t("auth.subtitle")}
    >
      <View style={styles.form}>
        <FormField
          label={t("auth.name")}
          icon="person-outline"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholder="Alex"
        />
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
          autoComplete="new-password"
          secureTextEntry
          placeholder="8+ characters"
        />
        {register.error ? (
          <AppText
            variant="caption"
            color={String(theme.danger)}
            style={{ textAlign: "center" }}
          >
            {register.error.message || t("auth.invalid")}
          </AppText>
        ) : null}
        <AppButton
          onPress={() => register.mutate()}
          loading={register.isPending}
          disabled={!valid}
          icon="person-add-outline"
          glow
        >
          {t("auth.register")}
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
      <View style={styles.switch}>
        <AppText muted>{t("auth.hasAccount")}</AppText>
        <Pressable onPress={() => router.back()}>
          <AppText variant="label" color={String(theme.primary)}>
            {t("auth.login")}
          </AppText>
        </Pressable>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
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
  switch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 5,
  },
});
