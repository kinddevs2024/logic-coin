import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { ChoiceChip } from "@/components/choice-chip";
import { ScreenHeader } from "@/components/screen-header";
import { TaskCard } from "@/components/task-card";
import { radii } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTasks } from "@/hooks/use-tasks";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";
import type { LogicTask } from "@/types";

type Filter = "all" | "daily" | "boost";

export default function TasksScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
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
    <AppFrame>
      <ScreenHeader
        title={t("task.title")}
        subtitle={t("task.subtitle")}
        action={
          <View
            style={[
              styles.coin,
              { backgroundColor: theme.primarySoft },
            ]}
          >
            <Ionicons name="flash" size={18} color={String(theme.primary)} />
          </View>
        }
      />
      <View
        style={[
          styles.note,
          { backgroundColor: theme.primarySoft, borderColor: theme.border },
        ]}
      >
        <View style={[styles.noteIcon, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" color="#FFFFFF" size={19} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" color={String(theme.primary)}>
            {t("common.demo")}
          </AppText>
          <AppText variant="caption" color={String(theme.primary)}>
            {t("task.demoNote")}
          </AppText>
        </View>
      </View>

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

      <View style={styles.list}>
        {filtered.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            count={taskCounts[task.id] ?? 0}
            loading={pendingTaskId === task.id}
            onPress={() => void complete(task)}
          />
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
  note: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noteIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
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
});
