const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
const nativeAdminStub = path.join(__dirname, "src/components/admin/native-unavailable.tsx");
const adminRoutes = path.join(__dirname, "src/app/admin") + path.sep;

// Expo Router's context can otherwise pull website-only admin route modules
// into Android, even when the route also has a native replacement.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== "web" && moduleName.startsWith(adminRoutes) && /\.[cm]?[jt]sx?$/.test(moduleName)) {
    return { type: "sourceFile", filePath: nativeAdminStub };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
