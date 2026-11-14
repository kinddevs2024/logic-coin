import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash, verify } from "node:crypto";

export function validSelector(value) {
  return typeof value === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(value);
}

export function updateServer({ root, certificate }) {
  return createServer(async (request, response) => {
    try {
      if (request.method !== "GET") { response.writeHead(405); response.end(); return; }
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/updates/health") { response.writeHead(200, { "content-type": "application/json" }); response.end('{"status":"ok"}'); return; }
      if (url.pathname.startsWith("/updates/assets/")) {
        const hash = url.pathname.slice("/updates/assets/".length);
        if (!/^[a-f0-9]{64}$/.test(hash)) { response.writeHead(404); response.end(); return; }
        const bytes = await readFile(resolve(root, "assets", hash));
        if (createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error("Corrupt asset");
        let contentType = "application/octet-stream";
        try {
          const candidate = (await readFile(resolve(root, "assets", `${hash}.mime`), "utf8")).trim();
          if (/^[a-z]+\/[a-zA-Z0-9.+-]+$/.test(candidate)) contentType = candidate;
        } catch (error) { if (error.code !== "ENOENT") throw error; }
        response.writeHead(200, { "content-type": contentType, "cache-control": "public, max-age=31536000, immutable" }); response.end(bytes); return;
      }
      if (url.pathname !== "/updates" && url.pathname !== "/updates/") { response.writeHead(404); response.end(); return; }
      const platform = request.headers["expo-platform"];
      const runtime = request.headers["expo-runtime-version"];
      const channel = request.headers["expo-channel-name"] ?? "production";
      if (!["android", "ios"].includes(platform) || !validSelector(runtime) || !validSelector(channel)) { response.writeHead(400); response.end(); return; }
      if (request.headers["expo-protocol-version"] !== "1") { response.writeHead(406); response.end(); return; }
      const headers = { "expo-protocol-version": "1", "expo-sfv-version": "0", "expo-manifest-filters": `channel="${channel}"`, "expo-server-defined-headers": "", "cache-control": "private, max-age=0" };
      let pointer;
      try { pointer = JSON.parse(await readFile(resolve(root, "channels", channel, platform, `${runtime}.json`), "utf8")); }
      catch (error) { if (error.code === "ENOENT") { response.writeHead(204, headers); response.end(); return; } throw error; }
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(pointer.id)) throw new Error("Invalid release pointer");
      const manifest = await readFile(resolve(root, "releases", pointer.id, "manifest.json"));
      const signature = (await readFile(resolve(root, "releases", pointer.id, "signature.txt"), "utf8")).trim();
      if (!verify("RSA-SHA256", manifest, certificate, Buffer.from(signature, "base64"))) throw new Error("Invalid manifest signature");
      const parsed = JSON.parse(manifest);
      if (parsed.runtimeVersion !== runtime || parsed.metadata.channel !== channel || parsed.metadata.platform !== platform) throw new Error("Incompatible release");
      response.writeHead(200, { ...headers, "content-type": "application/expo+json", "expo-signature": `sig="${signature}", keyid="root", alg="rsa-v1_5-sha256"` });
      response.end(manifest);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 503, { "cache-control": "no-store" }); response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.env.OTA_STORAGE ?? "./ota-storage");
  const certPath = process.env.OTA_CERTIFICATE;
  if (!certPath) throw new Error("OTA_CERTIFICATE is required");
  const certificate = await readFile(certPath, "utf8");
  await stat(root);
  updateServer({ root, certificate }).listen(Number(process.env.PORT ?? 8099), "127.0.0.1");
}
