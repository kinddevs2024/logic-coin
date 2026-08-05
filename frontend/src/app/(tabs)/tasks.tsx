import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { ChoiceChip } from "@/components/choice-chip";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenHeader } from "@/components/screen-header";
import { TaskCard } from "@/components/task-card";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { useTasks } from "@/hooks/use-tasks";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import type { LogicTask } from "@/types";

type Filter = "all" | "daily" | "boost";

export default function TasksScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveLayout();
  const [filter, setFilter] = useState<Filter>("all");
  const taskCounts = useAppStore((state) => state.taskCounts);
  const { tasks, claim, pendingTaskId } = useTasks();

  const filtered = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "daily") return task.category === "daily";
    return task.category === "boost" || task.rewardUnits >= 20;
  });

  const complete = async (task: LogicTask) => {
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
    <AppFrame wide desktopNavigationInset>
      <ScreenHeader
        title={t("task.title")}
        action={
          <GlassSurface variant="soft" intensity={56} style={styles.coin}>
            <Ionicons name="flash" size={18} color={String(theme.primary)} />
          </GlassSurface>
        }
      />
      <View style={styles.filters}>
        <ChoiceChip
          label={t("task.filter.all")}
          selected={filter === "all"}
          onPress={() => setFilter("all")}
        />
        <ChoiceChip
          label={t("task.filter.daily")}
          selected={filter === "daily"}
          onPress={() => setFilter("daily")}
        />
        <ChoiceChip
          label={t("task.filter.boost")}
          selected={filter === "boost"}
          onPress={() => setFilter("boost")}
        />
      </View>

      <View style={[styles.list, isDesktop && styles.listDesktop]}>
        {filtered.map((task) => (
          <View
            key={task.id}
            style={[styles.taskCell, isDesktop && styles.taskCellDesktop]}
          >
            <TaskCard
              task={task}
              count={taskCounts[task.id] ?? 0}
              loading={pendingTaskId === task.id}
              onPress={() => void complete(task)}
            />
          </View>
        ))}
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  coin: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 20,
  },
  list: {
    gap: 11,
  },
  listDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    gap: 12,
  },
  taskCell: {
    width: "100%",
  },
  taskCellDesktop: {
    width: "49%",
    minWidth: 360,
  },
});
