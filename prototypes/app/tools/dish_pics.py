"""Фото блюд для прототипа: квадратный кадр по блюду, блюдо целиком в любой рамке приложения.

Источник каждого фото — Unsplash (images.unsplash.com, лицензия Unsplash: бесплатно, подпись не обязательна),
номер и где на исходнике блюдо (box: доли ширины и высоты, x0 y0 x1 y1) — в tools/dish_pics.json.

Кадр — квадрат вокруг блюда: блюдо занимает не больше 82% ширины и 74% высоты. Рамки фото в приложении — от 0,86
(«Популярное» в меню, 116×135) до 1,3 (страница блюда 390×300, «Добавить к заказу?» 132×102); рамка обрезает края
квадрата, а блюдо остаётся целиком. Не хватает фото вокруг блюда, а фон однородный (чёрный, белый, ровный) — фон
продлевается краем фото с размытием. Результат: img/u/dish-<блюдо>.webp (1080), -m (540), -s (180) и
img/u/dish-boxes.json — где блюдо в кадре (по нему проверка «блюдо целиком в каждой рамке»).

Запуск: python3 tools/dish_pics.py [папка для исходников, по умолчанию /tmp/dish_src]
"""
import json, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'u')
SRC = sys.argv[1] if len(sys.argv) > 1 else '/tmp/dish_src'
FW, FH = .82, .74      # доля кадра под блюдо
MW, MH = .075, .12     # ближе к краю — блюдо срежет рамка 0,86 или 1,3 (с запасом)

cfg = json.load(open(os.path.join(ROOT, 'tools', 'dish_pics.json')))
os.makedirs(SRC, exist_ok=True)
boxes = {}
for k, v in cfg.items():
    src = os.path.join(SRC, k + '.jpg')
    if not os.path.exists(src):
        urllib.request.urlretrieve('https://images.unsplash.com/photo-%s?w=2000&q=88&fm=jpg' % v['unsplash'], src)
    im = Image.open(src).convert('RGB'); W, H = im.size
    bx0, by0, bx1, by1 = v['box'][0] * W, v['box'][1] * H, v['box'][2] * W, v['box'][3] * H
    bw, bh, cx, cy = bx1 - bx0, by1 - by0, (bx0 + bx1) / 2, (by0 + by1) / 2
    S = max(bw / FW, bh / FH)
    x0, y0 = cx - S / 2, cy - S / 2
    pad = S > W or S > H
    if not pad:   # влезает — сдвигаем в границы фото, если блюдо остаётся в безопасной зоне
        x0c, y0c = min(max(x0, 0), W - S), min(max(y0, 0), H - S)
        if (bx0 - x0c) >= MW * S and (x0c + S - bx1) >= MW * S and (by0 - y0c) >= MH * S and (y0c + S - by1) >= MH * S:
            x0, y0 = x0c, y0c
        else:
            pad = True
    L, T = int(round(-min(0, x0))), int(round(-min(0, y0)))
    R, B = int(round(max(0, x0 + S - W))), int(round(max(0, y0 + S - H)))
    big, x0p, y0p = im, x0, y0
    if L or T or R or B:   # за краем фото — его край, размытый
        a = np.pad(np.asarray(im), ((T, B), (L, R), (0, 0)), mode='edge')
        big = Image.fromarray(a); blur = big.filter(ImageFilter.GaussianBlur(max(6, S / 120)))
        m = np.zeros(a.shape[:2], np.uint8); m[:T, :] = 255; m[T + H:, :] = 255; m[:, :L] = 255; m[:, L + W:] = 255
        big = Image.composite(blur, big, Image.fromarray(m).filter(ImageFilter.GaussianBlur(4)))
        x0p, y0p = x0 + L, y0 + T
    crop = big.crop((int(round(x0p)), int(round(y0p)), int(round(x0p + S)), int(round(y0p + S))))
    base = os.path.join(OUT, 'dish-' + k)
    crop.resize((1080, 1080), Image.LANCZOS).save(base + '.webp', 'WEBP', quality=80, method=6)
    crop.resize((540, 540), Image.LANCZOS).save(base + '-m.webp', 'WEBP', quality=80, method=6)
    crop.resize((180, 180), Image.LANCZOS).save(base + '-s.webp', 'WEBP', quality=78, method=6)
    boxes['u/dish-' + k] = [round((bx0 - x0) / S, 4), round((by0 - y0) / S, 4), round((bx1 - x0) / S, 4), round((by1 - y0) / S, 4)]
    print(k.ljust(10), 'кадр %d из %d×%d' % (S, W, H), 'с полями' if (L or T or R or B) else '', boxes['u/dish-' + k])
json.dump(boxes, open(os.path.join(OUT, 'dish-boxes.json'), 'w'), indent=1)
