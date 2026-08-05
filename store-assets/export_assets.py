from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "store-assets" / "source-captures"
OUT = ROOT / "store-assets" / "google-play"

SCREENSHOTS = [
    ("01-home.png", "01-home.png"),
    ("02-tasks.png", "02-tasks.png"),
    ("03-bonuses.png", "03-bonuses.png"),
    ("04-games.png", "04-games.png"),
    ("05-profile.png", "05-profile.png"),
]


def resize_exact(source: Path, destination: Path, size: tuple[int, int]) -> None:
    with Image.open(source) as image:
        image = image.convert("RGBA")
        if image.size[0] * size[1] != image.size[1] * size[0]:
            raise ValueError(f"Aspect ratio mismatch for {source}: {image.size} -> {size}")
        image = image.resize(size, Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "PNG", optimize=True)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = image.copy()
    result.thumbnail(size, Image.Resampling.LANCZOS)
    return result


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in names:
        path = Path("C:/Windows/Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def make_feature_graphic(destination: Path) -> None:
    width, height = 1024, 500
    image = Image.new("RGB", (width, height), "white")
    pixels = image.load()
    start = (250, 253, 255)
    end = (186, 224, 255)
    for y in range(height):
        for x in range(width):
            mix = (x / width * 0.65) + (y / height * 0.35)
            pixels[x, y] = tuple(round(start[i] * (1 - mix) + end[i] * mix) for i in range(3))

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((560, -130, 1090, 400), fill=(25, 137, 255, 80))
    glow_draw.ellipse((-170, 220, 330, 700), fill=(123, 92, 255, 42))
    glow = glow.filter(ImageFilter.GaussianBlur(70))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    island = contain(Image.open(ROOT / "frontend/assets/scene/island.png").convert("RGBA"), (390, 310))
    jar = contain(Image.open(ROOT / "frontend/assets/scene/jar-shell.png").convert("RGBA"), (270, 310))
    coin_a = contain(Image.open(ROOT / "frontend/assets/scene/coin-gold-a.png").convert("RGBA"), (60, 60))
    coin_b = contain(Image.open(ROOT / "frontend/assets/scene/coin-silver.png").convert("RGBA"), (54, 54))
    bill = contain(Image.open(ROOT / "frontend/assets/scene/bill-10.png").convert("RGBA"), (96, 96))

    island_x = 604 + (390 - island.width) // 2
    island_y = 212
    image.alpha_composite(island, (island_x, island_y))

    jar_x = 675 + (270 - jar.width) // 2
    jar_y = 78
    image.alpha_composite(coin_a, (jar_x + 82, jar_y + 196))
    image.alpha_composite(coin_b, (jar_x + 132, jar_y + 205))
    image.alpha_composite(coin_a.rotate(-18, expand=True), (jar_x + 112, jar_y + 228))
    image.alpha_composite(jar, (jar_x, jar_y))
    image.alpha_composite(coin_a.rotate(18, expand=True), (610, 86))
    image.alpha_composite(coin_b.rotate(-12, expand=True), (936, 128))
    image.alpha_composite(bill.rotate(12, expand=True), (865, 32))

    draw = ImageDraw.Draw(image)
    title_font = load_font(64, bold=True)
    tagline_font = load_font(22, bold=False)
    draw.text((70, 172), "Logic Coin", font=title_font, fill=(12, 31, 66, 255))
    draw.text((74, 256), "SAVE  •  GROW  •  ENJOY", font=tagline_font, fill=(54, 86, 130, 255))
    draw.rounded_rectangle((70, 310, 372, 368), radius=29, fill=(8, 102, 255, 235))
    badge_font = load_font(20, bold=True)
    draw.text((102, 326), "Small steps. Real progress.", font=badge_font, fill=(255, 255, 255, 255))

    destination.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(destination, "PNG", optimize=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    phone_dir = OUT / "phone"
    tablet_dir = OUT / "tablet"
    for source_name, output_name in SCREENSHOTS:
        resize_exact(RAW / "phone" / source_name, phone_dir / output_name, (1080, 1920))
        resize_exact(RAW / "tablet" / source_name, tablet_dir / output_name, (1440, 2560))

    icon_source = ROOT / "frontend/public/icon-512.png"
    icon_destination = OUT / "app-icon-512.png"
    icon_destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(icon_source, icon_destination)
    make_feature_graphic(OUT / "feature-graphic-1024x500.png")

    assets = []
    for path in sorted(OUT.rglob("*.png")):
        with Image.open(path) as image:
            assets.append(
                {
                    "file": path.relative_to(OUT).as_posix(),
                    "width": image.width,
                    "height": image.height,
                    "mode": image.mode,
                    "bytes": path.stat().st_size,
                    "sha256": sha256(path),
                }
            )
    (OUT / "manifest.json").write_text(
        json.dumps({"app": "Logic Coin", "package": "com.kinddevs.logiccoin", "assets": assets}, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
