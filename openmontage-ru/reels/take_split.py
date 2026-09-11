#!/usr/bin/env python3
"""Разрезать сырую запись на дубли и распознать каждый отдельно.

Зачем отдельно. Если отдать faster-whisper всю запись целиком, на длинных
паузах и повторах он зацикливается: возвращает одну и ту же фразу десятки
раз подряд, а тайминги слов растягивает на всю тишину. На реальном материале
(172 секунды, где спикер переснимает каждую реплику по три-четыре раза) это
превращает расшифровку в кашу.

Разрез по тишине снимает обе проблемы разом: каждый дубль — отдельный запрос,
контекст не тянется между ними, и список блоков сам по себе оказывается
списком дублей, из которого монтажёр выбирает лучший.

    python take_split.py source.mov -o takes.json
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def probe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True).stdout.strip()
    return float(out)


def extract_audio(src: Path, dst: Path) -> None:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
                    "-vn", "-ac", "1", "-ar", "16000", str(dst)], check=True)


def silences(wav: Path, noise_db: int, min_silence: float) -> list[tuple[float, float]]:
    log = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(wav),
         "-af", f"silencedetect=noise={noise_db}dB:d={min_silence}", "-f", "null", "-"],
        capture_output=True, text=True).stderr
    spans, start = [], None
    for m in re.finditer(r"silence_(start|end): ([\d.]+)", log):
        kind, t = m.group(1), float(m.group(2))
        if kind == "start":
            start = t
        elif start is not None:
            spans.append((start, t))
            start = None
    return spans


def blocks_from(spans, duration: float, gap: float, min_take: float):
    """Речь — это дополнение к тишине, но дубль рвёт только длинная пауза."""
    out, cursor = [], 0.0
    for s, e in spans:
        if e - s >= gap:
            if s - cursor > min_take:
                out.append((cursor, s))
            cursor = e
    if duration - cursor > min_take:
        out.append((cursor, duration))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("takes.json"))
    ap.add_argument("--model", default="large-v3")
    ap.add_argument("--language", default="ru")
    ap.add_argument("--gap", type=float, default=1.0,
                    help="пауза от скольких секунд считается границей дубля")
    ap.add_argument("--min-take", type=float, default=0.6)
    ap.add_argument("--noise-db", type=int, default=-32)
    ap.add_argument("--pad", type=float, default=0.25, help="запас на вдох по краям")
    args = ap.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"нет файла: {args.input}")

    wav = args.output.with_suffix(".wav")
    extract_audio(args.input, wav)
    duration = probe_duration(wav)
    takes = blocks_from(silences(wav, args.noise_db, 0.45), duration,
                        args.gap, args.min_take)
    if not takes:
        raise SystemExit("речь не найдена — проверьте --noise-db")
    print(f"{len(takes)} дублей в {duration:.1f}с\n", flush=True)

    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    result = []
    for i, (s, e) in enumerate(takes):
        a, b = max(0.0, s - args.pad), min(duration, e + args.pad)
        clip = args.output.with_name(f".take_{i:02d}.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(a), "-to", str(b),
                        "-i", str(wav), "-c", "copy", str(clip)], check=True)
        segs, _ = model.transcribe(str(clip), language=args.language,
                                   word_timestamps=True, beam_size=5,
                                   condition_on_previous_text=False)
        words, text = [], []
        for seg in segs:
            text.append(seg.text.strip())
            for w in (seg.words or []):
                words.append({"word": w.word.strip(),
                              "start": round(a + w.start, 2),
                              "end": round(a + w.end, 2),
                              "probability": round(w.probability, 3)})
        entry = {"index": i, "start": round(a, 2), "end": round(b, 2),
                 "duration": round(b - a, 2), "text": " ".join(text), "words": words}
        result.append(entry)
        print(f"[{i:02d}] {a:7.2f}–{b:7.2f} ({b-a:5.2f}с)  {entry['text']}", flush=True)
        clip.unlink()

    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=1),
                           encoding="utf-8")
    print(f"\n-> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
