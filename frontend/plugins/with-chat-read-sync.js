const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod, withAppBuildGradle } = require("expo/config-plugins");
const base = "com.kinddevs.logiccoin.chatnotify";
module.exports = function withChatReadSync(config) {
  config = withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest, app = manifest.application[0];
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const replace = (kind, original, name, actions) => {
      app[kind] = (app[kind] || []).filter(x => ![original, name].includes(x.$["android:name"]));
      // Keep the original receiver addressable by tap intents that were created
      // before the APK upgrade (notably Android 7–11). All new dispatches resolve
      // only to the guarded receiver, because the compatibility entry has no filters.
      app[kind].push({ $: kind === "receiver"
        ? { "android:name": original, "tools:node": "replace", "android:exported": "false", "android:enabled": "true" }
        : { "android:name": original, "tools:node": "remove" } });
      app[kind].push({ $: { "android:name": name, "android:exported": "false", "android:enabled": "true" }, "intent-filter": [{ $: { "android:priority": "10" }, action: actions.map(action => ({ $: { "android:name": action } })) }] });
    };
    replace("service", "expo.modules.notifications.service.ExpoFirebaseMessagingService", `${base}.ReadFirebaseMessagingService`, ["com.google.firebase.MESSAGING_EVENT"]);
    replace("receiver", "expo.modules.notifications.service.NotificationsService", `${base}.ReadNotificationsReceiver`, ["expo.modules.notifications.NOTIFICATION_EVENT", "android.intent.action.BOOT_COMPLETED", "android.intent.action.REBOOT", "android.intent.action.QUICKBOOT_POWERON", "com.htc.intent.action.QUICKBOOT_POWERON", "android.intent.action.MY_PACKAGE_REPLACED"]);
    return cfg;
  });
  config = withAppBuildGradle(config, cfg => {
    const block = '\n// chat-read-sync-tests\nandroid { testOptions { unitTests { includeAndroidResources = true } } }\ndependencies { implementation(project(":expo-modules-core")); implementation("io.github.lukmccall.pika:pika-api:0.3.2"); implementation("com.google.firebase:firebase-messaging:25.0.1"); testImplementation("junit:junit:4.13.2"); testImplementation("org.robolectric:robolectric:4.16.1") }\n';
    const existing = /\n?\/\/ chat-read-sync-tests\r?\nandroid[^\r\n]*\r?\ndependencies[^\r\n]*\r?\n?/;
    cfg.modResults.contents = existing.test(cfg.modResults.contents) ? cfg.modResults.contents.replace(existing, block) : cfg.modResults.contents + block;
    return cfg;
  });
  return withDangerousMod(config, ["android", async cfg => {
    const java = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/java/com/kinddevs/logiccoin");
    const destination = path.join(java, "chatnotify"); fs.mkdirSync(destination, { recursive: true });
    for (const name of fs.readdirSync(path.join(__dirname, "chat-read-sync")).filter(x => x.endsWith(".kt"))) fs.copyFileSync(path.join(__dirname, "chat-read-sync", name), path.join(destination, name));
    const main = path.join(java, "MainApplication.kt"), anchor = "PackageList(this).packages.apply {", added = "add(com.kinddevs.logiccoin.chatnotify.ChatNotificationSyncPackage())";
    let source = fs.readFileSync(main, "utf8");
    if (!source.includes(added)) { if (!source.includes(anchor)) throw new Error("Chat read sync package registration anchor missing"); source = source.replace(anchor, `${anchor}\n          ${added}`); fs.writeFileSync(main, source); }
    const tests = path.join(cfg.modRequest.platformProjectRoot, "app/src/test/java/com/kinddevs/logiccoin/chatnotify"); fs.mkdirSync(tests, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "chat-read-tests/ChatReadStateTest.kt"), path.join(tests, "ChatReadStateTest.kt"));
    return cfg;
  }]);
};
