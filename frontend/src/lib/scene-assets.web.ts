import type { ImageSourcePropType } from "react-native";

// The classic island and seven jars use PNG; reward particles retain their original assets.
export const sceneAssets = {
  island: require("../../assets/scene/island-deep.png") as ImageSourcePropType,
  jars: [require("../../assets/scene/1-Photoroom.png"),
    require("../../assets/scene/2-Photoroom.png"),
    require("../../assets/scene/3-Photoroom.png"),
    require("../../assets/scene/4-Photoroom.png"),
    require("../../assets/scene/5-Photoroom.png"),
    require("../../assets/scene/6-Photoroom.png"),
    require("../../assets/scene/7-Photoroom.png")] as ImageSourcePropType[],
  coins: [require("../../assets/scene/coin-angle.webp"),
    require("../../assets/scene/coin-gold-a.webp"),
    require("../../assets/scene/coin-gold-b.png"),
    require("../../assets/scene/coin-silver.webp")] as ImageSourcePropType[],
  bills: [require("../../assets/scene/bill-1.png"),
    require("../../assets/scene/bill-5.png"),
    require("../../assets/scene/bill-10.png"),
    require("../../assets/scene/bill-100.png")] as ImageSourcePropType[],
};
