import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

export const isExpoGo = Platform.OS !== "web" && (
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.appOwnership === "expo"
);
