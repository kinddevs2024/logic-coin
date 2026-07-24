import type { PropsWithChildren } from "react";
import {
  Text,
  type TextProps,
  type TextStyle,
  type StyleProp,
} from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

type Variant = "display" | "title" | "heading" | "body" | "caption" | "label";

const variants: Record<Variant, TextStyle> = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1.1,
  },
  title: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  heading: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  caption: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
};

type AppTextProps = TextProps &
  PropsWithChildren<{
    variant?: Variant;
    muted?: boolean;
    color?: string;
    style?: StyleProp<TextStyle>;
  }>;

export function AppText({
  variant = "body",
  muted,
  color,
  style,
  children,
  ...props
}: AppTextProps) {
  const theme = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        variants[variant],
        { color: color ?? (muted ? theme.textMuted : theme.text) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
