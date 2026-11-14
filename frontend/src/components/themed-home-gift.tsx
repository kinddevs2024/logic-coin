import { useEffect, useState } from "react";
import { Image, type ImageProps } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { giftPalette } from "@/lib/gift-colors";
import { GIFT_CLOSED, GIFT_OPEN } from "./home-gift-assets";

type Props = Omit<ImageProps, "source"> & { state: "open" | "closed" };
export function ThemedHomeGift({ state, ...props }: Props) {
  const theme = useAppTheme();
  const [body, ribbon] = giftPalette(String(theme.primary));
  const [source, setSource] = useState<ImageProps["source"]>(state === "open" ? GIFT_OPEN : GIFT_CLOSED);
  useEffect(() => {
    let active = true;
    // Do not wait for the gift's continuous flight animation to finish.
    // Decode lazily once per image and recolor only on palette changes.
    const timer = setTimeout(() => {
      void import("@/lib/themed-gift-image").then(({ themedGiftSource }) => {
        const next = themedGiftSource(state, [body, ribbon]);
        if (active) setSource(next);
      }).catch(() => { if (active) setSource(state === "open" ? GIFT_OPEN : GIFT_CLOSED); });
    }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [body, ribbon, state]);
  return <Image {...props} source={source} />;
}
