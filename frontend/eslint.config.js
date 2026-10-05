const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", "dist-*/**", ".expo/**", "android/**", "ios/**"],
    rules: {
      "react-hooks/exhaustive-deps": "warn"
    }
  }
]);
