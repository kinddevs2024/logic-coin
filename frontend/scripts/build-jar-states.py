"""Build normalized transparent savings-jar states from the supplied source photos."""

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "imgs" / "banka"
OUTPUT = ROOT / "frontend" / "assets" / "scene"
STATES = [
    "Make_empty_jar_202607261857.jpeg",
    "Piggy_bank_with_few_coins_202607261857.jpeg",
    "Jar_one-third_filled_money_202607261857.jpeg",
    "Jar_half-filled_with_money_202607261857.jpeg",
    "Jar_half_filled_with_money_202607261857.jpeg",
    "Money_inside_piggy_bank_202607261857 (1).jpeg",
]


def background_alpha(image: Image.Image) -> Image.Image:
    values: list[int] = []
    for red, green, blue in image.getdata():
        low = min(red, green, blue)
        high = max(red, green, blue)
        chroma = high - low
        if low >= 224 and chroma <= 36:
            values.append(0)
        elif low >= 204 and chroma <= 42:
            values.append(max(0, min(255, (224 - low) * 13)))
        else:
            values.append(255)
    alpha = Image.new("L", image.size)
    alpha.putdata(values)
    return alpha


def build_state(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGB")
    alpha = background_alpha(image)
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.15))
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)
    bbox = alpha.point(lambda value: 255 if value > 18 else 0).getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    scale = min(860 / max(1, rgba.width), 920 / max(1, rgba.height))
    resized = rgba.resize(
        (max(1, round(rgba.width * scale)), max(1, round(rgba.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (1024 - resized.width) // 2
    y = 52 + (920 - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    canvas.save(target, optimize=True)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for index, filename in enumerate(STATES):
        build_state(SOURCE / filename, OUTPUT / f"jar-state-{index}.png")
    print(f"Built {len(STATES)} jar states in {OUTPUT}")
