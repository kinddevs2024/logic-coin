"""Normalize generated game covers for the mobile/web asset bundle."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
COVERS = ROOT / "assets" / "games" / "covers"
QA = ROOT.parent / ".qa"
TARGET_SIZE = (512, 512)


def optimize(source: Path) -> Path:
    with Image.open(source) as image:
        normalized = ImageOps.fit(
            image.convert("RGB"),
            TARGET_SIZE,
            method=Image.Resampling.LANCZOS,
        )
        target = source.with_suffix(".webp")
        normalized.save(target, "WEBP", quality=84, method=6)
        return target


def build_contact_sheet() -> Path:
    sources = sorted(COVERS.glob("*.webp"))
    tile = 192
    gap = 12
    columns = 5
    rows = (len(sources) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * tile + (columns + 1) * gap, rows * tile + (rows + 1) * gap), "white")
    for index, source in enumerate(sources):
        with Image.open(source) as image:
            preview = ImageOps.fit(image.convert("RGB"), (tile, tile), method=Image.Resampling.LANCZOS)
            x = gap + (index % columns) * (tile + gap)
            y = gap + (index // columns) * (tile + gap)
            sheet.paste(preview, (x, y))
    QA.mkdir(parents=True, exist_ok=True)
    target = QA / "game-covers-contact-sheet.jpg"
    sheet.save(target, "JPEG", quality=90, optimize=True)
    return target


if __name__ == "__main__":
    outputs = [optimize(source) for source in sorted(COVERS.glob("*.png"))]
    contact_sheet = build_contact_sheet()
    print(f"Optimized {len(outputs)} covers in {COVERS}; contact sheet: {contact_sheet}")
