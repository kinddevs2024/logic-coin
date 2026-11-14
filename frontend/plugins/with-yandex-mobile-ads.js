const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
} = require("expo/config-plugins");

const YANDEX_DEPENDENCY = 'implementation("com.yandex.android:mobileads:8.4.0")';
const AUTO_INIT_META = "com.yandex.mobile.ads.AUTOMATIC_SDK_INITIALIZATION";
const PACKAGE_NAME = "com.kinddevs.logiccoin";
const NATIVE_SOURCE_FILES = ["YandexAdsModule.java", "YandexAdsPackage.java"];

function addOnce(source, anchor, value) {
  if (source.includes(value)) return source;
  if (!source.includes(anchor)) {
    throw new Error(`Yandex Mobile Ads config plugin could not find Gradle anchor: ${anchor}`);
  }
  return source.replace(anchor, `${anchor}\n    ${value}`);
}

module.exports = function withYandexMobileAds(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = addOnce(
      gradleConfig.modResults.contents,
      'implementation("com.facebook.react:react-android")',
      YANDEX_DEPENDENCY,
    );
    return gradleConfig;
  });

  config = withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    if (!application) throw new Error("Yandex Mobile Ads config plugin could not find Android application");
    application["meta-data"] ??= [];
    const existing = application["meta-data"].find(
      (item) => item.$?.["android:name"] === AUTO_INIT_META,
    );
    if (existing) {
      existing.$["android:value"] = "false";
    } else {
      application["meta-data"].push({
        $: { "android:name": AUTO_INIT_META, "android:value": "false" },
      });
    }
    return manifestConfig;
  });

  config = withDangerousMod(config, ["android", async (dangerousConfig) => {
    const androidRoot = dangerousConfig.modRequest.platformProjectRoot;
    const packagePath = PACKAGE_NAME.split(".").join(path.sep);
    const sourceRoot = path.join(__dirname, "yandex-native");
    const destinationRoot = path.join(
      androidRoot,
      "app",
      "src",
      "main",
      "java",
      packagePath,
    );

    fs.mkdirSync(destinationRoot, { recursive: true });
    for (const fileName of NATIVE_SOURCE_FILES) {
      fs.copyFileSync(path.join(sourceRoot, fileName), path.join(destinationRoot, fileName));
    }

    const mainApplicationPath = path.join(destinationRoot, "MainApplication.kt");
    if (fs.existsSync(mainApplicationPath)) {
      let contents = fs.readFileSync(mainApplicationPath, "utf8");
      if (!contents.includes("add(YandexAdsPackage())")) {
        const anchor = "PackageList(this).packages.apply {";
        if (!contents.includes(anchor)) {
          throw new Error("Yandex Mobile Ads config plugin could not find MainApplication package list");
        }
        contents = contents.replace(anchor, `${anchor}\n          add(YandexAdsPackage())`);
        fs.writeFileSync(mainApplicationPath, contents);
      }
    }

    return dangerousConfig;
  }]);

  return config;
};