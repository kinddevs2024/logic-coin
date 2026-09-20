"""Encode scene/onboarding PNGs as smaller WebP files without changing any RGBA pixel.

Requires Pillow with WebP support. Run from any directory. Original PNGs stay in
place; TSX references are intentionally outside this script's responsibility.
Use --check to verify the generated files without encoding them again.
"""

import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, features


FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent
REPORT = ROOT / ".qa" / "android-tabs-assets" / "lossless-manifest.json"
SCENE = FRONTEND / "assets" / "scene"

# These are the PNGs referenced by SavingsScene that have no PNG-only color
# metadata. Do not broaden this to every source asset in the repository.
LOSSLESS_NAMES = (
    "1-Photoroom", "2-Photoroom", "3-Photoroom", "4-Photoroom",
    "5-Photoroom", "6-Photoroom", "7-Photoroom", "island",
    "coin-angle", "coin-gold-a", "coin-silver",
)
ONBOARDING_NAMES = ("01-savings", "02-challenges", "03-streak", "04-withdraw")
COVER_NAMES = (
    "one-second", "tsvet", "udar", "space-find-number", "brain-training",
    "find-letter", "volt-match", "geography-quiz", "pulse", "volt-numbers",
    "math-quiz", "shadow", "2048",
)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def encode_or_check(source: Path, check: bool) -> dict:
    target = source.with_suffix(".webp")
    source_bytes = source.read_bytes()
    with Image.open(BytesIO(source_bytes)) as original:
        if original.info:
            raise ValueError(f"Review metadata before converting {source}: {list(original.info)}")
        if getattr(original, "n_frames", 1) != 1:
            raise ValueError(f"Animated source is outside this script's scope: {source}")
        rgba = original.convert("RGBA")
        if check:
            encoded = target.read_bytes()
        else:
            buffer = BytesIO()
            # exact preserves RGB values even for fully transparent pixels.
            rgba.save(buffer, "WEBP", lossless=True, quality=100, method=6, exact=True)
            encoded = buffer.getvalue()
        with Image.open(BytesIO(encoded)) as decoded:
            size_equal = rgba.size == decoded.size
            output_rgba = decoded.convert("RGBA").tobytes()
        source_rgba = rgba.tobytes()
        if not size_equal or source_rgba != output_rgba:
            raise ValueError(f"Decoded RGBA changed: {source}")
        smaller = len(encoded) < len(source_bytes)
        if not smaller:
            raise ValueError(f"No file-size saving for {source}; original must remain in use")
        if not check and (not target.exists() or target.read_bytes() != encoded):
            target.write_bytes(encoded)
        return {
            "source": relative(source),
            "optimized": relative(target),
            "width": rgba.width,
            "height": rgba.height,
            "source_bytes": len(source_bytes),
            "optimized_bytes": len(encoded),
            "saved_bytes": len(source_bytes) - len(encoded),
            "saved_percent": round((1 - len(encoded) / len(source_bytes)) * 100, 2),
            "decoded_rgba_bytes": len(source_rgba),
            "dimensions_equal": size_equal,
            "decoded_rgba_equal": source_rgba == output_rgba,
            "source_sha256": digest(source_bytes),
            "optimized_sha256": digest(encoded),
            "source_rgba_sha256": digest(source_rgba),
            "optimized_rgba_sha256": digest(output_rgba),
        }


def audit_unchanged(path: Path, reason: str) -> dict:
    with Image.open(path) as original:
        return {
            "source": relative(path),
            "bytes": path.stat().st_size,
            "width": original.width,
            "height": original.height,
            "decoded_rgba_bytes": original.width * original.height * 4,
            "sha256": digest(path.read_bytes()),
            "unchanged_reason": reason,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Only verify existing WebP outputs")
    args = parser.parse_args()
    if not features.check("webp"):
        raise SystemExit("Pillow was built without WebP support")
    converted = []
    for name in LOSSLESS_NAMES:
        result = encode_or_check(SCENE / f"{name}.png", args.check)
        converted.append(result)
        print(f"{name}: {result['source_bytes']:,} -> {result['optimized_bytes']:,} bytes; exact RGBA", flush=True)
    for name in ONBOARDING_NAMES:
        result = encode_or_check(FRONTEND / "assets" / "onboarding" / f"{name}.png", args.check)
        converted.append(result)
        print(f"{name}: {result['source_bytes']:,} -> {result['optimized_bytes']:,} bytes; exact RGBA", flush=True)
    unchanged = [
        audit_unchanged(SCENE / f"{name}.png", "Retained PNG sRGB/gamma metadata; no color conversion")
        for name in ("bill-1", "bill-10")
    ] + [
        audit_unchanged(FRONTEND / "assets" / "games" / "covers" / f"{name}.webp",
                        "Already compressed 512px WebP; retain current decoded pixels")
        for name in COVER_NAMES
    ]
    before = sum(item["source_bytes"] for item in converted)
    after = sum(item["optimized_bytes"] for item in converted)
    report = {
        "scope": "SavingsScene and onboarding static images, and thirteen covers referenced by game-covers.ts",
        "encoder": "Pillow WebP lossless=True quality=100 method=6 exact=True",
        "originals_retained": True,
        "converted": converted,
        "unchanged": unchanged,
        "totals": {
            "converted_count": len(converted),
            "source_bytes": before,
            "optimized_bytes": after,
            "saved_bytes": before - after,
            "saved_percent": round((1 - after / before) * 100, 2),
            "decoded_rgba_bytes_unchanged": sum(item["decoded_rgba_bytes"] for item in converted),
        },
        "limits": [
            "Savings apply when the app references WebP instead of PNG; originals remain in source control.",
            "Unchanged dimensions mean decoded RGBA memory is unchanged; APK bytes do not measure frame smoothness.",
            "Actual APK compression and Android decoding must be checked in the release build.",
        ],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Total: {before:,} -> {after:,} bytes; saved {before - after:,} bytes ({report['totals']['saved_percent']}%)")
    print(f"Manifest: {REPORT}")


if __name__ == "__main__":
    main()
