import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

test("Android game results do not leave a stacked native modal after navigation", async () => {
  const source = await readFile(new URL("src/app/play/[gameKey].tsx", root), "utf8");
  const resultComponent = source.slice(source.indexOf("function GameResultModal("), source.indexOf("function ResultStat("));
  assert.match(resultComponent, /if \(!value\) return null/);
  assert.match(resultComponent, /Platform\.OS === "android"\s*\? <View accessibilityViewIsModal style=\{styles\.androidResultLayer\}/);
  assert.doesNotMatch(resultComponent, /<Modal visible=\{Boolean\(value\)\}/);
  assert.match(resultComponent, /value\.saving \? <ActivityIndicator accessibilityLabel="Сохраняем награду"/);
  assert.match(resultComponent, /value=\{value\.saving \? "…"/);
});

async function json(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}
test("next challenge keeps a result visible until a fresh game host mounts", async () => {
  const game = await readFile(new URL("src/app/play/[gameKey].tsx", root), "utf8");
  assert.match(game, /<PlayableGameRoute key=\{/);
  const transition = game.slice(game.indexOf("const continueChallenge"), game.indexOf("const applyGift"));
  assert.doesNotMatch(transition, /setResult\(null\)/);
  assert.match(transition, /resultReady: false/);
});
test("Android fortune wheel closes in the game tree before the next route", async () => {
  const wheel = await readFile(new URL("src/components/fortune-wheel-modal.tsx", root), "utf8");
  const game = await readFile(new URL("src/app/play/[gameKey].tsx", root), "utf8");
  assert.match(wheel, /if \(!visible\) return null/);
  assert.match(wheel, /Platform\.OS === "android"\s*\? <View accessibilityViewIsModal style=\{styles\.androidLayer\}/);
  assert.match(wheel, /BackHandler\.addEventListener\("hardwareBackPress"/);
  const transition = game.slice(game.indexOf("const continueChallenge"), game.indexOf("const applyGift"));
  assert.match(transition, /if \(adBusy \|\| fortuneBusy \|\| fortuneSpinning\) return/);
  assert.ok(transition.indexOf("exitSession.discard()") < transition.indexOf("router.replace"));
  assert.ok(transition.indexOf("setFortuneVisible(false)") < transition.indexOf("router.replace"));
  assert.ok(transition.indexOf("setGiftOpen(false)") < transition.indexOf("router.replace"));
});

test("Expo and web deployment config target Logic Coin", async () => {
  const [app, eas, vercel, pkg, appodealPlugin] = await Promise.all([
    json("app.json"),
    json("eas.json"),
    json("vercel.json"),
    json("package.json"),
    readFile(new URL("plugins/with-appodeal.js", root), "utf8"),
  ]);
  assert.equal(app.expo.name, "Logic Coin");
  assert.equal(app.expo.android.package, "com.kinddevs.logiccoin");
  assert.equal(app.expo.web.output, "single");
  assert.equal(vercel.outputDirectory, "dist");
  assert.equal(pkg.scripts["build:web"], "expo export --platform web");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.match(eas.build.preview.android.gradleCommand, /arm64-v8a/);
  assert.match(eas.build.production.android.gradleCommand, /armeabi-v7a,arm64-v8a/);
  assert.match(appodealPlugin, /android\.enableMinifyInReleaseBuilds/);
  assert.match(appodealPlugin, /android\.enableShrinkResourcesInReleaseBuilds/);
  assert.match(appodealPlugin, /expo\.gif\.enabled/);
});

test("public config contains no secrets and uses v1 API", async () => {
  const env = await readFile(new URL(".env.example", root), "utf8");
  assert.match(env, /EXPO_PUBLIC_API_URL=.*\/api\/v1/);
  assert.doesNotMatch(env, /SMTP_PASS|CLIENT_SECRET|MONGODB|TELEGRAM_BOT/);
});

test("brand assets and core routes exist", async () => {
  const files = [
    "assets/brand/icon.png",
    "assets/brand/logo-source.png",
    "assets/brand/logo-mark.png",
    "assets/brand/adaptive-icon.png",
    "assets/brand/splash.png",
    "assets/brand/favicon.png",
    "assets/store/google-play-ru.png",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/maskable-icon-512.png",
    "public/apple-touch-icon.png",
    "src/app/(tabs)/index.tsx",
    "src/app/(tabs)/tasks.tsx",
    "src/app/(tabs)/bonuses.tsx",
    "src/app/(tabs)/profile.tsx",
    "src/app/settings.tsx",
    "src/app/(auth)/login.tsx",
    "src/app/(auth)/verify.tsx",
    "src/app/(auth)/set-password.tsx",
    "src/app/admin/_layout.tsx",
    "src/app/withdraw.tsx",
    "src/app/withdrawal-agreement.tsx",
    "src/components/payment-card.tsx",
    "src/components/contest-reward-modal.tsx",
    "src/lib/payment-card.ts",
    "src/games/pause-clock.ts",
    "src/app/invite.tsx",
    "src/app/games/longcat.tsx",
    "src/app/games/gobble.tsx",
    "src/app/games/loops.tsx",
    "src/app/games/brain-tricks.tsx",
    "src/app/dev/brain-tricks-editor.tsx",
    "src/games/longcat/engine.ts",
    "src/games/gobble/engine.ts",
    "src/games/loops/engine.ts",
    "src/games/loops/solver.ts",
    "src/games/brain-tricks/engine.ts",
    "src/games/brain-tricks/levels.ts",
    "src/games/progress-store.ts",
  ];
  for (const file of files) {
    assert.ok((await stat(new URL(file, root))).size > 100, `${file} is empty`);
  }
  const png = await readFile(new URL("assets/brand/icon.png", root));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
