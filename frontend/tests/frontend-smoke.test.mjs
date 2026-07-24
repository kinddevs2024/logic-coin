import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function json(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("Expo and web deployment config target Logic Coin", async () => {
  const [app, vercel, pkg] = await Promise.all([
    json("app.json"),
    json("vercel.json"),
    json("package.json"),
  ]);
  assert.equal(app.expo.name, "Logic Coin");
  assert.equal(app.expo.android.package, "com.kinddevs.logiccoin");
  assert.equal(app.expo.web.output, "static");
  assert.equal(vercel.outputDirectory, "dist");
  assert.equal(pkg.scripts["build:web"], "expo export --platform web");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
});

test("public config contains no secrets and uses v1 API", async () => {
  const env = await readFile(new URL(".env.example", root), "utf8");
  assert.match(env, /EXPO_PUBLIC_API_URL=.*\/api\/v1/);
  assert.doesNotMatch(env, /SMTP_PASS|CLIENT_SECRET|MONGODB|TELEGRAM_BOT/);
});

test("brand assets and core routes exist", async () => {
  const files = [
    "assets/brand/icon.png",
    "assets/brand/app-icon.svg",
    "src/app/(tabs)/index.tsx",
    "src/app/(tabs)/tasks.tsx",
    "src/app/(tabs)/bonuses.tsx",
    "src/app/(tabs)/profile.tsx",
    "src/app/settings.tsx",
    "src/app/withdraw.tsx",
    "src/app/invite.tsx",
  ];
  for (const file of files) {
    assert.ok((await stat(new URL(file, root))).size > 100, `${file} is empty`);
  }
  const png = await readFile(new URL("assets/brand/icon.png", root));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
