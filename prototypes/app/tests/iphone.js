/* Прогон на настоящем iPhone: Safari на телефоне под управлением Mac (safaridriver, WebDriver) — настоящая клавиатура iOS,
   настоящая плавность, без эмуляции. По кадрам пишем то же, что tests/run.js: где шторка и кнопка «Доставить сюда» и сколько
   экрана видно над клавиатурой (visualViewport).
   Один раз:
     iPhone — Настройки → Приложения → Safari → Дополнения: «Веб-инспектор» и «Удалённая автоматизация»; подключить кабелем
              к Mac, «Доверять этому компьютеру».
     Mac    — в Терминале: safaridriver --enable (спросит пароль). Node 18 и новее.
   Запуск — на Mac, в папке репозитория:
     node tests/iphone.js                  — «Плавность: Быстрая»
     node tests/iphone.js --perf=normal    — «Как было»
     node tests/iphone.js --url=https://…  — другой адрес (по умолчанию clever-newdiz.onrender.com, свежая версия)
   Пока идёт прогон, телефон не трогать: Safari под управлением (рамка вокруг страницы). Касания — сенсорные (WebDriver
   Actions, touch), как пальцем; не умеет — обычный клик по элементу (тогда клавиатура может не выехать — так и напишем) */
'use strict';
const { spawn } = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const PORT = +(arg('port') || 4444), BASE = 'http://127.0.0.1:' + PORT, PERF = arg('perf') || 'fast';
const URL0 = (arg('url') || 'https://clever-newdiz.onrender.com/') + '?v=' + Date.now();   // свежая версия, а не из кэша Safari
const ELEM = 'element-6066-11e4-a52e-4f735466cecf';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function wd(method, p, body) {
    const r = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.value && (j.value.message || j.value.error)) || 'HTTP ' + r.status); e.wd = j.value; throw e; }
    return j.value;
}
// safaridriver уже запущен — берём его; нет — запускаем сами
async function driverUp() {
    try { await wd('GET', '/status'); return null; } catch (e) {}
    const p = spawn('safaridriver', ['--port', String(PORT)], { stdio: 'ignore' });
    p.on('error', e => { console.error('safaridriver не запустился (' + e.message + '). Нужен Mac и один раз: safaridriver --enable'); process.exit(2); });
    for (let i = 0; i < 50; i++) { await sleep(200); try { await wd('GET', '/status'); return p; } catch (e) {} }
    throw new Error('safaridriver не отвечает на порту ' + PORT);
}

// запись по кадрам (в странице): видимая шторка (её копия, пока едет), низ кнопки, видимая часть экрана; момент касания
const REC_START = function () {
    var q = function (s) { return document.querySelector(s); }, t0 = performance.now(), ev = ['touchstart', 'pointerdown', 'mousedown'];
    // у каждой записи свой номер: кадр прошлой, уже запрошенный до её остановки, иначе продолжал бы писать в новую — со своим отсчётом
    var id = window._recN = (window._recN || 0) + 1, rec = window._rec = [];
    window._tap = null;
    // слушатель прошлой записи снимаем: мышиное событие после касания поля гасится (preventDefault), и старый слушатель
    // срабатывал на следующем касании — со своим началом отсчёта
    if (window._mark) ev.forEach(function (t) { document.removeEventListener(t, window._mark, true); });
    window._mark = function () { if (window._tap == null) window._tap = performance.now() - t0; };
    ev.forEach(function (t) { document.addEventListener(t, window._mark, true); });
    (function f(ts) {
        if (window._recN !== id) return;
        var g = q('#sheet > .scroll--ghost'), p = g || q('#sheet > .scroll'), b = q('#addrFoot .cta'), v = window.visualViewport, a = document.activeElement;
        rec.push({ t: ts - t0, y: p ? p.getBoundingClientRect().top : null, b: b ? b.getBoundingClientRect().bottom : null,
            vh: v ? v.height : innerHeight, vt: v ? v.offsetTop : 0, a: a && a.id || '' });
        requestAnimationFrame(f);
    })(t0);
};
const REC_STOP = function () { window._recN++; return { f: window._rec, tap: window._tap }; };

// разбор записи: когда выехала (сменилась) клавиатура и тронулась шторка — от касания; шаг шторки на кадр 16,7 мс (под нагрузкой
// кадры выпадают — через пропущенный шаг вдвое больше, это не рывок); рывок — кадр, шаг которого резко больше соседних (у плавного
// хода шаги меняются постепенно: «пружина» клавиатуры при открытии доходит до 60px за кадр, и это не рывок); кадров, где кнопку
// закрыла клавиатура; где кнопка в конце (от низа видимой части)
function look(r) {
    const f = r.f, tap = r.tap == null ? 0 : r.tap, s0 = f.filter(q => q.t <= tap).pop() || f[0];
    let first = null, pt = s0.t, py = s0.y, under = 0;
    const st = [];
    f.filter(q => q.t > tap).forEach(q => {
        if (first == null && q.y != null && s0.y != null && Math.abs(q.y - s0.y) > .5) first = q.t - tap;
        if (q.y != null && py != null) st.push(Math.abs(q.y - py) / Math.max(1, (q.t - pt) / 16.7));
        if (q.b != null && q.b > q.vt + q.vh + 1) under++;
        pt = q.t; py = q.y;
    });
    let step = 0, jerk = 0;
    st.forEach((v, i) => { step = Math.max(step, v); const nb = Math.max(st[i - 1] || 0, st[i + 1] || 0); if (v > 2.5 * nb + 3) jerk = Math.max(jerk, v - nb); });
    const kb = f.find(q => q.t > tap && Math.abs(q.vh - s0.vh) > 2), end = f[f.length - 1];
    return { first, step, jerk, under, kb: kb ? kb.t - tap : null, vh0: Math.round(s0.vh), vh1: Math.round(end.vh), gap: end.b != null ? Math.round(end.vt + end.vh - end.b) : null, act: end.a, tapSeen: r.tap != null };
}
const moved = q => (q.first == null ? 'не ехала' : 'тронулась через ' + Math.round(q.first) + ' мс') + ', шаг до ' + q.step.toFixed(1) + 'px за кадр' + (q.jerk ? ', рывок на ' + q.jerk.toFixed(1) + 'px ✗' : ', без рывков');

(async () => {
    const drv = await driverUp();
    let sid = null, ok = 0, all = 0;
    const done = async code => { if (sid) await wd('DELETE', '/session/' + sid).catch(() => {}); if (drv) drv.kill(); process.exit(code); };
    try {
        const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', platformName: 'iOS', 'safari:deviceType': 'iPhone' } } });
        sid = s.sessionId;
    } catch (e) {
        // причины Safari пишет списком после «could not be used:» — печатаем его ответ целиком
        console.error('Не открылся Safari на iPhone: ' + e.message + (e.wd ? '\n\nОтвет Safari полностью:\n' + JSON.stringify(e.wd, null, 2) : ''));
        console.error('\nПроверьте: iPhone разблокирован и экран включён; кабель передаёт данные; в Finder iPhone виден и ему доверяют;\n' +
            'на телефоне Настройки → Приложения → Safari → Дополнения: «Веб-инспектор» и «Удалённая автоматизация» включены.');
        return done(2);
    }
    const S = p => '/session/' + sid + p;
    const js = (fn, ...args) => wd('POST', S('/execute/sync'), { script: 'return (' + fn + ').apply(null, arguments)', args });
    const tap = async sel => {
        const r = await js(function (s) { var e = document.querySelector(s); if (!e) return null; var b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; }, sel);
        if (!r) throw new Error('на странице нет ' + sel);
        if (process.env.DEBUG) console.log('  касание ' + sel + ' в ' + r.x + ',' + r.y + ': под пальцем ' + await js(function (x, y) { var e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && e.className.baseVal == null ? '.' + String(e.className).trim().split(/\s+/).join('.') : '') : '—'; }, r.x, r.y) +
            (await js(function () { return !!document.querySelector('[data-ghost]'); }) ? ' (шторка-копия ещё едет)' : ''));
        try {
            await wd('POST', S('/actions'), { actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'touch' }, actions: [
                { type: 'pointerMove', duration: 0, origin: 'viewport', x: r.x, y: r.y }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 70 }, { type: 'pointerUp', button: 0 }] }] });
            await wd('DELETE', S('/actions')).catch(() => {});
        } catch (e) {
            if (!tap.warned) { tap.warned = true; console.log('  (касания пальцем WebDriver не умеет: ' + e.message + ' — жмём кликом по элементу)'); }
            const el = await wd('POST', S('/element'), { using: 'css selector', value: sel });
            await wd('POST', S('/element/' + el[ELEM] + '/click'), {});
        }
    };
    // DEBUG=1 — ещё и по кадрам: когда касание, смена фокуса и видимой части, где шторка
    const rec = async (sel, ms) => {
        await js(REC_START); await sleep(150); await tap(sel); await sleep(ms);
        const r = await js(REC_STOP);
        if (process.env.DEBUG) { let pa = null, pv = null; console.log('  ' + sel + ': касание ' + (r.tap == null ? '—' : Math.round(r.tap)) + ' мс; ' + r.f.filter(q => { const c = q.a !== pa || Math.abs(q.vh - pv) > 2; pa = q.a; pv = q.vh; return c; }).map(q => Math.round(q.t) + ': фокус ' + (q.a || '—') + ', видно ' + Math.round(q.vh) + ', шторка ' + Math.round(q.y)).join(' | ')); }
        return look(r);
    };
    const check = (name, pass, detail) => { all++; if (pass) ok++; console.log((pass ? '✓ ' : '✗ ') + name + '\n    ' + detail); };

    try {
        await wd('POST', S('/timeouts'), { pageLoad: 120000, script: 30000 });   // onrender после простоя просыпается до минуты
        await wd('POST', S('/url'), { url: URL0 });
        await js(function (perf) { localStorage.setItem('clever2-city', 'minsk'); if (perf === 'fast') localStorage.setItem('clever2-perf', 'fast'); else localStorage.removeItem('clever2-perf'); }, PERF);
        await wd('POST', S('/url'), { url: URL0 });
        const info = await js(function () { return { ua: navigator.userAgent, w: screen.width, h: screen.height, dpr: devicePixelRatio, build: (document.body.innerHTML.match(/сборка ([0-9.]+ · [0-9:]+)/) || [])[1] || '' }; });
        console.log('iPhone: экран ' + info.w + '×' + info.h + ' (×' + info.dpr + '), ' + (info.ua.match(/OS [\d_]+/) || [''])[0].replace(/_/g, '.') + '; плавность: ' + (PERF === 'fast' ? 'Быстрая' : 'Как было') + '\n');
        await sleep(1200); await tap('#splash'); await sleep(2600);
        await tap('.hero [data-act="open-addr"]'); await sleep(2800);

        // 1. касание поля адреса: клавиатура выезжает, шторка встаёт над ней
        const a = await rec('#addrSearch', 1800);
        const kbUp = a.vh1 < a.vh0 - 150;
        // пока клавиатура выезжает, Safari сообщает высоту не по ходу — «кнопку закрыла» тут не считаем
        check('касание поля адреса: клавиатура выехала, шторка над ней', kbUp && !a.jerk && a.gap >= 4 && a.gap <= 30,
            (kbUp ? 'клавиатура через ' + Math.round(a.kb) + ' мс, видно ' + a.vh0 + ' → ' + a.vh1 + 'px' : 'клавиатура не выехала ✗ (видно ' + a.vh1 + 'px; фокус: ' + (a.act || 'нет') + ')') +
            '; шторка ' + moved(a) + '; в конце кнопка в ' + a.gap + 'px от низа видимой части' + (a.tapSeen ? '' : ' (касания страница не увидела — клик)'));
        if (!kbUp) { console.log('\nКлавиатура не выехала: WebDriver касается не пальцем. Дальше без неё мерить нечего.'); return done(1); }

        // 2. адрес ↔ этаж (буквы ↔ цифры) — дважды: в первый раз высоту цифровой приложение ещё не знает
        for (let i = 1; i <= 2; i++) {
            for (const [sel, name] of [['#n-floor', 'этаж'], ['#addrSearch', 'адрес']]) {
                const q = await rec(sel, 1300);
                const dv = q.vh1 - q.vh0;
                // клавиатура стала выше — iOS меняет её сразу, и пару кадров, пока шторка трогается, она закрывает низ кнопки
                check('переход на ' + name + (i === 2 ? ' (второй раз)' : '') + ': шторка за клавиатурой плавно', q.act === sel.slice(1) && !q.jerk && q.under <= 3 && q.gap >= 4 && q.gap <= 30,
                    'клавиатура ' + (Math.abs(dv) > 2 ? (dv > 0 ? 'ниже' : 'выше') + ' на ' + Math.abs(dv) + 'px через ' + Math.round(q.kb) + ' мс' : 'той же высоты') +
                    '; шторка ' + moved(q) + '; кнопку закрывала клавиатура ' + q.under + ' кадр.' + (q.under > 3 ? ' ✗' : '') + '; в конце кнопка в ' + q.gap + 'px от низа видимой части' + (q.act === sel.slice(1) ? '' : '; фокус: ' + (q.act || 'нет') + ' ✗'));
            }
        }
        // снимок экрана в конце — посмотреть глазами
        const png = await wd('GET', S('/screenshot')).catch(() => null);
        if (png) { const f = path.join(os.tmpdir(), 'clever-iphone.png'); fs.writeFileSync(f, Buffer.from(png, 'base64')); console.log('\nснимок экрана: ' + f); }
    } catch (e) { console.error('\nПрогон оборвался: ' + e.message); all++; }
    console.log('\n' + (ok === all ? '✓ все ' + all + ' проверок прошли' : '✗ не прошли: ' + (all - ok) + ' из ' + all));
    return done(ok === all ? 0 : 1);
})();
