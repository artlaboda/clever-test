#!/usr/bin/env python3
"""Обложки заведений — настоящие фото (Unsplash, по номеру фото), без коллажей: вкусно, как на снимке у Terra и Let it be.

    python3 tools/covers.py [заведение ...]      без аргументов — все из PLAN; пишет img/u/r-<id>.webp (1600×860)

Кадр — 1600×860 (1,86 — как карточка на главной). Центр кадра — точка (fx, fy) в долях исходника. На странице заведения
обложку обрезает по бокам до 390×292 (середина ~72% ширины) — главное держим в середине; пицца, пирог — целиком в обоих
кадрах, не обрезаны по краям. Исходник —
images.unsplash.com/photo-<номер>?w=2400, кэш — во временной папке (в репозиторий не кладём). Тон — по необходимости:
яркость, контраст, насыщенность (1 — как есть). fit — кадр во всю высоту снимка, недостающую ширину — тем же ровным фоном
(цвет края снимка и лёгкое зерно): блюдо меньше, с полями — целиком и в карточке, и в обложке витрины над плашкой.
rot — повернуть исходник (градусы против часовой, 90/270) до кадрирования: снимок строго сверху от поворота не страдает, а
вертикальный кадр становится широким — блюда в ряд помещаются целиком; fx, fy тогда — в долях уже повёрнутого снимка.
Лицензия и номера — img/u/SOURCES.md.

Остальные обложки (Terra, Let it be, Fusion, Мангал, Флора) — тоже фото Unsplash, кадрированы раньше (номера — там же)."""
import io
import os
import sys
import tempfile
import urllib.request

from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 1600, 860

# заведение: (номер фото, fx, fy, тон) — что на снимке
PLAN = {
    'dominos': ('1516697073-419b2bd079db', .5, .672, {'rot': 90, 'contrast': 1.05, 'color': 1.24}),   # две пиццы с салями и сыром в открытых коробках на светлой ткани, строго сверху; вертикальный снимок повёрнут — обе целиком
    'tempo': ('1585238342024-78d387f4a707', .5, .5, {}),       # ломтики с базиликом, томатами, оливками и колбасками, тёмное дерево
    'mirpizza': ('1555072956-7758afb20e8f', .5, .5, {}),       # пицца со шпинатом и моцареллой на мраморе, вино, масло, кусок в руке
    'papochka': ('1560180474-e8563fd75bab', .5, .5, {'rot': 270, 'contrast': 1.04, 'color': 1.15}),    # три открытых пирога с кремом, апельсином и ежевикой на светлом столе, розмарин, строго сверху; вертикальный снимок повёрнут
}


def source(pid):
    cache = os.path.join(tempfile.gettempdir(), 'clever-covers')
    os.makedirs(cache, exist_ok=True)
    f = os.path.join(cache, pid + '.jpg')
    if not os.path.exists(f):
        data = urllib.request.urlopen('https://images.unsplash.com/photo-' + pid + '?w=2400&q=90&auto=format&fm=jpg', timeout=60).read()
        open(f, 'wb').write(data)
    return Image.open(f).convert('RGB')


def build(rid):
    pid, fx, fy, tone = PLAN[rid]
    im = source(pid)
    if tone.get('rot'): im = im.rotate(tone['rot'], expand=True)
    w, h = im.size
    if tone.get('fit'):   # во всю высоту: ширину добираем фоном по краям
        import numpy as np
        need = round(h * W / H)
        if need > w:
            a = np.asarray(im).astype('float32')
            edge = np.concatenate([a[:, :24].reshape(-1, 3), a[:, -24:].reshape(-1, 3)]).mean(0)
            rng = np.random.default_rng(7)
            bg = edge[None, None, :] + rng.normal(0, 2.4, (h, need, 1)).astype('float32')
            x0 = round(fx * need - w / 2)
            x0 = min(max(0, x0), need - w)
            bg[:, x0:x0 + w] = a
            im = Image.fromarray(np.clip(bg, 0, 255).astype('uint8'))
            w = need
    if w / h > W / H:
        cw, ch = round(h * W / H), h
    else:
        cw, ch = w, round(w * H / W)
    x = min(max(0, round(fx * w - cw / 2)), w - cw)
    y = min(max(0, round(fy * h - ch / 2)), h - ch)
    im = im.crop((x, y, x + cw, y + ch)).resize((W, H), Image.LANCZOS)
    if tone.get('bright', 1) != 1: im = ImageEnhance.Brightness(im).enhance(tone['bright'])
    if tone.get('contrast', 1) != 1: im = ImageEnhance.Contrast(im).enhance(tone['contrast'])
    if tone.get('color', 1) != 1: im = ImageEnhance.Color(im).enhance(tone['color'])
    out = os.path.join(ROOT, 'img', 'u', 'r-' + rid + '.webp')
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=82, method=6)
    open(out, 'wb').write(buf.getvalue())
    print('%-10s %s  %5.0f КБ  (photo-%s, кадр %d×%d от %d×%d)' % (rid, out, os.path.getsize(out) / 1024, pid, cw, ch, w, h))


if __name__ == '__main__':
    for rid in (sys.argv[1:] or list(PLAN)):
        build(rid)
