import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { ChoiceChip } from "@/components/choice-chip";
import { GlassSwitch } from "@/components/glass-switch";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { radii, themes, type ThemeMode } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTranslation } from "@/hooks/use-translation";
import { meApi } from "@/lib/api";
import { configureDailyReminder } from "@/lib/notifications";
import { useAppStore } from "@/store/app-store";
import type { Language } from "@/types";

const themeModes: ThemeMode[] = ["light", "sky", "dark"];
const languages: Language[] = ["ru", "uz", "en"];
const times = ["09:00", "19:00", "21:00"];

const legalCopy = {
  ru: {
    title: "Данные и конфиденциальность",
    privacy: "Политика конфиденциальности",
    deleteAccount: "Удаление аккаунта",
  },
  uz: {
    title: "Ma’lumotlar va maxfiylik",
    privacy: "Maxfiylik siyosati",
    deleteAccount: "Hisobni o‘chirish",
  },
  en: {
    title: "Data and privacy",
    privacy: "Privacy Policy",
    deleteAccount: "Delete account",
  },
} as const;

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { isDesktop } = useResponsiveLayout();
  const { t, language } = useTranslation();
  const notificationsEnabled = useAppStore(
    (state) => state.notificationsEnabled,
  );
  const notificationTime = useAppStore((state) => state.notificationTime);
  const setNotifications = useAppStore((state) => state.setNotifications);
  const setNotificationTime = useAppStore((state) => state.setNotificationTime);
  const mode = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setGoal = useAppStore((state) => state.setGoal);
  const goal = useAppStore((state) => state.goalUnits);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const [busy, setBusy] = useState(false);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
  const legal = legalCopy[language];
  const patchPreferences = (
    input: Parameters<typeof meApi.updatePreferences>[0],
  ) => {
    if (!authenticated) return;
    void meApi.updatePreferences(input, accessToken!).catch(() => {});
  };
  const patchProfile = (input: Parameters<typeof meApi.updateProfile>[0]) => {
    if (!authenticated) return;
    void meApi.updateProfile(input, accessToken!).catch(() => {});
  };

  const toggleNotifications = async (enabled: boolean) => {
    setBusy(true);
    try {
      const allowed = await configureDailyReminder(
        enabled,
        notificationTime,
        language,
      );
      const nextEnabled = enabled && allowed;
      setNotifications(nextEnabled);
      patchPreferences({
        notificationsEnabled: nextEnabled,
        dailyReminderEnabled: nextEnabled,
      });
      if (enabled && !allowed) {
        Alert.alert(t("settings.notifications"), t("settings.permissionDenied"));
      }
    } catch {
      setNotifications(false);
      Alert.alert(t("settings.notifications"), t("settings.permissionDenied"));
    } finally {
      setBusy(false);
    }
  };

  const changeTime = async (time: string) => {
    setNotificationTime(time);
    if (notificationsEnabled) {
      void configureDailyReminder(true, time, language).catch(() => {});
    }
  };

  const changeTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    patchPreferences({ theme: nextTheme });
  };

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    patchPreferences({ language: nextLanguage });
  };

  const changeGoal = (amount: number) => {
    setGoal(amount);
    patchProfile({ savingsGoalCents: amount });
  };

  return (
    <AppFrame wide>
      <ScreenHeader
        title={t("settings.title")}
        onBack={() => router.back()}
      />

      <View
        style={[styles.settingsGrid, isDesktop && styles.settingsGridDesktop]}
      >
        <GlassSurface
          intensity={58}
          variant="strong"
          style={[
            styles.section,
            isDesktop && styles.settingsCardDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
        <View style={styles.settingRow}>
          <View
            style={[styles.settingIcon, { backgroundColor: theme.primarySoft }]}
          >
            <Ionicons
              name="notifications-outline"
              color={String(theme.primary)}
              size={22}
            />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="label">{t("settings.notifications")}</AppText>
            <AppText variant="caption" muted>
              {t("settings.notificationBody")}
            </AppText>
          </View>
          <GlassSwitch
            accessibilityLabel={t("settings.notifications")}
            value={notificationsEnabled}
            disabled={busy}
            onValueChange={(value) => void toggleNotifications(value)}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View>
          <AppText variant="caption" muted style={{ marginBottom: 10 }}>
            {t("settings.time")}
          </AppText>
          <View style={styles.chips}>
            {times.map((time) => (
              <ChoiceChip
                key={time}
                label={time}
                selected={notificationTime === time}
                onPress={() => void changeTime(time)}
              />
            ))}
          </View>
        </View>
        </GlassSurface>

        <GlassSurface
          intensity={54}
          variant="strong"
          style={[
            styles.blockGlass,
            isDesktop && styles.settingsCardDesktop,
          ]}
        >
        <AppText variant="heading">{t("settings.theme")}</AppText>
        <View style={styles.themeGrid}>
          {themeModes.map((themeMode) => {
            const palette = themes[themeMode];
            const selected = mode === themeMode;
            return (
              <Pressable
                key={themeMode}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t(`settings.theme.${themeMode}`)}
                onPress={() => changeTheme(themeMode)}
                style={({ pressed }) => [
                  styles.themeCard,
                  {
                    backgroundColor: palette.glassFillStrong,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.themePreview,
                    { backgroundColor: palette.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.themeBar,
                      { backgroundColor: palette.primary },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeLine,
                      { backgroundColor: palette.surfaceMuted },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeLine,
                      { width: "55%", backgroundColor: palette.surfaceMuted },
                    ]}
                  />
                </View>
                <View style={styles.themeLabel}>
                  <AppText
                    variant="caption"
                    color={String(palette.text)}
                  >
                    {t(`settings.theme.${themeMode}`)}
                  </AppText>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      color={String(theme.primary)}
                      size={18}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        </GlassSurface>

        <GlassSurface
          intensity={56}
          variant="strong"
          style={[
            styles.section,
            isDesktop && styles.settingsCardDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
        <View style={styles.sectionTitle}>
          <Ionicons
            name="globe-outline"
            size={20}
            color={String(theme.primary)}
          />
          <AppText variant="heading">{t("settings.language")}</AppText>
        </View>
        <View style={styles.chips}>
          {languages.map((item) => (
            <ChoiceChip
              key={item}
              label={t(`language.${item}`)}
              selected={language === item}
              onPress={() => changeLanguage(item)}
            />
          ))}
        </View>
        </GlassSurface>

        <GlassSurface
          intensity={56}
          variant="strong"
          style={[
            styles.section,
            isDesktop && styles.settingsCardDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
        <View style={styles.sectionTitle}>
          <Ionicons
            name="flag-outline"
            size={20}
            color={String(theme.primary)}
          />
          <AppText variant="heading">{t("home.goal")}</AppText>
        </View>
        <View style={styles.chips}>
          {[1000, 2500, 5000].map((amount) => (
            <ChoiceChip
              key={amount}
              label={`$${amount / 100}`}
              selected={goal === amount}
              onPress={() => changeGoal(amount)}
            />
          ))}
        </View>
        </GlassSurface>

        <GlassSurface
          intensity={56}
          variant="strong"
          style={[
            styles.section,
            isDesktop && styles.settingsCardDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
          <View style={styles.sectionTitle}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={String(theme.primary)}
            />
            <AppText variant="heading">{legal.title}</AppText>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/privacy" as never)}
            style={({ pressed }) => [
              styles.legalRow,
              { borderColor: theme.border, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={String(theme.primary)}
            />
            <AppText style={styles.legalText}>{legal.privacy}</AppText>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={String(theme.textMuted)}
            />
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/account-deletion" as never)}
            style={({ pressed }) => [
              styles.legalRow,
              { borderColor: theme.border, opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <Ionicons name="trash-outline" size={20} color="#E5484D" />
            <AppText style={styles.legalText}>{legal.deleteAccount}</AppText>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={String(theme.textMuted)}
            />
          </Pressable>
        </GlassSurface>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  settingsGrid: {
    width: "100%",
  },
  settingsGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 18,
  },
  settingsCardDesktop: {
    flexBasis: "46%",
    flexGrow: 1,
    minWidth: 360,
    marginBottom: 0,
  },
  section: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  blockGlass: {
    borderRadius: radii.lg,
    padding: 16,
    gap: 12,
    marginBottom: 18,
  },
  themeGrid: {
    flexDirection: "row",
    gap: 9,
  },
  themeCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radii.lg,
    padding: 8,
    minWidth: 0,
  },
  themePreview: {
    height: 72,
    borderRadius: 13,
    padding: 8,
    gap: 6,
  },
  themeBar: {
    height: 13,
    width: "42%",
    borderRadius: 6,
  },
  themeLine: {
    height: 8,
    width: "76%",
    borderRadius: 4,
  },
  themeLabel: {
    minHeight: 28,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 2,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legalText: {
    flex: 1,
  },
});
