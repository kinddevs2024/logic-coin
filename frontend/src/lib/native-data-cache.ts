import AsyncStorage from "@react-native-async-storage/async-storage";
import { IncrementalCache } from "./incremental-cache";

export const nativeDataCache = new IncrementalCache(AsyncStorage);
export const dataCacheScope = (api: string, userId: string, language: string) => JSON.stringify([api, userId, language]);
