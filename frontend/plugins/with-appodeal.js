const {
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const APPODEAL_REPOSITORY =
  'maven { url "https://artifactory.appodeal.com/appodeal" }';
const APPODEAL_DEPENDENCIES = [
  'implementation("com.appodeal.ads.sdk:core:4.3.0")',
  'implementation("com.appodeal.ads.sdk.adapters:bidmachine:3.7.1.0")',
  'implementation("com.appodeal.ads.sdk.adapters:bidon:0.14.0.0")',
];
const ANDROID_RELEASE_PROPERTIES = [
  ["reactNativeArchitectures", "armeabi-v7a,arm64-v8a"],
  ["android.enableMinifyInReleaseBuilds", "true"],
  ["android.enableShrinkResourcesInReleaseBuilds", "true"],
  ["expo.gif.enabled", "false"],
  ["expo.useLegacyPackaging", "true"],
];

function addOnce(source, anchor, value) {
  if (source.includes(value)) return source;
  if (!source.includes(anchor)) {
    throw new Error(`Appodeal config plugin could not find Gradle anchor: ${anchor}`);
  }
  return source.replace(anchor, `${anchor}\n    ${value}`);
}

module.exports = function withAppodeal(config) {
  config = withGradleProperties(config, (gradleConfig) => {
    for (const [key, value] of ANDROID_RELEASE_PROPERTIES) {
      const exists = gradleConfig.modResults.some(
        (property) => property.type === "property" && property.key === key,
      );
      if (!exists) {
        gradleConfig.modResults.push({ type: "property", key, value });
      }
    }
    return gradleConfig;
  });

  config = withProjectBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = addOnce(
      gradleConfig.modResults.contents,
      "maven { url 'https://www.jitpack.io' }",
      APPODEAL_REPOSITORY,
    );
    return gradleConfig;
  });

  config = withAppBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;
    for (const dependency of APPODEAL_DEPENDENCIES) {
      contents = addOnce(
        contents,
        'implementation("com.facebook.react:react-android")',
        dependency,
      );
    }
    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });

  return config;
};
