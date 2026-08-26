#!/usr/bin/env python3
"""Generate the embedded Cyrillic font module for the Remotion composer.

Reads the woff2 subsets from ``fonts/`` and writes
``remotion-composer/src/lib/cyrillicFontData.ts`` as base64 blobs.

The faces are embedded rather than served from ``public/`` because every
Remotion render worker loads fonts in its own tab, and parallel fetches
against the bundler are slow enough to blow the delayRender timeout.

Usage:
    python build_cyrillic_fonts.py --composer /path/to/OpenMontage/remotion-composer
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# family, filename, weight, style — the CSS stacks in cyrillicFonts.ts
# reference these family names.
FACES: list[tuple[str, str, str, str]] = [
    ("OM Display", "Montserrat-500.woff2", "500", "normal"),
    ("OM Display", "Montserrat-700.woff2", "700", "normal"),
    ("OM Display", "Montserrat-800.woff2", "800", "normal"),
    ("OM Text", "Inter-400.woff2", "400", "normal"),
    ("OM Text", "Inter-600.woff2", "600", "normal"),
    ("OM Text", "Inter-700.woff2", "700", "normal"),
    ("OM Text", "Inter-900.woff2", "900", "normal"),
    ("OM Serif", "PlayfairDisplay-700.woff2", "700", "normal"),
    ("OM Serif", "PlayfairDisplay-700-italic.woff2", "700", "italic"),
]

HEADER = """/**
 * Cyrillic font faces, embedded as base64 woff2.
 *
 * Generated file — do not edit. Rebuild with build_cyrillic_fonts.py.
 * Embedded rather than fetched from public/ because every render worker
 * loads fonts independently, and parallel fetches against the bundler
 * saturate and blow the delayRender timeout.
 */

export interface EmbeddedFace {
  family: string;
  weight: string;
  style: string;
  data: string;
}

export const EMBEDDED_FACES: EmbeddedFace[] = [
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--composer",
        type=Path,
        required=True,
        help="OpenMontage remotion-composer directory",
    )
    parser.add_argument(
        "--fonts",
        type=Path,
        default=HERE / "fonts",
        help="directory holding the woff2 subsets (default: ./fonts)",
    )
    args = parser.parse_args()

    lib = args.composer / "src" / "lib"
    if not lib.is_dir():
        raise SystemExit(f"not a remotion-composer checkout: {args.composer}")

    missing = [name for _, name, _, _ in FACES if not (args.fonts / name).is_file()]
    if missing:
        raise SystemExit(f"missing font files in {args.fonts}: {', '.join(missing)}")

    chunks = [HEADER]
    total = 0
    for family, name, weight, style in FACES:
        raw = (args.fonts / name).read_bytes()
        total += len(raw)
        chunks.append(
            "  {\n"
            f"    family: {json.dumps(family)},\n"
            f"    weight: {json.dumps(weight)},\n"
            f"    style: {json.dumps(style)},\n"
            f"    data: {json.dumps(base64.b64encode(raw).decode())},\n"
            "  },\n"
        )
    chunks.append("];\n")

    # The loader itself lives next to the generated data.
    loader_src = HERE / "cyrillicFonts.ts"
    if not loader_src.is_file():
        raise SystemExit(f"missing loader source: {loader_src}")
    (lib / "cyrillicFonts.ts").write_text(
        loader_src.read_text(encoding="utf-8"), encoding="utf-8"
    )

    out = lib / "cyrillicFontData.ts"
    out.write_text("".join(chunks), encoding="utf-8")

    public_fonts = args.composer / "public" / "fonts"
    public_fonts.mkdir(parents=True, exist_ok=True)
    for _, name, _, _ in FACES:
        (public_fonts / name).write_bytes((args.fonts / name).read_bytes())

    print(f"cyrillicFonts.ts     -> {lib / 'cyrillicFonts.ts'}")
    print(f"cyrillicFontData.ts  -> {out} ({len(FACES)} faces, {total} raw bytes)")
    print(f"woff2 subsets        -> {public_fonts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
