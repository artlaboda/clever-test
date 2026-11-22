# Вырезки для промо, шаг 2 (после birefnet.py): чистка маски, «подкраска» краёв (цвет сплошной части вытягивается в полупрозрачный край — без тёмной
# каймы от прежнего фона), обрезка по блюду, WEBP с прозрачностью в двух размерах. Аргументы: папка out/, папка назначения
import sys, os, colorsys
import numpy as np
from PIL import Image
SRC, DST = sys.argv[1], sys.argv[2]

def load(n):
    im = Image.open(os.path.join(SRC, n + '.png')).convert('RGBA')
    return np.asarray(im).astype(np.float32)

def bleed(a, it=8):
    rgb, al = a[..., :3].copy(), a[..., 3] / 255.0
    solid = al >= .92
    for _ in range(it):
        acc = np.zeros_like(rgb); cnt = np.zeros(al.shape, np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if not dx and not dy: continue
                s = np.roll(np.roll(solid, dy, 0), dx, 1); c = np.roll(np.roll(rgb, dy, 0), dx, 1)
                acc += c * s[..., None]; cnt += s
        grow = (~solid) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        solid = solid | grow
    out = a.copy(); out[..., :3] = rgb
    # край — чуть плотнее: слабый ореол прежнего фона уходит
    out[..., 3] = np.clip((al - .06) / .88, 0, 1) * 255
    return out

def circle_keep(a, cx, cy, r, soft=2.0):
    h, w = a.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    k = np.clip((r - d) / soft + .5, 0, 1)
    a[..., 3] *= k
    return a

def rect_keep(a, x0, y0, x1, y1):
    h, w = a.shape[:2]; m = np.zeros((h, w), np.float32); m[max(0, y0):y1, max(0, x0):x1] = 1
    a[..., 3] *= m
    return a

def save(a, name, big=640, small=320):
    al = a[..., 3]
    ys, xs = np.where(al > 10)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    pad = 4
    a = a[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    for px, suf in ((big, ''), (small, '-s')):
        t = im.copy(); t.thumbnail((px, px), Image.LANCZOS)
        p = os.path.join(DST, 'promo-' + name + suf + '.webp'); t.save(p, 'WEBP', quality=84, method=6)
        print(name + suf, t.size, os.path.getsize(p) // 1024, 'KB')

# стейк: нарезка, соус и шпажка (сковороду модель убрала сама)
save(bleed(load('steak')), 'steak')
# суши: только линия нигири (палочки и соус слева — убираем)
a = load('sushi'); a = rect_keep(a, 520, 0, 10000, 10000); save(bleed(a), 'sushi')
# борщ: только тарелка — круг (полосатый край подстолья и ложка — убираем)
a = load('borsch'); a = circle_keep(a, 782, 449, 262); save(bleed(a), 'borsch')
# панкейки с черникой и бананом
save(bleed(load('syrniki')), 'pancakes')
# пионы в вазе
save(bleed(load('u_1591886960571-74d43a9d4166')), 'flowers')
# Мангал: два шампура (курица с деревянной ручкой и свинина) и крылышки — обвод по снимку гриля (координаты на картинке 600×900)
from PIL import ImageDraw, ImageFilter
a = load('u_1555939594-58d7cb561ad1'); H, W = a.shape[:2]; k = W / 600.0
poly = [(138,352),(150,328),(298,246),(332,196),(452,168),(474,150),(496,92),(540,70),(606,70),(606,176),(566,176),(556,186),(546,210),(522,234),(503,250),(499,300),(510,318),(536,338),(540,410),(536,452),(520,520),(470,540),(420,522),(370,525),(318,528),(296,500),(298,440),(270,410),(236,396),(200,392),(160,384)]
m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon([(x * k, y * k) for x, y in poly], fill=255); m = m.filter(ImageFilter.GaussianBlur(2))
a[..., 3] *= np.asarray(m, np.float32) / 255.0
save(bleed(a), 'grill')
