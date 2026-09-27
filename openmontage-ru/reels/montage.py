#!/usr/bin/env python3
"""Короткое вертикальное видео по описанию в JSON: от сырья до готового файла.

Раньше каждый ролик собирался пачкой одноразовых скриптов в рабочей папке.
Контейнер пересоздали — и весь конвейер пропал, уцелело только то, что
лежало в репозитории. Здесь он собран в одно место.

    python montage.py spec.json                # всё с начала
    python montage.py spec.json --from render  # переиграть с этапа

Этапы: assemble → grade → words → render → finish → check.

Что изменилось против прежних скриптов — всё про качество картинки:

* Промежуточные файлы пишутся почти без потерь (crf 10), а не crf 17-18.
  Прежде ролик проходил пять кодирований с потерями подряд.
* Remotion рендерит кадры в PNG, а не в JPEG 80 по умолчанию. Это был
  самый грубый из тех пяти шагов: сжатие каждого кадра до кодирования.
* Одно финальное кодирование в H.265, медленное и качественное (лучший
  crf, который помещается в лимит чата), с явной разметкой bt709 — иначе плееры угадывают цветовое
  пространство и иногда угадывают неверно.
* HDR с айфона (HLG, PQ) распознаётся и честно сводится в SDR. Без этого
  ffmpeg читает HLG как обычное видео, и картинка выходит серой.
* Голос отдельно обрабатывается перед сведением: срез гула ниже 80 Гц,
  мягкая компрессия. На телефонном динамике речь читается ровнее.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KIT = HERE.parent                                   # openmontage-ru/
ROOT = Path(os.environ.get("OPENMONTAGE_ROOT", "/home/user/calesthio/openmontage"))
SFX_DIR = ROOT / ".agents/skills/hyperframes-media/assets/sfx"
RIMMA = KIT / "fonts" / "RimmaSans-Bold.woff2"

OW, OH = 1080, 1920
STAGES = ("assemble", "grade", "words", "render", "finish", "check")

# Промежуточные файлы — почти без потерь: их всё равно перекодируют.
MEZZ = ["-c:v", "libx264", "-preset", "fast", "-crf", "10", "-pix_fmt", "yuv420p"]
# Единственное настоящее кодирование — в самом конце.
# H.265: на том же качестве вдвое легче H.264. Замер на ролике партии против
# эталона без потерь: H.264 crf 16 — 36.9 МиБ, 46.94 дБ; H.265 crf 18 —
# 25.0 МиБ, 46.62 дБ; H.264 crf 18 — 25.1 МиБ, 45.75 дБ. Тег hvc1 нужен,
# чтобы файл открывался на айфоне и маке.
FINAL = ["-c:v", "libx265", "-preset", "slow", "-crf", "16", "-tag:v", "hvc1",
         "-x265-params", "log-level=error", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
         "-movflags", "+faststart"]

# Цветокор v5: форма из замера по блокам (фон/объект), ослаблена к прямой
# на 0.70 по просьбе владельца канала, насыщенность 0.90, резкость 1.20.
GRADE = (
    "hqdn3d=1.0:0.8:4:4,"
    "curves=r='0/0 0.05/0.0388 0.14/0.1295 0.25/0.327 0.4/0.554 0.62/0.7705 1/0.993'"
    ":g='0/0 0.05/0.0332 0.14/0.1106 0.25/0.285 0.4/0.519 0.62/0.7565 1/1'"
    ":b='0/0.007 0.05/0.0444 0.14/0.14 0.25/0.3375 0.4/0.561 0.62/0.774 1/1',"
    "eq=saturation=0.90,"
    "unsharp=5:5:1.20:5:5:0.0"
)

# Субтитры: замеры по IMG_6561 (см. README).
CAPTION_STYLE = {
    "wordsPerPage": 1,
    "fontSize": 101,                      # капитель 82px
    "captionFontFamily": '"OM Condensed", Oswald, sans-serif',
    "captionColor": "#FFFFFF",
    "captionBackgroundColor": "transparent",
    "captionVerticalPosition": 0.679,
    "captionTextTransform": "uppercase",
    "captionScaleX": 0.788,
    "captionTextShadow": (
        "6px 6px 0 rgba(18,16,22,0.92), 0 5px 20px rgba(0,0,0,0.95), "
        "0 0 32px rgba(0,0,0,0.88), 0 0 58px rgba(0,0,0,0.68), "
        "0 0 96px rgba(0,0,0,0.42)"
    ),
    "captionDimUpcoming": False,
    "captionInstantIn": True,
    "captionMaxHoldMs": 240,
}

TITLE_INSET = 100
TITLE_MAX_W = OW - 2 * TITLE_INSET - 12
TITLE_RED = "#FD3233"

VOICE = "highpass=f=80,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=150:makeup=1.5"


# Глитчи — шум на всю полосу частот, перекрывают голос при любой громкости.
SFX_BANNED = ("glitch",)
SFX_REF_DB = -26.0      # средняя громкость pop.mp3 — опорный уровень эффектов
SFX_MAX_LEN = 1.2       # длиннее эффект не звучит: хвост ударов тянется по 2.5 с
MIN_VOICE_MARGIN = 12   # на речи эффекты должны быть тише голоса минимум на столько дБ


def _sfx_level(name: str) -> tuple[float, float]:
    f = SFX_DIR / name
    r = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-i", str(f), "-af", "volumedetect",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    mean = float(re.search(r"mean_volume: (-?[\d.]+) dB", r).group(1))
    length = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", str(f)], capture_output=True, text=True).stdout)
    return mean, length


def _voice_margin(voice_wav: Path, sfx_wav: Path, win: float = 0.1):
    import numpy as np

    def rms_db(path):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-"],
                             capture_output=True).stdout
        x = np.frombuffer(raw, np.int16).astype(float) / 32768
        n = int(16000 * win)
        k = len(x) // n
        return 20 * np.log10(np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(1)) + 1e-9)

    v, e = rms_db(voice_wav), rms_db(sfx_wav)
    k = min(len(v), len(e))
    v, e = v[:k], e[:k]
    speech = (v > -35) & (e > -70)   # речь, поверх которой звучит эффект
    margin = v[speech] - e[speech]
    bad = [(i * win, MIN_VOICE_MARGIN - (v[i] - e[i])) for i in np.where(speech)[0]
           if v[i] - e[i] < MIN_VOICE_MARGIN]
    worst = margin.min() if len(margin) else 99
    med = np.median(margin) if len(margin) else 99
    print(f"  голос над эффектами: худшее {worst:.1f} дБ (нужно ≥{MIN_VOICE_MARGIN}), "
          f"медиана {med:.1f} дБ")
    if bad:
        print("  ! эффекты громче допустимого на: " + ", ".join(f"{t:.1f}с" for t, _ in bad[:12]))
    return bad


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
         "-show_streams", str(path)], capture_output=True, text=True, check=True).stdout
    data = json.loads(out)
    v = next(s for s in data["streams"] if s["codec_type"] == "video")
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    return {"w": w, "h": h, "dur": float(data["format"]["duration"]),
            "trc": v.get("color_transfer", ""), "rot": rot}


def hdr_prefix(src: dict) -> str:
    """Свести HDR в SDR, если исходник HDR. Пустая строка — если не нужно."""
    if src["trc"] not in ("arib-std-b67", "smpte2084"):
        return ""
    return ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
            "tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,")


def _moving_zoom(src, base_w, base_h, crop_y, z0, z1, dur):
    """Плавный наезд (z1 > z0) или отъезд (z1 < z0) на протяжении куска.

    У crop размеры окна вычисляются один раз, поэтому зум делается иначе:
    каждый кадр масштабируется целиком до нужного размера, а потом из
    середины вырезается кадр 1080x1920. Кривая — косинусная: движение
    мягко разгоняется и мягко останавливается, без рывка на склейке.
    """
    x0 = (src["w"] - base_w) // 2
    y0 = (src["h"] - base_h) // 2
    k = f"(1-cos(PI*min(t/{dur:.3f},1)))/2"
    zf = f"({z0:.4f}+({z1 - z0:.4f})*{k})"
    return (f"crop={base_w}:{base_h}:{x0}:{y0},fps=30,"
            f"scale=w='trunc({OW}*{zf}/2)*2':h='trunc({OH}*{zf}/2)*2':eval=frame:flags=lanczos,"
            f"crop={OW}:{OH}:(iw-{OW})/2:(ih-{OH})*{crop_y}")


def _keyed_zoom(src, base_w, base_h, crop_y, keys):
    """Зум по ключевым точкам: [[t, z], [t, z, "punch"], ...].

    t — секунды от начала куска, z — масштаб. Переход к точке по умолчанию
    мягкий (косинус); с меткой "punch" — резкий удар: кубический выход,
    почти весь путь проходится в первой трети отрезка. Так делается наезд
    «в такт слову» — за 0.25-0.35с, а не растянутый на весь кусок дрейф,
    который глаз почти не замечает.
    """
    keys = [(float(k[0]), float(k[1]), k[2] if len(k) > 2 else "smooth") for k in keys]
    keys.sort()
    expr = f"{keys[-1][1]:.4f}"
    for (t0, z0, _), (t1, z1, kind) in reversed(list(zip(keys, keys[1:]))):
        x = f"min(max((t-{t0:.3f})/{max(t1 - t0, 0.01):.3f},0),1)"
        ease = f"(1-pow(1-{x},3))" if kind == "punch" else f"((1-cos(PI*{x}))/2)"
        expr = f"if(lt(t,{t1:.3f}),{z0:.4f}+({z1 - z0:.4f})*{ease},{expr})"
    expr = f"if(lt(t,{keys[0][0]:.3f}),{keys[0][1]:.4f},{expr})"
    x0 = (src["w"] - base_w) // 2
    y0 = (src["h"] - base_h) // 2
    return (f"crop={base_w}:{base_h}:{x0}:{y0},fps=30,"
            f"scale=w='trunc({OW}*({expr})/2)*2':h='trunc({OH}*({expr})/2)*2':eval=frame:flags=lanczos,"
            f"crop={OW}:{OH}:(iw-{OW})/2:(ih-{OH})*{crop_y}")


# ─────────────────────────────── этапы ────────────────────────────────

def stage_assemble(spec, out: Path):
    src_path = Path(spec["source"])
    src = probe(src_path)
    tone = hdr_prefix(src)
    print(f"исходник {src['w']}x{src['h']}, {src['dur']:.1f}с"
          + (f", HDR ({src['trc']}) → SDR" if tone else ", SDR"))
    crop_y = float(spec.get("crop_y", 0.35))
    parts, total = [], 0.0
    for i, cut in enumerate(spec["cuts"]):
        a, b, z = float(cut["a"]), float(cut["b"]), float(cut.get("zoom", 1.0))
        base_w = min(src["w"], int(src["h"] * 9 / 16))
        base_h = int(base_w * 16 / 9)
        if "keys" in cut:
            vf = tone + _keyed_zoom(src, base_w, base_h, crop_y, cut["keys"])
        elif "zoom_to" in cut:
            vf = tone + _moving_zoom(src, base_w, base_h, crop_y,
                                     float(cut.get("zoom_from", z)), float(cut["zoom_to"]), b - a)
        else:
            # Кроп под 9:16 по центру; при зуме окно уменьшается и чуть поднято.
            cw, ch = int(base_w / z) // 2 * 2, int(base_h / z) // 2 * 2
            x = (src["w"] - cw) // 2
            y = int((src["h"] - ch) * crop_y)
            vf = f"{tone}crop={cw}:{ch}:{x}:{y},scale={OW}:{OH}:flags=lanczos,fps=30"
        p = out / f"cut_{i:02d}.mp4"
        run(["ffmpeg", "-y", "-v", "error", "-ss", str(a), "-to", str(b), "-i", str(src_path),
             "-vf", vf, *MEZZ, "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
             str(p.with_suffix(".mov"))])
        parts.append(p.with_suffix(".mov"))
        total += b - a
        if "keys" in cut:
            zoom_txt = "→".join(f"{k[1]:.2f}{'!' if len(k) > 2 else ''}" for k in cut["keys"])
        elif "zoom_to" in cut:
            zoom_txt = f"{float(cut.get('zoom_from', z)):.2f}→{float(cut['zoom_to']):.2f}"
        else:
            zoom_txt = f"{z:.2f}"
        print(f"  [{i}] {a:7.2f}–{b:7.2f}  зум {zoom_txt:9s} {cut.get('label', '')}")
    (out / "concat.txt").write_text("".join(f"file '{p.name}'\n" for p in parts))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", str(out / "concat.txt"), "-c", "copy", str(out / "rough.mov")])
    run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "rough.mov"),
         "-vn", "-ac", "1", "-ar", "16000", str(out / "rough.wav")])
    print(f"черновой монтаж {total:.2f}с")


def stage_grade(spec, out: Path):
    grade = spec.get("grade", GRADE)
    run(["ffmpeg", "-y", "-v", "error", "-i", str(out / "rough.mov"),
         "-vf", grade, *MEZZ, "-c:a", "copy", str(out / "graded.mov")])
    print("цветокор готов")


def stage_words(spec, out: Path):
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(out / "rough.wav"), language="ru", word_timestamps=True,
                               beam_size=5, condition_on_previous_text=False)
    segments = []
    for s in segs:
        words = [{"word": re.sub(r"[.,!?;:—–-]+$", "", w.word.strip()),
                  "start": round(w.start, 2), "end": round(w.end, 2)} for w in (s.words or [])]
        segments.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                         "words": [w for w in words if w["word"]]})

    fixes = spec.get("fixes", {})
    # Отдельные слова, которые Whisper слышит неверно: «хранить» → «хоронить».
    words_map = {k.lower(): v for k, v in fixes.get("words", {}).items()}
    for s in segments:
        for w in s["words"]:
            if w["word"].lower() in words_map:
                w["word"] = words_map[w["word"].lower()]
    # Пары токенов: «результат»+«-то», «со»+«зуба» → одно слово.
    pairs = {(a.lower(), b.lower()): c for a, b, c in fixes.get("pairs", [])}
    for s in segments:
        ws, new, i = s["words"], [], 0
        while i < len(ws):
            if i + 1 < len(ws):
                key = (ws[i]["word"].lower(), ws[i + 1]["word"].lower())
                if key in pairs:
                    new.append({"word": pairs[key], "start": ws[i]["start"], "end": ws[i + 1]["end"]})
                    i += 2
                    continue
            new.append(ws[i])
            i += 1
        s["words"] = new
    # Целая фраза, которую общий прогон слышит неустойчиво: заменить слова,
    # разложив их по той же длительности пропорционально длине.
    for fix in fixes.get("phrases", []):
        for s in segments:
            if fix["contains"].lower() in s["text"].lower() and s["words"]:
                a, b = s["words"][0]["start"], s["words"][-1]["end"]
                tot = sum(len(w) for w in fix["words"])
                t, new = a, []
                for w in fix["words"]:
                    d = (b - a) * len(w) / tot
                    new.append({"word": w, "start": round(t, 2), "end": round(t + d, 2)})
                    t += d
                s["words"], s["text"] = new, " ".join(fix["words"])
    (out / "segments.json").write_text(json.dumps(segments, ensure_ascii=False, indent=1),
                                       encoding="utf-8")
    for s in segments:
        print(f"  [{s['start']:6.2f}–{s['end']:6.2f}] {s['text']}")


def _fit_title(lines, sizes, tracks):
    from fontTools.ttLib import TTFont
    font = TTFont(str(RIMMA))
    upm, cmap, hmtx = font["head"].unitsPerEm, font.getBestCmap(), font["hmtx"]

    def width(text, size, track):
        adv = sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap)
        return adv / upm * size + max(len(text) - 1, 0) * track * size

    fitted = []
    for text, size, track in zip(lines, sizes, tracks):
        s = size
        while s > 8 and width(text, s, track) > TITLE_MAX_W:
            s -= 1
        fitted.append(s)
        print(f"  титр «{text}»: {size}→{s}px ({width(text, s, track):.0f}/{TITLE_MAX_W}px)")
    ratio = fitted[1] / fitted[0] if len(fitted) > 1 else 1
    if len(fitted) > 1 and ratio > 0.85:
        print(f"  ! строки почти одного размера ({ratio:.2f}); в образце 0.72 — "
              f"первую строку стоит укоротить")
    return fitted


def stage_render(spec, out: Path):
    sys.path.insert(0, str(ROOT))
    os.environ.setdefault("REMOTION_BROWSER_EXECUTABLE", "/opt/pw-browsers/chromium")
    from fontTools.ttLib import TTFont
    from tools.video.remotion_caption_burn import RemotionCaptionBurn

    segments = json.loads((out / "segments.json").read_text(encoding="utf-8"))
    title = spec["title"]
    title_out = float(title["out"])
    # Пока на экране титр, субтитры не нужны.
    for s in segments:
        s["words"] = [w for w in s["words"] if w["start"] >= title_out]
    segments = [s for s in segments if s["words"]]

    cap = TTFont(str(RIMMA))["OS/2"].sCapHeight / TTFont(str(RIMMA))["head"].unitsPerEm
    wanted = [round(74 / cap), round(53 / cap)]          # капители титра в образце
    tracks = [0.0, float(title.get("track", 0.13))]
    sizes = _fit_title(title["lines"], wanted, tracks)

    style = dict(CAPTION_STYLE)
    style["hookTitle"] = {
        "in_seconds": 0.12, "out_seconds": title_out, "top": 0.055, "align": "left",
        "inset": TITLE_INSET, "strokeWidth": 7, "fontWeight": 700,
        "lines": [
            {"text": title["lines"][0], "delay": 0.0, "fontSize": sizes[0], "color": TITLE_RED},
            {"text": title["lines"][1], "delay": 0.34, "fontSize": sizes[1],
             "letterSpacing": f"{tracks[1]}em"},
        ],
    }
    res = RemotionCaptionBurn().execute({
        "input_path": str(out / "graded.mov"),
        "output_path": str(out / "captioned.mp4"),
        "segments": segments, "corrections": {}, "caption_style": style,
        "words_per_page": 1, "font_size": style["fontSize"], "highlight_color": "#FFFFFF",
        "overlays": [],
        "render_quality": {"image_format": "png", "crf": 10},
    })
    if not res.success:
        raise SystemExit(f"рендер упал: {res.error}")
    print(f"  {res.data.get('caption_count')} субтитров")


def _make_chip(text: str, path: Path):
    from fontTools.ttLib import TTFont
    from PIL import Image, ImageDraw, ImageFont
    ttf = path.with_suffix(".ttf")
    f = TTFont(str(RIMMA)); f.flavor = None; f.save(str(ttf))
    font = ImageFont.truetype(str(ttf), 56)
    W, H, R = 560, 132, 66
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, H - 1], R, fill=255)
    grad = Image.new("RGBA", (W, H))
    px = grad.load()
    for y in range(H):
        t = y / H
        a, v = int(78 * (1 - t) + 26 * t), int(255 * (1 - t) + 214 * t)
        for x in range(W):
            px[x, y] = (v, v, 255, a)
    chip = Image.composite(grad, Image.new("RGBA", (W, H), (0, 0, 0, 0)), mask)
    edge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.rounded_rectangle([1, 1, W - 2, H - 2], R, outline=(255, 255, 255, 150), width=2)
    ed.arc([1, 1, W - 2, H - 2], 190, 350, fill=(255, 255, 255, 205), width=3)
    chip = Image.alpha_composite(chip, edge)
    d = ImageDraw.Draw(chip)
    bb = d.textbbox((0, 0), text, font=font)
    tx, ty = (W - (bb[2] - bb[0])) // 2 - bb[0], (H - (bb[3] - bb[1])) // 2 - bb[1]
    d.text((tx + 2, ty + 2), text, font=font, fill=(10, 8, 14, 120))
    d.text((tx, ty), text, font=font, fill=(255, 255, 255, 245))
    chip.save(path)


def stage_finish(spec, out: Path):
    src = out / "captioned.mp4"
    dur = probe(src)["dur"]
    fade_at = max(0.0, dur - 0.16)

    inputs = ["-i", str(src)]
    fc, vlabel = [], "0:v"
    chip = spec.get("chip")
    if chip:
        png = out / "chip.png"
        _make_chip(chip.get("text", "ЧТО ДЕЛАТЬ"), png)
        at, cd = float(chip["at"]), float(chip.get("dur", 1.7))
        inputs += ["-loop", "1", "-t", f"{dur:.3f}", "-i", str(png)]
        fc.append(f"[1:v]format=rgba,fade=in:st={at:.2f}:d=0.22:alpha=1,"
                  f"fade=out:st={at + cd - 0.30:.2f}:d=0.30:alpha=1[chip]")
        fc.append(f"[0:v][chip]overlay=x=260:y=300:enable='between(t,{at:.2f},{at + cd:.2f})'[vc]")
        vlabel = "vc"
    # Анимированные вставки (inserts.py): каждая рисуется в прозрачный ролик,
    # сдвигается во времени и кладётся поверх; звук к ней добавляется сам.
    sys.path.insert(0, str(HERE))
    import inserts as ins
    auto_sfx = []
    for k, item in enumerate(spec.get("inserts", [])):
        at, dur = float(item["at"]), float(item["dur"])
        mov = ins.render(item, out / f"ins_{k:02d}.mov")
        idx = inputs.count("-i")
        inputs += ["-i", str(mov)]
        y = int(item.get("y", 230))
        fc.append(f"[{idx}:v]format=rgba,setpts=PTS+{at:.3f}/TB[ins{k}]")
        fc.append(f"[{vlabel}][ins{k}]overlay=x=(W-w)/2:y={y}:eof_action=pass:"
                  f"enable='between(t,{at:.3f},{at + dur:.3f})'[vi{k}]")
        vlabel = f"vi{k}"
        kind = item["type"]
        # sfx_gain — множитель громкости звуков этой вставки (0 — без звука).
        g = float(item.get("sfx_gain", 1.0))
        if kind == "list":
            auto_sfx += [["pop.mp3", at + o, 0.40 * g] for o in item["offsets"]]
        else:
            auto_sfx.append(["pop.mp3", at, 0.42 * g])
        if kind == "strike":
            auto_sfx.append(["error.mp3", at + 0.35, 0.26 * g])
        elif kind == "check":
            auto_sfx.append(["ping.mp3", at + 0.20, 0.28 * g])
        elif kind == "counter":
            auto_sfx.append(["ping.mp3", at + float(item.get("run", 0.7)), 0.28 * g])
        auto_sfx = [x for x in auto_sfx if x[2] > 0]
        print(f"  вставка {kind:8s} {at:6.2f}с  {item.get('text') or item.get('items') or item.get('to')}")
    fc.append(f"[{vlabel}]fade=t=out:st={fade_at:.2f}:d=0.16[vout]")

    sfx = [["whoosh-short.mp3", 0.10, 0.45], ["impact-bass-1.mp3", 0.26, 0.45]]
    sfx += spec.get("sfx", []) + auto_sfx
    kept = []
    for name, at, vol in sfx:
        if name.startswith(SFX_BANNED):
            print(f"  ! {name} запрещён (глушит голос) — пропускаю")
            continue
        kept.append((name, float(at), float(vol)))
    # Номер следующего входа — по числу "-i", а не по длине списка: у плашки
    # перед "-i" стоят ещё "-loop 1 -t ...".
    base = inputs.count("-i")
    for name, _, _ in kept:
        inputs += ["-i", str(SFX_DIR / name)]

    def audio_graph(stems: bool) -> list[str]:
        g = []
        labels = []
        for n, (name, at, vol) in enumerate(kept):
            # Файлы библиотеки разной громкости (удар баса в 20 дБ громче
            # щелчка), поэтому каждый приводится к средней громкости щелчка,
            # а vol — множитель поверх. Длинные хвосты обрезаются.
            mean_db, length = _sfx_level(name)
            gain = min(0.0, SFX_REF_DB - mean_db) + 20 * math.log10(max(vol, 1e-4))
            cap = min(SFX_MAX_LEN, length)
            ms = int(at * 1000)
            g.append(f"[{base + n}:a]aresample=48000,atrim=0:{cap:.2f},afade=t=out:st={max(cap - 0.3, 0):.2f}:d=0.3,"
                     f"volume={gain:.1f}dB,adelay={ms}|{ms}[s{n}]")
            labels.append(f"[s{n}]")
        # Голос нормализуется отдельно, до смешивания, поэтому эффекты не
        # влияют на его громкость. Эффекты сводятся в шину и сильно
        # прижимаются голосом (sidechain): пока человек говорит, их почти нет.
        split = 3 if stems else 2
        outs = "[voice][vkey][vstem]" if stems else "[voice][vkey]"
        # loudnorm отдаёт 192 кГц; без aresample шина эффектов считает длину
        # не в тех отсчётах, и ролик обрезается на последнем эффекте.
        g.append(f"[0:a]{VOICE},loudnorm=I=-14:TP=-2:LRA=11,aresample=48000,asplit={split}{outs}")
        # apad: шина эффектов короче голоса, а sidechain и amix обрезают всё
        # по самому короткому входу — без добивки тишиной ролик укорачивается.
        g.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,"
                 f"apad=whole_dur={dur + 0.5:.2f}[sfxbus]")
        g.append("[sfxbus][vkey]sidechaincompress=threshold=0.01:ratio=12:attack=4:release=220"
                 + (",asplit=2[sfxd][sstem]" if stems else "[sfxd]"))
        g.append(f"[voice][sfxd]amix=inputs=2:normalize=0:duration=first,"
                 f"alimiter=limit=0.85:level=false,afade=t=out:st={fade_at:.2f}:d=0.16[aout]")
        return g

    # Проверка «голос в приоритете»: отдельно пишем голос и эффекты и
    # смотрим, насколько эффекты тише голоса там, где идёт речь.
    # Если где-то эффект слишком громкий, он приглушается ровно на недостающие
    # дБ (с запасом) и проверка повторяется: голос всегда главнее.
    for attempt in range(4):
        run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(audio_graph(True)),
             "-map", "[vstem]", "-ac", "1", "-ar", "16000", str(out / "stem_voice.wav"),
             "-map", "[sstem]", "-ac", "1", "-ar", "16000", str(out / "stem_sfx.wav"),
             "-map", "[aout]", "-f", "null", "-"])
        bad = _voice_margin(out / "stem_voice.wav", out / "stem_sfx.wav")
        if not bad:
            break
        for n, (name, at, vol) in enumerate(kept):
            end = at + min(SFX_MAX_LEN, _sfx_level(name)[1])
            need = max((d for t, d in bad if at - 0.1 <= t <= end), default=0)
            if need > 0:
                vol *= 10 ** (-(need + 2) / 20)
                kept[n] = (name, at, vol)
                print(f"    приглушаю {name} на {at:.2f}с ещё на {need + 2:.1f} дБ")
    fc += audio_graph(False)

    final = out / "final.mp4"
    # Готовый файл уходит в чат, а там лимит 30 МиБ. Берём лучшее качество,
    # которое в него влезает: начинаем с crf 16 и поднимаем, пока не влезет.
    max_bytes = float(spec.get("max_mb", 29)) * 1024 * 1024
    crf = int(spec.get("final_crf", 16))
    while True:
        enc = list(FINAL)
        enc[enc.index("-crf") + 1] = str(crf)
        run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(fc),
             "-map", "[vout]", "-map", "[aout]", *enc, "-c:a", "aac", "-b:a", "256k",
             "-ar", "48000", "-shortest", str(final)])
        size = final.stat().st_size
        if size <= max_bytes or crf >= 24:
            break
        # Каждая ступень crf у x265 даёт примерно x0.84 к размеру — прыгаем
        # сразу на нужную, а не перебираем по одной: медленный пресет дорог.
        step = max(1, math.ceil(math.log(size / max_bytes) / math.log(1 / 0.84)))
        print(f"  crf {crf}: {size / 1048576:.1f} МиБ — больше лимита, пробую crf {crf + step}")
        crf += step
    info = probe(final)
    if info["dur"] < dur - 0.25:
        raise SystemExit(f"итог {info['dur']:.2f}с короче монтажа {dur:.2f}с — что-то обрезало звук")
    rate = size * 8 / info["dur"] / 1e6
    print(f"  {final}: {info['w']}x{info['h']}, {info['dur']:.2f}с, crf {crf}, "
          f"{size / 1048576:.1f} МиБ ({rate:.1f} Мбит/с)")


def stage_check(spec, out: Path):
    py = sys.executable
    ok = True
    # Хвост проверяем по чистому голосу (rough.wav): в итоговом файле отзвук
    # эффектов (удар, звоночек) принимается за речь и даёт ложное «обрезано».
    for cmd in ([py, str(HERE / "tail_check.py"), str(out / "rough.wav"), "--min-tail", "0.3"],
                [py, str(HERE / "caption_spec.py"), "check", str(out / "final.mp4"),
                 "--position", "0.679", "--cap", "82"]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(r.stdout.rstrip())
        ok &= r.returncode == 0
    print("ПРОВЕРКИ ПРОЙДЕНЫ" if ok else "ЕСТЬ ЗАМЕЧАНИЯ — см. выше")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", type=Path)
    ap.add_argument("--from", dest="start", choices=STAGES, default="assemble")
    ap.add_argument("--only", choices=STAGES)
    args = ap.parse_args()
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    base = args.spec.parent
    spec["source"] = str((base / spec["source"]).resolve())
    out = (base / spec.get("out", "out")).resolve()
    out.mkdir(parents=True, exist_ok=True)

    todo = [args.only] if args.only else STAGES[STAGES.index(args.start):]
    for st in todo:
        print(f"\n── {st} ──")
        globals()[f"stage_{st}"](spec, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
