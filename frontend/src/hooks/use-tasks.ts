import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DEMO_TASKS } from "@/constants/tasks";
import { tasksApi } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { LogicTask } from "@/types";

function mapServerTask(task: Record<string, unknown>, index: number): LogicTask {
  const id = String(
    task.key ?? task.identifier ?? task.id ?? `server-task-${index}`,
  );
  const rawIcon = String(task.icon ?? "");
  const icon: LogicTask["icon"] = rawIcon.includes("people")
    ? "people"
    : rawIcon.includes("calendar")
      ? "calendar"
      : rawIcon.includes("layers")
        ? "layers"
        : rawIcon.includes("spark")
          ? "sparkles"
          : "play";
  const rawType = String(task.type ?? "");
  const serverState =
    typeof task.state === "object" && task.state
      ? (task.state as Record<string, unknown>)
      : undefined;
  const category: LogicTask["category"] = rawType.includes("daily")
    ? "daily"
    : rawType.includes("social") || rawType.includes("referral")
      ? "social"
      : Number(task.rewardUnits ?? 0) >= 20
        ? "boost"
        : "quick";
  return {
    id,
    titleKey: String(task.title ?? task.titleKey ?? "task.short.title"),
    descriptionKey: String(
      task.description ?? task.descriptionKey ?? "task.short.description",
    ),
    rewardUnits: Number(
      task.rewardUnits ?? task.reward ?? task.rewardCents ?? 8,
    ),
    category,
    icon,
    color: String(
      task.color ??
        (category === "daily"
          ? "#12B76A"
          : category === "boost"
            ? "#7A5AF8"
            : category === "social"
              ? "#EC4899"
              : "#0866FF"),
    ),
    repeatable: Boolean(task.repeatable ?? true),
    available:
      typeof serverState?.available === "boolean"
        ? serverState.available
        : true,
    remainingToday:
      typeof serverState?.remainingToday === "number"
        ? serverState.remainingToday
        : undefined,
    cooldownRemainingSeconds:
      typeof serverState?.cooldownRemainingSeconds === "number"
        ? serverState.cooldownRemainingSeconds
        : undefined,
  };
}

export function useTasks() {
  const authMode = useAppStore((state) => state.authMode);
  const accessToken = useAppStore((state) => state.accessToken);
  const addReward = useAppStore((state) => state.addReward);
  const setBalance = useAppStore((state) => state.setBalance);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tasks", authMode],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: authMode === "authenticated" && Boolean(accessToken),
    staleTime: 30_000,
    retry: 1,
  });

  const serverTasks = query.data?.map((task, index) =>
    mapServerTask(task as Record<string, unknown>, index),
  );
  const tasks = serverTasks?.length ? serverTasks : DEMO_TASKS;

  const mutation = useMutation({
    mutationFn: async (task: LogicTask) => {
      if (authMode === "authenticated" && accessToken) {
        const result = await tasksApi.claim(task.id, accessToken);
        return { task, result };
      }
      return {
        task,
        result: {
          claim: { rewardUnits: task.rewardUnits },
        },
      };
    },
    onSuccess: ({ task, result }) => {
      const reward = Number(
        result.claim?.rewardUnits ??
          result.claim?.rewardCents ??
          task.rewardUnits,
      );
      addReward(task.id, reward);
      const serverBalance =
        result.wallet?.availableUnits;
      if (typeof serverBalance === "number") {
        setBalance(serverBalance);
      }
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return {
    tasks,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    refresh: query.refetch,
    claim: mutation.mutateAsync,
    pendingTaskId: mutation.isPending ? mutation.variables?.id : undefined,
    error: query.error ?? mutation.error,
  };
}
