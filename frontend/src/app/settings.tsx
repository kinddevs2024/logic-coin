import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { ChoiceChip } from "@/components/choice-chip";
import { PiggyBank } from "@/components/piggy-bank";
import { ScreenHeader } from "@/components/screen-header";
import { radii, themes, type ThemeMode } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { meApi } from "@/lib/api";
import { configureDailyReminder } from "@/lib/notifications";
import { useAppStore } from "@/store/app-store";
import type { Language, PiggyKind } from "@/types";

const themeModes: ThemeMode[] = ["light", "sky", "dark"];
const languages: Language[] = ["ru", "uz", "en"];
const piggies: PiggyKind[] = ["pig", "jar", "safe", "car", "rocket"];
const times = ["09:00", "19:00", "21:00"];

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
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
  const selectedPiggy = useAppStore((state) => state.selectedPiggy);
  const selectPiggy = useAppStore((state) => state.selectPiggy);
  const setGoal = useAppStore((state) => state.setGoal);
  const goal = useAppStore((state) => state.goalUnits);
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const [busy, setBusy] = useState(false);
  const authenticated = authMode === "authenticated" && Boolean(accessToken);
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

  const changePiggy = (piggy: PiggyKind) => {
    selectPiggy(piggy);
    patchProfile({ piggyBankVariant: piggy });
  };

  const changeGoal = (amount: number) => {
    setGoal(amount);
    patchProfile({ savingsGoalCents: amount });
  };

  return (
    <AppFrame>
      <ScreenHeader
        title={t("settings.title")}
        onBack={() => router.back()}
      />

      <View
        style={[
          styles.section,
          { backgroundColor: theme.surface, borderColor: theme.border },
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
          <Switch
            value={notificationsEnabled}
            disabled={busy}
            onValueChange={(value) => void toggleNotifications(value)}
            trackColor={{
              false: String(theme.border),
              true: String(theme.primarySoft),
            }}
            thumbColor={
              notificationsEnabled
                ? String(theme.primary)
                : String(theme.textMuted)
            }
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
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t("settings.theme")}</AppText>
        <View style={styles.themeGrid}>
          {themeModes.map((themeMode) => {
            const palette = themes[themeMode];
            const selected = mode === themeMode;
            return (
              <Pressable
                key={themeMode}
                onPress={() => changeTheme(themeMode)}
                style={({ pressed }) => [
                  styles.themeCard,
                  {
                    backgroundColor: palette.background,
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
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: theme.surface, borderColor: theme.border },
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
      </View>

      <View style={styles.block}>
        <AppText variant="heading">{t("settings.bank")}</AppText>
        <View style={styles.piggyGrid}>
          {piggies.map((piggy) => {
            const selected = selectedPiggy === piggy;
            return (
              <Pressable
                key={piggy}
                onPress={() => changePiggy(piggy)}
                style={({ pressed }) => [
                  styles.piggyCard,
                  {
                    backgroundColor: selected
                      ? theme.primarySoft
                      : theme.surface,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: pressed ? 0.76 : 1,
                  },
                ]}
              >
                <PiggyBank kind={piggy} size={76} interactive={false} />
                <AppText
                  variant="caption"
                  color={selected ? String(theme.primary) : undefined}
                >
                  {t(`settings.bank.${piggy}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: theme.surface, borderColor: theme.border },
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
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
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
  block: {
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
  piggyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  piggyCard: {
    width: "31%",
    minWidth: 94,
    height: 108,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    overflow: "hidden",
  },
});
