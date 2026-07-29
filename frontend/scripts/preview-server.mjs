import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 8081);
const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function getFilePath(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, `http://${host}`).pathname);
  const relativePath = pathname.replace(/^\/+/, "");
  const candidates = relativePath
    ? [relativePath, `${relativePath}.html`, `${relativePath}/index.html`]
    : ["index.html"];

  for (const candidate of candidates) {
    const filePath = resolve(distRoot, candidate);
    if (
      filePath.startsWith(`${resolve(distRoot)}${sep}`) &&
      existsSync(filePath) &&
      statSync(filePath).isFile()
    ) {
      return filePath;
    }
  }

  return resolve(distRoot, "+not-found.html");
}

const server = createServer((request, response) => {
  try {
    const filePath = getFilePath(request.url ?? "/");
    response.writeHead(filePath.endsWith("+not-found.html") ? 404 : 200, {
      "Cache-Control": "no-store",
      "Content-Type":
        mimeTypes[extname(filePath).toLowerCase()] ??
        "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Preview server error");
  }
});

server.listen(port, host, () => {
  console.log(`Logic Coin preview: http://${host}:${port}`);
});
