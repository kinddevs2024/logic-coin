import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { CountryFlagBadge, countryName } from "@/components/country-flag";
import { AppButton } from "@/components/buttons";
import { EditProfileModal } from "@/components/edit-profile-modal";
import { useGlassBlurTarget } from "@/components/glass-blur-target";
import { GlassSurface } from "@/components/glass-surface";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { formatMoney } from "@/lib/format";
import { sharePublicProfile } from "@/lib/profile-link";
import { useAppStore } from "@/store/app-store";

export function ProfileDrawer({
  visible,
  onClose,
  onSettings,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onSettings: () => void;
  onInvite: () => void;
}) {
  const theme = useAppTheme();
  const blurTarget = useGlassBlurTarget();
  const { t, language } = useTranslation();
  const reduceMotion = useReducedMotion();
  const user = useAppStore((state) => state.user);
  const authMode = useAppStore((state) => state.authMode);
  const balance = useAppStore((state) => state.balanceUnits);
  const coinBalance = useAppStore((state) => state.coinBalance);
  const streak = useAppStore((state) => state.streak);
  const [translateX] = useState(() => new Animated.Value(-440));
  const [backdrop] = useState(() => new Animated.Value(0));
  const [editing, setEditing] = useState(false);
  const closing = useRef(false);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    translateX.setValue(-440);
    backdrop.setValue(0);
    const entrance = reduceMotion
      ? Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        })
      : Animated.spring(translateX, {
          toValue: 0,
          damping: 20,
          stiffness: 180,
          useNativeDriver: Platform.OS !== "web",
        });
    Animated.parallel([
      entrance,
      Animated.timing(backdrop, {
        toValue: 1,
        duration: reduceMotion ? 0 : 210,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [backdrop, reduceMotion, translateX, visible]);

  const closeWithAction = (afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -440,
        duration: reduceMotion ? 0 : 190,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: reduceMotion ? 0 : 190,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        afterClose?.();
      } else {
        closing.current = false;
      }
    });
  };
  const close = () => closeWithAction();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={close}
    >
      <View style={styles.modal}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(4,16,38,0.32)", opacity: backdrop },
          ]}
        >
          <BlurView
            pointerEvents="none"
            intensity={34}
            tint={theme.mode === "dark" ? "dark" : "light"}
            {...(Platform.OS === "android" && blurTarget
              ? {
                  blurMethod: "dimezisBlurViewSdk31Plus" as const,
                  blurTarget,
                }
              : {})}
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX }],
              shadowColor: "#000000",
            },
          ]}
        >
          <GlassSurface
            intensity={82}
            variant="strong"
            style={styles.drawerGlass}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient
                colors={["rgba(33,139,255,0.92)", "#155DD8", "#5745E9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileCard}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(255,255,255,0.5)", "rgba(255,255,255,0)"]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.profileTop}>
                  <Avatar name={user.name} avatarUrl={user.avatarUrl} size={72} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading" color="#FFFFFF">
                      {user.name}
                    </AppText>
                    <AppText variant="caption" color="rgba(255,255,255,0.72)">
                      {user.email ?? (authMode === "authenticated" ? "Telegram" : "Гость")}
                    </AppText>
                    <View style={styles.drawerCountry}>
                      <CountryFlagBadge countryCode={user.countryCode} size={16} />
                      <AppText variant="caption" color="rgba(255,255,255,0.78)">{countryName(user.countryCode, language)}</AppText>
                    </View>
                  </View>
                </View>
                <View style={styles.profileActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.edit")}
                    onPress={() => setEditing(true)}
                    style={({ pressed }) => [styles.profileAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="create-outline" size={18} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Поделиться профилем"
                    onPress={() => void sharePublicProfile(user.name, user.referralCode)}
                    style={({ pressed }) => [styles.profileAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={styles.balanceRow}>
                  <View>
                    <AppText variant="caption" color="rgba(255,255,255,0.72)">
                      {t("home.balance")}
                    </AppText>
                    <AppText variant="title" color="#FFFFFF">
                      {formatMoney(balance)}
                    </AppText>
                  </View>
                  <View style={styles.lcChip}>
                    <Ionicons name="diamond" size={15} color="#FFFFFF" />
                    <AppText variant="caption" color="#FFFFFF">
                      Logic member
                    </AppText>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.stats}>
                <GlassSurface style={styles.stat} intensity={48}>
                  <AppText variant="heading" color={String(theme.primary)}>
                    {coinBalance}
                  </AppText>
                  <AppText variant="caption" muted style={{ textAlign: "center" }}>
                    coin
                  </AppText>
                </GlassSurface>
                <GlassSurface style={styles.stat} intensity={48}>
                  <AppText variant="heading" color={String(theme.primary)}>
                    {streak}
                  </AppText>
                  <AppText variant="caption" muted style={{ textAlign: "center" }}>
                    {t("home.drawer.streak")}
                  </AppText>
                </GlassSurface>
              </View>

              <AppButton
                variant="secondary"
                icon="settings-outline"
                onPress={() => closeWithAction(onSettings)}
              >
                {t("profile.settings")}
              </AppButton>
              <AppButton
                icon="person-add-outline"
                glow
                onPress={() => closeWithAction(onInvite)}
              >
                {t("home.drawer.invite")}
              </AppButton>
            </ScrollView>
          </GlassSurface>
        </Animated.View>
        <EditProfileModal visible={editing} onClose={() => setEditing(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    flexDirection: "row",
  },
  drawer: {
    width: "78%",
    maxWidth: 390,
    height: "100%",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 18,
  },
  drawerGlass: {
    flex: 1,
    borderRadius: 0,
    borderTopRightRadius: 36,
    borderBottomRightRadius: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 34,
    paddingBottom: 34,
    gap: 14,
  },
  profileCard: {
    position: "relative",
    borderRadius: radii.xl,
    padding: 20,
    gap: 22,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingRight: 88,
  },
  drawerCountry: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  profileActions: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 8,
  },
  profileAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  lcChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    borderRadius: radii.lg,
    padding: 14,
    alignItems: "center",
    gap: 3,
  },
  activity: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    gap: 16,
    overflow: "hidden",
  },
  activityTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveDot: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
