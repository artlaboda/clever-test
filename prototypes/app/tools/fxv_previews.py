#!/usr/bin/env python3
"""Сборка превью для скрытых настроек (вызывает tools/fxv_previews.js): снимок → WebP, запись экрана → анимированный WebP.

Ролик: кадры по их времени раскладываем на шаг step (у роликов по виртуальному времени — 1/30 с, у цифр — 1/50 с: кадр
на каждый шаг; без шага — 50 мс; в паузах берём последний кадр), одинаковые подряд склеиваем в один длиннее. Кадры роликов
по виртуальному времени уже вырезаны по рамке (cropped). Первый кадр (до касания) держим 0,5 с, последний — 1 с: по кругу видно,
что было до и что стало. Ширина — 540 px (в шторке превью около 358 точек: на iPhone чётко), качество 62."""
import json
import os
import sys

from PIL import Image

STILL_W, FILM_W, STEP = 720, 540, 0.05


def still(job, name):
    im = Image.open(job['file']).convert('RGB')
    if im.width > STILL_W:
        im = im.resize((STILL_W, round(im.height * STILL_W / im.width)), Image.LANCZOS)
    im.save(name, 'WEBP', quality=80, method=6)
    return im.size, 1


def stills(job, name):
    """несколько состояний — одно под другим, между ними полоса 12 px цвета фона снимка (его угол)"""
    ims = [Image.open(f).convert('RGB') for f in job['files']]
    w = min(STILL_W, max(i.width for i in ims))
    ims = [i.resize((w, round(i.height * w / i.width)), Image.LANCZOS) for i in ims]
    gap = 12
    out = Image.new('RGB', (w, sum(i.height for i in ims) + gap * (len(ims) - 1)), ims[0].getpixel((2, 2)))
    y = 0
    for i in ims:
        out.paste(i, (0, y))
        y += i.height + gap
    out.save(name, 'WEBP', quality=80, method=6)
    return out.size, 1


def film(job, name):
    frames, clip = job['frames'], job['clip']
    if not frames:
        raise SystemExit('нет кадров: ' + name)
    first = Image.open(frames[0]['file'])
    k = first.width / 390.0   # кадр записи — в пикселях экрана (390 точек × масштаб)
    box = None if job.get('cropped') else tuple(round(v * k) for v in (clip['x'], clip['y'], clip['x'] + clip['width'], clip['y'] + clip['height']))
    ts, step, fw = [f['t'] for f in frames], job.get('step', STEP), job.get('w', FILM_W)
    t, end, i, seq = max(ts[0], job['t0'] - 0.3), ts[-1], 0, []
    while t <= end + 1e-6:
        while i + 1 < len(frames) and frames[i + 1]['t'] <= t + 1e-6:
            i += 1
        if seq and seq[-1][0] == i:
            seq[-1][1] += int(round(step * 1000))
        else:
            seq.append([i, int(round(step * 1000))])
        t += step
    seq[0][1] += 450
    seq[-1][1] += 950
    imgs, durs = [], []
    for idx, d in seq:
        im = Image.open(frames[idx]['file']).convert('RGB')
        if box:
            im = im.crop(box)
        if im.width != fw:
            im = im.resize((fw, round(im.height * fw / im.width)), Image.LANCZOS)
        if imgs and im.tobytes() == imgs[-1].tobytes():   # кадр как предыдущий (ничего не сдвинулось) — тот стоит дольше
            durs[-1] += d
            continue
        imgs.append(im)
        durs.append(d)
    imgs[0].save(name, 'WEBP', save_all=True, append_images=imgs[1:], duration=durs, loop=0, quality=62, method=6)
    return imgs[0].size, len(imgs)


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    os.makedirs(spec['out'], exist_ok=True)
    for job in spec['jobs']:
        name = os.path.join(spec['out'], job['k'] + '-' + job['v'] + '.webp')
        size, n = {'still': still, 'stills': stills, 'film': film}[job['kind']](job, name)
        print('%-22s %4d×%-4d кадров %-3d %5.0f КБ' % (os.path.basename(name), size[0], size[1], n, os.path.getsize(name) / 1024))


if __name__ == '__main__':
    main()
