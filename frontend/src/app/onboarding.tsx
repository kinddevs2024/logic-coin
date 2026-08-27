import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Animated,
  Image,
  type ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AppFrame } from "@/components/app-frame";
import { AppText } from "@/components/app-text";
import { AppButton } from "@/components/buttons";
import type { TranslationKey } from "@/constants/translations";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTranslation } from "@/hooks/use-translation";
import { useAppStore } from "@/store/app-store";

type Slide = {
  title: TranslationKey;
  body: TranslationKey;
  image: ImageSourcePropType;
  imageLabel: string;
};

const slides: Slide[] = [
  {
    title: "onboarding.one.title",
    body: "onboarding.one.body",
    image: require("../../assets/onboarding/01-savings.png"),
    imageLabel: "Glass savings jar on a floating island",
  },
  {
    title: "onboarding.two.title",
    body: "onboarding.two.body",
    image: require("../../assets/onboarding/02-challenges.png"),
    imageLabel: "Six daily puzzle games",
  },
  {
    title: "onboarding.three.title",
    body: "onboarding.three.body",
    image: require("../../assets/onboarding/03-streak.png"),
    imageLabel: "Activity streak calendar and daily gift",
  },
  {
    title: "onboarding.four.title",
    body: "onboarding.four.body",
    image: require("../../assets/onboarding/04-withdraw.png"),
    imageLabel: "Savings jar and payment card",
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const theme = useAppTheme();
  const { t } = useTranslation();
  const finishOnboarding = useAppStore((state) => state.finishOnboarding);
  const router = useRouter();
  const [entrance] = useState(() => new Animated.Value(1));
  const slide = slides[index];

  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      damping: 15,
      stiffness: 130,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [entrance, index]);

  const finish = () => {
    finishOnboarding();
    router.replace("/login");
  };

  const next = () => {
    if (index === slides.length - 1) {
      finish();
      return;
    }
    setIndex((value) => value + 1);
  };

  return (
    <AppFrame
      scroll={false}
      contentStyle={{ flex: 1, paddingBottom: 28 }}
    >
      <View style={styles.top}>
        <View style={styles.dots}>
          {slides.map((_, dot) => (
            <Animated.View
              key={dot}
              style={[
                styles.dot,
                {
                  width: dot === index ? 30 : 8,
                  backgroundColor:
                    dot === index ? theme.primary : theme.primarySoft,
                },
              ]}
            />
          ))}
        </View>
        <Pressable onPress={finish} hitSlop={10}>
          <AppText variant="label" muted>
            {t("common.skip")}
          </AppText>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.stage,
          {
            opacity: entrance,
            transform: [
              {
                translateX: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [32, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.visual,
            { borderColor: theme.border, shadowColor: theme.shadow },
          ]}
        >
          <Image
            source={slide.image}
            accessibilityLabel={slide.imageLabel}
            resizeMode="cover"
            style={styles.visualImage}
          />
        </View>
        <View style={styles.copy}>
          <AppText variant="display" style={{ textAlign: "center" }}>
            {t(slide.title)}
          </AppText>
          <AppText
            muted
            style={{ textAlign: "center", fontSize: 16, lineHeight: 24 }}
          >
            {t(slide.body)}
          </AppText>
        </View>
      </Animated.View>

      <View style={styles.bottom}>
        <AppButton
          onPress={next}
          icon={index === slides.length - 1 ? "checkmark" : "arrow-forward"}
          glow
        >
          {index === slides.length - 1
            ? t("common.done")
            : t("common.next")}
        </AppButton>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 42,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 26,
  },
  visual: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 1,
    borderRadius: 40,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 7,
    overflow: "hidden",
    backgroundColor: "#EAF4FF",
  },
  visualImage: { width: "100%", height: "100%" },
  copy: {
    width: "100%",
    maxWidth: 520,
    gap: 11,
  },
  bottom: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
});
