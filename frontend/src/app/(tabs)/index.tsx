import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { AppButton, IconButton } from "@/components/buttons";
import { LogicCoinLogo } from "@/components/logo";
import { PiggyBank } from "@/components/piggy-bank";
import { ProfileDrawer } from "@/components/profile-drawer";
import { ProgressBar } from "@/components/progress-bar";
import { SectionHeader } from "@/components/section-header";
import { TaskCard } from "@/components/task-card";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTasks } from "@/hooks/use-tasks";
import { useTranslation } from "@/hooks/use-translation";
import { formatMoney } from "@/lib/format";
import { useAppStore } from "@/store/app-store";
import type { PiggyKind } from "@/types";

const piggies: PiggyKind[] = ["pig", "jar", "safe", "car", "rocket"];

export default function HomeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useAppStore((state) => state.user);
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const selectedPiggy = useAppStore((state) => state.selectedPiggy);
  const selectPiggy = useAppStore((state) => state.selectPiggy);
  const taskCounts = useAppStore((state) => state.taskCounts);
  const { tasks, claim, pendingTaskId } = useTasks();
  const progress = balance / Math.max(goal, 1);

  const complete = async (task: (typeof tasks)[number]) => {
    try {
      await claim(task);
    } catch (error) {
      Alert.alert(
        t("task.title"),
        error instanceof Error ? error.message : t("auth.invalid"),
      );
    }
  };

  const cyclePiggy = () => {
    const index = piggies.indexOf(selectedPiggy);
    selectPiggy(piggies[(index + 1) % piggies.length]);
  };

  return (
    <AppFrame>
      <View style={styles.header}>
        <Pressable
          onPress={() => setDrawerOpen(true)}
          style={({ pressed }) => [
            styles.avatarPress,
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          <Avatar name={user.name} size={44} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" muted>
              {t("home.hello")}
            </AppText>
            <AppText variant="label" numberOfLines={1}>
              {user.name}
            </AppText>
          </View>
        </Pressable>
        <View style={styles.logoDesktop}>
          <LogicCoinLogo compact />
        </View>
        <IconButton
          name="ellipsis-horizontal"
          label={t("profile.settings")}
          onPress={() => router.push("/settings")}
        />
      </View>

      <LinearGradient
        colors={
          theme.mode === "dark"
            ? ["#12284A", "#101D34"]
            : ["rgba(255,255,255,0.98)", "rgba(232,243,255,0.96)"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.hero,
          {
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.balance}>
          <AppText variant="caption" muted>
            {t("home.balance")}
          </AppText>
          <AppText
            variant="display"
            style={{ fontSize: 40, lineHeight: 46 }}
          >
            {formatMoney(balance)}
          </AppText>
          <View
            style={[
              styles.demoChip,
              { backgroundColor: theme.primarySoft },
            ]}
          >
            <View style={[styles.demoDot, { backgroundColor: theme.primary }]} />
            <AppText variant="caption" color={String(theme.primary)}>
              {t("common.demo")}
            </AppText>
          </View>
        </View>

        <View style={styles.bankStage}>
          <View
            pointerEvents="none"
            style={[
              styles.bankHalo,
              { backgroundColor: theme.primarySoft },
            ]}
          />
          <PiggyBank
            kind={selectedPiggy}
            size={248}
            onPress={cyclePiggy}
          />
          <AppText variant="caption" muted style={{ textAlign: "center" }}>
            {t("home.bankHint")}
          </AppText>
        </View>

        <View style={styles.goal}>
          <View style={styles.goalLabels}>
            <AppText variant="caption" muted>
              {t("home.goal")} · {Math.round(Math.min(1, progress) * 100)}%
            </AppText>
            <AppText variant="caption">
              {formatMoney(balance)} / {formatMoney(goal)}
            </AppText>
          </View>
          <ProgressBar value={progress} height={9} />
        </View>

        <View style={styles.actions}>
          <AppButton
            variant="secondary"
            icon="flash-outline"
            onPress={() => router.push("/tasks")}
            style={styles.action}
          >
            {t("home.earn")}
          </AppButton>
          <AppButton
            icon="wallet-outline"
            onPress={() => router.push("/withdraw")}
            glow
            style={styles.action}
          >
            {t("home.withdraw")}
          </AppButton>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.piggyPicker}
        >
          {piggies.map((piggy) => {
            const selected = piggy === selectedPiggy;
            return (
              <Pressable
                key={piggy}
                onPress={() => selectPiggy(piggy)}
                style={({ pressed }) => [
                  styles.piggyOption,
                  {
                    backgroundColor: selected
                      ? theme.primarySoft
                      : theme.surface,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <PiggyBank
                  kind={piggy}
                  size={55}
                  interactive={false}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <View
        style={[
          styles.note,
          { backgroundColor: theme.primarySoft, borderColor: theme.border },
        ]}
      >
        <View
          style={[styles.noteIcon, { backgroundColor: theme.surfaceRaised }]}
        >
          <AppText color={String(theme.primary)} style={{ fontSize: 18 }}>
            i
          </AppText>
        </View>
        <AppText variant="caption" color={String(theme.primary)} style={{ flex: 1 }}>
          {t("task.demoNote")}
        </AppText>
      </View>

      <View style={styles.tasks}>
        <SectionHeader
          title={t("home.today")}
          action={t("home.allTasks")}
          onAction={() => router.push("/tasks")}
        />
        <View style={styles.taskList}>
          {tasks.slice(0, 3).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              compact
              count={taskCounts[task.id] ?? 0}
              loading={pendingTaskId === task.id}
              onPress={() => void complete(task)}
            />
          ))}
        </View>
      </View>

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onProfile={() => router.push("/profile")}
        onInvite={() => router.push("/invite")}
      />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },
  avatarPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  logoDesktop: {
    flex: 1,
    alignItems: "center",
  },
  hero: {
    borderRadius: 38,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    overflow: "hidden",
    shadowOpacity: Platform.OS === "web" ? 0.11 : 0.15,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 17 },
    elevation: 9,
  },
  balance: {
    alignItems: "center",
    gap: 2,
  },
  demoChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bankStage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 250,
  },
  bankHalo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.65,
  },
  goal: {
    gap: 8,
  },
  goalLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
  piggyPicker: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 8,
    paddingTop: 3,
  },
  piggyOption: {
    width: 64,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  note: {
    marginTop: 16,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noteIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tasks: {
    marginTop: 26,
  },
  taskList: {
    gap: 10,
  },
});
