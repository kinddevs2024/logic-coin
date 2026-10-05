import type { ConfigContext, ExpoConfig } from "expo/config";

// Populate these only with this application's Firebase/EAS configuration.
// Never embed a Firebase service-account private key into an APK.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "Logic Coin",
  slug: config.slug ?? "logic-coin",
  runtimeVersion: { policy: "fingerprint" },
  updates: {
    ...config.updates,
    enabled: true,
    url: "https://logic-coin.online/updates",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
    codeSigningCertificate: "./certs/update-certificate.pem",
    codeSigningMetadata: { keyid: "root", alg: "rsa-v1_5-sha256" },
    requestHeaders: { "expo-channel-name": process.env.LOGIC_UPDATE_CHANNEL ?? "production" }
  },
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {})
  },
  extra: {
    ...config.extra,
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { ...config.extra?.eas, projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {})
  }
});
