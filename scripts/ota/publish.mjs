// Run only on the trusted publishing host. No HTTP upload/admin bypass.
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve, sep, basename } from "node:path";
import { createHash, randomUUID, sign } from "node:crypto";

const [exportDirectory, configFile, runtime, channel = "preview", platform = "android"] = process.argv.slice(2);
if (!exportDirectory || !configFile || !/^[a-zA-Z0-9._-]{1,128}$/.test(runtime ?? "") || !/^[a-zA-Z0-9._-]{1,128}$/.test(channel) || !["android", "ios"].includes(platform)) throw new Error("Usage: publish EXPORT CONFIG RUNTIME [preview|production] [android|ios]");
if (!process.env.OTA_PRIVATE_KEY || !process.env.OTA_STORAGE || !process.env.OTA_PUBLIC_URL) throw new Error("Publishing host configuration is incomplete");
const publicUrl = new URL(process.env.OTA_PUBLIC_URL);
if (publicUrl.protocol !== "https:") throw new Error("Updates require HTTPS");
const directory = resolve(exportDirectory);
const root = resolve(process.env.OTA_STORAGE);
const metadata = JSON.parse(await readFile(resolve(directory, "metadata.json"), "utf8"));
const output = metadata.fileMetadata?.[platform];
if (!output?.bundle || !Array.isArray(output.assets)) throw new Error("Missing Expo export metadata");
const config = JSON.parse(await readFile(configFile, "utf8"));
const expoConfig = config.expo ?? config;
const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", ttf: "font/ttf", otf: "font/otf", mp3: "audio/mpeg", wav: "audio/wav" };
await mkdir(resolve(root, "assets"), { recursive: true });
async function asset(file, extension, launch = false) {
  const path = resolve(directory, file);
  if (!path.startsWith(directory + sep)) throw new Error("Asset outside export directory");
  const bytes = await readFile(path);
  const digest = createHash("sha256").update(bytes);
  const hash = digest.digest("hex");
  try { await writeFile(resolve(root, "assets", hash), bytes, { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; }
  const contentType = launch ? "application/javascript" : mime[extension] ?? "application/octet-stream";
  await writeFile(resolve(root, "assets", `${hash}.mime`), contentType);
  return { hash: createHash("sha256").update(bytes).digest("base64url"), key: basename(file).replace(/\.[^.]+$/, ""), contentType: launch ? "application/javascript" : mime[extension] ?? "application/octet-stream", ...(launch ? {} : { fileExtension: `.${extension}` }), url: `${publicUrl.href.replace(/\/$/, "")}/assets/${hash}` };
}
const manifest = { id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion: runtime, metadata: { channel, platform }, launchAsset: await asset(output.bundle, "bundle", true), assets: await Promise.all(output.assets.map(entry => asset(entry.path, entry.ext))), extra: { expoClient: expoConfig } };
const body = JSON.stringify(manifest);
const privateKey = await readFile(process.env.OTA_PRIVATE_KEY, "utf8");
const signature = sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64");
const release = resolve(root, "releases", manifest.id);
await mkdir(release, { recursive: true });
await writeFile(resolve(release, "manifest.json"), body, { flag: "wx" });
await writeFile(resolve(release, "signature.txt"), signature, { flag: "wx" });
const channelDirectory = resolve(root, "channels", channel, platform);
await mkdir(channelDirectory, { recursive: true });
const temporary = resolve(channelDirectory, `${runtime}.${randomUUID()}.tmp`);
await writeFile(temporary, JSON.stringify({ id: manifest.id }));
await rename(temporary, resolve(channelDirectory, `${runtime}.json`));
console.log(`Published signed ${platform} update to ${channel}. Keep this release for rollback.`);
