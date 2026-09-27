#!/usr/bin/env python3
"""Проверить, что ролик не обрывает последнее слово.

Ошибка повторялась трижды подряд, и каждый раз её замечали уже на готовом
файле. Причина устойчивая: Whisper растягивает последнее слово фразы на
следующую за ней паузу, поэтому по его таймингам речь кажется короче, чем
есть, и хвост подрезается «с запасом», которого нет.

Мерить надо по голосу, а не по общей громкости: басовый удар или музыка на
финале держат уровень и маскируют то, что речь уже кончилась. Отсюда
фильтр высоких частот перед замером.

    python tail_check.py out.mp4 --min-tail 0.4
"""

from __future__ import annotations

import argparse
import subprocess
import sys

import numpy as np


def duration(path: str) -> float:
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout)


def voice_end(path: str, window: float, highpass: int, floor_db: float) -> float | None:
    """Момент последнего звука голоса, в секундах от начала файла."""
    total = duration(path)
    start = max(0.0, total - window)
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(start), "-i", path,
         "-af", f"highpass=f={highpass}", "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
        capture_output=True).stdout
    if not raw:
        return None
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    step = 800  # 50 мс
    frames = len(x) // step
    if frames == 0:
        return None
    db = np.array([
        20 * np.log10(np.sqrt((x[i * step:(i + 1) * step] ** 2).mean() + 1e-12) + 1e-9)
        for i in range(frames)
    ])
    voiced = np.where(db > floor_db)[0]
    if len(voiced) == 0:
        return None
    return start + (voiced[-1] + 1) * (step / 16000)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--min-tail", type=float, default=0.4,
                    help="сколько тишины должно остаться после речи, с")
    ap.add_argument("--window", type=float, default=8.0,
                    help="сколько секунд с конца просматривать")
    ap.add_argument("--highpass", type=int, default=350,
                    help="срез низов, Гц: отсекает бас-эффекты")
    ap.add_argument("--floor-db", type=float, default=-46.0)
    args = ap.parse_args()

    total = duration(args.video)
    end = voice_end(args.video, args.window, args.highpass, args.floor_db)
    if end is None:
        print(f"{args.video}: голоса в последних {args.window:g}с не найдено")
        return 0

    tail = total - end
    print(f"{args.video}")
    print(f"  длительность      {total:7.2f}с")
    print(f"  голос кончается   {end:7.2f}с")
    print(f"  хвост тишины      {tail:7.2f}с  (нужно {args.min_tail:g})")
    if tail < args.min_tail:
        print(f"  ОБРЕЗАНО: удлините последний кусок на {args.min_tail - tail + 0.1:.2f}с")
        return 1
    print("  хвост чистый")
    return 0


if __name__ == "__main__":
    sys.exit(main())
