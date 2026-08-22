import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/app-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { localDayKey } from "@/lib/date";
import type { ActivityDay } from "@/types";

const activity = Array.from({ length: 84 }, (_, index) => {
  const wave = Math.sin(index * 1.71) + Math.cos(index * 0.43);
  if (index > 78) return index % 2 === 0 ? 3 : 2;
  if (wave > 1.1) return 3;
  if (wave > 0.2) return 2;
  if (wave > -0.65) return 1;
  return 0;
});

export function ActivityHeatmap({
  compact,
  days,
  toDayKey,
}: {
  compact?: boolean;
  days?: ActivityDay[];
  toDayKey?: string;
}) {
  const theme = useAppTheme();
  const { isDesktop } = useResponsiveLayout();
  const cellSize = compact ? 8 : isDesktop ? 18 : 12;
  const gap = compact ? 3 : isDesktop ? 6 : 4;
  const colors = [
    String(theme.surfaceMuted),
    `${String(theme.primary)}42`,
    `${String(theme.primary)}91`,
    String(theme.primary),
  ];
  const actionByDay = new Map(
    days?.map((day) => [day.dayKey, day.actionCount]) ?? [],
  );
  const endDate = new Date(
    `${toDayKey ?? localDayKey()}T00:00:00Z`,
  );
  const levels = days
    ? Array.from({ length: 84 }, (_, index) => {
        const date = new Date(endDate);
        date.setUTCDate(endDate.getUTCDate() - (83 - index));
        const actions = actionByDay.get(date.toISOString().slice(0, 10)) ?? 0;
        if (actions >= 4) return 3;
        if (actions >= 2) return 2;
        return actions > 0 ? 1 : 0;
      })
    : activity;

  return (
    <View>
      <View style={styles.row}>
        {Array.from({ length: 12 }, (_, week) => (
          <View key={week} style={{ gap }}>
            {Array.from({ length: 7 }, (_, day) => {
              const index = week * 7 + day;
              return (
                <View
                  key={day}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: compact ? 2.5 : isDesktop ? 6 : 4,
                    backgroundColor: colors[levels[index] ?? 0],
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      {!compact ? (
        <View style={styles.legend}>
          <AppText variant="caption" muted>
            Меньше
          </AppText>
          {colors.map((color) => (
            <View
              key={color}
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                backgroundColor: color,
              }}
            />
          ))}
          <AppText variant="caption" muted>
            Больше
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 4,
    alignItems: "flex-start",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    marginTop: 11,
  },
});
