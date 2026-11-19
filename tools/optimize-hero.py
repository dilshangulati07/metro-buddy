"""Make the hero photo files from images/hero-train.jpg.

Usage (from the project folder):  python tools/optimize-hero.py [path/to/photo.jpg]

Writes images/hero-train-1280.{webp,jpg} and images/hero-train-720.{webp,jpg},
cropped to 4:3 (1280x960 and 720x540, the size set in index.html so nothing
jumps while loading). Each file is kept under about 250 KB by lowering the
quality step by step. Needs Pillow (pip install Pillow).
"""
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "images" / "hero-train.jpg"
OUT = ROOT / "images"
LIMIT = 250 * 1024
SIZES = [(1280, 960), (720, 540)]


def crop_to(img, w, h):
    """Centre-crop to the w:h ratio, then resize to exactly w x h."""
    return ImageOps.fit(img, (w, h), method=Image.LANCZOS, centering=(0.5, 0.5))


def encode(img, fmt):
    for q in range(84, 39, -4):
        buf = BytesIO()
        if fmt == "WEBP":
            img.save(buf, "WEBP", quality=q, method=6)
        else:
            img.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= LIMIT:
            return buf.getvalue(), q
    return buf.getvalue(), q


def main():
    if not SRC.exists():
        sys.exit(f"Photo not found: {SRC}")
    img = ImageOps.exif_transpose(Image.open(SRC)).convert("RGB")
    OUT.mkdir(exist_ok=True)
    for w, h in SIZES:
        small = crop_to(img, w, h)
        for fmt, ext in (("WEBP", "webp"), ("JPEG", "jpg")):
            data, q = encode(small, fmt)
            path = OUT / f"hero-train-{w}.{ext}"
            path.write_bytes(data)
            print(f"{path.relative_to(ROOT)}  {w}x{h}  q{q}  {len(data) // 1024} KB")


if __name__ == "__main__":
    main()
