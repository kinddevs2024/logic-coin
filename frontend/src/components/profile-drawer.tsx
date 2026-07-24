import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ActivityHeatmap } from "@/components/activity-heatmap";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton, IconButton } from "@/components/buttons";
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
  const { t } = useTranslation();
  const user = useAppStore((state) => state.user);
  const balance = useAppStore((state) => state.balanceUnits);
  const streak = useAppStore((state) => state.streak);
  const activeDays = useAppStore((state) => state.activeDays);
  const [translateX] = useState(() => new Animated.Value(-440));
  const [backdrop] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(-440);
    backdrop.setValue(0);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        damping: 20,
        stiffness: 180,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 210,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [backdrop, translateX, visible]);

  const close = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -440,
        duration: 190,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 190,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  };

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
            { backgroundColor: "rgba(4,16,38,0.48)", opacity: backdrop },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: theme.background,
              transform: [{ translateX }],
              shadowColor: "#000000",
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.close}>
              <IconButton name="close" label={t("common.close")} onPress={close} />
            </View>
            <LinearGradient
              colors={["#0866FF", "#155DD8", "#5745E9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
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
              <View style={[styles.stat, { backgroundColor: theme.surface }]}>
                <AppText variant="heading" color={String(theme.primary)}>
                  {activeDays}
                </AppText>
                <AppText variant="caption" muted style={{ textAlign: "center" }}>
                  {t("home.drawer.activeDays")}
                </AppText>
              </View>
              <View style={[styles.stat, { backgroundColor: theme.surface }]}>
                <AppText variant="heading" color={String(theme.primary)}>
                  {streak}
                </AppText>
                <AppText variant="caption" muted style={{ textAlign: "center" }}>
                  {t("home.drawer.streak")}
                </AppText>
              </View>
            </View>

            <View
              style={[
                styles.activity,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
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
            </View>

            <AppButton
              variant="secondary"
              icon="person-outline"
              onPress={() => {
                close();
                setTimeout(onProfile, 210);
              }}
            >
              {t("home.drawer.profile")}
            </AppButton>
            <AppButton
              icon="person-add-outline"
              glow
              onPress={() => {
                close();
                setTimeout(onInvite, 210);
              }}
            >
              {t("home.drawer.invite")}
            </AppButton>
          </ScrollView>
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
