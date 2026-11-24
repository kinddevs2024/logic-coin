import { useUiCopy , CopyTextInput as TextInput } from "@/components/localized-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View } from "react-native";


import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { CountryFlagBadge } from "@/components/country-flag";
import { GlassSurface } from "@/components/glass-surface";
import { LogicCoinLogo } from "@/components/logo";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { meApi } from "@/lib/api";
import { countrySearchIndex, searchCountries, type CountryOption } from "@/lib/country-options";
import { useAppStore } from "@/store/app-store";

const COUNTRY_ROW_HEIGHT = 52;
const COUNTRY_ROW_GAP = 7;
function CountryRowSeparator() {
  return <View style={styles.countrySeparator} />;
}

export default function CountryScreen() {
  const { copyText, copyContent } = useUiCopy();
  const theme = useAppTheme();
  const { t, language } = useTranslation();
  const router = useRouter();
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const user = useAppStore((state) => state.user);
  const postAuthLanguageUserId = useAppStore((state) => state.postAuthLanguageUserId);
  const updateUser = useAppStore((state) => state.updateUser);
  const setPostAuthLanguageUserId = useAppStore((state) => state.setPostAuthLanguageUserId);
  const savedLanguage = useAppStore((state) => state.language) ?? "uz";
  const [countryCode, setCountryCode] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const listRef = useRef<FlatList<CountryOption>>(null);
  const countryIndex = useMemo(() => countrySearchIndex(language), [language]);
  const filteredCountries = useMemo(() => searchCountries(countryIndex, countryQuery), [countryIndex, countryQuery]);

  const saveCountry = useMutation({
    mutationFn: async () => {
      if (!countryCode || !accessToken) throw new Error("country_required");
      await meApi.updatePreferences({ language: savedLanguage }, accessToken);
      return meApi.updateProfile({ countryCode }, accessToken);
    },
    onSuccess: (nextUser) => {
      updateUser(nextUser);
      if (nextUser.id) setPostAuthLanguageUserId(nextUser.id);
      router.replace("/(tabs)");
    },
  });

  if (authMode !== "authenticated" || !accessToken) {
    return <Redirect href="/login" />;
  }
  if (user.role === "owner") return <Redirect href={(Platform.OS === "web" ? "/admin" : "/owner") as never} />;
  if (user.role === "admin") return <Redirect href="/admin" />;
  if (user.countryCode) return <Redirect href="/(tabs)" />;
  if (postAuthLanguageUserId !== user.id) {
    return <Redirect href="/language" />;
  }

  return (
    <AppFrame scroll={false} contentStyle={styles.frame}>
      <View style={styles.wrap}>
        <View style={styles.logo}><LogicCoinLogo /></View>
        <GlassSurface intensity={80} variant="strong" style={styles.card}>
          <View style={styles.heading}>
            <AppText variant="title" style={styles.center}>{copyContent(t("country.title"))}</AppText>
            <AppText muted style={styles.center}>{copyContent(t("country.subtitle"))}</AppText>
          </View>
          <TextInput
            value={countryQuery}
            onChangeText={(value) => {
              setCountryQuery(value);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            autoCapitalize="words"
            placeholder={copyText(t("country.search"))}
            placeholderTextColor={String(theme.textMuted)}
            style={[styles.search, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}
          />
          <FlatList
            ref={listRef}
            testID="country-list"
            style={styles.countryList}
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            initialNumToRender={10}
            maxToRenderPerBatch={16}
            windowSize={7}
            removeClippedSubviews={false}
            ItemSeparatorComponent={CountryRowSeparator}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            getItemLayout={(_, index) => ({ length: COUNTRY_ROW_HEIGHT, offset: (COUNTRY_ROW_HEIGHT + COUNTRY_ROW_GAP) * index, index })}
            ListEmptyComponent={<AppText muted style={styles.noCountries}>{copyContent(t("country.empty"))}</AppText>}
            renderItem={({ item: { code, name } }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: countryCode === code }}
                onPress={() => setCountryCode(code)}
                style={[styles.countryRow, {
                  borderColor: countryCode === code ? theme.primary : theme.border,
                  backgroundColor: countryCode === code ? theme.primarySoft : theme.surfaceRaised,
                }]}
              >
                <CountryFlagBadge countryCode={code} size={22} />
                <AppText variant="caption" numberOfLines={1} style={styles.countryLabel}>{copyContent(name)}</AppText>
                {countryCode === code ? <Ionicons name="checkmark-circle" size={19} color={String(theme.primary)} /> : null}
              </Pressable>
            )}
          />
          {saveCountry.isError ? <AppText style={[styles.error, { color: theme.danger }]}>{copyContent(t("country.error"))}</AppText> : null}
          <Pressable
            accessibilityRole="button"
            disabled={!countryCode || saveCountry.isPending}
            onPress={() => saveCountry.mutate()}
            style={[styles.continue, { backgroundColor: theme.primary }, (!countryCode || saveCountry.isPending) && styles.disabled]}
          >
            {saveCountry.isPending ? <ActivityIndicator color={String(theme.onPrimary)} /> : <Ionicons name="arrow-forward" size={19} color={String(theme.onPrimary)} />}
            <AppText variant="label" color={String(theme.onPrimary)}>{copyContent(t("country.continue"))}</AppText>
          </Pressable>
        </GlassSurface>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "center", paddingBottom: 24 },
  wrap: { width: "100%", maxWidth: 540, alignSelf: "center", flex: 1, justifyContent: "center" },
  logo: { alignItems: "center", marginBottom: 22 },
  card: { maxHeight: "86%", borderRadius: radii.xl, borderWidth: 1, padding: 20, gap: 13 },
  heading: { gap: 7 },
  center: { textAlign: "center" },
  search: { minHeight: 46, borderRadius: 15, borderWidth: 1, paddingHorizontal: 13, fontSize: 14, fontWeight: "600" },
  countryList: { height: 260, minHeight: 120, maxHeight: 330, flexGrow: 0, flexShrink: 1 },
  countrySeparator: { height: COUNTRY_ROW_GAP },
  countryRow: { height: COUNTRY_ROW_HEIGHT, borderWidth: 1, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11 },
  countryLabel: { flex: 1 },
  noCountries: { textAlign: "center", padding: 18 },
  continue: { minHeight: 52, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabled: { opacity: 0.55 },
  error: { fontSize: 12, lineHeight: 16, fontWeight: "700", textAlign: "center" },
});
