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
  stack    карточка-список слева, пункты выезжают     звук click-soft на каждый
  stamp    красный штамп с ударом и дрожью             звук pop (громче)
  cta      призыв в карточке со светящейся рамкой     звук ping
  label    ярлык + заголовок над карточкой видео      без звука
"""

from __future__ import annotations

import math
import subprocess
import tempfile
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
    ttf = Path(tempfile.gettempdir()) / "rimma_insert.ttf"
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


# ── новый стиль (ролик 6): редакционные карточки ─────────────────────
# Вдохновлено шортсами с «дорогим» монтажом: левое выравнивание, тёмное
# матовое стекло, красные акценты, узкий Oswald для пунктов, Inter для
# подписей, мягкая тень, движение «выезд + проявление» вместо «прыжка».
FONTS = KIT / "fonts"


def _ttf(name: str, size: int) -> ImageFont.FreeTypeFont:
    ttf = Path(tempfile.gettempdir()) / f"ins_{name}.ttf"
    if not ttf.exists():
        from fontTools.ttLib import TTFont
        f = TTFont(str(FONTS / f"{name}.woff2")); f.flavor = None; f.save(str(ttf))
    return ImageFont.truetype(str(ttf), size)


_CMAPS: dict[str, set] = {}
FALLBACK = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def _covered(font) -> set:
    if font.path not in _CMAPS:
        from fontTools.ttLib import TTFont
        _CMAPS[font.path] = set(TTFont(font.path).getBestCmap())
    return _CMAPS[font.path]


def _glyph_font(font, ch):
    """В наборе кириллические woff2 без цифр и знаков: сначала берём латинский
    файл того же шрифта (fonts/<Имя>-latin.woff2), и только потом запасной."""
    if ord(ch) in _covered(font):
        return font
    name = Path(font.path).stem.replace("ins_", "")
    latin = FONTS / f"{name}-latin.woff2"
    if latin.exists():
        lf = _ttf(f"{name}-latin", font.size)
        if ord(ch) in _covered(lf):
            return lf
    if not Path(FALLBACK).exists():
        return font
    return ImageFont.truetype(FALLBACK, int(font.size * 0.92))


def _text(d, xy, text, font, fill, track=0.0):
    """Текст с разрядкой (track — доля кегля) и запасным шрифтом для знаков."""
    x, y = xy
    if any(ord(ch) not in _covered(font) for ch in text):
        x0 = x
        for ch in text:
            f = _glyph_font(font, ch)
            d.text((x, y + (font.size - f.size) * 0.6), ch, font=f, fill=fill)   # у своего латинского файла сдвиг 0
            x += d.textlength(ch, font=f) + track * font.size
        return x - x0
    if not track:
        d.text((x, y), text, font=font, fill=fill)
        return d.textlength(text, font=font)
    x0 = x
    for ch in text:
        d.text((x, y), ch, font=font, fill=fill)
        x += d.textlength(ch, font=font) + track * font.size
    return x - x0


def _textw(text, font, track=0.0):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    if any(ord(ch) not in _covered(font) for ch in text):
        return sum(d.textlength(ch, font=_glyph_font(font, ch)) for ch in text) + track * font.size * max(len(text) - 1, 0)
    return d.textlength(text, font=font) + (track * font.size * max(len(text) - 1, 0) if track else 0)


def _shadow(w: int, h: int, r: int, blur: int = 26, alpha: int = 150) -> Image.Image:
    from PIL import ImageFilter
    pad = blur * 3
    sh = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + blur // 2, pad + w, pad + h + blur // 2], r,
                                         fill=(0, 0, 0, alpha))
    return sh.filter(ImageFilter.GaussianBlur(blur)), pad


def dark_card(w: int, h: int, r: int, accent: bool = True) -> Image.Image:
    """Тёмное матовое стекло: градиент сверху вниз, тонкая грань, красная полоса слева."""
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        v = int(34 * (1 - t) + 14 * t)
        col.putpixel((0, y), (v, v - 2, v + 4, int(205 * (1 - t) + 225 * t)))
    card = Image.composite(col.resize((w, h)), Image.new("RGBA", (w, h), (0, 0, 0, 0)), mask)
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([0, 0, w - 1, h - 1], r, outline=(255, 255, 255, 46), width=2 * SS)
    d.line([(r, 1 * SS), (w - r, 1 * SS)], fill=(255, 255, 255, 70), width=1 * SS)   # блик по верхней грани
    if accent:
        d.rounded_rectangle([14 * SS, r, 14 * SS + 5 * SS, h - r], 3 * SS, fill=RED + (255,))
    return card


def _mark(kind: str, k: float, S: int) -> Image.Image:
    """Значок пункта: x — красный крест в квадрате, check — зелёная галочка, num — номер."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "check":
        return _check_icon(k, S // SS)
    if kind == "x":
        d.rounded_rectangle([0, 0, S - 1, S - 1], 8 * SS, fill=RED + (int(255 * min(1, k * 2)),))
        m = S * 0.3
        L = k
        if L > 0:
            e = min(L * 2, 1)
            d.line([(m, m), (m + (S - 2 * m) * e, m + (S - 2 * m) * e)], fill=(255, 255, 255, 255), width=int(5 * SS))
        if L > 0.5:
            e = (L - 0.5) * 2
            d.line([(S - m, m), (S - m - (S - 2 * m) * e, m + (S - 2 * m) * e)], fill=(255, 255, 255, 255), width=int(5 * SS))
        return img
    d.rounded_rectangle([0, 0, S - 1, S - 1], 8 * SS, fill=RED + (255,))
    return img


def frames_stack(spec, W, H):
    """Карточка-список: заголовок, пункты выезжают слева по одному.

    spec: header, items, offsets, dur, mark ("x"|"check"|"num"), size.
    Карточка растёт по высоте вместе с пунктами."""
    items, offs, dur = spec["items"], spec["offsets"], spec["dur"]
    mark = spec.get("mark", "num")
    fh = _ttf("Inter-700", 25 * SS)
    header = spec.get("header", "").upper()
    pad, r = 40 * SS, 30 * SS
    # Кегль пунктов уменьшается, пока самый длинный пункт не влезет в карточку.
    size = spec.get("size", 62)
    while True:
        fi = _ttf("Oswald-700", size * SS)
        icon_w = 0 if mark == "none" else int(fi.size * 0.78) + 22 * SS
        if pad * 2 + 14 * SS + icon_w + max(_textw(t.upper(), fi) for t in items) <= W - 60 * SS or size <= 40:
            break
        size -= 2
    row = int(fi.size * 1.42)
    icon = int(fi.size * 0.78)
    head_h = (int(fh.size * 2.3) if header else 0)
    text_w = max(_textw(t.upper(), fi) for t in items)
    lead = 0 if mark == "none" else icon + 22 * SS
    cw = int(max(pad * 2 + 14 * SS + lead + text_w, _textw(header, fh, 0.14) + pad * 2 + 30 * SS))
    cw = min(cw, W - 40 * SS)
    x0 = 20 * SS if spec.get("align", "left") == "left" else (W - cw) // 2
    full_h = pad + head_h + row * len(items) + pad - int(row * 0.2)
    shadow_cache = {}
    for i in range(int(dur * FPS)):
        t = i / FPS
        shown = sum(1 for o in offs if t >= o)
        target = pad + head_h + row * max(shown, 1) + pad - int(row * 0.2)
        # высота догоняет цель плавно
        prev = row * max(shown - 1, 1)
        since = t - offs[max(shown - 1, 0)]
        ch = int(pad + head_h + prev + (row * max(shown, 1) - prev) * ease_out(since / 0.28) + pad - int(row * 0.2))
        ch = min(ch, full_h)
        a_in = ease_out(t / 0.28)
        a_out = 1 - ease_in((t - (dur - 0.25)) / 0.25)
        alpha = min(a_in, a_out)
        dx = int(-40 * SS * (1 - ease_out(t / 0.32)) - 60 * SS * ease_in((t - (dur - 0.25)) / 0.25))
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        card = dark_card(cw, ch, r)
        d = ImageDraw.Draw(card)
        if header:
            hx = pad + 14 * SS
            _text(d, (hx, pad - 8 * SS), header, fh, RED + (255,), 0.14)
        y = pad + head_h
        for n, (txt, o) in enumerate(zip(items, offs)):
            lt = t - o
            if lt < 0:
                continue
            k = ease_out(lt / 0.34)
            ix = pad + 14 * SS - int(26 * SS * (1 - k))
            layer = Image.new("RGBA", card.size, (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            if mark == "none":
                tx = ix
            elif mark == "num":
                num = f"{n + 1:02d}"
                _text(ld, (ix, y + (row - fi.size) // 2 - int(fi.size * 0.12)), num, fi, RED + (255,))
                tx = ix + int(_textw("00", fi)) + 22 * SS
            else:
                ic = _mark(mark, ease_out((lt - 0.08) / 0.3), icon)
                layer.alpha_composite(ic, (ix, y + (row - icon) // 2))
                tx = ix + icon + 22 * SS
            _text(ld, (tx, y + (row - fi.size) // 2 - int(fi.size * 0.12)), txt.upper(), fi, (255, 255, 255, 255))
            if k < 1:
                layer.putalpha(layer.getchannel("A").point(lambda v, k=k: int(v * k)))
            card.alpha_composite(layer)
            y += row
        key = ch // (8 * SS)
        if key not in shadow_cache:
            shadow_cache[key] = _shadow(cw, ch, r)
        sh, sp = shadow_cache[key]
        group = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        group.alpha_composite(sh, (max(x0 - sp, 0), max(10 * SS - sp, 0)) if x0 - sp >= 0 else (0, 0))
        group.alpha_composite(card, (x0, 10 * SS))
        if alpha < 1:
            group.putalpha(group.getchannel("A").point(lambda v, a=alpha: int(v * max(a, 0))))
        fr.alpha_composite(group, (dx, 0)) if dx >= 0 else fr.alpha_composite(group.crop((-dx, 0, W, H)), (0, 0))
        yield fr


def frames_stamp(spec, W, H):
    """Красный «штамп»: слово в рамке, повёрнуто, влетает с ударом и дрожью."""
    from PIL import ImageFilter
    text = spec["text"].upper()
    f = _font(spec.get("size", 96) * SS)
    tw = int(_textw(text, f)); th = int(f.size * 0.78)
    padx, pady = 34 * SS, 24 * SS
    w, h = tw + 2 * padx, th + 2 * pady
    base = Image.new("RGBA", (w + 40 * SS, h + 40 * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    ox, oy = 20 * SS, 20 * SS
    d.rounded_rectangle([ox, oy, ox + w, oy + h], 14 * SS, outline=RED + (255,), width=8 * SS)
    bb = d.textbbox((0, 0), text, font=f)
    d.text((ox + padx - bb[0], oy + pady - bb[1] + (th - (bb[3] - bb[1])) // 2), text, font=f, fill=RED + (255,))
    glow = base.filter(ImageFilter.GaussianBlur(10 * SS))
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    shadow.putalpha(base.getchannel("A").filter(ImageFilter.GaussianBlur(14 * SS)).point(lambda v: int(v * 0.8)))
    stamp = Image.new("RGBA", base.size, (0, 0, 0, 0))
    stamp.alpha_composite(shadow); stamp.alpha_composite(glow); stamp.alpha_composite(base)
    stamp = stamp.rotate(spec.get("angle", -6), resample=Image.BICUBIC, expand=True)
    dur = spec["dur"]
    for i in range(int(dur * FPS)):
        t = i / FPS
        if t < 0.16:
            x = ease_in(t / 0.16); s = 1.9 - 0.9 * x; a = min(1, t / 0.08)
        else:
            s = 1.0 + 0.035 * (t - 0.16) / max(dur, 0.1); a = 1.0
        if t > dur - 0.18:
            x = ease_in((t - (dur - 0.18)) / 0.18); s *= 1 + 0.25 * x; a = 1 - x
        sh = 0
        if 0.16 <= t < 0.46:
            sh = int(9 * SS * math.sin((t - 0.16) * 70) * (1 - (t - 0.16) / 0.3))
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        tmp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(tmp, stamp, s, a)
        fr.alpha_composite(tmp, (sh, 0)) if sh >= 0 else fr.alpha_composite(tmp.crop((-sh, 0, W, H)), (0, 0))
        yield fr


def frames_cta(spec, W, H):
    """Призыв: тёмная карточка с красной светящейся рамкой, мягко «дышит»."""
    from PIL import ImageFilter
    big = spec["text"].upper()
    sub = spec.get("sub", "")
    fb = _font(spec.get("size", 64) * SS)
    fs = _ttf("Inter-700", 27 * SS)
    tag = spec.get("tag", "").upper()
    ft = _ttf("Inter-700", 22 * SS)
    bw = int(_textw(big, fb)); bh = int(fb.size * 0.8)
    sw = int(_textw(sub, fs)) if sub else 0
    w = max(bw, sw) + 2 * 56 * SS
    h = bh + 2 * 44 * SS + (int(fs.size * 1.9) if sub else 0)
    r = 26 * SS
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=(14, 10, 14, 228))
    d = ImageDraw.Draw(card)
    bb = d.textbbox((0, 0), big, font=fb)
    d.text(((w - bw) // 2 - bb[0], 44 * SS - bb[1]), big, font=fb, fill=(255, 255, 255, 255))
    if sub:
        _text(d, ((w - sw) // 2, 44 * SS + bh + int(fs.size * 0.7)), sub, fs, (255, 255, 255, 170))
    ring = Image.new("RGBA", (w + 80 * SS, h + 80 * SS), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle([40 * SS, 40 * SS, 40 * SS + w - 1, 40 * SS + h - 1], r,
                                           outline=RED + (255,), width=5 * SS)
    glow = ring.filter(ImageFilter.GaussianBlur(16 * SS))
    tagimg = None
    if tag:
        tw = int(_textw(tag, ft, 0.14)) + 36 * SS
        tagimg = Image.new("RGBA", (tw, int(ft.size * 1.9)), (0, 0, 0, 0))
        td = ImageDraw.Draw(tagimg)
        td.rounded_rectangle([0, 0, tw - 1, tagimg.height - 1], tagimg.height // 2, fill=RED + (255,))
        _text(td, (18 * SS, int(ft.size * 0.42)), tag, ft, (255, 255, 255, 255), 0.14)
    dur = spec["dur"]
    for i in range(int(dur * FPS)):
        t = i / FPS
        s, a = pop_envelope(t, dur)
        pulse = 0.65 + 0.35 * (0.5 + 0.5 * math.sin(t * 2 * math.pi / 1.3))
        comp = Image.new("RGBA", ring.size, (0, 0, 0, 0))
        g = glow.copy(); g.putalpha(g.getchannel("A").point(lambda v, p=pulse: int(min(255, v * 1.6 * p))))
        comp.alpha_composite(g)
        comp.alpha_composite(card, (40 * SS, 40 * SS))
        comp.alpha_composite(ring)
        if tagimg is not None:
            comp.alpha_composite(tagimg, ((comp.width - tagimg.width) // 2, 40 * SS - tagimg.height // 2))
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(fr, comp, s, a)
        yield fr


def frames_label(spec, W, H):
    """Заголовок над карточкой видео: маленький красный ярлык + крупный текст слева."""
    big = spec["text"].upper()
    tag = spec.get("tag", "").upper()
    fb = _font(spec.get("size", 60) * SS)
    ft = _ttf("Inter-700", 24 * SS)
    dur = spec["dur"]
    for i in range(int(dur * FPS)):
        t = i / FPS
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(fr)
        a_out = 1 - ease_in((t - (dur - 0.2)) / 0.2)
        x0 = 60 * SS
        y = 20 * SS
        if tag:
            k = ease_out(t / 0.3)
            tw = int(_textw(tag, ft, 0.14)) + 34 * SS
            th = int(ft.size * 1.9)
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            ld.rounded_rectangle([x0, y, x0 + int(tw * k), y + th], th // 2, fill=RED + (int(255 * min(k, a_out)),))
            if k > 0.6:
                _text(ld, (x0 + 17 * SS, y + int(ft.size * 0.42)), tag, ft, (255, 255, 255, int(255 * min((k - 0.6) / 0.4, a_out))), 0.14)
            fr.alpha_composite(layer)
            y += th + 18 * SS
        k = ease_out((t - 0.12) / 0.34)
        if k > 0:
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            bb = ld.textbbox((0, 0), big, font=fb)
            yy = y + int(30 * SS * (1 - k))
            ld.text((x0 + 3 * SS - bb[0], yy + 4 * SS - bb[1]), big, font=fb, fill=(0, 0, 0, 120))
            ld.text((x0 - bb[0], yy - bb[1]), big, font=fb, fill=(255, 255, 255, 255))
            layer.putalpha(layer.getchannel("A").point(lambda v, a=min(k, a_out): int(v * max(a, 0))))
            fr.alpha_composite(layer)
        yield fr


RENDER = {"pop": frames_pop, "strike": frames_strike, "check": frames_check,
          "list": frames_list, "counter": frames_counter,
          "stack": frames_stack, "stamp": frames_stamp, "cta": frames_cta, "label": frames_label}


def render(spec: dict, out: Path, width: int = 1000, height: int = 360) -> Path:
    """Отрисовать вставку в прозрачный ролик (mov/png с альфой)."""
    W, H = width * SS, height * SS
    if spec["type"] == "list":
        H = max(H, 150 * SS * len(spec["items"]))
    if spec["type"] == "stack":
        H = max(H, (200 + 92 * len(spec["items"])) * SS)
    if spec["type"] in ("stamp", "cta"):
        H = max(H, 420 * SS)
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
    outdir = Path(sys.argv[1] if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / "inserts_demo")
    outdir.mkdir(parents=True, exist_ok=True)
    for d in demo:
        p = render(d, outdir / f"{d['type']}.mov")
        print(p)
