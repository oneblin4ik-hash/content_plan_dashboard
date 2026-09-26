#!/usr/bin/env python3
"""Анимированные вставки в стеклянном стиле канала.

Каждая вставка рисуется покадрово (PIL, 30 fps, суперсэмплинг x2 для
гладких краёв) в прозрачный ролик и накладывается в montage.py поверх
видео в нужный момент. Звук к вставке подставляется там же.

Типы:
  pop      плашка выпрыгивает с отдачей              звук pop
  strike   фраза перечёркивается красной линией      звук error — для мифов
  check    рисуется галочка перед фразой             звук ping — для верного ответа
  list     пункты выскакивают по одному              звук click-soft на каждый
  counter  число бежит до значения                   звук ping в конце
"""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30
SS = 2                      # суперсэмплинг
KIT = Path(__file__).resolve().parent.parent
RIMMA = KIT / "fonts" / "RimmaSans-Bold.woff2"
RED = (253, 50, 51)
GREEN = (72, 214, 120)

SOUND = {"pop": "pop.mp3", "strike": "error.mp3", "check": "ping.mp3",
         "list": "click-soft.mp3", "counter": "ping.mp3"}


def _font(size: int) -> ImageFont.FreeTypeFont:
    ttf = Path("/tmp") / "rimma_insert.ttf"
    if not ttf.exists():
        from fontTools.ttLib import TTFont
        f = TTFont(str(RIMMA)); f.flavor = None; f.save(str(ttf))
    return ImageFont.truetype(str(ttf), size)


# ── кривые ────────────────────────────────────────────────────────────
def back_out(x: float) -> float:
    """Выход с перелётом: 0 → чуть больше 1 → 1."""
    x = min(max(x, 0.0), 1.0)
    c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_out(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def ease_in(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x ** 3


# ── стеклянная плашка ─────────────────────────────────────────────────
def glass(w: int, h: int, r: int) -> Image.Image:
    """Полупрозрачный градиент, светлая грань и блик сверху — как у плашки."""
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    grad = Image.new("RGBA", (w, h))
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        a, v = int(84 * (1 - t) + 30 * t), int(255 * (1 - t) + 214 * t)
        col.putpixel((0, y), (v, v, 255, a))
    grad = col.resize((w, h))
    out = Image.composite(grad, Image.new("RGBA", (w, h), (0, 0, 0, 0)), mask)
    edge = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.rounded_rectangle([1, 1, w - 2, h - 2], r, outline=(255, 255, 255, 150), width=2 * SS)
    ed.arc([1, 1, w - 2, h - 2], 190, 350, fill=(255, 255, 255, 205), width=3 * SS)
    return Image.alpha_composite(out, edge)


def text_block(text: str, size: int, color=(255, 255, 255)) -> tuple[Image.Image, tuple[int, int]]:
    font = _font(size * SS)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bb = probe.textbbox((0, 0), text, font=font)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    img = Image.new("RGBA", (w + 8 * SS, h + 8 * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((4 * SS + 2 * SS - bb[0], 4 * SS + 2 * SS - bb[1]), text, font=font, fill=(10, 8, 14, 130))
    d.text((4 * SS - bb[0], 4 * SS - bb[1]), text, font=font, fill=color + (245,))
    return img, (w, h)


def pill(text: str, size: int = 56, pad_x: int = 48, pad_y: int = 30,
         lead: Image.Image | None = None) -> Image.Image:
    """Плашка по размеру текста; lead — значок слева (галочка и т.п.)."""
    txt, (tw, th) = text_block(text, size)
    lead_w = (lead.width + 18 * SS) if lead is not None else 0
    w = tw + lead_w + 2 * pad_x * SS
    h = th + 2 * pad_y * SS
    card = glass(w, h, h // 2)
    x = pad_x * SS
    if lead is not None:
        card.alpha_composite(lead, (x, (h - lead.height) // 2))
        x += lead_w
    card.alpha_composite(txt, (x - 4 * SS, (h - txt.height) // 2))
    return card


def place(canvas: Image.Image, card: Image.Image, scale: float, alpha: float):
    """Вставить карточку по центру холста с масштабом и прозрачностью."""
    if scale <= 0.01 or alpha <= 0.01:
        return
    w, h = max(1, int(card.width * scale)), max(1, int(card.height * scale))
    c = card.resize((w, h), Image.LANCZOS)
    if alpha < 1:
        a = c.getchannel("A").point(lambda v: int(v * alpha))
        c.putalpha(a)
    canvas.alpha_composite(c, ((canvas.width - w) // 2, (canvas.height - h) // 2))


def pop_envelope(t: float, dur: float) -> tuple[float, float]:
    """Масштаб и прозрачность: выпрыгнуть за 0.24с, в конце уйти за 0.18с."""
    if t < 0.24:
        x = t / 0.24
        return 0.55 + 0.45 * back_out(x), ease_out(x * 1.6)
    if t > dur - 0.18:
        x = (t - (dur - 0.18)) / 0.18
        return 1 - 0.12 * ease_in(x), 1 - ease_in(x)
    return 1.0, 1.0


# ── типы вставок ─────────────────────────────────────────────────────
def frames_pop(spec, W, H):
    card = pill(spec["text"], spec.get("size", 58))
    dur = spec["dur"]
    for i in range(int(dur * FPS)):
        t = i / FPS
        s, a = pop_envelope(t, dur)
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(fr, card, s, a)
        yield fr


def frames_strike(spec, W, H):
    """Плашка с фразой, через 0.35с её перечёркивает красная линия."""
    base = pill(spec["text"], spec.get("size", 58))
    dur = spec["dur"]
    y = base.height // 2
    x0, x1 = 30 * SS, base.width - 30 * SS
    for i in range(int(dur * FPS)):
        t = i / FPS
        s, a = pop_envelope(t, dur)
        card = base.copy()
        k = ease_out((t - 0.35) / 0.28)
        if k > 0:
            d = ImageDraw.Draw(card)
            xe = x0 + (x1 - x0) * k
            d.line([(x0, y + 3 * SS), (xe, y - 3 * SS)], fill=RED + (255,), width=9 * SS)
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(fr, card, s, a)
        yield fr


def _check_icon(k: float, size: int = 44) -> Image.Image:
    """Зелёный круг и галочка, прорисованная на долю k."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, S - 1, S - 1], fill=GREEN + (255,))
    p1, p2, p3 = (S * 0.26, S * 0.53), (S * 0.43, S * 0.70), (S * 0.75, S * 0.33)
    l1 = math.dist(p1, p2); l2 = math.dist(p2, p3); L = (l1 + l2) * k
    if L > 0:
        e = p2 if L >= l1 else (p1[0] + (p2[0] - p1[0]) * L / l1, p1[1] + (p2[1] - p1[1]) * L / l1)
        d.line([p1, e], fill=(255, 255, 255, 255), width=int(5.5 * SS))
    if L > l1:
        r = (L - l1) / l2
        e = (p2[0] + (p3[0] - p2[0]) * r, p2[1] + (p3[1] - p2[1]) * r)
        d.line([p2, e], fill=(255, 255, 255, 255), width=int(5.5 * SS))
    return img


def frames_check(spec, W, H):
    dur = spec["dur"]
    for i in range(int(dur * FPS)):
        t = i / FPS
        s, a = pop_envelope(t, dur)
        card = pill(spec["text"], spec.get("size", 58), lead=_check_icon(ease_out((t - 0.18) / 0.3)))
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(fr, card, s, a)
        yield fr


def frames_list(spec, W, H):
    """Пункты друг под другом; каждый выпрыгивает в своё время (offsets, с)."""
    items, offs, dur = spec["items"], spec["offsets"], spec["dur"]
    cards = [pill(t, spec.get("size", 50), pad_y=22) for t in items]
    gap = 18 * SS
    total_h = sum(c.height for c in cards) + gap * (len(cards) - 1)
    for i in range(int(dur * FPS)):
        t = i / FPS
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        y = (H - total_h) // 2
        for c, o in zip(cards, offs):
            local = t - o
            if local >= 0:
                s, a = pop_envelope(local, dur - o)
                w, h = max(1, int(c.width * s)), max(1, int(c.height * s))
                cc = c.resize((w, h), Image.LANCZOS)
                if a < 1:
                    cc.putalpha(cc.getchannel("A").point(lambda v, a=a: int(v * a)))
                fr.alpha_composite(cc, ((W - w) // 2, y + (c.height - h) // 2))
            y += c.height + gap
        yield fr


def frames_counter(spec, W, H):
    """Число бежит от from до to за run секунд, дальше стоит."""
    dur, run = spec["dur"], spec.get("run", 0.7)
    a0, a1 = spec.get("from", 0), spec["to"]
    suffix = spec.get("suffix", "")
    for i in range(int(dur * FPS)):
        t = i / FPS
        s, a = pop_envelope(t, dur)
        n = round(a0 + (a1 - a0) * ease_out(t / run))
        card = pill(f"{n}{suffix}", spec.get("size", 66))
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(fr, card, s, a)
        yield fr


RENDER = {"pop": frames_pop, "strike": frames_strike, "check": frames_check,
          "list": frames_list, "counter": frames_counter}


def render(spec: dict, out: Path, width: int = 1000, height: int = 360) -> Path:
    """Отрисовать вставку в прозрачный ролик (mov/png с альфой)."""
    W, H = width * SS, height * SS
    if spec["type"] == "list":
        H = max(H, 150 * SS * len(spec["items"]))
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-vf", f"scale={W // SS}:{H // SS}:flags=lanczos",
         "-c:v", "png", "-pix_fmt", "rgba", str(out)],
        stdin=subprocess.PIPE)
    for fr in RENDER[spec["type"]](spec, W, H):
        proc.stdin.write(fr.tobytes())
    proc.stdin.close()
    proc.wait()
    return out


if __name__ == "__main__":
    import json, sys
    demo = [
        {"type": "pop", "text": "30 МИНУТ", "dur": 1.6},
        {"type": "strike", "text": "2 ЧАСА В ЗАЛЕ", "dur": 1.8},
        {"type": "check", "text": "ПРОГРЕССИЯ", "dur": 1.6},
        {"type": "list", "items": ["БАЗА", "ИНТЕНСИВНОСТЬ", "ПРОГРЕССИЯ"], "offsets": [0, 0.35, 0.7], "dur": 2.2},
        {"type": "counter", "to": 30, "suffix": " МИН", "dur": 1.6},
    ]
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/inserts_demo")
    outdir.mkdir(parents=True, exist_ok=True)
    for d in demo:
        p = render(d, outdir / f"{d['type']}.mov")
        print(p)
