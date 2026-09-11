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

# Доля от пикового числа пикселей в ряду, ниже которой ряд не считается
# частью капители. См. пояснение в line_metrics.
CORE_ROW_FRACTION = 0.12

# Ниже этой капители (в долях высоты кадра) находка — не строка субтитра,
# а блик или деталь одежды. 0.02 от 1920 — это 38px, вдвое меньше самого
# мелкого субтитра в образцах.
MIN_CAP_FRACTION = 0.02


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
    """Вернуть (капитель, ширина, центр по высоте) строки субтитра.

    Наивный поиск «яркий пиксель со смещённой тенью» ловит не только текст:
    белая футболка с тёмным краем, светлая полоска на рукаве, блик на столе
    отзываются так же. Поэтому найденное проверяется дважды.

    Во-первых, строка берётся не по всем откликнувшимся рядам, а по тем, где
    пикселей много. Выносные элементы (Д, Ц, Щ опускаются ниже базовой линии)
    дают считанные пиксели на ряд и завышают капитель на 15-20%, если их
    не отсечь.

    Во-вторых, у текста поперёк строки много переходов «есть-нет»: буквы
    чередуются с просветами. У куска одежды переходов единицы. Это и
    отличает одно от другого.
    """
    h, w, _ = im.shape
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    bright, shadow = lum[:-offset, :-offset], lum[offset:, offset:]
    text = (bright > 235) & (shadow < bright - 95)
    lo, hi = int(h * band[0]), int(h * band[1])
    strip = text[lo:hi]

    counts = strip.sum(1)
    if counts.max() < 12:
        return None
    # Ряды, где пикселей заметно меньше пика, — это выносные элементы и мусор.
    # Порог подобран по кадрам, а не на глаз: на пяти словах с выносными
    # элементами и светлой одеждой в кадре 0.12 даёт 94-95px там, где
    # ожидается 95. Ниже 0.12 в замер лезут ножки Д и полоска на рукаве
    # (до 265px), выше — срезаются настоящие ряды капители.
    core = np.where(counts >= counts.max() * CORE_ROW_FRACTION)[0]
    if len(core) == 0:
        return None
    runs, s0 = [], core[0]
    for a, b in zip(core, core[1:]):
        if b - a > 8:
            runs.append((s0, a))
            s0 = b
    runs.append((s0, core[-1]))
    r0, r1 = max(runs, key=lambda r: r[1] - r[0])

    rows = strip[r0:r1 + 1]
    cols = np.where(rows.sum(0) > 0)[0]
    if len(cols) == 0:
        return None

    # Плотность штрихов: сколько раз по горизонтали текст начинается заново.
    occupied = rows.sum(0) > 0
    transitions = int(np.count_nonzero(occupied[1:] & ~occupied[:-1])) + int(occupied[0])
    width = cols[-1] - cols[0] + 1
    if transitions < 2 and width > (r1 - r0 + 1) * 2.5:
        return None  # широкое и сплошное — это одежда, а не слово

    cap = r1 - r0 + 1
    if cap < h * MIN_CAP_FRACTION:
        return None  # слишком мелко для субтитра — блик или деталь одежды
    return cap, width, (lo + (r0 + r1) / 2) / h


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
