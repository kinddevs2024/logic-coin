import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppButton, IconButton } from "@/components/buttons";
import { GlassSurface } from "@/components/glass-surface";
import { ProfileDrawer } from "@/components/profile-drawer";
import { SavingsScene } from "@/components/savings-scene";
import { SectionHeader } from "@/components/section-header";
import { TaskCard } from "@/components/task-card";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTasks } from "@/hooks/use-tasks";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

export default function HomeScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { isDesktop } = useResponsiveLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const balance = useAppStore((state) => state.balanceUnits);
  const goal = useAppStore((state) => state.goalUnits);
  const taskCounts = useAppStore((state) => state.taskCounts);
  const { tasks, claim, pendingTaskId } = useTasks();

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

  return (
    <AppFrame wide desktopNavigationInset contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton
          name="person-outline"
          label={t("tabs.profile")}
          onPress={() => setDrawerOpen(true)}
        />
        <IconButton
          name="settings-outline"
          label={t("profile.settings")}
          onPress={() => router.push("/settings")}
        />
      </View>

      <View style={[styles.dashboard, isDesktop && styles.dashboardDesktop]}>
        <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <SavingsScene balance={balance} goal={goal} />

          <View style={styles.actions}>
            <AppButton
              variant="secondary"
              icon="flash"
              onPress={() => router.push("/tasks")}
              style={styles.action}
            >
              {t("home.earn")}
            </AppButton>
            <AppButton
              icon="wallet"
              onPress={() => router.push("/withdraw")}
              glow
              style={styles.action}
            >
              {t("home.withdraw")}
            </AppButton>
          </View>
        </View>

        <GlassSurface
          intensity={68}
          variant="strong"
          style={[
            styles.tasksPanel,
            isDesktop && styles.tasksPanelDesktop,
            { borderColor: theme.glassBorder },
          ]}
        >
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
        </GlassSurface>
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
  content: {
    paddingTop: 12,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -2,
    zIndex: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: -34,
    zIndex: 12,
  },
  dashboard: {
    width: "100%",
  },
  dashboardDesktop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    paddingTop: 6,
  },
  hero: {
    width: "100%",
  },
  heroDesktop: {
    flex: 1,
    minWidth: 0,
  },
  action: {
    flex: 1,
    minHeight: 64,
  },
  tasksPanel: {
    borderRadius: 34,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  tasksPanelDesktop: {
    flex: 1,
    minWidth: 0,
    marginTop: 10,
    padding: 18,
  },
  taskList: {
    gap: 9,
  },
});
