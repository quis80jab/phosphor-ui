#!/usr/bin/env python3
"""Build the local Phosphor Pixel TTF and WOFF from dist/vfd-glyphs.js.

Dependency (official PyPI):
    python3 -m pip install --index-url https://pypi.org/simple fonttools==4.68.0

Build and validate:
    python3 tools/build-pixel-font.py
    python3 tools/build-pixel-font.py --check

The 1000-unit em contains a 100-unit bitmap-cell pitch. CSS font-size:20px
therefore gives a 2px pitch and roughly 14px cap height. Both formats have
identical outlines, fixed 600-unit advances, and deterministic timestamps.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
from pathlib import Path

try:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib import TTFont
except ImportError as error:
    raise SystemExit(
        "FontTools is required. Install from official PyPI with:\n"
        "python3 -m pip install --index-url https://pypi.org/simple fonttools==4.68.0"
    ) from error


ROOT = Path(__file__).resolve().parents[1]
UPM = 1000
PITCH = 100
CELL = 90
ADVANCE = 600
ASCENT = 800
DESCENT = -200
LEFT_MARGIN = 50
FAMILY = "Phosphor Pixel"
# OpenType timestamps use the epoch 1904-01-01; this is 1970-01-01 UTC.
FIXED_TIMESTAMP = 2082844800

# Read the literal bitmap declarations, including the Object.assign additions.
# No JavaScript is evaluated. Later declarations override earlier declarations.
ENTRY = re.compile(
    r"(?P<key>'(?:\\.|[^'\\])*'|\"(?:\\.|[^\"\\])*\"|[A-Za-z_$][\w$]*)"
    r"\s*:\s*\[(?P<rows>[^\[\]]*)\]"
)
ROW = re.compile(r"['\"]([01]{5})['\"]")


def read_bitmaps(source: Path) -> dict[int, tuple[str, ...]]:
    bitmaps: dict[int, tuple[str, ...]] = {}
    for match in ENTRY.finditer(source.read_text(encoding="utf-8")):
        rows = tuple(ROW.findall(match.group("rows")))
        if len(rows) != 7:
            continue
        raw_key = match.group("key")
        key = ast.literal_eval(raw_key) if raw_key[:1] in ("'", '"') else raw_key
        # Accept a doubly escaped backslash declaration without editing source.
        if key == "\\\\":
            key = "\\"
        if len(key) == 1 and 32 <= ord(key) <= 126:
            bitmaps[ord(key)] = rows
    missing = sorted(set(range(32, 127)) - set(bitmaps))
    if missing:
        names = ", ".join(f"U+{code:04X}" for code in missing)
        raise ValueError(f"The source must define all 95 printable ASCII glyphs; missing {names}")
    return bitmaps


def glyph_name(code: int) -> str:
    return "space" if code == 32 else f"uni{code:04X}"


def rectangles(rows: tuple[str, ...]) -> list[tuple[int, int, int, int]]:
    inset = (PITCH - CELL) // 2
    return [
        (
            LEFT_MARGIN + column * PITCH + inset,
            (6 - row) * PITCH + inset,
            LEFT_MARGIN + column * PITCH + inset + CELL,
            (6 - row) * PITCH + inset + CELL,
        )
        for row, bits in enumerate(rows)
        for column, on in enumerate(bits)
        if on == "1"
    ]


def make_glyph(rows: tuple[str, ...]):
    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in rectangles(rows):
        # Every illuminated cell is a separate clockwise square contour.
        pen.moveTo((x0, y0))
        pen.lineTo((x0, y1))
        pen.lineTo((x1, y1))
        pen.lineTo((x1, y0))
        pen.closePath()
    return pen.glyph()


def build_font(bitmaps: dict[int, tuple[str, ...]]) -> TTFont:
    order = [".notdef", *(glyph_name(code) for code in range(32, 127))]
    glyphs = {".notdef": make_glyph(bitmaps[ord("?")])}
    glyphs.update({glyph_name(code): make_glyph(rows) for code, rows in bitmaps.items()})
    metrics = {}
    for name, glyph in glyphs.items():
        # The horizontal advance stays fixed; the sidebearing follows the ink.
        coordinates = getattr(glyph, "coordinates", ())
        metrics[name] = (ADVANCE, min((point[0] for point in coordinates), default=0))
    digest = hashlib.sha256(json.dumps(bitmaps, sort_keys=True).encode()).hexdigest()[:12]
    builder = FontBuilder(UPM, isTTF=True)
    builder.setupGlyphOrder(order)
    builder.setupCharacterMap({code: glyph_name(code) for code in range(32, 127)})
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT, lineGap=0)
    builder.setupNameTable(
        {
            "familyName": FAMILY,
            "styleName": "Regular",
            "uniqueFontIdentifier": f"PhosphorPixel-Regular:1.000:{digest}",
            "fullName": FAMILY,
            "psName": "PhosphorPixel-Regular",
            "version": "Version 1.000",
            "description": "5x7 bitmap monospace; 100-unit pitch with separate 90-unit square phosphor cells.",
        }
    )
    builder.setupOS2(
        version=4,
        sTypoAscender=ASCENT,
        sTypoDescender=DESCENT,
        sTypoLineGap=0,
        usWinAscent=ASCENT,
        usWinDescent=-DESCENT,
        sxHeight=500,
        sCapHeight=700,
        usWeightClass=400,
        usWidthClass=5,
        fsType=0,
        fsSelection=(1 << 6) | (1 << 7),  # Regular; use typographic metrics.
    )
    builder.setupPost(isFixedPitch=1, underlinePosition=-100, underlineThickness=50)
    builder.setupMaxp()
    font = builder.font
    font.recalcTimestamp = False
    font["head"].created = FIXED_TIMESTAMP
    font["head"].modified = FIXED_TIMESTAMP
    return font


def validate_font(path: Path, bitmaps: dict[int, tuple[str, ...]]) -> dict:
    with TTFont(path, recalcTimestamp=False, checkChecksums=2) as font:
        cmap = font.getBestCmap()
        assert set(cmap) == set(range(32, 127)), "Character map must contain exactly 95 printable ASCII characters"
        assert len(font.getGlyphOrder()) == 96, "Expected 95 ASCII glyphs plus .notdef"
        assert font["head"].unitsPerEm == UPM
        assert font["hhea"].ascent == ASCENT and font["hhea"].descent == DESCENT
        assert font["post"].isFixedPitch == 1
        assert font["name"].getDebugName(1) == FAMILY
        assert font["name"].getDebugName(6) == "PhosphorPixel-Regular"
        contours = 0
        for code, rows in bitmaps.items():
            glyph = font["glyf"][cmap[code]]
            expected = rectangles(rows)
            assert glyph.numberOfContours == len(expected), f"Incorrect cell count for U+{code:04X}"
            assert font["hmtx"][cmap[code]][0] == ADVANCE
            if expected:
                bounds = (
                    min(r[0] for r in expected), min(r[1] for r in expected),
                    max(r[2] for r in expected), max(r[3] for r in expected),
                )
                assert (glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax) == bounds
                assert 0 <= glyph.xMin < glyph.xMax <= ADVANCE
                assert DESCENT <= glyph.yMin < glyph.yMax <= ASCENT
                assert len(glyph.coordinates) == len(expected) * 4
                for i, rectangle in enumerate(expected):
                    points = glyph.coordinates[i * 4 : i * 4 + 4]
                    assert max(p[0] for p in points) - min(p[0] for p in points) == CELL
                    assert max(p[1] for p in points) - min(p[1] for p in points) == CELL
            contours += len(expected)
        assert font["glyf"]["space"].numberOfContours == 0
        return {
            "path": str(path), "format": font.flavor or "ttf", "bytes": path.stat().st_size,
            "family": FAMILY, "ascii_characters": 95, "glyphs": 96, "square_contours": contours,
            "units_per_em": UPM, "advance": ADVANCE, "cell_pitch": PITCH, "cell_ink": CELL,
            "ascent": ASCENT, "descent": DESCENT,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=ROOT / "dist" / "vfd-glyphs.js")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist" / "fonts")
    parser.add_argument("--check", action="store_true", help="Validate existing fonts without changing them")
    args = parser.parse_args()
    bitmaps = read_bitmaps(args.source)
    outputs = [args.output_dir / "phosphor-pixel.ttf", args.output_dir / "phosphor-pixel.woff"]
    if not args.check:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        font = build_font(bitmaps)
        for path, flavor in zip(outputs, (None, "woff")):
            font.flavor = flavor
            font.save(path, reorderTables=True)
        font.close()
    report = [validate_font(path, bitmaps) for path in outputs]
    print(json.dumps({"fonts": report, "recommended_css": {"font_family": FAMILY, "font_size_px": 20, "line_height_px": 22}}, indent=2))


if __name__ == "__main__":
    main()
