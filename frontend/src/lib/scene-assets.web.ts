import type { ImageSourcePropType } from "react-native";

// Web island compression preserves the original native scene assets.
export const sceneAssets = {
  island: require("../../assets/scene/island-deep-web.webp") as ImageSourcePropType,
  jars: [require("../../assets/scene/1-Photoroom.lossless.webp"),
    require("../../assets/scene/2-Photoroom.lossless.webp"),
    require("../../assets/scene/3-Photoroom.lossless.webp"),
    require("../../assets/scene/4-Photoroom.lossless.webp"),
    require("../../assets/scene/5-Photoroom.lossless.webp"),
    require("../../assets/scene/6-Photoroom.lossless.webp"),
    require("../../assets/scene/7-Photoroom.lossless.webp")] as ImageSourcePropType[],
  coins: [require("../../assets/scene/coin-angle.webp"),
    require("../../assets/scene/coin-gold-a.webp"),
    require("../../assets/scene/coin-gold-b.webp"),
    require("../../assets/scene/coin-silver.webp")] as ImageSourcePropType[],
  bills: [require("../../assets/scene/bill-1.webp"),
    require("../../assets/scene/bill-5.webp"),
    require("../../assets/scene/bill-10.webp"),
    require("../../assets/scene/bill-100.webp")] as ImageSourcePropType[],
};
