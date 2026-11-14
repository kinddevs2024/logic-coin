import { useUiCopy } from "@/components/localized-native";

import { View } from "react-native";

import { AppText } from "@/components/app-text";
import { IconButton } from "@/components/buttons";
import { useTranslation } from "@/hooks/use-translation";

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  const { copyContent } = useUiCopy();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        marginBottom: 22,
      }}
    >
      {onBack ? (
        <IconButton
          name="chevron-back"
          label={t("common.back")}
          onPress={onBack}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="title">{copyContent(title)}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {copyContent(subtitle)}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}
