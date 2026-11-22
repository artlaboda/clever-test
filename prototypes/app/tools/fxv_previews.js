#!/usr/bin/env node
/* Превью для скрытых настроек («Для разработчика» → «Варианты»): у каждого варианта — свой снимок, у эффектов — короткий
   ролик (анимированный WebP: iPhone проигрывает его в обычной картинке). Шторка-превью в приложении показывает
   img/fxv/<строка>-<вариант>.webp.

   node tools/fxv_previews.js [строка ...]      без аргументов — все строки; иначе только названные (rmenu rinfo …);
                                                строка:вид,вид — только эти виды строки (num:wheel,board)

   Снимаем в Chromium (Playwright): экран 390×844, полоса под часами 47 px — как у iPhone 13. Статичные варианты — снимок
   нужного места; эффекты — кадр за кадром по виртуальному времени (vFilm): часы страницы и все анимации ведём сами, ровным
   шагом, — 30 кадров в секунду, у цифр — 50 (05.11: «fps в примерах сделай лучше, хотя бы 30, особенно в счётчиках»;
   раньше — запись экрана, кадры приходили неровно, ролик собирался в 20 кадров в секунду). Переходы экранов (seek) — кадр
   за кадром по времени анимаций, шаг step мс. Кадры собирает в WebP tools/fxv_previews.py (Pillow): перед касанием и после —
   короткая пауза, по кругу. */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const pw = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'img', 'fxv');
const W = 390, H = 844, DPR = 2;

const sleep = ms => new Promise(f => setTimeout(f, ms));
async function page(b, fxv, theme, dpr, init) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr || DPR, isMobile: true, hasTouch: true, locale: 'ru-RU' });
    const m = await ctx.newPage();
    if (init) await m.addInitScript(init);   // до скриптов страницы (подменить visualViewport — «клавиатура»)
    await m.route(/unpkg|openfreemap|nominatim/, r => r.abort());   // карта в превью не нужна
    await m.goto('file://' + path.join(ROOT, 'index.html'));
    // одноразовые переводы прежних значений по умолчанию (08.11, 10.11 — выбор владельца) — уже «были»: иначе «Кусочек» снялся бы как «Точки»
    await m.evaluate(f => { localStorage.clear(); localStorage.setItem('clever2-city', 'minsk'); localStorage.setItem('clever2-ts1511', '1'); localStorage.setItem('clever2-tb159', '1'); localStorage.setItem('clever2-tbsel2', '1'); localStorage.setItem('clever2-ri185', '1'); localStorage.setItem('clever2-dcx', '1'); localStorage.setItem('clever2-def1110', '1'); localStorage.setItem('clever2-lk1011', '1'); localStorage.setItem('clever2-fav1111', '1'); localStorage.setItem('clever2-dl1311', '1'); localStorage.setItem('clever2-dc1311', '1'); localStorage.setItem('clever2-hb1311', '1'); localStorage.setItem('clever2-pr1111', '1'); localStorage.setItem('clever2-perf', ''); localStorage.setItem('clever2-oldios', ''); localStorage.setItem('clever2-fxv', JSON.stringify(f)); }, fxv);
    await m.reload(); await sleep(1500);
    if (theme) await m.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await m.addStyleTag({ content: '.app { --top: 47px !important; }' });   // как у iPhone: полоса под часами
    return m;
}
const tap = (m, sel) => m.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); if (!e) throw new Error('нет ' + sel); e.click(); }, sel);
async function openRest(m, id) { await tap(m, '[data-act="open-rest"][data-id="' + id + '"]'); await sleep(1400); }
async function restScroll(m, y) { await m.evaluate(y => { const sc = document.getElementById('restScroll'); for (let v = 0; v <= y; v += 40) { sc.scrollTop = Math.min(v, y); sc.dispatchEvent(new Event('scroll')); } }, y); await sleep(500); }
async function toCart(m) { await tap(m, '[data-act="open-cart"]'); await sleep(1500); }
const rect = (m, sel) => m.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.getClientRects().length); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
// кадр вокруг элемента: на всю ширину, сверху и снизу — запас
async function around(m, sel, above, below) { const r = await rect(m, sel); const y = Math.max(0, Math.round(r.y - above)); return { x: 0, y, width: W, height: Math.min(H - y, Math.round(r.h + above + below)) }; }

// запись экрана: от «до касания» до конца движения; кадры — JPEG во временную папку
async function film(m, act, ms, dir) {
    const cdp = await m.context().newCDPSession(m), frames = [];
    cdp.on('Page.screencastFrame', f => { frames.push({ t: f.metadata.timestamp, data: f.data }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
    await sleep(300);
    const t0 = Date.now() / 1000; await act();
    await sleep(ms);
    await cdp.send('Page.stopScreencast');
    fs.mkdirSync(dir, { recursive: true });
    const list = frames.map((f, i) => { const file = path.join(dir, String(i).padStart(4, '0') + '.jpg'); fs.writeFileSync(file, Buffer.from(f.data, 'base64')); return { file, t: f.t }; });
    return { frames: list, t0 };
}

// ролик по времени (seek): кадр до касания, касание, анимации — на паузу; дальше ставим каждой её время + t и снимаем
async function seekFilm(m, act, ms, step, dir) {
    fs.mkdirSync(dir, { recursive: true });
    const frames = [], T0 = 0.1;
    const shot = async (i, t) => { const file = path.join(dir, String(i).padStart(4, '0') + '.jpg'); await m.screenshot({ path: file, type: 'jpeg', quality: 92 }); frames.push({ file, t }); };
    await shot(0, 0);
    await act();
    await m.evaluate(() => { window.__sk = document.getAnimations().map(a => { a.pause(); return [a, a.currentTime || 0]; }); });
    for (let t = 0, i = 1; t <= ms; t += step, i++) {
        await m.evaluate(t => window.__sk.forEach(([a, c]) => { a.currentTime = c + t; }), t);
        await sleep(40);
        await shot(i, T0 + t / 1000);
    }
    return { frames, t0: T0 };
}

/* ролик по виртуальному времени: часы страницы (таймеры, requestAnimationFrame, performance.now, Date) — Playwright clock,
   на паузе; все анимации (WAAPI и CSS) — тоже на паузе, каждой ставим её время. Шаг — 1000/fps мс: двигаем часы (срабатывают
   таймеры и кадры анимаций на JS), ставим время анимациям, снимаем нужный кусок экрана — ровно fps кадров в секунду, без
   пропусков. Анимация впервые попалась — её время с этого мига (что видно сейчас — то и есть); закончилась — finish(): её
   onfinish и transitionend срабатывают, как вживую, и следующий шаг эффекта начинается вовремя */
async function vFilm(m, act, ms, fps, clip, dir) {
    fs.mkdirSync(dir, { recursive: true });
    const frames = [], step = 1000 / fps;
    await m.clock.install();
    await m.clock.pauseAt(await m.evaluate(() => Date.now()) + 20);
    const sync = () => m.evaluate(() => {
        const now = performance.now();
        for (const a of document.getAnimations()) {
            if (a.__vr == null) { a.__vr = now; a.__c0 = a.currentTime || 0; a.__k = a.playbackRate || 1; }
            const ct = a.__c0 + (now - a.__vr) * a.__k, end = a.effect ? a.effect.getComputedTiming().endTime : 0;
            if (isFinite(end) && (a.__k > 0 ? ct >= end : ct <= 0)) { if (a.playState !== 'finished') a.finish(); }
            else { if (a.playState !== 'paused') a.pause(); a.currentTime = ct; }
        }
    });
    // кадры — PNG, без потерь: где ничего не движется, пиксели в соседних кадрах совпадают точно — WebP их не кодирует заново
    const shot = async (i, t) => { const file = path.join(dir, String(i).padStart(4, '0') + '.png'); await m.screenshot({ path: file, clip }); frames.push({ file, t }); };
    await sync(); await shot(0, 0);
    await act();
    let done = 0;
    for (let i = 1; i * step <= ms + 1e-6; i++) {
        const to = Math.round(i * step); await m.clock.runFor(to - done); done = to;
        await sync();
        await shot(i, i * step / 1000);
    }
    return { frames, t0: 0 };
}

/* что и где снимаем. still — снимок (prep → clip), film — ролик по виртуальному времени (prep → act, ms; fps — 30, если не
   сказано), seek — ролик по времени анимаций (prep → act, ms, step). clip — в точках экрана */
// таб-бар (07.11): эффект значка — зовём сам эффект (без перехода — значок на месте и виден), кадр — вокруг значка
function tbPrev(tab) {
    return { kind: 'film', ms: 1150, prep: async () => {}, act: m => m.evaluate(t => __p.tabFx(document.querySelector('.tab[data-tab="' + t + '"]')), tab),
        clip: async m => { const r = await rect(m, '.tab[data-tab="' + tab + '"] svg.tbi'), cx = r.x + r.w / 2, y = Math.round(r.y - 64);
            return { x: Math.max(0, Math.min(W - 150, Math.round(cx - 75))), y, width: 150, height: Math.min(H - y, 124) }; } };
}
// 15.11, ночью: значки бейджей — шторка блюда (все метки блюда, у каждой значок) и карточка заведения на главной
const badgeDish = (rid, dish) => ({ kind: 'still', prep: async m => { await openRest(m, rid); await m.evaluate(d => { const it = document.querySelector('#s-rest .item[data-item="' + d + '"]'); (it.querySelector('[data-act="open-dish"]') || it).click(); }, dish); await sleep(1500); },
    clip: m => around(m, '#sheet .dish__stage .item__tags', 16, 16) });
const badgeRest = id => ({ kind: 'still', prep: async m => { await m.evaluate(id => { const c = [...document.querySelectorAll('#homeScroll .rest[data-id="' + id + '"]')].find(x => x.getClientRects().length); c.scrollIntoView({ block: 'center' }); }, id); await sleep(700); },
    clip: m => around(m, '#homeScroll .rest[data-id="' + id + '"] .rest__pic', 6, 6) });
const ROWS = {
    tbh: tbPrev('home'), tbp: tbPrev('profile'), tbs: tbPrev('search'), tbf: tbPrev('fav'), tbc: tbPrev('cart'),
    // выбранная вкладка: «Профиль», через 0,75 с — «Избранное»: заливка (или точка) переезжает
    tbsel: { kind: 'film', ms: 1700, prep: async () => {}, act: m => m.evaluate(() => { document.querySelector('.tab[data-tab="profile"]').click(); setTimeout(() => document.querySelector('.tab[data-tab="fav"]').click(), 750); }),
        clip: async () => ({ x: 0, y: H - 96, width: W, height: 96 }) },
    // «Снова хочется: шторка» (17.11): шторка «Вы заказывали 4 раза» (Американо) целиком — тёплая шторка и белый список или наоборот
    agnbg: { kind: 'still', prep: async m => {
            await m.evaluate(() => { const c = document.querySelector('#homeScroll .dcard--again[data-dish="americano"]'); c.closest('.hscroll').scrollLeft = Math.max(0, c.offsetLeft - 16); c.scrollIntoView({ block: 'center' }); });
            await sleep(500); await tap(m, '#homeScroll .dcard--again[data-dish="americano"] .dcard__times'); await sleep(1800); },
        clip: async m => { const r = await rect(m, '#sheet'); const y = Math.max(0, Math.round(r.y) - 12); return { x: 0, y, width: W, height: H - y }; } },
    // вход: значок замка — снимок верха шторки входа; «код верный — эффект» — ролик: щит → кружок с галочкой (10.11). С 17.11 значка
    // по умолчанию нет — замок снимаем с «Вход: значок» → Замок
    // вход: капча (20.11) — «Проходит сама»: лоток «Готово»; «Просит галочку»: форма Cloudflare. Кадр — от поля до кнопки
    authbot: { kind: 'still', prep: async (m, v) => { await m.evaluate(() => __p.authOpen({})); await sleep(v === 'ask' ? 2800 : 2000); },
        clip: async m => { const p = await rect(m, '#sheet .auth__ph'), g = await rect(m, '#authGo'), y = Math.max(0, Math.round(p.y - 14)); return { x: 0, y, width: W, height: Math.min(H - y, Math.round(g.y + g.h + 14 - y)) }; } },
    // вход: заголовок и подпись (18.11) — снимок шторки входа от верха до кнопки, капча уже спряталась
    authhd: { kind: 'still', prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(4800); },
        clip: async m => { const s = await rect(m, '#sheet'), g = await rect(m, '#authGo'), y = Math.max(0, Math.round(s.y)); return { x: 0, y, width: W, height: Math.min(H - y, Math.round(g.y + g.h + 14 - y)) }; } },
    lock: { kind: 'still', fx: { authic: 'lock' }, prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(1500); }, clip: m => around(m, '#authLogo', 14, 62) },
    /* вход: выбор страны (17.11) — ролик: шторка входа, касание чипа «флаг +375» → выбор раскрылся → «Россия» (у барабана —
       колесо прокручивается на строку и встаёт, потом «Готово») → чип «+7», маска «900 000-00-00». Кадр — шторка целиком */
    authcc: { kind: 'film', ms: 2700, prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(1800); },
        act: (m, v) => m.evaluate(v => {
            setTimeout(() => document.getElementById('authCc').click(), 150);
            if (v === 'wheel') {
                setTimeout(() => { const wh = document.querySelector('#ccp .ccp__wh'), rh = wh.querySelector('.ccp__row').offsetHeight, t0 = performance.now();
                    (function f() { const q = Math.min(1, (performance.now() - t0) / 420), e = 1 - Math.pow(1 - q, 3); wh.scrollTop = e * rh; if (q < 1) requestAnimationFrame(f); })(); }, 1000);
                setTimeout(() => { const d = document.querySelector('#ccp [data-act="cc-done"]'); if (d) d.click(); }, 1950);
            } else setTimeout(() => { const r = document.querySelector('#ccp [data-cc="ru"]'); if (r) r.click(); }, 1150);
        }, v),
        clip: async m => { const s = await rect(m, '#sheet'), y = Math.max(0, Math.round(s.y) - 8); return { x: 0, y, width: W, height: H - y }; } },
    /* вход: значок (17.11) — ролик верного кода: шаг кода (номер набран, «Получить код»), код 0505 одним событием (как из СМС над
       клавиатурой). Без значка — цифры зеленеют и собираются в кружок с галочкой; замок — щит перетекает в кружок. Кадр — шторка
       от верха до кнопки */
    authic: { kind: 'film', ms: 1700, prep: async m => {
            await m.evaluate(() => { __p.authOpen({}); const f = document.getElementById('authPhone'); f.value = '291234567'; f.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: f.value })); });
            await sleep(1700); await tap(m, '#authGo'); await sleep(1500); await m.evaluate(() => { const t = document.getElementById('toast'); if (t) t.style.visibility = 'hidden'; }); },
        // дыхание точки кода (бесконечное, на ::before) часы ролика держат на паузе — и точка оставалась внутри «0»: гасим его до ввода
        act: m => m.evaluate(() => { document.getAnimations().forEach(a => { if (a.animationName === 'authBreath') a.cancel(); }); const f = document.getElementById('authCode'); f.value = '0505'; f.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: '0505' })); }),
        clip: async m => { const s = await rect(m, '#sheet'), g = await rect(m, '#authGo'), y = Math.max(0, Math.round(s.y)); return { x: 0, y, width: W, height: Math.min(H - y, Math.round(g.y + g.h + 14 - y)) }; } },
    /* своя клавиатура входа (16.11): вид — два снимка одно под другим (номер набран наполовину; шаг кода — две цифры), эффект —
       ролик: шторка выезжает, клавиши появляются, потом три касания (2, 9, 1) — нажатие и цифра в поле. Касания — события
       пальца на клавише (pointerdown / pointerup), по виртуальным часам ролика */
    akbv: { kind: 'stills', fx: { akbk: 'own' }, prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(1500); for (const k of '29123') { await tap(m, '#akb [data-k="' + k + '"]'); await sleep(120); } await sleep(900); },
        steps: [async m => around(m, '#sheet .auth__ph', 14, 14),
            async m => { for (const k of '4567') { await tap(m, '#akb [data-k="' + k + '"]'); await sleep(120); } await sleep(500); await tap(m, '#authGo'); await sleep(1400);
                for (const k of '05') { await tap(m, '#akb [data-k="' + k + '"]'); await sleep(150); } await sleep(900);
                const a = await rect(m, '#authCells'), b = await rect(m, '#akb'), y = Math.round(a.y - 8); return { x: 0, y, width: W, height: Math.min(H - y, Math.round(b.y + b.h + 10 - y)) }; }] },
    akb: { kind: 'film', ms: 2300, fx: { akbk: 'own' }, prep: async () => {},
        act: m => m.evaluate(() => {
            __p.authOpen({});
            const press = (k, t) => setTimeout(() => { const b = document.querySelector('#akb [data-k="' + k + '"]'); if (!b) return; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, button: 0, pointerType: 'touch' }));
                setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerType: 'touch' })), 170); }, t);
            press('2', 1150); press('9', 1500); press('1', 1850);
        }),
        clip: async () => ({ x: 0, y: H - 520, width: W, height: 520 }) },
    /* клавиатура входа (17.11): «Системная» — шторка над цифровой клавиатурой iPhone. В Chromium её нет: visualViewport подменён
       (как в проверках), клавиатура нарисована поверх — полоса подсказки Safari с номером и цифры 3×4. «Своя» — шторка со своей
       клавиатурой. В номере — «29 123», снимок экрана целиком */
    akbk: { kind: 'still',
        init: () => { const f = new EventTarget(); f.k = null; Object.defineProperty(f, 'height', { get: () => f.k ? f.k.h : innerHeight }); Object.defineProperty(f, 'offsetTop', { get: () => 0 });
            Object.defineProperty(window, 'visualViewport', { value: f }); window._kb = k => { f.k = k; f.dispatchEvent(new Event('resize')); }; },
        prep: async m => {
            await m.evaluate(() => __p.authOpen({})); await sleep(1300);
            if (await m.$('#akb')) { for (const k of '29123') { await tap(m, '#akb [data-k="' + k + '"]'); await sleep(140); } await sleep(800); return; }
            await m.evaluate(() => {
                const KH = 300, kb = document.createElement('div'), L = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
                kb.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:' + KH + 'px;z-index:9999;background:#d4d6dc;font-family:-apple-system,system-ui,sans-serif;color:#111;box-sizing:border-box;padding:0 6px';
                const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(k => !k ? '<i></i>' : k === 'del'
                    ? '<i style="display:grid;place-items:center;font-size:22px;font-style:normal">⌫</i>'
                    : '<i style="display:grid;place-content:center;justify-items:center;background:#fff;border-radius:7px;box-shadow:0 1px 0 rgba(0,0,0,.28);font-style:normal"><b style="font:400 25px/1 inherit">' + k + '</b><small style="font:600 9px/1.3 inherit;letter-spacing:2px;min-height:12px">' + (L[k] || '') + '</small></i>').join('');
                kb.innerHTML = '<div style="height:46px;display:flex;align-items:center;justify-content:center;font:500 15px/1 inherit;color:#222;border-bottom:.5px solid rgba(0,0,0,.08)">+375 29 123-45-67</div>' +
                    '<div style="display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:47px;gap:7px 6px;padding-top:8px">' + keys + '</div>';
                document.body.appendChild(kb);
                window._kb({ h: innerHeight - KH, t: 0 }); document.getElementById('authPhone').focus({ preventScroll: true });
            });
            await sleep(900); await m.keyboard.type('29123'); await sleep(900);
        },
        clip: async () => ({ x: 0, y: 0, width: W, height: H }) },
    // вид шторки входа (16.11: теперь со своей клавиатурой) — снимок всей шторки
    auth: { kind: 'still', prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(1600); }, clip: async () => ({ x: 0, y: 40, width: W, height: H - 40 }) },
    lockfx: { kind: 'film', ms: 1900, fx: { authic: 'lock' }, prep: async m => { await m.evaluate(() => __p.authOpen({})); await sleep(1500); }, act: m => m.evaluate(() => __p.authShieldOk(document.getElementById('authLogo'))), clip: m => around(m, '#authLogo', 46, 62) },
    /* разбитое сердце (11.11): Terra, первая карточка сетки — блюдо в избранном, касание сердца. Сердце маленькое (значок 21 px):
       кадр — 72×90 точек вокруг него при плотности 7,5 (в шторке-превью сердце выходит шириной около 95 точек — трещину и куски
       видно), 50 кадров в секунду */
    hbrk: { kind: 'film', ms: v => v === 'mend' ? 3300 : v === 'boltash' ? 3200 : v === 'bolt' ? 2500 : 1500, fps: 50, dpr: 7.5, prep: async m => { await openRest(m, 'terra'); await restScroll(m, 760);
            await m.evaluate(() => { const it = document.querySelector('#s-rest .grid2 .item'), sc = document.querySelector('#s-rest .scroll'); sc.scrollTop += it.getBoundingClientRect().top - 236; }); await sleep(500);
            await m.evaluate(() => { const b = document.querySelector('#s-rest .grid2 .item .item__fav'); if (!b.classList.contains('is-on')) b.click(); }); await sleep(1500); },
        act: (m, v) => m.evaluate(v => { const b = document.querySelector('#s-rest .grid2 .item .item__fav'); b.click(); if (v === 'mend') setTimeout(() => b.click(), 1750); }, v),   // «Молния + бинт» (12.11): разбитое остаётся — второе касание его составляет и бинтует
        clip: async m => { const r = await rect(m, '#s-rest .grid2 .item .item__fav svg'); return { x: Math.round(r.x + r.w / 2 - 36), y: Math.round(r.y + r.h / 2 - 24), width: 72, height: 90 }; } },   // «Молния в пепел» осыпается, как «Пепел», — кадр тот же
    // значки акций (13.11, ещё позже): Мангал — скидка, доставка, подарок; билет скрыт, строка переносится, чтобы все три значка
    // были видны сразу; светлая и тёмная тема одна под другой
    dico: { kind: 'stills', prep: async m => { await openRest(m, 'mangal'); await sleep(900);
            await m.evaluate(() => { const row = document.querySelector('#s-rest .ri-tks'), t = row.querySelector('.ri-tk--pick'); if (t) t.style.display = 'none'; row.style.flexWrap = 'wrap'; row.style.rowGap = '8px'; row.querySelectorAll('.ri-tk').forEach(p => { p.style.minWidth = ''; }); }); await sleep(300); },
        steps: [null, 'dark'].map(t => async m => { await m.evaluate(t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }, t); await sleep(500);
            const r = await rect(m, '#s-rest .ri-tks'); return { x: 0, y: Math.round(r.y + 12), width: W, height: Math.round(r.h - 8) }; }) },
    // плашки акций (12.11): страница Доминос (три плашки, лента) — светлая и тёмная тема одна под другой
    deal: { kind: 'stills', prep: async m => { await openRest(m, 'dominos'); await sleep(900); },
        steps: [null, 'dark'].map(t => async m => { await m.evaluate(t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }, t); await sleep(700); return around(m, '#s-rest .ri-tks', 14, 14); }) },
    rinfo: { kind: 'still', prep: async m => { await openRest(m, 'dominos'); }, clip: async () => ({ x: 0, y: 0, width: W, height: 640 }) },
    rbtn: { kind: 'still', prep: async m => { await openRest(m, 'dominos'); }, clip: async () => ({ x: 0, y: 0, width: W, height: 200 }) },
    fav: { kind: 'still', prep: async m => { await openRest(m, 'terra'); await restScroll(m, 760);   // карточки — целиком под липким рядом категорий: сердца видны
        await m.evaluate(() => { const it = document.querySelector('#s-rest .grid2 .item'), sc = document.querySelector('#s-rest .scroll'); sc.scrollTop += it.getBoundingClientRect().top - 236; }); await sleep(500); }, clip: m => around(m, '#s-rest .grid2 .item', 12, 300) },
    promo: { kind: 'stills', prep: async m => { await m.evaluate(() => document.getElementById('promoRow').scrollIntoView({ block: 'center' })); await sleep(600); },
        steps: [2, 4].map(i => async m => { await m.evaluate(i => { const r = document.getElementById('promoRow'); r.scrollLeft = r.children[i].offsetLeft - 16; }, i); await sleep(400); return around(m, '#promoRow', 10, 10); }) },
    // полоса доставки — два состояния: в начале пути (¼) и дальше 60% (¾) — у «Смешанного» призыв там меняется
    dlv: { kind: 'stills', prep: async m => { await openRest(m, 'terra'); await tap(m, '#s-rest .item .plus[data-act="quick-add"][data-id="steak"]'); await sleep(900); await toCart(m); },
        steps: [async m => { await m.evaluate(() => document.querySelector('#s-cart .dlv').scrollIntoView({ block: 'center' })); await sleep(500); return around(m, '#s-cart .dlv', 12, 12); },
            async m => { for (let i = 0; i < 2; i++) { await tap(m, '#s-cart .citem .stepper [data-d="1"]'); await sleep(700); } await m.evaluate(() => document.querySelector('#s-cart .dlv').scrollIntoView({ block: 'center' })); await sleep(900); return around(m, '#s-cart .dlv', 12, 12); }] },
    // «назад» с витрины Terra (в заказе блюдо) на главную: уход экрана, тень и притемнение, плашка заказа, таб-бар
    // «вперёд»: витрина с блюдом в заказе → корзина по стики-бару; движение начинается со второго кадра — ждём его, потом пауза
    fwd: { kind: 'seek', ms: 640, step: 32, w: 420, prep: async m => { await openRest(m, 'terra'); await tap(m, '#s-rest .plus[data-act="quick-add"]'); await sleep(2400); },
        act: m => m.evaluate(() => new Promise(r => { document.getElementById('cartbar').click(); requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))); })), clip: async () => ({ x: 0, y: 0, width: W, height: H }) },
    back: { kind: 'seek', ms: 640, step: 32, w: 420, prep: async m => { await openRest(m, 'terra'); await tap(m, '#s-rest .plus[data-act="quick-add"]'); await sleep(2400); },   // подсказка «в заказе» успела уйти
        act: m => tap(m, '#s-rest [data-act="back"]'), clip: async () => ({ x: 0, y: 0, width: W, height: H }) },
    // рейтинг блюда: Доминос — десерты (вафли 2,7 — красный, оладьи 4,8 — зелёный) и напитки (американо 4,3 — салатовый, чай 3,3 — жёлтый)
    drate: { kind: 'stills', prep: async m => { await openRest(m, 'dominos'); },
        steps: ['cinnabon', 'americano'].map(id => async m => { await m.evaluate(id => { const sc = document.getElementById('restScroll'), c = document.querySelector('#s-rest .grid2 .item[data-item="' + id + '"]'); sc.scrollTop += c.getBoundingClientRect().top - 260; sc.dispatchEvent(new Event('scroll')); }, id); await sleep(700); return around(m, '#s-rest .grid2 .item[data-item="' + id + '"]', 10, 10); }) },
    // значок «Хит»: Terra — стейк (метки «Хит», «От шефа» и бейдж рейтинга на фото)
    hit: { kind: 'still', prep: async m => { await openRest(m, 'terra'); await m.evaluate(() => { const sc = document.getElementById('restScroll'), c = document.querySelector('#s-rest .grid2 .item[data-item="steak"]'); sc.scrollTop += c.getBoundingClientRect().top - 260; sc.dispatchEvent(new Event('scroll')); }); await sleep(700); },
        clip: m => around(m, '#s-rest .grid2 .item[data-item="steak"]', 10, 10) },
    tgnew: badgeDish('terra', 'bowl'), tghot: badgeDish('dominos', 'wings'), tgchef: badgeDish('terra', 'caesar'), tgveg: badgeDish('fusion', 'poke'),
    tglean: badgeDish('fusion', 'poke'), tggf: badgeDish('fusion', 'poke'), tgsale: badgeDish('terra', 'bowl'),
    rnew: badgeRest('letitbe'), rsale: badgeRest('letitbe'), rgift: badgeRest('tempo'),
    // зачёркивание в корзине: Fusion — боул (название в две строки) и ещё блюдо; ролик — касание «−» (урна) у боула
    cstrike: { kind: 'film', ms: 1600, prep: async m => { await openRest(m, 'fusion');
            for (const it of ['poke', 'roll']) { await m.evaluate(it => { const e = [...document.querySelectorAll('#s-rest .item[data-item="' + it + '"] [data-act="quick-add"]')].find(x => x.getClientRects().length) || [...document.querySelectorAll('#s-rest [data-act="quick-add"]')].find(x => x.getClientRects().length); e && e.click(); }, it); await sleep(500); }
            await toCart(m); await m.evaluate(() => { document.querySelector('#s-cart > .scroll').scrollTop = 0; }); await sleep(400);
            // «Чирк»: каждое пятое удаление — широкая каракуля (мешочком по пять); на ролике нужен сам чирк — убираем и возвращаем второе
            // блюдо, пока широкая не выпадет не последней в своей пятёрке: тогда следующее удаление — точно чирк
            const warm = await m.evaluate(() => { if (document.querySelector('[data-cstrike]').dataset.cstrike !== 'flick') return 0;
                for (let n = 1; n <= 30; n++) {
                    const rows = document.querySelectorAll('#s-cart .citem'); rows[rows.length - 1].querySelector('[data-d="-1"]').click();
                    const off = document.querySelector('#s-cart .citem--off'), wide = !!off.querySelector('.cstrike[data-style]');
                    off.querySelector('[data-act="restore-line"]').click();
                    if (wide && n % 5) return n;
                }
                return -1; });
            if (warm) await sleep(1500); },
        act: m => m.evaluate(() => document.querySelector('#s-cart .citem [data-d="-1"]').click()),
        clip: async m => { const r = await rect(m, '#s-cart .citem'); const y = Math.max(0, Math.round(r.y - 14)); return { x: 0, y, width: W, height: Math.round(r.h + 28) }; } },
    // промокод в корзине: два блюда, корзина, промокод на середине экрана; ролик — фокус (у «Свёрнуто» — касание строки), код
    // по букве, применить (у «Подсказки» — касание готового кода)
    pcode: { kind: 'film', ms: 3600, prep: async m => { for (const id of ['steak', 'pasta']) { await tap(m, '#homeScroll [data-act="quick-add"][data-id="' + id + '"]'); await sleep(400); } await toCart(m);
            await m.evaluate(() => { const p = document.querySelector('#s-cart .pcode'), sc = document.querySelector('#s-cart > .scroll'); sc.scrollTop += p.getBoundingClientRect().top - 330; }); await sleep(600); },
        act: m => m.evaluate(() => { const q = s => document.querySelector(s), v = q('#s-cart .pcode').className, wait = ms => new Promise(r => setTimeout(r, ms));
            (async () => {
                await wait(400);
                if (/pcode--chips/.test(v)) { q('#s-cart .pchip').click(); return; }
                if (/pcode--fold/.test(v)) { q('#s-cart .pfold').classList.add('is-open'); await wait(60); q('#promoField').focus({ preventScroll: true }); await wait(600); }   // как касание строки, но без подъёма приложения под клавиатуру (её в превью нет) else { q('#promoField').focus(); await wait(450); }
                const f = q('#promoField');
                for (const ch of 'CLEVER10') { f.value += ch; f.dispatchEvent(new Event('input', { bubbles: true })); await wait(95); }
                await wait(450);
                (q('#s-cart .pcode .pfield__go') || q('#s-cart .pcode [data-act="promo"]')).click();
            })(); }),
        clip: async m => { const r = await rect(m, '#s-cart .pcode'); const y = Math.max(0, Math.round(r.y - 96)); return { x: 0, y, width: W, height: Math.min(H - y, 400) }; } },
    // метки на фото блюда: Fusion — поке и боул (по 3 метки) выезжают снизу на экран; ролик 3 с (раскрытие и смена карусели)
    dtags: { kind: 'film', ms: 3000, prep: async m => { await openRest(m, 'fusion'); await m.evaluate(() => { const sc = document.getElementById('restScroll'), c = document.querySelector('#s-rest .grid2 .item[data-item="poke"]'); sc.scrollTop += c.getBoundingClientRect().top - 900; sc.dispatchEvent(new Event('scroll')); }); await sleep(600); },
        act: m => m.evaluate(() => { const sc = document.getElementById('restScroll'); let k = 0; const f = () => { sc.scrollTop += 22; sc.dispatchEvent(new Event('scroll')); if (++k < 24) requestAnimationFrame(f); }; requestAnimationFrame(f); }),
        clip: async () => ({ x: 0, y: 260, width: W, height: 560 }) },
    // меню категорий: касание третьего пункта — стекло (линза летит, раздувается и садится) и прежний ряд с его переездами
    rmenu: { kind: 'film', ms: 1100, prep: async m => { await openRest(m, 'dominos'); await restScroll(m, 520); },
        act: m => tap(m, '#rtabs button:nth-of-type(3)'), clip: async m => { const r = await rect(m, '#rtabs'); return { x: 0, y: 0, width: W, height: Math.round(r.y + r.h + 150) }; } },
    // стики-бар: два блюда подряд — второе через 0,3 с (таймер страницы — на тех же виртуальных часах): видно, как волны складываются
    cbar: { kind: 'film', ms: 2500, prep: async m => { await openRest(m, 'terra'); await restScroll(m, 760); await tap(m, '#s-rest .grid2 .item .plus[data-act="quick-add"]'); await sleep(1600); },
        act: m => m.evaluate(() => {
            const q = sel => [...document.querySelectorAll(sel)].find(x => x.getClientRects().length);
            q('#s-rest .grid2 .item:nth-of-type(2) .plus[data-act="quick-add"]').click();
            setTimeout(() => { const b = q('#s-rest .grid2 .item:nth-of-type(2) .qty [data-act="quick-add"]'); if (b) b.click(); }, 300);
        }), clip: async () => ({ x: 0, y: 300, width: W, height: H - 300 }) },
    tab: { kind: 'film', ms: 1700, prep: async m => { await m.evaluate(() => { const s = document.getElementById('homeScroll'), c = [...s.querySelectorAll('[data-act="quick-add"]')].find(x => x.getClientRects().length); s.scrollTop += c.getBoundingClientRect().top - 520; }); await sleep(600); },
        act: m => tap(m, '#homeScroll [data-act="quick-add"]'), clip: async () => ({ x: 0, y: 380, width: W, height: H - 380 }) },
    tail: { kind: 'film', ms: 1100, prep: async m => { await m.evaluate(() => { const s = document.getElementById('homeScroll'), c = [...s.querySelectorAll('[data-act="quick-add"]')].find(x => x.getClientRects().length); s.scrollTop += c.getBoundingClientRect().top - 420; }); await sleep(600); },
        act: m => tap(m, '#homeScroll [data-act="quick-add"]'), clip: async () => ({ x: 0, y: 280, width: W, height: H - 280 }) },
    press: { kind: 'film', ms: 900, prep: async m => { await openRest(m, 'terra'); await restScroll(m, 760); await tap(m, '#s-rest .grid2 .item .plus[data-act="quick-add"]'); await sleep(1600); },
        act: m => tap(m, '#s-rest .grid2 .item .qty [data-act="quick-add"]'), clip: m => around(m, '#s-rest .grid2 .item .qty', 230, 40) },
    // переключатель «Доставка / Заберу сам» в оформлении: касание «Заберу сам», через 0,8 с — «Доставка» (таймер страницы — на тех же часах)
    seg: { kind: 'film', ms: 1700, prep: async m => { await tap(m, '#homeScroll [data-act="quick-add"][data-id="steak"]'); await sleep(450); await toCart(m); await tap(m, '[data-act="to-checkout"]'); await sleep(1300); },
        act: m => m.evaluate(() => { document.querySelector('#s-checkout [data-act="mode"][data-id="pickup"]').click(); setTimeout(() => document.querySelector('#s-checkout [data-act="mode"][data-id="delivery"]').click(), 800); }),
        clip: async m => { const r = await rect(m, '#s-checkout .co__mode'); return { x: 0, y: Math.max(0, r.y - 70), width: W, height: r.h + 150 }; } },
    // дымок над огоньком: оформление, «Ко времени» — огонёк гаснет и дымит (видно и над плиткой)
    smoke: { kind: 'film', ms: 2300, prep: async m => { await tap(m, '#homeScroll [data-act="quick-add"][data-id="steak"]'); await sleep(450); await toCart(m); await tap(m, '[data-act="to-checkout"]'); await sleep(1300);
            await m.evaluate(() => { const sc = document.querySelector('#s-checkout .scroll'), w = document.querySelector('#s-checkout .cwhen'); sc.scrollTop += w.getBoundingClientRect().top - 330; window.__smokeCurl = true; }); await sleep(500); },   // в ролике «Струек» — и завиток
        act: m => m.evaluate(() => document.querySelector('#s-checkout [data-act="slot-plan"]').click()),
        clip: async m => { const r = await rect(m, '#s-checkout .cwhen'); return { x: 0, y: Math.max(0, r.y - 150), width: W, height: 290 }; } },
    // оформление заказа: два блюда, корзина, «Перейти к оформлению» — экран без кнопки внизу
    co: { kind: 'still', prep: async m => { for (const id of ['steak', 'pasta']) { await tap(m, '#homeScroll [data-act="quick-add"][data-id="' + id + '"]'); await sleep(450); } await toCart(m); await tap(m, '[data-act="to-checkout"]'); await sleep(1300); },
        clip: async () => ({ x: 0, y: 0, width: W, height: 740 }) },
    // «Заберу сам»: острова (три + «Ещё 4 адреса») или карта с точками — «Плитки», корзина из Доминоса (семь точек)
    pick: { kind: 'still', prep: async m => {
            await m.evaluate(() => { const f = JSON.parse(localStorage.getItem('clever2-fxv') || '{}'); f.co = 'bento'; localStorage.setItem('clever2-fxv', JSON.stringify(f)); }); await m.reload(); await sleep(1500);
            await openRest(m, 'dominos'); await tap(m, '#s-rest [data-act="quick-add"]'); await sleep(600); await toCart(m); await tap(m, '[data-act="to-checkout"]'); await sleep(1300);
            await tap(m, '#s-checkout [data-act="mode"][data-id="pickup"]'); await sleep(1200);
            await m.evaluate(() => { const w = document.querySelector('#s-checkout .pkis, #s-checkout .bt--pick'), sc = document.querySelector('#s-checkout .scroll'); sc.scrollTop += w.getBoundingClientRect().top - 120; }); await sleep(500); },
        clip: async () => ({ x: 0, y: 60, width: W, height: 620 }) },
    // шторка блюда, низ: боул, «+» один раз — «− 2 +» и кнопка с суммой
    dfoot: { kind: 'still', prep: async m => { await openRest(m, 'fusion'); await tap(m, '#s-rest .item[data-item="poke"] [data-act="open-dish"]'); await sleep(1200); await tap(m, '#sheet .dfoot [data-act="dqty"][data-d="1"]'); await sleep(900); },
        clip: m => around(m, '#sheet .dfoot', 70, 0) },
    num: { kind: 'film', ms: 2100, fps: 50, prep: async m => { await openRest(m, 'terra'); await restScroll(m, 760); for (let i = 0; i < 3; i++) { await tap(m, '#s-rest .grid2 .item .plus[data-act="quick-add"], #s-rest .grid2 .item .qty [data-act="quick-add"]'); await sleep(700); } await sleep(900); },
        act: m => tap(m, '#s-rest .grid2 .item .qty [data-act="quick-add"]'), clip: async () => ({ x: 0, y: H - 260, width: W, height: 260 }) },
    ups: { kind: 'film', ms: 1700, prep: async m => { for (const id of ['steak', 'pasta']) { await tap(m, '#homeScroll [data-act="quick-add"][data-id="' + id + '"]'); await sleep(400); } await toCart(m); await m.evaluate(() => { const u = document.querySelector('#s-cart .ups'); u && u.closest('.sec').scrollIntoView({ block: 'end' }); }); await sleep(600); },
        act: m => tap(m, '#s-cart .ups[data-act="quick-add"]'), clip: async () => ({ x: 0, y: 60, width: W, height: H - 60 }) }
};

(async () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const rows = new Function('return ' + /var FXV_ROWS = (\[[\s\S]*?\n    \]);/.exec(html)[1].replace(/\bic\([^)]*\)/g, "''"))();
    const only = process.argv.slice(2).map(a => a.split(':')[0]), pick = {};
    process.argv.slice(2).forEach(a => { const [k, vs] = a.split(':'); if (vs) pick[k] = vs.split(','); });
    fs.mkdirSync(OUT, { recursive: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fxv-')), jobs = [];
    const b = await pw.chromium.launch();
    for (const r of rows) {
        const k = r[0], spec = ROWS[k];
        if (!spec || (only.length && !only.includes(k))) continue;
        for (const [v] of r[3]) {
            if (pick[k] && !pick[k].includes(v)) continue;
            const m = await page(b, Object.assign({ [k]: v }, spec.fx || {}), null, spec.dpr, spec.init);   // fx — что ещё выбрать в «Вариантах» для снимка
            try {
                await spec.prep(m, v);   // v — вид строки (20.11: authbot ждёт по-разному)
                const clip = spec.clip ? await spec.clip(m) : null;
                const dir = path.join(tmp, k + '-' + v);
                if (spec.kind === 'stills') {   // несколько состояний — одно под другим
                    fs.mkdirSync(dir, { recursive: true }); const files = [];
                    for (let i = 0; i < spec.steps.length; i++) { const c = await spec.steps[i](m), f = path.join(dir, 'still' + i + '.png'); await m.screenshot({ path: f, clip: c }); files.push(f); }
                    jobs.push({ k, v, kind: 'stills', files });
                } else if (spec.kind === 'still') { fs.mkdirSync(dir, { recursive: true }); await m.screenshot({ path: path.join(dir, 'still.png'), clip }); jobs.push({ k, v, kind: 'still', file: path.join(dir, 'still.png') }); }
                else if (spec.kind === 'seek') { const f = await seekFilm(m, () => spec.act(m), spec.ms, spec.step, dir); jobs.push({ k, v, kind: 'film', clip, dpr: DPR, t0: f.t0, frames: f.frames, step: spec.step / 1000, w: spec.w }); }
                else { const fps = spec.fps || 30, f = await vFilm(m, () => spec.act(m, v), typeof spec.ms === 'function' ? spec.ms(v) : spec.ms, fps, clip, dir); jobs.push({ k, v, kind: 'film', clip, cropped: true, dpr: spec.dpr || DPR, t0: f.t0, frames: f.frames, step: 1 / fps, w: spec.w }); }
                console.log('снято', k + '-' + v);
            } catch (e) { console.log('НЕ снято', k + '-' + v + ':', e.message); }
            await m.context().close();
        }
    }
    await b.close();
    fs.writeFileSync(path.join(tmp, 'jobs.json'), JSON.stringify({ out: OUT, jobs }));
    cp.execFileSync('python3', [path.join(__dirname, 'fxv_previews.py'), path.join(tmp, 'jobs.json')], { stdio: 'inherit' });
    fs.rmSync(tmp, { recursive: true, force: true });
})();
