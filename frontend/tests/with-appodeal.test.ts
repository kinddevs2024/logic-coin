import { describe, expect, it } from "vitest";

const withAppodeal = require("../plugins/with-appodeal");

const {
  addGoogleAdsResolution,
  addOnce,
  APPODEAL_REPOSITORY,
  GOOGLE_MOBILE_ADS_FORCE_LINE,
} = withAppodeal.__test__;

describe("with-appodeal plugin", () => {
  it("pins Google Mobile Ads in the root Android project", () => {
    const baseBuildGradle = `allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
  }
}

apply plugin: "expo-root-project"
`;

    const withRepository = addOnce(
      baseBuildGradle,
      "maven { url 'https://www.jitpack.io' }",
      APPODEAL_REPOSITORY,
    );

    expect(addGoogleAdsResolution(withRepository)).toContain(`  configurations.configureEach {
    ${GOOGLE_MOBILE_ADS_FORCE_LINE}
  }`);
  });

  it("adds the Google Mobile Ads pin only once", () => {
    const buildGradle = `allprojects {
  repositories {
    google()
    mavenCentral()
    ${APPODEAL_REPOSITORY}
  }
}
`;

    const once = addGoogleAdsResolution(buildGradle);
    const twice = addGoogleAdsResolution(once);

    expect(twice).toBe(once);
    expect(twice.split("play-services-ads:24.7.0")).toHaveLength(2);
  });
});
