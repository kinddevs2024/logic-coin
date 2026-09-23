import { Router } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { rateLimit } from "express-rate-limit";
import { User } from "../models/User.js";
import { ChallengeAttempt } from "../models/ChallengeAttempt.js";
import { requireDatabase } from "../middleware/database.js";
import { ApiError } from "../lib/api-error.js";
import { escapeMarkup, injectPreview, SHARE_DESCRIPTION, SHARE_IMAGE, SHARE_ORIGIN, SHARE_TITLE } from "../lib/share-preview.js";

const router = Router();
const webRoot = () => resolve(process.env.WEB_DIST_DIR || "../frontend/dist");
const validCode = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9-]{4,32}$/i.test(value);
// Bounded, short cache: public profile updates become visible without retaining private data.
const images = new Map<string, { expires: number; data: Buffer }>();
router.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false }));

router.get("/page/:kind/:code", requireDatabase, async (request, response) => {
  const { kind, code } = request.params;
  if ((kind !== "profile" && kind !== "invite") || !validCode(code)) throw new ApiError(404, "not_found", "Not found");
  const normalized = code.toUpperCase();
  const user = await User.findOne({ referralCode: normalized }).select("name").lean();
  const profile = kind === "profile" && Boolean(user);
  const name = user?.name?.slice(0, 80) || "Игрок";
  const preview = {
    title: profile ? `${name} · Logic Coin` : kind === "invite" && user ? `${name} приглашает тебя в Logic Coin` : SHARE_TITLE,
    description: profile ? "Открой профиль игрока: результаты, монеты и достижения в челленджах Logic Coin." : SHARE_DESCRIPTION,
    url: `${SHARE_ORIGIN}/${kind}/${normalized}`,
    image: profile ? `${SHARE_ORIGIN}/api/v1/share/profile/${normalized}.jpg` : SHARE_IMAGE,
    profile,
  };
  const html = await readFile(resolve(webRoot(), "index.html"), "utf8");
  response.set("Cache-Control", "public, max-age=60").type("html").send(injectPreview(html, preview));
});

router.get("/profile/:file", requireDatabase, async (request, response) => {
  const code = String(request.params.file).replace(/\.jpg$/, "").toUpperCase();
  if (!validCode(code)) throw new ApiError(404, "not_found", "Not found");
  const cached = images.get(code);
  if (cached && cached.expires > Date.now()) {
    response.set("Cache-Control", "public, max-age=300").type("jpeg").send(cached.data);
    return;
  }
  const user = await User.findOne({ referralCode: code }).select("name avatarUrl countryCode coins wallet").lean();
  if (!user) throw new ApiError(404, "profile_not_found", "Profile not found");
  const completed = await ChallengeAttempt.countDocuments({ userId: user._id, mode: "challenge", status: "completed" });
  const data = await renderProfileImage(user, completed);
  if (images.size >= 100) images.delete(images.keys().next().value!);
  images.set(code, { expires: Date.now() + 300_000, data });
  response.set("Cache-Control", "public, max-age=300").type("jpeg").send(data);
});

export async function renderProfileImage(user: {
  name?: string;
  countryCode?: string | null;
  avatarUrl?: string | null;
  wallet?: { availableUnits?: number };
  coins?: { balance?: number };
}, completed: number) {
  const name = escapeMarkup(Array.from(user.name || "Игрок").slice(0, 30).join(""));
  const money = `$${(Math.max(0, user.wallet?.availableUnits || 0) / 100).toFixed(2)}`;
  const coins = new Intl.NumberFormat("en-US").format(Math.max(0, user.coins?.balance || 0));
  const background = await readFile(resolve(webRoot(), "share/profile-background.jpg"));
  // This is typeset public profile data, not a generated portrait or illustration.
  const text = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><g font-family="DejaVu Sans, Arial, sans-serif" fill="#fff"><text x="280" y="175" font-size="48" font-weight="bold">${name}</text><text x="280" y="218" font-size="24" fill="#a8c9ff">Logic Coin · ${escapeMarkup(user.countryCode || "Игрок")}</text><text x="85" y="355" font-size="24" fill="#a8c9ff">Баланс</text><text x="85" y="415" font-size="46" font-weight="bold">${money}</text><text x="465" y="355" font-size="24" fill="#a8c9ff">Монеты</text><text x="465" y="415" font-size="46" font-weight="bold">${coins}</text><text x="880" y="355" font-size="24" fill="#a8c9ff">Игр в челленджах</text><text x="880" y="415" font-size="46" font-weight="bold">${completed}</text><text x="85" y="555" font-size="24" fill="#a8c9ff">Смотри профиль на logic-coin.online</text></g></svg>`);
  let avatar = await readFile(resolve(webRoot(), "share/logo.png"));
  // Never request arbitrary user-supplied URLs (SSRF). Validated uploads are data URLs.
  if (user.avatarUrl && /^data:image\/(png|jpeg|webp);base64,/.test(user.avatarUrl) && user.avatarUrl.length < 10_000_000) {
    try { avatar = await sharp(Buffer.from(user.avatarUrl.split(",")[1]!, "base64"), { limitInputPixels: 20_000_000 }).resize(150, 150, { fit: "cover" }).png().toBuffer(); } catch { /* keep the brand fallback */ }
  } else if (user.avatarUrl) {
    try {
      const url = new URL(user.avatarUrl);
      if (url.protocol === "https:" && !url.port && !url.username && !url.password && /^lh[0-9]+\.googleusercontent\.com$/.test(url.hostname)) {
        const result = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(2000) });
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
    } catch { /* Google avatar unavailable: retain the brand fallback. */ }
  }
  avatar = await sharp(avatar).resize(150, 150, { fit: "cover" }).png().toBuffer();
  const data = await sharp(background).resize(1200, 630).composite([{ input: avatar, left: 85, top: 95 }, { input: text }]).jpeg({ quality: 88 }).toBuffer();
  return data;
}

export default router;
