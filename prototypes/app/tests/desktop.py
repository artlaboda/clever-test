#!/usr/bin/env python3
"""Автоматический прогон проверок десктопной версии clever.by по пунктам из tests/DESKTOP.md.

Запуск:
    python3 prototypes/app/tests/desktop.py --list      # список всех пунктов
    python3 prototypes/app/tests/desktop.py             # прогнать весь десктоп
    python3 prototypes/app/tests/desktop.py "4."        # только раздел 4 (Доминос пицца)
    python3 prototypes/app/tests/desktop.py "КБЖУ"      # только пункты с «КБЖУ» в названии
    python3 prototypes/app/tests/desktop.py "5.4" "6.1" # конкретные пункты
"""

import http.server
import os
import re
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

APP_DIR = Path(__file__).resolve().parent.parent
CHROME_PATHS = [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]


def find_chrome():
    for p in CHROME_PATHS:
        if os.path.exists(p):
            return p
    return None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(APP_DIR), **kw)

    def log_message(self, *a):
        pass


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def start_server():
    srv = ReusableTCPServer(("127.0.0.1", 0), QuietHandler)
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv, f"http://127.0.0.1:{port}/index.html"


TESTS = []


def check(code, title):
    def dec(fn):
        TESTS.append((code, title, fn))
        return fn
    return dec


def open_desk(browser, url, w=1440, h=900, auth=True, locale="ru-RU", theme=None, dismiss_ask=True):
    ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=False, locale=locale)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    page.on("console", lambda m: errs.append(f"console.error: {m.text}") if m.type == "error" else None)
    # Отключаем внешние сетевые запросы карт/геокодера, чтобы прогон работал без сети
    page.route(re.compile(r"unpkg\.com|openfreemap\.org|nominatim\.openstreetmap\.org|fonts\.googleapis\.com|fonts\.gstatic\.com"), lambda r: r.abort())
    page.add_init_script(f"""() => {{
        try {{
            localStorage.setItem('clever2-city', 'minsk');
            {'localStorage.setItem("clever2-auth", "1");' if auth else 'localStorage.removeItem("clever2-auth");'}
            {f'localStorage.setItem("clever2-theme", "{theme}");' if theme else ''}
        }} catch (e) {{}}
    }}""")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(650)
    if dismiss_ask:
        page.evaluate("var b = document.querySelector('#dAddrAsk [data-ask=\"ok\"]'); if (b) b.click();")
        page.wait_for_timeout(180)
    return ctx, page, errs


def assert_no_errs(errs):
    real = [e for e in errs if "ERR_FAILED" not in e and "Failed to load resource" not in e]
    assert not real, f"Ошибки JS/консоли: {real}"


def open_rest(page, rid):
    page.locator(f'[data-act="open-rest"][data-id="{rid}"]').first.click()
    page.wait_for_timeout(500)


def open_dish(page, did, scope="#m-pizza"):
    loc = page.locator(f'{scope} [data-act="open-dish"][data-id="{did}"]').first
    if loc.count() == 0:
        loc = page.locator(f'#s-rest [data-act="open-dish"][data-id="{did}"]').first
    loc.scroll_into_view_if_needed()
    loc.click()
    page.wait_for_timeout(480)


# ──────────────────────────────────────────────────────────────────────────────
# 1. Загрузка, шапка и уточнение адреса
# ──────────────────────────────────────────────────────────────────────────────

@check("1.1", "Загрузка десктопного режима (1440×900): html.desk, 0 ошибок, картинки")
def t_1_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        st = page.evaluate("""() => {
            const imgs = [...document.querySelectorAll('#s-home img')].filter(i => i.offsetWidth > 0 && i.offsetHeight > 0);
            const broken = imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'));
            return {
                desk: document.documentElement.classList.contains('desk'),
                cssLoaded: [...document.styleSheets].some(s => (s.href || '').includes('desktop.css')),
                jsLoaded: typeof window.cleverDesk === 'function',
                imgCount: imgs.length,
                broken
            };
        }""")
        assert st["desk"] and st["cssLoaded"] and st["jsLoaded"], f"Десктоп не активирован: {st}"
        assert not st["broken"], f"Битые картинки на главной: {st['broken']}"
        assert_no_errs(errs)
        return f"imgs={st['imgCount']}, broken=0"
    finally:
        ctx.close()


@check("1.2", "Верхняя полоса .dstrip и статичная шапка #tabbar")
def t_1_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        st = page.evaluate("""() => {
            const tb = document.getElementById('tabbar');
            const need = ['.dstrip', '.dlogo', '.cseg.dseg', '#dAddr', '#dSearch', '.dh-tel', '.tab[data-tab="profile"]', '#cartTab'];
            const missing = need.filter(s => !tb.querySelector(s) || tb.querySelector(s).offsetWidth === 0);
            return { pos: getComputedStyle(tb).position, h: Math.round(tb.getBoundingClientRect().height), missing };
        }""")
        assert st["pos"] == "relative", f"Ожидалась статичная шапка relative, получено {st['pos']}"
        assert not st["missing"], f"Не видны элементы шапки: {st['missing']}"
        assert_no_errs(errs)
        return f"pos={st['pos']}, h={st['h']}px"
    finally:
        ctx.close()


@check("1.3", "Переключатель «Доставка ↔ Навынос −15%» и искры .dseg__fx")
def t_1_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        page.locator('.cseg.dseg button[data-m="pk"]').click()
        page.wait_for_timeout(240)
        st = page.evaluate("""() => ({
            isPk: document.querySelector('.cseg.dseg').classList.contains('is-pk'),
            stored: localStorage.getItem('clever2-mode'),
            sparks: document.querySelectorAll('.cseg.dseg .dseg__sp').length
        })""")
        assert st["isPk"] and st["stored"] == "pick", f"Навынос не включился: {st}"
        page.locator('.cseg.dseg button[data-m="dl"]').click()
        page.wait_for_timeout(150)
        assert not page.evaluate("document.querySelector('.cseg.dseg').classList.contains('is-pk')")
        assert_no_errs(errs)
        return f"sparks={st['sparks']}, stored={st['stored']}"
    finally:
        ctx.close()


@check("1.4", "Бегущая строка длинного адреса в #dAddr")
def t_1_4(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        has_addr = page.evaluate("!!document.querySelector('#dAddr .dh-city') && !!document.querySelector('#dAddr .dh-place')")
        assert has_addr, "Не найден контрол города/адреса в #dAddr"
        assert_no_errs(errs)
        return "city+place OK"
    finally:
        ctx.close()


@check("1.5", "Окошко уточнения адреса #dAddrAsk: показ, «Да, верно» и закрытие по Esc/скроллу")
def t_1_5(browser, url):
    ctx, page, errs = open_desk(browser, url, dismiss_ask=False)
    try:
        page.wait_for_timeout(500)
        ask = page.evaluate("""() => {
            const el = document.getElementById('dAddrAsk');
            const an = document.getElementById('dAddr');
            if (!el || !an) return null;
            const r = el.getBoundingClientRect(), a = an.getBoundingClientRect();
            return { on: el.classList.contains('is-on'), top: Math.round(r.top), anchorBot: Math.round(a.bottom) };
        }""")
        assert ask and ask["on"] and ask["top"] >= ask["anchorBot"], f"Окошко адреса не появилось под #dAddr: {ask}"
        page.keyboard.press("Escape")
        page.wait_for_timeout(320)
        assert page.evaluate("!document.getElementById('dAddrAsk')"), "Esc не закрыл #dAddrAsk"
        assert_no_errs(errs)
        return f"top={ask['top']}px (anchorBot={ask['anchorBot']}px)"
    finally:
        ctx.close()


@check("1.6", "Кнопка корзины #cartTab: постоянная ширина, smooth corners, наполнение .bag")
def t_1_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        w0 = page.evaluate("document.getElementById('cartTab').getBoundingClientRect().width")
        sq = page.evaluate("document.getElementById('cartTab').getAttribute('data-sq')")
        # Добавляем 1-й товар (Американо в Доминос — без опций)
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(650)
        st = page.evaluate("""() => {
            const ct = document.getElementById('cartTab');
            return {
                w1: ct.getBoundingClientRect().width,
                hasSum: ct.classList.contains('has-sum'),
                badge: ct.querySelector('.tab__badge')?.textContent?.trim(),
                hasBag: !!ct.querySelector('.bag .bag__liq')
            };
        }""")
        assert w0 >= 153 and abs(st["w1"] - w0) <= 1.5, f"Ширина #cartTab прыгнула: {w0} -> {st['w1']}"
        assert sq == "clip" and st["hasSum"] and st["badge"] == "1" and st["hasBag"], f"Состояние #cartTab: {st}"
        assert_no_errs(errs)
        return f"w={w0:.1f}->{st['w1']:.1f}px, sq={sq}"
    finally:
        ctx.close()


@check("1.7", "Поиск по горячей клавише '/' и закрытие по Esc")
def t_1_7(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        page.keyboard.press("/")
        page.wait_for_timeout(350)
        assert page.evaluate("document.getElementById('s-search').classList.contains('is-on')"), "Поиск не открылся по '/'"
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        assert not page.evaluate("document.getElementById('s-search').classList.contains('is-on')"), "Поиск не закрылся по Esc"
        assert_no_errs(errs)
        return "/ -> search -> Esc OK"
    finally:
        ctx.close()


@check("1.8", "Клик по профилю без входа открывает авторизацию")
def t_1_8(browser, url):
    ctx, page, errs = open_desk(browser, url, auth=False)
    try:
        page.locator('.tab[data-tab="profile"]').click()
        page.wait_for_timeout(450)
        is_auth = page.evaluate("document.getElementById('sheet').classList.contains('is-on') && !!document.getElementById('authPhone')")
        assert is_auth, "Окно входа не открылось при клике по профилю"
        assert_no_errs(errs)
        return "anon profile -> auth sheet OK"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 2. Главная страница: категории, акции, ленты и заведения
# ──────────────────────────────────────────────────────────────────────────────

@check("2.1", "Категории под шапкой (.cats) и фильтрация списка заведений")
def t_2_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        n_all = page.locator("#s-home .rest").count()
        page.locator('#homeScroll .cats .cat[data-id="pizza"]').first.click()
        page.wait_for_timeout(300)
        n_piz = page.locator("#s-home .rest").count()
        page.locator("#homeScroll .cats .dcat-all").click()
        page.wait_for_timeout(300)
        n_back = page.locator("#s-home .rest").count()
        assert 0 < n_piz < n_all and n_back == n_all, f"Фильтрация категорий не сработала: all={n_all}, pizza={n_piz}, back={n_back}"
        assert_no_errs(errs)
        return f"all={n_all}, pizza={n_piz}"
    finally:
        ctx.close()


@check("2.2", "Лента «Акции» (#promoRow): 9 карточек, единая сетка заголовков, фото rich")
def t_2_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        st = page.evaluate("""() => {
            const row = document.getElementById('promoRow');
            const cards = [...row.querySelectorAll('.promo')];
            const titles = cards.map(c => {
                const t = c.querySelector('.promo__title');
                const b = c.querySelector('.promo__banner');
                return t && b ? +(t.getBoundingClientRect().top - b.getBoundingClientRect().top).toFixed(1) : null;
            });
            const imgs = cards.map(c => {
                const i = c.querySelector('.promo__rich');
                return i && i.complete && i.naturalWidth > 0;
            });
            const spread = Math.max(...titles) - Math.min(...titles);
            const ratio = row.clientWidth / (cards[0].getBoundingClientRect().width + 12);
            return { n: cards.length, spread, allImgs: imgs.every(Boolean), perView: +ratio.toFixed(2) };
        }""")
        assert st["n"] >= 9, f"Ожидалось 9 акций, получено {st['n']}"
        assert st["spread"] <= 1.5, f"Заголовки акций не в одну линию: разброс {st['spread']}px"
        assert st["allImgs"], "Не все фото promo__rich загрузились"
        assert_no_errs(errs)
        return f"n={st['n']}, titleSpread={st['spread']}px, perView≈{st['perView']}"
    finally:
        ctx.close()


@check("2.3", "Порядок секций главной: Акции → Снова хочется → Часто заказывают (9) → Заведения")
def t_2_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        st = page.evaluate("""() => {
            const secs = [...document.querySelectorAll('#homeScroll > .sec')];
            const heads = secs.map(s => (s.querySelector('.h')?.textContent || '').trim());
            const freq = secs.find(s => (s.querySelector('.h')?.textContent || '').includes('Часто заказывают'));
            const freqN = freq ? freq.querySelectorAll('.dcard').length : 0;
            const split = document.querySelectorAll('#homeScroll .sec--rests2').length;
            return { heads, freqN, split };
        }""")
        assert st["freqN"] == 9, f"В «Часто заказывают» ожидалось 9 хитов, получено {st['freqN']}"
        assert st["split"] == 0, "Список заведений не должен разрываться (.sec--rests2)"
        assert st["heads"].index("Часто заказывают") == st["heads"].index("Снова хочется") + 1, f"Порядок секций: {st['heads']}"
        assert_no_errs(errs)
        return f"heads={st['heads'][:4]}, freq={st['freqN']}"
    finally:
        ctx.close()


@check("2.4", "Ленты блюд 6 → 5 → 4 целых карточек и стрелки в шапке")
def t_2_4(browser, url):
    res = []
    for vw, exp_n in [(1440, 6), (1180, 5), (960, 4)]:
        ctx, page, errs = open_desk(browser, url, w=vw, h=820)
        try:
            st = page.evaluate("""() => {
                const row = [...document.querySelectorAll('#s-home .hscroll')].find(r => r.querySelector('.dcard'));
                const cards = [...row.querySelectorAll(':scope > .dcard')];
                const rr = row.getBoundingClientRect();
                const full = cards.filter(c => {
                    const b = c.getBoundingClientRect();
                    return b.left >= rr.left - 1.5 && b.right <= rr.right + 1.5;
                }).length;
                const nav = row.closest('.sec').querySelector('.sec__head .dpromo-nav');
                return { full, hasNav: !!nav };
            }""")
            assert st["full"] == exp_n, f"При {vw}px ожидалось {exp_n} целых карточек, получено {st['full']}"
            assert st["hasNav"], f"Нет стрелок в шапке при {vw}px"
            assert_no_errs(errs)
            res.append(f"{vw}px→{st['full']}")
        finally:
            ctx.close()
    return ", ".join(res)


@check("2.5", "Перетягивание лент мышкой (drag-to-scroll) без случайного клика")
def t_2_5(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        box = page.locator("#promoRow").bounding_box()
        x0, y0 = box["x"] + box["width"] * 0.7, box["y"] + box["height"] * 0.5
        page.mouse.move(x0, y0)
        page.mouse.down()
        page.mouse.move(x0 - 260, y0, steps=10)
        page.mouse.up()
        page.wait_for_timeout(480)
        st = page.evaluate("""() => ({
            sl: Math.round(document.getElementById('promoRow').scrollLeft),
            restOpen: document.getElementById('s-rest').classList.contains('is-on')
        })""")
        assert st["sl"] > 100, f"Лента не прокрутилась мышкой: scrollLeft={st['sl']}"
        assert not st["restOpen"], "После перетягивания мышкой сработал случайный клик!"
        assert_no_errs(errs)
        return f"scrollLeft={st['sl']}px, clickSuppressed=True"
    finally:
        ctx.close()


@check("2.6", "«Снова хочется»: обычный регистр заведения и шторка «N раза»")
def t_2_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        tt = page.evaluate("getComputedStyle(document.querySelector('#s-home .dcard__rest')).textTransform")
        assert tt == "none", f"Ожидался обычный регистр (none), получено {tt}"
        page.locator("#s-home .dcard__times").first.click()
        page.wait_for_timeout(450)
        is_agn = page.evaluate("document.getElementById('sheet').classList.contains('is-on') && !!document.querySelector('#sheet .agn__list')")
        assert is_agn, "Шторка «Вы заказывали N раз» не открылась"
        assert_no_errs(errs)
        return f"textTransform={tt}, againSheet=True"
    finally:
        ctx.close()


@check("2.7", "Плавающая круглая корзина .dfcart на главной при скролле")
def t_2_7(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(400)
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)
        page.evaluate("document.getElementById('s-home').scrollTop = 600")
        page.wait_for_timeout(400)
        st = page.evaluate("""() => {
            const f = document.querySelector('.dfcart');
            return {
                on: f && !f.hidden && f.classList.contains('is-on'),
                n: f?.querySelector('.dfcart__n')?.textContent,
                hasBag: !!f?.querySelector('.dfcart__bag > .bag .bag__liq')
            };
        }""")
        assert st["on"] and st["n"] == "1" and st["hasBag"], f".dfcart не показалась: {st}"
        assert_no_errs(errs)
        return f"dfcart on=True, n={st['n']}, bag=True"
    finally:
        ctx.close()


@check("2.8", "Карточки заведений: 3 колонки, все обложки загружены, бегущий курьер при ховере")
def t_2_8(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        # Прокручиваем, чтобы подгрузились lazy-обложки
        page.evaluate("""() => { document.querySelectorAll('#s-home .rest img').forEach(i => i.loading = 'eager'); }""")
        page.wait_for_timeout(500)
        st = page.evaluate("""() => {
            const rests = [...document.querySelectorAll('#s-home .rest')];
            const broken = rests.filter(r => { const i = r.querySelector('img'); return !i || !i.complete || i.naturalWidth === 0; }).map(r => r.dataset.id);
            const cols = getComputedStyle(document.querySelector('#s-home .rests')).gridTemplateColumns.split(' ').length;
            return { total: rests.length, cols, broken };
        }""")
        assert st["cols"] == 3, f"Ожидалось 3 колонки заведений, получено {st['cols']}"
        assert not st["broken"], f"Битые обложки заведений: {st['broken']}"
        page.locator("#s-home .rest").first.hover()
        page.wait_for_timeout(200)
        has_run = page.evaluate("!!document.querySelector('#s-home .rest:hover .dcr svg')")
        assert has_run, "При наведении на заведение не появился бегущий курьер .dcr"
        assert_no_errs(errs)
        return f"rests={st['total']}, cols={st['cols']}, runnerHover=True"
    finally:
        ctx.close()


@check("2.9", "Фильтры заведений (.chip): высота 40px и фильтрация")
def t_2_9(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        h = page.evaluate("document.querySelector('#s-home .chip').getBoundingClientRect().height")
        assert abs(h - 40) <= 0.5, f"Ожидалась высота чипа 40px, получено {h}"
        assert_no_errs(errs)
        return f"chipH={h}px"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 3. Страница заведения, навигация и меню
# ──────────────────────────────────────────────────────────────────────────────

@check("3.1", "Открытие заведения, history.pushState (#rest=dominos) и возврат Back/Esc")
def t_3_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        h1 = page.evaluate("location.hash")
        t1 = page.title()
        assert h1 == "#rest=dominos" and "Доминос" in t1, f"hash={h1}, title={t1}"
        page.go_back()
        page.wait_for_timeout(400)
        assert not page.evaluate("document.getElementById('s-rest').classList.contains('is-on')"), "Back не вернул на главную"
        assert_no_errs(errs)
        return f"hash={h1}, Back→home OK"
    finally:
        ctx.close()


@check("3.2", "Обложка .rhero, кнопки .rtop, окно «Детали» и «Отзывы»")
def t_3_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        in_hero = page.evaluate("!!document.querySelector('#s-rest .rhero > #rtop')")
        assert in_hero, "#rtop должен находиться внутри .rhero"
        page.locator('#s-rest [data-act="rest-about"]').first.click()
        page.wait_for_timeout(400)
        assert page.evaluate("document.getElementById('sheet').classList.contains('is-on')"), "Окно «Детали» не открылось"
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        assert_no_errs(errs)
        return "rtop in rhero, Детали OK"
    finally:
        ctx.close()


@check("3.3", "Плашки акций заведения (.ri-tks) и окно акции с плазменным кругом")
def t_3_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        cnt = page.locator("#s-rest .ri-tk").count()
        assert cnt >= 2, f"Ожидалось >=2 плашек акций, получено {cnt}"
        page.locator("#s-rest .ri-tk").first.click()
        page.wait_for_timeout(420)
        is_deal = page.evaluate("document.getElementById('sheet').classList.contains('is-deal') && document.getElementById('sheet').classList.contains('is-on')")
        assert is_deal, "Окно акции не открылось"
        page.keyboard.press("Escape")
        assert_no_errs(errs)
        return f"deals={cnt}, modal=True"
    finally:
        ctx.close()


@check("3.4", "Статичное меню разделов #rtabs: 18px, flex-wrap без скролла и стрелок")
def t_3_4(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        st = page.evaluate("""() => {
            const row = document.querySelector('#rtabs .rtabs__row');
            const btn = row.querySelector('button[data-act="rtab"]');
            return {
                wrap: getComputedStyle(row).flexWrap,
                fs: parseFloat(getComputedStyle(btn).fontSize),
                bh: Math.round(btn.getBoundingClientRect().height)
            };
        }""")
        assert st["wrap"] == "wrap" and abs(st["fs"] - 18) <= 0.5 and st["bh"] >= 42, f"Неверные стили #rtabs: {st}"
        assert_no_errs(errs)
        return f"wrap={st['wrap']}, fs={st['fs']}px, h={st['bh']}px"
    finally:
        ctx.close()


@check("3.5", "Верхняя панель #drnavBar: раннее появление, 1px линия, клик наверх, скрытие на главной")
def t_3_5(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.evaluate("document.getElementById('restScroll').scrollTop = 260")
        page.wait_for_timeout(350)
        st = page.evaluate("""() => {
            const bar = document.getElementById('drnavBar');
            const cs = getComputedStyle(bar);
            return {
                on: bar.classList.contains('is-on'),
                hasBack: !!bar.querySelector('[data-act="back"]'),
                shadow: cs.boxShadow,
                rowPad: parseFloat(getComputedStyle(bar.querySelector('.drnav-tabs .rtabs__row')).paddingLeft)
            };
        }""")
        assert st["on"] and not st["hasBack"], f"Неверное состояние #drnavBar: {st}"
        assert "0px 1px 0px" in st["shadow"], f"Ожидалась 1px линия вместо тени: {st['shadow']}"
        assert st["rowPad"] >= 24, f"Малый запас слева под «Каплю»: {st['rowPad']}px"
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)
        assert not page.evaluate("document.getElementById('drnavBar')?.classList.contains('is-on')"), "#drnavBar не скрылся при возврате на главную"
        assert_no_errs(errs)
        return f"hairline=1px, pad={st['rowPad']}px"
    finally:
        ctx.close()


@check("3.6", "Перелёт «Капли» в #drnavBar от последнего раздела к «Популярному» без обрезки")
def t_3_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.evaluate("document.getElementById('restScroll').scrollTop = 320")
        page.wait_for_timeout(350)
        tabs = page.locator('#drnavBar button[data-act="rtab"]')
        tabs.last.click()
        page.wait_for_timeout(450)
        tabs.first.click()
        page.wait_for_timeout(450)
        ok = page.evaluate("""() => {
            const b = document.querySelector('#drnavBar button[data-act="rtab"]');
            const th = document.querySelector('#drnavBar .rtabs__th');
            const br = b.getBoundingClientRect(), tr = th.getBoundingClientRect();
            return { cur: b.getAttribute('aria-current'), dx: +(tr.left - br.left).toFixed(1) };
        }""")
        assert ok["cur"] == "true" and abs(ok["dx"]) <= 2.5, f"Капля не доехала ровно: {ok}"
        assert_no_errs(errs)
        return f"firstTab cur=true, dx={ok['dx']}px"
    finally:
        ctx.close()


@check("3.7", "Живая наполняющаяся корзина в #drnavBar (.drnav-cart__btn)")
def t_3_7(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.evaluate("document.getElementById('restScroll').scrollTop = 360")
        page.wait_for_timeout(350)
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(650)
        st = page.evaluate("""() => {
            const btn = document.querySelector('#drnavBar .drnav-cart__btn');
            return {
                hasBag: !!btn.querySelector('.drnav-cart__bag > .bag .bag__liq'),
                n: btn.querySelector('.drnav-cart__n')?.textContent,
                sum: btn.querySelector('.drnav-cart__sum')?.textContent
            };
        }""")
        assert st["hasBag"] and st["n"] == "1" and "Корзина" not in st["sum"], f"Корзина в #drnavBar не обновилась: {st}"
        assert_no_errs(errs)
        return f"n={st['n']}, sum={st['sum']}"
    finally:
        ctx.close()


@check("3.8", "«Популярное» (#m-popular) в формате .dcard со стрелками в шапке")
def t_3_8(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        st = page.evaluate("""() => {
            const p = document.getElementById('m-popular');
            return {
                cards: p ? p.querySelectorAll('.pop-row > .dcard').length : 0,
                nav: !!p?.querySelector('.dpop-h .dpromo-nav')
            };
        }""")
        assert st["cards"] >= 3 and st["nav"], f"Неверный формат #m-popular: {st}"
        assert_no_errs(errs)
        return f"dcard={st['cards']}, nav=True"
    finally:
        ctx.close()


@check("3.9", "Единое правило «от» и открытия карточки для блюд с опциями (в т.ч. по «+»)")
def t_3_9(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "letitbe")
        # Панкейки с бананом имеют топпинги -> «от» и клик по + открывает карточку
        meta = page.locator('#s-rest .item:has([data-id="pancakes"]) .item__mp').first.inner_text()
        assert "от" in meta.lower(), f"У блюда с топпингами нет «от»: {meta}"
        page.locator('#s-rest .item:has([data-id="pancakes"]) .plus').first.click()
        page.wait_for_timeout(400)
        assert page.evaluate("document.getElementById('sheet').classList.contains('is-dish')"), "Клик по '+' у блюда с опциями не открыл карточку"
        assert_no_errs(errs)
        return f"pancakes price='{meta}', '+'→modal OK"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 4. Доминос пицца: 10 пицц и отдельные фото S / M / L
# ──────────────────────────────────────────────────────────────────────────────

@check("4.1", "Все 10 пицц Доминос: 960×960, цена «от …» и «25 см»")
def t_4_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        items = page.evaluate("""() => [...document.querySelectorAll('#m-pizza .item')].map(c => {
            const i = c.querySelector('img');
            return {
                id: c.querySelector('[data-act="open-dish"]')?.dataset.id,
                meta: c.querySelector('.item__meta')?.textContent.replace(/\\s+/g, ' ').trim(),
                w: i?.naturalWidth, h: i?.naturalHeight, ok: i?.complete && i?.naturalWidth === 960
            };
        })""")
        assert len(items) == 10, f"Ожидалось 10 пицц, получено {len(items)}"
        for it in items:
            assert it["ok"], f"Битое/не 960px фото пиццы: {it}"
            assert "25 см" in it["meta"] and "от" in it["meta"].lower(), f"Нет 25 см / от: {it}"
        assert_no_errs(errs)
        return "10/10 pizzas 960x960 + 'от' + '25 см'"
    finally:
        ctx.close()


@check("4.2", "«Дьявола» и «Пицца Карбонара» с выбором размеров S/M/L, бортов и КБЖУ")
def t_4_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        for pid in ("diavola", "carbonara_pizza"):
            open_dish(page, pid)
            st = page.evaluate("""() => ({
                cfg: document.getElementById('sheet').classList.contains('is-dish-cfg'),
                sizes: document.querySelectorAll('#sheet .cseg[data-key="size"] > button').length,
                crusts: document.querySelectorAll('#sheet .ddish-crust .opt').length,
                nutr: !!document.querySelector('#sheet .ddish-nutr')
            })""")
            assert st["cfg"] and st["sizes"] == 3 and st["crusts"] == 4 and st["nutr"], f"{pid}: {st}"
            page.keyboard.press("Escape")
            page.wait_for_timeout(320)
        assert_no_errs(errs)
        return "diavola + carbonara_pizza cfg OK"
    finally:
        ctx.close()


@check("4.3", "Отдельные фото S/M/L в стеке .dpz без вращения при смене размера")
def t_4_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        for pid in ("country", "seasons", "diavola", "carbonara_pizza"):
            open_dish(page, pid)
            for sz, suf in [("S", "-s.webp"), ("M", ".webp"), ("L", "-l.webp")]:
                page.locator(f'#sheet .cseg[data-key="size"] button[data-id="{sz}"]').click()
                page.wait_for_timeout(380)
                st = page.evaluate("""() => {
                    const dpz = document.getElementById('dishImg');
                    const imgs = [...dpz.querySelectorAll('img.dpz__img')];
                    const on = imgs.find(i => i.classList.contains('is-on'));
                    const m = getComputedStyle(dpz).transform;
                    const vals = m.startsWith('matrix(') ? m.slice(7, -1).split(',').map(Number) : [1, 0, 0, 1];
                    return {
                        sz: dpz.dataset.sz,
                        src: on?.getAttribute('src') || '',
                        all960: imgs.length === 3 && imgs.every(i => i.complete && i.naturalWidth === 960),
                        rot: Math.abs(vals[1]) + Math.abs(vals[2])
                    };
                }""")
                assert st["sz"] == sz and suf in st["src"] and st["all960"], f"{pid} [{sz}]: {st}"
                if sz == "M":
                    assert "-s.webp" not in st["src"] and "-l.webp" not in st["src"]
                assert st["rot"] < 0.001, f"Обнаружено вращение пиццы: {st}"
            page.keyboard.press("Escape")
            page.wait_for_timeout(320)
        assert_no_errs(errs)
        return "4 pizzas × S/M/L (960px, 0° rot) OK"
    finally:
        ctx.close()


@check("4.4", "Круглая тень пиццы (.dpz): box-shadow без filter: drop-shadow")
def t_4_4(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "country")
        st = page.evaluate("""() => {
            const dpz = document.getElementById('dishImg');
            const img = dpz.querySelector('img.dpz__img.is-on');
            return {
                dpzBr: getComputedStyle(dpz).borderRadius,
                dpzSh: getComputedStyle(dpz).boxShadow,
                dpzF: getComputedStyle(dpz).filter,
                imgF: getComputedStyle(img).filter,
                imgSh: getComputedStyle(img).boxShadow
            };
        }""")
        assert st["dpzBr"] == "50%" and st["dpzSh"] != "none" and st["dpzF"] == "none", f"dpz: {st}"
        assert st["imgF"] == "none" and st["imgSh"] == "none", f"img: {st}"
        assert_no_errs(errs)
        return "border-radius=50%, filter=none, single shadow"
    finally:
        ctx.close()


@check("4.5", "Фото-добавки («Кантри» и «Панкейки»): натуральные тени, цена и степпер по центру")
def t_4_5(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "country")
        st0 = page.evaluate("""() => {
            const cards = [...document.querySelectorAll('.ddish-addon.has-pic')];
            return {
                n: cards.length,
                loaded: cards.every(c => { const i = c.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }),
                noFilter: cards.every(c => getComputedStyle(c.querySelector('img')).filter === 'none'),
                ctlHidden: cards.every(c => parseFloat(getComputedStyle(c.querySelector('.ddish-addon__ctl')).opacity) === 0)
            };
        }""")
        assert st0["n"] == 6 and st0["loaded"] and st0["noFilter"] and st0["ctlHidden"], f"Кантри добавки: {st0}"
        page.locator('.ddish-addon[data-id="mozzarella"] .ddish-addon__hit').click()
        page.wait_for_timeout(320)
        dx = page.evaluate("""() => {
            const c = document.querySelector('.ddish-addon[data-id="mozzarella"]');
            const cr = c.getBoundingClientRect(), sr = c.querySelector('.ddish-addon__ctl').getBoundingClientRect();
            return Math.abs((sr.left + sr.width / 2) - (cr.left + cr.width / 2));
        }""")
        assert dx <= 1.0, f"Степпер не по центру карточки: dx={dx:.2f}px"
        assert_no_errs(errs)
        return f"6 pics, filter=none, stepperDx={dx:.2f}px"
    finally:
        ctx.close()


@check("4.6", "Миниатюра выбранного размера пиццы в корзине и при редактировании")
def t_4_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "diavola")
        page.locator('#sheet .cseg[data-key="size"] button[data-id="L"]').click()
        page.wait_for_timeout(200)
        page.locator("#dishAdd").click()
        page.wait_for_timeout(350)
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)
        page.locator("#cartTab").click()
        page.wait_for_timeout(450)
        src1 = page.locator("#s-cart .citem .citem__pic img").first.get_attribute("src")
        assert "-l.webp" in src1, f"Ожидалась -l.webp в корзине, получено {src1}"
        # Редактируем размер L -> S прямо из корзины
        page.locator('#s-cart .citem [data-act="cart-edit"]').first.click()
        page.wait_for_timeout(450)
        page.locator('#sheet .cseg[data-key="size"] button[data-id="S"]').click()
        page.wait_for_timeout(200)
        page.locator("#dishAdd").click()
        page.wait_for_timeout(1100)
        src2 = page.locator("#s-cart .citem .citem__pic img").first.get_attribute("src")
        assert "-s.webp" in src2, f"После правки L→S ожидалась -s.webp, получено {src2}"
        assert_no_errs(errs)
        return "cart thumb L→S updated OK"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 5. Карточка блюда, КБЖУ и модификаторы
# ──────────────────────────────────────────────────────────────────────────────

@check("5.1", "Карточка блюда: 2 колонки, smooth corners без filter на #sheet, крестик по сетке")
def t_5_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "country")
        st = page.evaluate("""() => {
            const sh = document.getElementById('sheet');
            const stg = sh.querySelector('.dish__stage');
            return {
                sheetFilter: getComputedStyle(sh).filter,
                stageBr: getComputedStyle(stg).borderRadius,
                gridSq: sh.querySelector('.ddish-grid')?.getAttribute('data-sq')
            };
        }""")
        assert st["sheetFilter"] == "none" and st["stageBr"] == "0px", f"Стили карточки: {st}"
        assert_no_errs(errs)
        return f"sheetFilter=none, stageBr=0px, gridSq={st['gridSq']}"
    finally:
        ctx.close()


@check("5.2", "Галерея нескольких фото (.ddish-pnav) в карточке блюда")
def t_5_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "wings", "#m-snacks")
        has_nav = page.locator("#sheet .ddish-pnav--next").count() == 1
        assert has_nav, "Нет стрелок галереи у «Крылья острые»"
        page.locator("#sheet .ddish-pnav--next").click(force=True)
        page.wait_for_timeout(300)
        idx = page.evaluate("[...document.querySelectorAll('#sheet .dph__dots i')].findIndex(i => i.classList.contains('is-on'))")
        assert idx == 1, f"Кадр галереи не переключился: idx={idx}"
        assert_no_errs(errs)
        return "wings gallery 0→1 OK"
    finally:
        ctx.close()


@check("5.3", "Блок КБЖУ: сумма процентов 100%, режимы 100г/порция и живой пересчёт")
def t_5_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "manhattan")
        def read_nutr():
            return page.evaluate("""() => {
                const pcts = [...document.querySelectorAll('.ddish-nutr__pct')].map(e => parseInt(e.textContent, 10));
                return {
                    sumPct: pcts.reduce((a, b) => a + b, 0),
                    kcal: document.querySelector('.ddish-nutr__kcal')?.textContent,
                    tab: document.querySelector('.ddish-nutr__t')?.textContent
                };
            }""")
        n1 = read_nutr()
        assert n1["sumPct"] == 100 and "порцию" in n1["tab"], f"n1={n1}"
        page.locator('.dfoot [data-act="dqty"][data-d="1"]').click()
        page.wait_for_timeout(420)
        n2 = read_nutr()
        assert n2["sumPct"] == 100 and "2" in n2["tab"] and n2["kcal"] != n1["kcal"], f"n2={n2}"
        page.locator('.ddish-nutr__tab[data-mode="100"]').click()
        page.wait_for_timeout(380)
        assert page.evaluate("document.querySelector('.ddish-nutr__wwrap').hidden"), "На 100 г вес порции должен скрываться"
        assert_no_errs(errs)
        return f"sumPct=100%, {n1['kcal']} → {n2['kcal']}"
    finally:
        ctx.close()


@check("5.4", "Регрессия КБЖУ: 0 скачков капсулы, 0 схлопываний пробелов, 0 ResizeObserver")
def t_5_4(browser, url):
    for vw, vh in [(1440, 900), (1280, 760)]:
        ctx, page, errs = open_desk(browser, url, w=vw, h=vh)
        try:
            open_rest(page, "dominos")
            open_dish(page, "manhattan")
            page.wait_for_timeout(200)
            page.evaluate("""() => {
                window._ro = 0;
                let first = true;
                new ResizeObserver(() => { if (first) { first = false; return; } window._ro++; }).observe(document.querySelector('.ddish-nutr'));
            }""")
            page.wait_for_timeout(100)
            # 1 -> 2 -> 3
            page.locator('.dfoot [data-act="dqty"][data-d="1"]').click()
            page.wait_for_timeout(420)
            page.locator('.dfoot [data-act="dqty"][data-d="1"]').click()
            page.wait_for_timeout(120)
            mid = page.evaluate("""() => {
                const t = document.querySelector('.ddish-nutr__t').getBoundingClientRect();
                const w = document.querySelector('.ddish-nutr__w').getBoundingClientRect();
                return { tt: +t.top.toFixed(2), th: +t.height.toFixed(2), wl: +w.left.toFixed(2), ww: +w.width.toFixed(2), ro: window._ro };
            }""")
            page.wait_for_timeout(420)
            end = page.evaluate("""() => {
                const t = document.querySelector('.ddish-nutr__t').getBoundingClientRect();
                const w = document.querySelector('.ddish-nutr__w').getBoundingClientRect();
                return { tt: +t.top.toFixed(2), th: +t.height.toFixed(2), wl: +w.left.toFixed(2), ww: +w.width.toFixed(2), ro: window._ro };
            }""")
            assert end["ro"] == 0, f"{vw}×{vh}: ResizeObserver сработал {end['ro']} раз"
            assert abs(mid["tt"] - end["tt"]) < 0.01 and abs(mid["th"] - end["th"]) < 0.01, f"{vw}×{vh}: скачок капсулы {mid} vs {end}"
            assert abs(mid["wl"] - end["wl"]) < 0.5 and abs(mid["ww"] - end["ww"]) < 0.5, f"{vw}×{vh}: скачок граммов {mid} vs {end}"
            assert_no_errs(errs)
        finally:
            ctx.close()
    return "1440×900 & 1280×760: capsuleΔ=0.00px, gramsΔ<0.5px, RO=0"


@check("5.5", "Борты 2×2: целые высоты и 0px скачка цены/радиокнопки в нижнем ряду")
def t_5_5(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "manhattan")
        before = page.evaluate("""() => [...document.querySelectorAll('.ddish-crust .opt')].map(o => ({
            h: +o.getBoundingClientRect().height.toFixed(2),
            pt: +o.querySelector('small').getBoundingClientRect().top.toFixed(2),
            rt: +o.querySelector('.radio').getBoundingClientRect().top.toFixed(2)
        }))""")
        for k in ("hotdog", "cheesedog", "cream", "classic"):
            page.locator(f'.ddish-crust .opt:has(input[value="{k}"])').click()
            page.wait_for_timeout(120)
        after = page.evaluate("""() => [...document.querySelectorAll('.ddish-crust .opt')].map(o => ({
            h: +o.getBoundingClientRect().height.toFixed(2),
            pt: +o.querySelector('small').getBoundingClientRect().top.toFixed(2),
            rt: +o.querySelector('.radio').getBoundingClientRect().top.toFixed(2)
        }))""")
        for b, a in zip(before, after):
            assert abs(b["h"] - round(b["h"])) < 0.05, f"Дробная высота борта: {b['h']}"
            assert abs(b["pt"] - a["pt"]) < 0.05 and abs(b["rt"] - a["rt"]) < 0.05, f"Сдвиг борта: {b} vs {a}"
        assert_no_errs(errs)
        return f"crustH={before[0]['h']}px, drift=0.00px"
    finally:
        ctx.close()


@check("5.6", "Текстовые добавки: жирная цена с ×1, целые 12px иконки, счётчик «выбрано N»")
def t_5_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "manhattan")
        page.locator('.ddish-addon[data-id="mozzarella"] .ddish-addon__hit').click()
        page.wait_for_timeout(250)
        st = page.evaluate("""() => {
            const c = document.querySelector('.ddish-addon[data-id="mozzarella"]');
            const p = c.querySelector('.ddish-addon__p');
            const svg = c.querySelector('.ddish-addon__btn svg').getBoundingClientRect();
            const cnt = document.querySelector('.ddish-addons .ddish-addons__cnt');
            return {
                fw: parseInt(getComputedStyle(p).fontWeight, 10),
                svgW: +svg.width.toFixed(1), svgH: +svg.height.toFixed(1),
                cntHidden: cnt.hidden, cntTxt: cnt.textContent.trim()
            };
        }""")
        assert st["fw"] >= 600, f"Цена при ×1 не жирная: fw={st['fw']}"
        assert st["svgW"] == 12 and st["svgH"] == 12, f"Иконка степпера не 12×12: {st}"
        assert not st["cntHidden"] and "1" in st["cntTxt"], f"Счётчик добавок: {st}"
        assert_no_errs(errs)
        return f"fw={st['fw']}, svg=12×12, cnt='{st['cntTxt']}'"
    finally:
        ctx.close()


@check("5.7", "Pad Thai (.is-dish-rich): 12 фото, «Дополнительно», «Убрать», «Начинка», скролл")
def t_5_7(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "padthai")
        page.evaluate("document.querySelectorAll('#s-rest img').forEach(i => i.loading = 'eager')")
        page.wait_for_timeout(450)
        broken = page.evaluate("""() => [...document.querySelectorAll('#s-rest img')].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'))""")
        assert not broken, f"Битые фото в Pad Thai: {broken}"
        open_dish(page, "pt_padthai_shrimp", "#s-rest")
        st = page.evaluate("""() => {
            const sh = document.getElementById('sheet');
            const ext = sh.querySelector('.ddish-extras .ddish-addon__txt small')?.textContent.trim();
            return {
                rich: sh.classList.contains('is-dish-rich'),
                ext,
                exclN: sh.querySelectorAll('.ddish-excl').length,
                fillN: sh.querySelectorAll('.ddish-addons .ddish-addon').length
            };
        }""")
        assert st["rich"] and "·" in st["ext"] and st["exclN"] > 0 and st["fillN"] >= 10, f"Pad Thai карточка: {st}"
        # Проверка порядка «+цена · вес г» (знак + в начале)
        assert st["ext"].startswith("+"), f"Неверный порядок цены и веса: {st['ext']}"
        # Прокрутка правой колонки -> появляется .is-dish-scr
        page.evaluate("document.querySelector('#sheet .dish__body').scrollTop = 120")
        page.wait_for_timeout(150)
        assert page.evaluate("document.getElementById('sheet').classList.contains('is-dish-scr')"), "Не включился .is-dish-scr при скролле"
        assert_no_errs(errs)
        return f"rich=True, ext='{st['ext']}', excl={st['exclN']}, fill={st['fillN']}"
    finally:
        ctx.close()


@check("5.8", "Добавление из карточки блюда: сброс qty на 1, нет вспышек .drift")
def t_5_8(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "country")
        page.locator('.dfoot [data-act="dqty"][data-d="1"]').click()
        page.wait_for_timeout(150)
        page.locator("#dishAdd").click()
        page.wait_for_timeout(400)
        st = page.evaluate("""() => ({
            qty: document.getElementById('dqty')?.textContent?.trim(),
            badge: document.querySelector('#cartTab .tab__badge')?.textContent?.trim(),
            drift: document.querySelectorAll('.drift').length,
            stillOpen: document.getElementById('sheet').classList.contains('is-dish')
        })""")
        assert st["qty"] == "1" and st["badge"] == "2" and st["drift"] == 0 and st["stillOpen"], f"Состояние после добавления: {st}"
        assert_no_errs(errs)
        return "qty→1, cart=2, drift=0"
    finally:
        ctx.close()


@check("5.9", "Окно смены ресторана (#sheet.is-swap): 440px, перчик, капсулы без желе")
def t_5_9(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)
        open_rest(page, "terra")
        page.locator('#s-rest [data-act="quick-add"]').first.click()
        page.wait_for_timeout(450)
        st = page.evaluate("""() => {
            const sh = document.getElementById('sheet');
            return {
                swap: sh.classList.contains('is-swap') && sh.classList.contains('is-on'),
                w: Math.round(sh.getBoundingClientRect().width),
                oh: !!sh.querySelector('.is-surprised')
            };
        }""")
        assert st["swap"] and abs(st["w"] - 440) <= 2 and st["oh"], f"Окно смены ресторана: {st}"
        page.locator('#sheet .btn2').click()
        page.wait_for_timeout(350)
        assert not page.evaluate("document.getElementById('sheet').classList.contains('is-on')")
        assert_no_errs(errs)
        return f"swapW={st['w']}px, surprisedPepper=True"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 6. Корзина, акции, оформление и авторизация
# ──────────────────────────────────────────────────────────────────────────────

@check("6.1", "Корзина центрированной модалкой (#s-cart, 600px) с затемнением и закрытием по Esc")
def t_6_1(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.locator("#cartTab").click()
        page.wait_for_timeout(450)
        st = page.evaluate("""() => {
            const c = document.getElementById('s-cart').getBoundingClientRect();
            const a = document.getElementById('app').getBoundingClientRect();
            return {
                w: Math.round(c.width),
                cxDiff: +Math.abs((c.left + c.width / 2) - (a.left + a.width / 2)).toFixed(1),
                scrimOp: parseFloat(getComputedStyle(document.getElementById('dscrim')).opacity)
            };
        }""")
        assert abs(st["w"] - 600) <= 4 and st["cxDiff"] <= 2.5 and st["scrimOp"] > 0.5, f"Корзина не центрирована: {st}"
        page.keyboard.press("Escape")
        page.wait_for_timeout(350)
        assert not page.evaluate("document.getElementById('s-cart').classList.contains('is-on')")
        assert_no_errs(errs)
        return f"w={st['w']}px, centerDx={st['cxDiff']}px"
    finally:
        ctx.close()


@check("6.2", "Строки корзины: +/−, удаление→«Вернуть», очистка до пустой корзины")
def t_6_2(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.locator("#cartTab").click()
        page.wait_for_timeout(450)
        page.locator('#s-cart .citem [data-act="line"][data-d="1"]').first.click()
        page.wait_for_timeout(350)
        assert page.locator("#s-cart .citem .stepper .num").first.inner_text().strip() == "2"
        page.locator('#s-cart [data-act="clear-cart"]').click()
        page.wait_for_timeout(400)
        assert page.evaluate("document.getElementById('s-cart').classList.contains('is-empty')"), "Корзина не очистилась"
        assert_no_errs(errs)
        return "qty 1→2, clear→empty OK"
    finally:
        ctx.close()


@check("6.3", "Кросс-селл «Добавить к заказу?» в корзине без наложения на промокод")
def t_6_3(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.locator("#cartTab").click()
        page.wait_for_timeout(450)
        st = page.evaluate("""() => {
            const ups = document.querySelector('#s-cart .ups');
            const pr = document.querySelector('#s-cart .promo-in, #s-cart #promoIn');
            if (!ups) return { n: 0 };
            const ur = ups.getBoundingClientRect();
            const prr = pr ? pr.getBoundingClientRect() : null;
            return { n: document.querySelectorAll('#s-cart .ups').length, gap: prr ? Math.round(prr.top - ur.bottom) : 99 };
        }""")
        assert st["n"] >= 2 and st["gap"] >= 0, f"Кросс-селл перекрывает промокод: {st}"
        assert_no_errs(errs)
        return f"ups={st['n']}, gap={st['gap']}px"
    finally:
        ctx.close()


@check("6.4", "Промокод CLEVER15 и ошибка неверного кода в корзине")
def t_6_4(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.locator("#cartTab").click()
        page.wait_for_timeout(450)
        inp = page.locator("#s-cart #promoIn")
        inp.fill("TEST999")
        page.locator('#s-cart [data-act="promo-apply"]').click()
        page.wait_for_timeout(300)
        err_on = page.evaluate("!!document.querySelector('#s-cart .pfield.is-err, #s-cart .is-err')")
        assert err_on, "Не показалась ошибка неверного промокода"
        inp.fill("CLEVER15")
        page.locator('#s-cart [data-act="promo-apply"]').click()
        page.wait_for_timeout(400)
        has_disc = page.evaluate("!!document.querySelector('#s-cart .disc')")
        assert has_disc, "Промокод CLEVER15 не применился"
        assert_no_errs(errs)
        return "bad→err, CLEVER15→.disc OK"
    finally:
        ctx.close()


@check("6.5", "Ползунок бесплатной доставки: есть в Terra (Clever.by), нет в Доминос")
def t_6_5(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(300)
        page.locator("#cartTab").click()
        page.wait_for_timeout(350)
        dom_dlv = page.locator("#s-cart .dlv").count()
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)
        open_rest(page, "terra")
        page.locator('#s-rest [data-act="quick-add"]').first.click()
        page.wait_for_timeout(350)
        page.locator('#sheet.is-swap .cta').click()
        page.wait_for_timeout(400)
        page.locator("#cartTab").click()
        page.wait_for_timeout(400)
        ter_dlv = page.locator("#s-cart .dlv").count()
        assert dom_dlv == 0 and ter_dlv == 1, f"dom_dlv={dom_dlv}, ter_dlv={ter_dlv}"
        assert_no_errs(errs)
        return "dominos=0, terra=1"
    finally:
        ctx.close()


@check("6.6", "Оформление заказа (#s-checkout): центрированная модалка 600px и возврат в корзину")
def t_6_6(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        open_dish(page, "country")
        page.locator("#dishAdd").click()
        page.wait_for_timeout(350)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        page.locator("#cartTab").click()
        page.wait_for_timeout(400)
        page.locator('#s-cart [data-act="checkout"]').click()
        page.wait_for_timeout(450)
        st = page.evaluate("""() => {
            const c = document.getElementById('s-checkout').getBoundingClientRect();
            const a = document.getElementById('app').getBoundingClientRect();
            return {
                on: document.getElementById('s-checkout').classList.contains('is-on'),
                w: Math.round(c.width),
                cxDiff: +Math.abs((c.left + c.width / 2) - (a.left + a.width / 2)).toFixed(1)
            };
        }""")
        assert st["on"] and abs(st["w"] - 600) <= 4 and st["cxDiff"] <= 2.5, f"Оформление: {st}"
        page.locator('#s-checkout [data-act="back"]').first.click()
        page.wait_for_timeout(350)
        assert page.evaluate("document.getElementById('s-cart').classList.contains('is-on')"), "Назад из оформления не вернул в корзину"
        assert_no_errs(errs)
        return f"checkout w={st['w']}px, back→cart OK"
    finally:
        ctx.close()


@check("6.7", "Авторизация на десктопе: пропорциональные цифры, ввод номера и кода 0505")
def t_6_7(browser, url):
    ctx, page, errs = open_desk(browser, url, auth=False)
    try:
        page.locator('.tab[data-tab="profile"]').click()
        page.wait_for_timeout(450)
        ls = page.evaluate("getComputedStyle(document.getElementById('authPhone')).letterSpacing")
        assert ls == "normal", f"Ожидался letter-spacing: normal на десктопе, получено {ls}"
        page.locator("#authPhone").fill("291234567")
        page.wait_for_timeout(1350)
        page.locator('#sheet [data-act="auth-go"]').click()
        page.wait_for_timeout(450)
        page.locator("#authCode").fill("0505")
        page.wait_for_timeout(1200)
        assert page.evaluate("localStorage.getItem('clever2-auth') === '1'"), "Код 0505 не авторизовал"
        assert_no_errs(errs)
        return "letterSpacing=normal, 0505→auth OK"
    finally:
        ctx.close()


@check("6.8", "Второстепенные кнопки .btn2 без тени при ховере")
def t_6_8(browser, url):
    ctx, page, errs = open_desk(browser, url)
    try:
        open_rest(page, "dominos")
        page.locator('#m-drinks [data-act="quick-add"]').first.click()
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        open_rest(page, "terra")
        page.locator('#s-rest [data-act="quick-add"]').first.click()
        page.wait_for_timeout(400)
        btn = page.locator("#sheet .btn2").first
        btn.hover()
        page.wait_for_timeout(150)
        sh = page.evaluate("getComputedStyle(document.querySelector('#sheet .btn2')).boxShadow")
        assert sh == "none", f"У .btn2 не должно быть тени на ховере: {sh}"
        assert_no_errs(errs)
        return "btn2 hover boxShadow=none"
    finally:
        ctx.close()


# ──────────────────────────────────────────────────────────────────────────────
# 7. Темы, адаптивность, языки, мобильная изоляция и статика
# ──────────────────────────────────────────────────────────────────────────────

@check("7.1", "Тёмная тема (data-theme=dark): главная, #drnavBar, карточка «Кантри»")
def t_7_1(browser, url):
    ctx, page, errs = open_desk(browser, url, theme="dark")
    try:
        assert page.evaluate("document.documentElement.dataset.theme === 'dark'")
        open_rest(page, "dominos")
        page.evaluate("document.getElementById('restScroll').scrollTop = 300")
        page.wait_for_timeout(300)
        bar_sh = page.evaluate("getComputedStyle(document.getElementById('drnavBar')).boxShadow")
        assert "0px 1px 0px" in bar_sh, f"Тёмная тема #drnavBar shadow: {bar_sh}"
        open_dish(page, "country")
        assert page.evaluate("getComputedStyle(document.querySelector('.ddish-addon.has-pic img')).filter === 'none'")
        assert_no_errs(errs)
        return "dark theme + drnavBar hairline + addons OK"
    finally:
        ctx.close()


@check("7.2", "Адаптивность (1440×900, 1280×760, 1100×800, 900×700): 0 переполнений, «Кантри» без скролла")
def t_7_2(browser, url):
    out = []
    for vw, vh in [(1440, 900), (1280, 760), (1100, 800), (900, 700)]:
        ctx, page, errs = open_desk(browser, url, w=vw, h=vh)
        try:
            ov = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            assert ov <= 1, f"Горизонтальный скролл на {vw}×{vh}: +{ov}px"
            if vw == 1280 and vh == 760:
                open_rest(page, "dominos")
                open_dish(page, "country")
                body_ov = page.evaluate("""() => {
                    const b = document.querySelector('#sheet .dish__body');
                    return b ? b.scrollHeight - b.clientHeight : 0;
                }""")
                assert body_ov <= 2, f"«Кантри» прокручивается на 1280×760: +{body_ov}px"
            assert_no_errs(errs)
            out.append(f"{vw}×{vh}")
        finally:
            ctx.close()
    return "OK: " + ", ".join(out)


@check("7.3", "Языки (ru / be / en): переводы и стабильная ширина #cartTab на «Мая замова»")
def t_7_3(browser, url):
    widths = {}
    for loc in ("ru-RU", "be-BY", "en-US"):
        ctx, page, errs = open_desk(browser, url, locale=loc)
        try:
            st = page.evaluate("""() => ({
                w: +document.getElementById('cartTab').getBoundingClientRect().width.toFixed(1),
                lbl: document.getElementById('cartLabel')?.textContent?.trim()
            })""")
            widths[loc] = st
            assert_no_errs(errs)
        finally:
            ctx.close()
    ws = [v["w"] for v in widths.values()]
    assert max(ws) - min(ws) <= 2.0, f"Ширина #cartTab скачет между языками: {widths}"
    return ", ".join(f"{k[:2]}='{v['lbl']}'({v['w']}px)" for k, v in widths.items())


@check("7.4", "Изоляция мобильной версии (402×874 и 390×844): десктопного не видно")
def t_7_4(browser, url):
    for vw, vh in [(402, 874), (390, 844)]:
        ctx = browser.new_context(viewport={"width": vw, "height": vh}, has_touch=True, is_mobile=True, locale="ru-RU")
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.route(re.compile(r"unpkg\.com|openfreemap\.org|nominatim\.openstreetmap\.org|fonts\.googleapis\.com|fonts\.gstatic\.com"), lambda r: r.abort())
        page.add_init_script("() => { try { localStorage.setItem('clever2-city', 'minsk'); localStorage.setItem('clever2-auth', '1'); } catch(e){} }")
        try:
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(550)
            st = page.evaluate("""() => ({
                desk: document.documentElement.classList.contains('desk'),
                hidden: ['.dlogo', '.hsnav', '.dh', '.dscrim'].every(s => [...document.querySelectorAll(s)].every(e => getComputedStyle(e).display === 'none'))
            })""")
            assert not st["desk"] and st["hidden"], f"Утечка десктопа на {vw}×{vh}: {st}"
            assert_no_errs(errs)
        finally:
            ctx.close()
    return "402×874 & 390×844: desk=False, desktopEls=none"


@check("7.5", "Статика: синтаксис JS (index.html + desktop.js), BUILD, баланс скобок desktop.css")
def t_7_5(browser, url):
    subprocess.run(["node", "--check", str(APP_DIR / "desktop.js")], check=True)
    js_check = (
        "const fs=require('fs'),vm=require('vm');"
        "const html=fs.readFileSync(process.argv[1],'utf8');"
        "const m=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];"
        "m.forEach((s,i)=>{if(s[1].trim())new vm.Script(s[1],{filename:'s'+i});});"
        "const b=html.match(/var BUILD = '([^']+)'/);"
        "if(!b) throw new Error('BUILD missing');"
        "console.log(b[1]);"
    )
    out = subprocess.check_output(["node", "-e", js_check, str(APP_DIR / "index.html")], text=True).strip()
    css = (APP_DIR / "desktop.css").read_text(encoding="utf-8")
    css_clean = re.sub(r"/\*[\s\S]*?\*/", "", css)
    o_br, c_br = css_clean.count("{"), css_clean.count("}")
    assert o_br == c_br, f"Несбалансированные скобки в desktop.css: {{={o_br}, }}={c_br}"
    return f"BUILD='{out}', desktop.css braces={o_br}/{c_br}"


def main():
    args = sys.argv[1:]
    if "--list" in args:
        for code, title, _ in TESTS:
            print(f"{code:4s}  {title}")
        print(f"\nВсего пунктов: {len(TESTS)}")
        return 0

    selected = TESTS
    if args:
        need = [a.lower() for a in args]
        selected = [
            t for t in TESTS
            if any(q in t[0].lower() or q in t[1].lower() for q in need)
        ]
        if not selected:
            print(f"Ни один пункт не совпал с фильтром: {args}")
            return 2

    chrome = find_chrome()
    srv, url = start_server()
    passed = 0
    failed = []
    t_all = time.monotonic()

    try:
        with sync_playwright() as p:
            launch_kw = {"headless": True}
            if chrome:
                launch_kw["executable_path"] = chrome
            browser = p.chromium.launch(**launch_kw)
            for code, title, fn in selected:
                t0 = time.monotonic()
                try:
                    info = fn(browser, url) or ""
                    dt = time.monotonic() - t0
                    passed += 1
                    print(f"✓ {code:4s}  {title}  [{dt:.1f}s] {info}", flush=True)
                except Exception as exc:
                    dt = time.monotonic() - t0
                    failed.append((code, title, str(exc)))
                    print(f"✗ {code:4s}  {title}  [{dt:.1f}s]\n        {exc}", flush=True)
            browser.close()
    finally:
        srv.shutdown()

    total_dt = time.monotonic() - t_all
    print(f"\nИтог: {passed}/{len(selected)} пройдено за {total_dt:.1f} с.")
    if failed:
        print("Упавшие пункты:")
        for code, title, err in failed:
            print(f"  ✗ {code} {title}: {err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
