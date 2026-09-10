#!/usr/bin/env python3
"""Снять параметры субтитров с образца и проверить по ним свой ролик.

Белый текст нельзя искать просто по яркости: в кадре есть белая футболка и
засвеченная стена. Ищем по подписи жёсткой тени — пиксель яркий, а на
несколько точек ниже-правее резко темнее. Так отзывается только текст с
контурной тенью, и замер перестаёт зависеть от фона.

    python caption_spec.py measure ref.mov            # что в образце
    python caption_spec.py check out.mp4 --position 0.679 --cap 95
"""

from __future__ import annotations

import argparse
import subprocess
import sys

import numpy as np


def read_frame(path: str, t: float, w: int, h: int) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-frames:v", "1",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    if len(raw) != w * h * 3:
        raise SystemExit(f"кадр {t}с не прочитан — проверьте размер {w}x{h}")
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32)


def dimensions(path: str) -> tuple[int, int]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x", path],
        capture_output=True, text=True, check=True).stdout.strip().split("x")
    return int(out[0]), int(out[1])


def line_metrics(im: np.ndarray, offset: int, band: tuple[float, float]):
    """Вернуть (капитель, ширина, центр по высоте) строки субтитра."""
    h, w, _ = im.shape
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    bright, shadow = lum[:-offset, :-offset], lum[offset:, offset:]
    text = (bright > 235) & (shadow < bright - 95)
    lo, hi = int(h * band[0]), int(h * band[1])
    strip = text[lo:hi]
    rows = np.where(strip.sum(1) > 4)[0]
    if len(rows) == 0:
        return None
    runs, s = [], rows[0]
    for a, b in zip(rows, rows[1:]):
        if b - a > 8:
            runs.append((s, a))
            s = b
    runs.append((s, rows[-1]))
    r0, r1 = max(runs, key=lambda r: r[1] - r[0])
    cols = np.where(strip[r0:r1 + 1].sum(0) > 0)[0]
    if len(cols) == 0:
        return None
    return r1 - r0 + 1, cols[-1] - cols[0] + 1, (lo + (r0 + r1) / 2) / h


def sample_times(path: str, count: int) -> list[float]:
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout)
    return [dur * (i + 0.5) / count for i in range(count)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["measure", "check"])
    ap.add_argument("video")
    ap.add_argument("--times", type=float, nargs="*")
    ap.add_argument("--samples", type=int, default=6)
    ap.add_argument("--offset", type=int, default=6, help="смещение жёсткой тени, px")
    ap.add_argument("--band", type=float, nargs=2, default=(0.55, 0.85))
    ap.add_argument("--position", type=float, help="ожидаемый центр строки (доля высоты)")
    ap.add_argument("--cap", type=float, help="ожидаемая капитель в px при 1920")
    ap.add_argument("--tol-position", type=float, default=0.02)
    ap.add_argument("--tol-cap", type=float, default=12)
    args = ap.parse_args()

    w, h = dimensions(args.video)
    times = args.times or sample_times(args.video, args.samples)
    caps, centres, ok = [], [], True

    print(f"{args.video}  {w}x{h}")
    print(f"{'момент':>8s} {'капитель':>9s} {'при 1920':>9s} {'ширина':>7s} {'центр':>7s}")
    for t in times:
        m = line_metrics(read_frame(args.video, t, w, h), args.offset, tuple(args.band))
        if m is None:
            print(f"{t:8.2f} {'—':>9s} {'—':>9s} {'—':>7s} {'—':>7s}")
            continue
        cap, width, centre = m
        scaled = cap / h * 1920
        caps.append(scaled)
        centres.append(centre)
        note = ""
        if args.mode == "check":
            good = ((args.position is None or abs(centre - args.position) < args.tol_position)
                    and (args.cap is None or abs(scaled - args.cap) < args.tol_cap))
            ok &= good
            note = "  ✓" if good else "  ✗"
        print(f"{t:8.2f} {cap:8d}px {scaled:8.1f}  {width:6d} {centre:7.3f}{note}")

    if caps:
        print(f"\nкапитель: медиана {np.median(caps):.0f}px, разброс "
              f"{min(caps):.0f}–{max(caps):.0f}   центр: медиана {np.median(centres):.3f}")
    if args.mode == "check":
        print("итог:", "совпадает" if ok else "есть расхождения")
        return 0 if ok else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
