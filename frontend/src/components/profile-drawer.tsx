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

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton, IconButton } from "@/components/buttons";
import { useGlassBlurTarget } from "@/components/glass-blur-target";
import { GlassSurface } from "@/components/glass-surface";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";

export function ProfileDrawer({
  visible,
  onClose,
  onProfile,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onProfile: () => void;
  onInvite: () => void;
}) {
  const theme = useAppTheme();
  const blurTarget = useGlassBlurTarget();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const user = useAppStore((state) => state.user);
  const balance = useAppStore((state) => state.balanceUnits);
  const streak = useAppStore((state) => state.streak);
  const activeDays = useAppStore((state) => state.activeDays);
  const [translateX] = useState(() => new Animated.Value(-440));
  const [backdrop] = useState(() => new Animated.Value(0));
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
              <View style={styles.close}>
                <IconButton
                  name="close"
                  label={t("common.close")}
                  onPress={close}
                />
              </View>
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
                  <Avatar name={user.name} size={72} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading" color="#FFFFFF">
                      {user.name}
                    </AppText>
                    <AppText variant="caption" color="rgba(255,255,255,0.72)">
                      {user.email ?? t("common.demo")}
                    </AppText>
                  </View>
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
                    {activeDays}
                  </AppText>
                  <AppText variant="caption" muted style={{ textAlign: "center" }}>
                    {t("home.drawer.activeDays")}
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

              <GlassSurface
                intensity={52}
                style={[styles.activity, { borderColor: theme.border }]}
              >
                <View style={styles.activityTitle}>
                  <View>
                    <AppText variant="label">{t("profile.active")}</AppText>
                    <AppText variant="caption" muted>
                      {t("bonus.calendar")}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.liveDot,
                      { backgroundColor: theme.primarySoft },
                    ]}
                  >
                    <View
                      style={[styles.dot, { backgroundColor: theme.primary }]}
                    />
                    <AppText variant="caption" color={String(theme.primary)}>
                      {activeDays}
                    </AppText>
                  </View>
                </View>
                <ActivityHeatmap compact />
              </GlassSurface>

              <AppButton
                variant="secondary"
                icon="person-outline"
                onPress={() => closeWithAction(onProfile)}
              >
                {t("home.drawer.profile")}
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
    width: "86%",
    maxWidth: 430,
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
  close: {
    alignItems: "flex-end",
  },
  profileCard: {
    borderRadius: radii.xl,
    padding: 20,
    gap: 22,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
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
