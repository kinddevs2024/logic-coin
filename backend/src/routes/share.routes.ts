import { requestLanguage } from "../lib/request-language.js";
import { formatBuiltIn, localizeBuiltIn, type CopyLanguage } from "../lib/localize-built-in.js";
import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { User } from "../models/User.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { requireDatabase } from "../middleware/database.js";
import { ApiError } from "../lib/api-error.js";
import { storedAvatarThumbnail } from "../services/avatar.service.js";
import { injectPreview, SHARE_DESCRIPTION, SHARE_IMAGE, SHARE_ORIGIN, SHARE_TITLE } from "../lib/share-preview.js";

import { profileArtwork, platformArtwork, SHARE_ARTWORK_VERSION } from "../lib/share-artwork.js";

const router = Router();
const webRoot = () => resolve(process.env.WEB_DIST_DIR || "../frontend/dist");
const validCode = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{4,32}$/i.test(value);
// Bounded, short cache: public profile updates become visible without retaining private data.
const images = new Map<string, { expires: number; data: Buffer }>();
export function profileImageRevision(user: unknown, completed: number) {
  return createHash("sha256").update(JSON.stringify([SHARE_ARTWORK_VERSION, user, completed])).digest("hex").slice(0, 24);
}

export function allowedAvatarUrl(url: URL) {
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    (/^lh[0-9]+\.googleusercontent\.com$/.test(url.hostname) || url.hostname === "avatars.githubusercontent.com");
}
router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }));

// The admin entry is a public app shell, not admin data. Give it its own URL
// instead of incorrectly canonicalizing every share to the home page.
router.get("/site/admin", async (request, response) => {
  const html = await readFile(resolve(webRoot(), "index.html"), "utf8");
  response.set("Cache-Control", "no-store, max-age=0").type("html").send(injectPreview(html, {
    title: localizeBuiltIn(SHARE_TITLE, requestLanguage(request)),
    description: localizeBuiltIn(SHARE_DESCRIPTION, requestLanguage(request)),
    url: `${SHARE_ORIGIN}/admin`,
    image: `${SHARE_ORIGIN}/api/v1/share/platform/${requestLanguage(request)}.jpg`,
  }));
});

router.get("/page/:kind/:code", requireDatabase, async (request, response) => {
  const { kind, code } = request.params;
  if ((kind !== "profile" && kind !== "invite") || !validCode(code)) throw new ApiError(404, "not_found", "Not found");
  const normalized = code.toUpperCase();
  const language = requestLanguage(request);
  const version = typeof request.query.preview === "string" && /^\d{1,16}$/.test(request.query.preview) ? `?preview=${request.query.preview}` : "";
  const user = await User.findOne({ referralCode: normalized }).select("name avatarUrl countryCode coins wallet").lean();
  const profile = kind === "profile" && Boolean(user);
  const completed = profile ? await ChallengeAttempt.countDocuments({ userId: user!._id, mode: "challenge", status: "completed" }) : 0;
  const name = user?.name?.slice(0, 80) || "Игрок";
  const preview = {
    title: profile ? `${name} · Logic Coin` : kind === "invite" && user ? formatBuiltIn("{0} приглашает тебя в Logic Coin", language, [name]) : SHARE_TITLE,
    description: profile ? "Открой профиль игрока: результаты, монеты и достижения в челленджах Logic Coin." : SHARE_DESCRIPTION,
    url: `${SHARE_ORIGIN}/${kind}/${normalized}${version}${version ? "&" : "?"}lang=${language}`,
    image: profile ? `${SHARE_ORIGIN}/api/v1/share/profile/${profileImageRevision(user, completed)}/${normalized}.jpg` : SHARE_IMAGE,
    profile,
  };
  const html = await readFile(resolve(webRoot(), "index.html"), "utf8");
  preview.title = localizeBuiltIn(preview.title, language);
  preview.description = localizeBuiltIn(preview.description, language);
  if (profile) preview.image += `?lang=${language}`;
  else preview.image = `${SHARE_ORIGIN}/api/v1/share/platform/${language}.jpg`;
  response.set("Cache-Control", "no-store").type("html").send(injectPreview(html, preview));
});

router.get("/platform/:language.jpg", async (request, response) => {
  const language = request.params.language;
  if (language !== "ru" && language !== "en" && language !== "uz") throw new ApiError(404, "not_found", "Not found");
  const key = `platform:${language}`;
  const cached = images.get(key);
  if (cached && cached.expires > Date.now()) { response.type("jpeg").send(cached.data); return; }
  const logo = await readFile(resolve(webRoot(), "share/logo.png"));
  const svg = platformArtwork(`data:image/png;base64,${logo.toString("base64")}`, language);
  const data = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
  if (images.size >= 100) images.delete(images.keys().next().value!);
  images.set(key, { expires: Date.now() + 300_000, data });
  response.set("Cache-Control", "public, max-age=300").type("jpeg").send(data);
});

router.get(["/profile/:file", "/profile/:revision/:file"], requireDatabase, async (request, response) => {
  const code = String(request.params.file).replace(/\.jpg$/, "").toUpperCase();
  if (!validCode(code)) throw new ApiError(404, "not_found", "Not found");
  const user = await User.findOne({ referralCode: code }).select("name avatarUrl countryCode coins wallet").lean();
  if (!user) throw new ApiError(404, "profile_not_found", "Profile not found");
  const completed = await ChallengeAttempt.countDocuments({ userId: user._id, mode: "challenge", status: "completed" });
  const key = createHash("sha256").update(JSON.stringify([SHARE_ARTWORK_VERSION, code, user, completed, requestLanguage(request)])).digest("hex");
  const cached = images.get(key);
  if (cached && cached.expires > Date.now()) {
    response.set("Cache-Control", "no-store").type("jpeg").send(cached.data);
    return;
  }
  const data = await renderProfileImage(user, completed, requestLanguage(request));
  if (images.size >= 100) images.delete(images.keys().next().value!);
  images.set(key, { expires: Date.now() + 300_000, data });
  response.set("Cache-Control", "no-store").type("jpeg").send(data);
});

export async function renderProfileImage(user: {
  name?: string;
  countryCode?: string | null;
  avatarUrl?: string | null;
  wallet?: { availableUnits?: number };
  coins?: { balance?: number };
}, completed: number, language: CopyLanguage = "ru") {
  const logo = await readFile(resolve(webRoot(), "share/logo.png"));
  const background = Buffer.from(profileArtwork(user, completed, `data:image/png;base64,${logo.toString("base64")}`, language));
  let avatar: Buffer = logo;
  const stored = await storedAvatarThumbnail(user.avatarUrl);
  // Never request arbitrary user-supplied URLs (SSRF). Validated uploads are data URLs.
  if (stored) {
    avatar = await sharp(stored).resize(150, 150, { fit: "cover" }).png().toBuffer();
  } else if (user.avatarUrl && /^data:image\/(png|jpeg|webp);base64,/.test(user.avatarUrl) && user.avatarUrl.length < 10_000_000) {
    try { avatar = await sharp(Buffer.from(user.avatarUrl.split(",")[1]!, "base64"), { limitInputPixels: 20_000_000 }).resize(150, 150, { fit: "cover" }).png().toBuffer(); } catch { /* keep the brand fallback */ }
  } else if (user.avatarUrl) {
    try {
      const url = new URL(user.avatarUrl);
      if (allowedAvatarUrl(url)) {
        const result = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
        if (result.ok && result.body && result.headers.get("content-type")?.startsWith("image/")) {
          const reader = result.body.getReader();
          const chunks: Uint8Array[] = [];
          let bytes = 0;
          try {
            for (;;) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.length;
              if (bytes > 2_000_000) throw new Error("Avatar too large");
              chunks.push(chunk.value);
            }
            avatar = await sharp(Buffer.concat(chunks), { limitInputPixels: 20_000_000 }).resize(150, 150, { fit: "cover" }).png().toBuffer();
          } finally { await reader.cancel(); }
        }
      }
    } catch { /* Approved avatar host unavailable: retain the brand fallback. */ }
  }
  const mask = Buffer.from('<svg width="150" height="150"><circle cx="75" cy="75" r="75" fill="white"/></svg>');
  avatar = await sharp(avatar).resize(150, 150, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const data = await sharp(background).composite([{ input: avatar, left: 61, top: 137 }]).jpeg({ quality: 88 }).toBuffer();
  return data;
}

export default router;
