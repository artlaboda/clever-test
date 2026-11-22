/* Прогон улиц Беларуси: как приложение показывает каждый адрес в тесных местах — по правилам переноса и сокращений
   (stPlan в index.html, README → «Адреса: переносы и сокращения»). Улицы — tools/streets-by.txt; дом у каждой — свой,
   из набора настоящих номеров («21», «117А», «15/2»…), одинаковый от прогона к прогону.
   Места (экран 390 px, как у iPhone 13; шрифт приложения — Golos):
   • плитка «Куда» в оформлении «Плитки» — 750 19 px, до трёх строк, кегль — до 16 px;
   • шапка главной — «Сокращать» (одна строка, не влезло — бежит) и «Две строки»;
   • «Улица и дом» в оформлении «Чисто» — 600 16 px, до трёх строк.
   Язык (06.11: адреса на языке приложения) — третьим аргументом: ru (как было), en — английская латиница от русского названия
   («Nezavisimosti Ave, 21»), be — беларускія назвы, какие знает приложение (словарь ST_BE; остальные улицы пропускаем).
   node tools/streets.js [index.html] [итог.json] [ru|en|be] — в консоли сводка по правилам, в файле — каждая улица */
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const fs = require('fs'), path = require('path');
const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html')), LANG = process.argv[4] || 'ru',
    out = process.argv[3] || path.join(__dirname, 'streets-run' + (LANG === 'ru' ? '' : '-' + LANG) + '.json');
const HOUSES = ['1', '2', '5', '7', '12', '14', '21', '26', '33', '48', '65', '103', '117А', '15/2', '150'];
// примеры к правилам (README, страница «Переносы адресов») — ровно эти адреса
const EXAMPLES = ['ул. Свердлова, 22', 'пр-т Победителей, 65', 'пр-т Независимости, 21', 'Партизанский пр-т, 150', 'ул. Максима Богдановича, 2', 'ул. Героев 120 Дивизии, 15',
    'ул. Интернационалистов, 21', 'ул. Героев Обороны Брестской Крепости, 1', 'пр-т Генерала Людникова, 15', 'ул. Иркутско-Пинской Дивизии, 7', 'ул. Большая Троицкая, 117А'];
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const list = []; let city = '';
fs.readFileSync(path.join(__dirname, 'streets-by.txt'), 'utf8').split('\n').forEach(l => {
    l = l.trim(); if (!l) return;
    if (/^#\s*[А-ЯЁ]/.test(l) && l.length < 30) { city = l.replace(/^#\s*/, ''); return; }
    if (l[0] === '#') return;
    list.push({ city, name: l, st: l + ', ' + HOUSES[hash(l) % HOUSES.length] });
});
(async () => {
    const b = await pw.chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' }), m = await ctx.newPage();
    const errs = []; m.on('pageerror', e => errs.push(e.message));
    await m.route(/unpkg|openfreemap|nominatim/, r => r.abort());
    if (process.env.FONTROUTE) await require(process.env.FONTROUTE)(m);   // шрифты из своего кэша (если Google Fonts недоступен)
    await m.goto('file://' + file);
    await m.evaluate(() => { localStorage.clear(); localStorage.setItem('clever2-city', 'minsk'); localStorage.setItem('clever2-fxv', JSON.stringify({ co: 'bento' })); });
    await m.reload(); await m.evaluate(() => document.fonts.ready); await m.waitForTimeout(1200);
    const loc = await m.evaluate(([L, lang]) => L.map(s => lang === 'ru' ? s : __st.loc(s, lang)), [list.map(x => x.st).concat(EXAMPLES), LANG]);
    const skipped = [];
    list.forEach((x, i) => { x.ru = x.st; x.st = loc[i]; if (LANG === 'be' && x.st === x.ru) skipped.push(x); });
    for (let i = list.length - 1; i >= 0; i--) if (skipped.indexOf(list[i]) > -1) list.splice(i, 1);
    const EX = EXAMPLES.map((s, j) => loc[loc.length - EXAMPLES.length + j]).filter((s, j) => !(LANG === 'be' && s === EXAMPLES[j]));
    // шапка главной: сколько места у адреса, кегль
    const head = await m.evaluate(([L, lang]) => {
        const run = document.querySelector('#s-home .addr__run'), t = run.parentNode, keep = run.textContent;
        t.classList.add('is-2l'); run.textContent = 'ул. Немига, 3 '.repeat(8); const W = t.clientWidth; t.classList.remove('is-2l'); run.textContent = keep;
        const fs = parseFloat(getComputedStyle(run).fontSize), mz = __st.measurer(run), res = [];
        L.forEach(x => {
            const vs = __st.variants(x.st, lang); let one = null;
            for (const v of vs) if (mz.w(v, fs) <= W + .5) { one = v; break; }
            const two = __st.plan(x.st, W, mz.w, 2, [fs], lang);
            res.push({ one: one || vs[vs.length - 1], run: !one, oneHow: one === x.st ? 'full' : one ? 'short' : 'run', two: { lines: two.lines, how: two.how } });
        });
        mz.done();
        return { W, fs, res };
    }, [list.concat(EX.map(st => ({ st }))), LANG]);
    await m.evaluate(() => { const e = [...document.querySelectorAll('#homeScroll [data-act="quick-add"][data-id="steak"]')].find(x => x.getClientRects().length); e.click(); }); await m.waitForTimeout(450);
    await m.evaluate(() => document.querySelector('[data-act="open-cart"]').click()); await m.waitForTimeout(1400);
    await m.evaluate(() => document.querySelector('[data-act="to-checkout"]').click()); await m.waitForTimeout(1500);
    // плитка «Куда» и «Чисто» (ячейка «Улица и дом» — та же разметка, что у «Чисто», на время прогона)
    const co = await m.evaluate(([L, lang]) => {
        const big = document.querySelector('#s-checkout .bt__big'), Wb = big.clientWidth, fb = parseFloat(getComputedStyle(big).fontSize), mb = __st.measurer(big);
        const cell = document.createElement('div'); cell.className = 'cgrp'; cell.innerHTML = '<div class="ccell ccell--go"><span class="ccell__l">Улица и дом</span><span class="ccell__v">ул. Немига, 3</span><svg class="i"></svg></div>';
        document.querySelector('#s-checkout .scroll').appendChild(cell);
        const cv = cell.querySelector('.ccell__v'), Wc = cv.clientWidth, fc = parseFloat(getComputedStyle(cv).fontSize), mc = __st.measurer(cv), res = [];
        const sizes = []; for (let s = fb; s >= 16; s--) sizes.push(s);
        L.forEach(x => {
            const p = __st.plan(x.st, Wb, mb.w, 3, sizes, lang), c = __st.plan(x.st, Wc, mc.w, 3, [fc], lang);
            res.push({ bento: { lines: p.lines, size: p.size, how: p.how, w: p.lines.map(l => Math.round(mb.w(l, p.size))) }, clean: { lines: c.lines, how: c.how } });
        });
        mb.done(); mc.done(); cell.remove();
        return { Wb, fb, Wc, fc, res };
    }, [list.concat(EX.map(st => ({ st }))), LANG]);
    const rows = list.map((x, i) => Object.assign({}, x, head.res[i], co.res[i]));
    const examples = EX.map((st, j) => Object.assign({ st }, head.res[list.length + j], co.res[list.length + j]));
    const sum = {}; rows.forEach(r => { const k = r.bento.how.join('+'); sum[k] = (sum[k] || 0) + 1; });
    fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), lang: LANG, skipped: skipped.length, screen: 390, font: 'Golos Text', places: { bento: { W: co.Wb, size: co.fb, min: 16, lines: 3 }, head: { W: head.W, size: head.fs }, clean: { W: co.Wc, size: co.fc, lines: 3 } }, rows, examples }, null, 1));
    console.log('язык:', LANG, '· улиц:', rows.length + (skipped.length ? ' (без беларускай назвы пропущено ' + skipped.length + ')' : ''), '· плитка «Куда»:', co.Wb + ' px,', co.fb + ' px · шапка:', head.W + ' px,', head.fs + ' px · «Чисто»:', co.Wc + ' px,', co.fc + ' px');
    console.log('плитка «Куда» — по правилам:', Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(' · '));
    console.log('шапка, одна строка: целиком', rows.filter(r => r.oneHow === 'full').length, '· сокращено', rows.filter(r => r.oneHow === 'short').length, '· бежит', rows.filter(r => r.run).length);
    const bad = rows.filter(r => r.bento.how.includes('clip') || r.bento.w.some(w => w > co.Wb + .5));
    console.log(bad.length ? '✗ не влезло: ' + bad.map(r => r.st).join('; ') : 'всё влезло, переносов внутри слов и сокращений нет');
    console.log(errs.length ? 'ошибки: ' + errs.join(' | ') : 'ошибок нет', '→', out);
    await b.close();
})();
