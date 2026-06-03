"""Download the Noto fonts the render pipeline needs for multilingual export.

Run once after setup:
    python download_fonts.py

Fonts are OFL-licensed and saved under ./fonts. They are gitignored — each
environment downloads its own copy.
"""

import sys
import urllib.request
from pathlib import Path

BASE = "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf"

# family folder -> files to fetch (Regular + Bold where available)
FAMILIES = [
    "NotoSans",
    "NotoSansDevanagari",
    "NotoSansBengali",
    "NotoSansTamil",
    "NotoSansTelugu",
    "NotoSansKannada",
    "NotoSansMalayalam",
    "NotoSansGujarati",
    "NotoSansGurmukhi",
    "NotoSansOriya",
    "NotoSansArabic",
]
STYLES = ["Regular", "Bold"]

FONT_DIR = Path(__file__).parent / "fonts"


def run() -> None:
    FONT_DIR.mkdir(exist_ok=True)
    ok, fail = 0, 0
    for family in FAMILIES:
        for style in STYLES:
            name = f"{family}-{style}.ttf"
            dest = FONT_DIR / name
            if dest.exists() and dest.stat().st_size > 1000:
                print(f"  have  {name}")
                ok += 1
                continue
            url = f"{BASE}/{family}/{name}"
            try:
                urllib.request.urlretrieve(url, dest)
                if dest.stat().st_size < 1000:
                    raise RuntimeError("file too small")
                print(f"  got   {name}")
                ok += 1
            except Exception as e:  # noqa: BLE001
                if dest.exists():
                    dest.unlink()
                print(f"  MISS  {name} ({e})")
                fail += 1
    print(f"\nDone. {ok} present, {fail} missing.")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    run()
