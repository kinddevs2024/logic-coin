import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const [promo, background] = process.argv.slice(2);
if (!promo || !background) throw new Error("Pass generated promo and background image paths");
const target = resolve("frontend/public/share");
await mkdir(target, { recursive: true });
await sharp(promo).resize(1200, 630, { fit: "contain", background: "#07152e" }).jpeg({ quality: 90 }).toFile(resolve(target, "logic-coin-v1.jpg"));
await sharp(background).resize(1200, 630).jpeg({ quality: 90 }).toFile(resolve(target, "profile-background.jpg"));
await copyFile("frontend/assets/brand/logo-mark.png", resolve(target, "logo.png"));
console.log("Prepared social images at 1200 x 630");
