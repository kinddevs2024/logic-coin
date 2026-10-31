export function verifyClientConfig(env) {
  for (const key of ["EXPO_PUBLIC_GOOGLE_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB"]) {
    if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(env[key] ?? "")) {
      throw new Error(`${key} is required for release builds; refusing to publish disabled Google sign-in`);
    }
  }
}
verifyClientConfig(process.env);
