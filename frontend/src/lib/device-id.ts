import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const DEVICE_ID_STORAGE_KEY = "logic-coin-device-id-v2";
let cachedDeviceId: string | null = null;

async function platformDeviceId() {
  try {
    const raw = Platform.OS === "android"
      ? Application.getAndroidId()
      : Platform.OS === "ios"
        ? await Application.getIosIdForVendorAsync()
        : null;
    if (!raw) return null;
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `logic-coin:${Platform.OS}:${raw}`,
    );
    return `logic-${Platform.OS}-${digest}`;
  } catch {
    return null;
  }
}

export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  const platformId = await platformDeviceId();
  if (platformId) {
    cachedDeviceId = platformId;
    return platformId;
  }
  const saved = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (saved) {
    cachedDeviceId = saved;
    return saved;
  }
  const created = `logic-${Platform.OS}-${Crypto.randomUUID()}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  cachedDeviceId = created;
  return created;
}
