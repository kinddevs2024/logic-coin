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
test("home gift uses matching generated closed and open transparent assets", async () => {
  const source = await readFile(new URL("src/components/floating-home-gift.tsx", root), "utf8");
  assert.match(source, /source=\{remaining > 0 \? GIFT_CLOSED : GIFT_OPEN\}/);
  assert.doesNotMatch(source, /MaterialCommunityIcons|BlurView|styles\.glass|styles\.sparkle/);
  assert.match(source, /disabled=\{remaining > 0\}/);
  assert.match(source, /remaining > 0 \? <View pointerEvents="none" style=\{\[styles\.timer/);
  for (const name of ["closed", "open"]) {
    const bytes = await readFile(new URL(`assets/rewards/home-gift-${name}-3d.png`, root));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    // PNG IHDR colour type 6 = RGBA, not a flattened screenshot.
    assert.equal(bytes[25], 6);
  }
});
test("opening a gift cannot leave a stale press pause after an ad or app return", async () => {
  const source = await readFile(new URL("src/components/floating-home-gift.tsx", root), "utf8");
  assert.match(source, /onPress=\{\(\) => \{ setHoldingGift\(false\); setOpen\(true\); \}\}/);
  assert.match(source, /setHoldingGift\(false\);\s*\}, \[open, foreground\]\)/);
  assert.match(source, /finally \{ setHoldingGift\(false\); setBusy\(false\); \}/);
  assert.match(source, /ru: "Открыть", en: "Open", uz: "Ochish"/);
  assert.match(source, /<AppText style=\{styles\.timerText\}>\{OPEN_GIFT_LABEL\[language\]\}/);
});
test("native app icons retain the original logo", async () => {
  const app = await json("app.json");
  assert.equal(app.expo.icon, "./assets/brand/icon.png");
  assert.equal(app.expo.android.adaptiveIcon.foregroundImage, "./assets/brand/adaptive-icon.png");
  assert.equal(app.expo.web.favicon, "./assets/brand/favicon.png");
  assert.equal(app.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === "expo-splash-screen")[1].image, "./assets/brand/splash.png");
  for (const name of ["icon.png", "adaptive-icon.png"]) {
    const bytes = await readFile(new URL(`assets/brand/${name}`, root));
    assert.equal(bytes.readUInt32BE(16), 1024);
    assert.equal(bytes.readUInt32BE(20), 1024);
  }
});
test("active challenge exit uses native-stack prevention and a route-owned Android dialog", async () => {
  const game = await readFile(new URL("src/app/play/[gameKey].tsx", root), "utf8");
  const dialog = await readFile(new URL("src/components/game-exit-modal.tsx", root), "utf8");
  assert.match(game, /usePreventRemove\(mode === "challenge" && exitGuardEnabled/);
  assert.doesNotMatch(game, /navigation\.addListener\("beforeRemove"/);
  assert.match(game, /pendingExitAction\.current = data\.action/);
  const confirm = game.slice(game.indexOf("const confirmExit"), game.indexOf("const stayInGame"));
  assert.ok(confirm.indexOf("exitSession.discard()") < confirm.indexOf("navigation.dispatch(action)"));
  assert.match(confirm, /setExitGuardEnabled\(false\)/);
  assert.doesNotMatch(confirm, /router.replace/);
  assert.match(dialog, /if \(!visible\) return null/);
  assert.match(dialog, /Platform\.OS === "android"\s*\? <View accessibilityViewIsModal style=\{styles\.androidLayer\}/);
  assert.match(dialog, /subscription.remove\(\)/);
});
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
