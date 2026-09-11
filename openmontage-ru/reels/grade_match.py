#!/usr/bin/env python3
"""Подогнать цветокор под образец — по замерам, а не на глаз.

Меряет тональный профиль образца (перцентили яркости, насыщенность, уход
цвета в тенях, средних и светах), затем прогоняет кандидатов-цепочек ffmpeg
по исходнику и считает, насколько каждая приблизилась к образцу.

Важное ограничение: глобальная кривая не переносит свет. Если в образце
тёмный фон и выбитый ключевой свет на лице, а в исходнике всё залито ровно,
кривая приблизит тон, но не воспроизведёт разницу в постановке света —
попытка дожать цифры до совпадения даст постеризацию.

    python grade_match.py --reference ref.mov --source src.mov
"""

from __future__ import annotations

import argparse
import subprocess
import sys

import numpy as np

PERCENTILES = (5, 10, 25, 50, 75, 90, 95)


def frames(path: str, count: int, vf: str, w: int, h: int) -> np.ndarray:
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout)
    out = []
    for i in range(count):
        t = dur * (i + 0.5) / count
        chain = f"{vf},scale={w}:{h}" if vf else f"scale={w}:{h}"
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
             "-vf", chain, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True).stdout
        if len(raw) == w * h * 3:
            out.append(np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32))
    if not out:
        raise SystemExit(f"не удалось прочитать кадры: {path}")
    return np.stack(out)


def profile(a: np.ndarray) -> dict:
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    mx, mn = a.max(2), a.min(2)
    prof = {f"p{p}": float(np.percentile(lum, p)) for p in PERCENTILES}
    prof["sat"] = float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean())
    for lo, hi, name in ((0, 25, "тени"), (40, 60, "средние"), (85, 100, "света")):
        m = (lum >= np.percentile(lum, lo)) & (lum <= np.percentile(lum, hi))
        r, g, b = (float(a[..., i][m].mean()) for i in range(3))
        prof[f"{name}_RG"] = r - g
        prof[f"{name}_BG"] = b - g
    return prof


def error(got: dict, want: dict) -> float:
    """Средняя относительная ошибка по яркостным перцентилям."""
    return float(np.mean([abs(got[f"p{p}"] - want[f"p{p}"]) / max(want[f"p{p}"], 8)
                          for p in PERCENTILES]))


def show(name: str, prof: dict, ref: dict | None = None) -> None:
    line = " ".join(f"p{p}={prof[f'p{p}']:6.1f}" for p in PERCENTILES)
    tail = f" sat={prof['sat']:.3f}"
    if ref is not None:
        tail += f"  ошибка={error(prof, ref):.3f}"
    print(f"{name:34s} {line}{tail}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reference", required=True, help="ролик-образец")
    ap.add_argument("--source", required=True, help="исходник для подгонки")
    ap.add_argument("--chain", action="append", default=[],
                    metavar="ИМЯ=ФИЛЬТР", help="цепочка ffmpeg; можно несколько раз")
    ap.add_argument("--samples", type=int, default=12)
    ap.add_argument("--width", type=int, default=270)
    ap.add_argument("--height", type=int, default=480)
    args = ap.parse_args()

    ref = profile(frames(args.reference, args.samples, "", args.width, args.height))
    show("ОБРАЗЕЦ", ref)
    for name in ("тени", "средние", "света"):
        print(f"  {name:8s} R-G={ref[f'{name}_RG']:+6.1f}  B-G={ref[f'{name}_BG']:+6.1f}")
    print()

    candidates = [("исходник без правок", "")]
    for spec in args.chain:
        name, _, vf = spec.partition("=")
        candidates.append((name, vf))

    best = None
    for name, vf in candidates:
        prof = profile(frames(args.source, args.samples, vf, args.width, args.height))
        show(name, prof, ref)
        err = error(prof, ref)
        if best is None or err < best[1]:
            best = (name, err)
    if best:
        print(f"\nближе всего: {best[0]} (ошибка {best[1]:.3f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
