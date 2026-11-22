// Карточки ссылок «Поделиться» для заведений: картинка 1200×630 (img/og/<id>.jpg) и страница r/<id>.html с разметкой
// Open Graph — по ней мессенджеры (Telegram, WhatsApp, iMessage, Viber) показывают превью: название, картинку и текст.
// Человека страница сразу ведёт в приложение на заведение (../#rest=<id>).
// Запуск из корня репозитория: node tools/og_cards.js [заведение ...]   (нужен Playwright с Chromium; шрифт — Inter Display)
// Без аргументов — все заведения; с аргументами (dominos papochka) — только названные: после смены обложки остальные не трогаем.
// Данные заведений берём из index.html (RESTS) — правите там, перезапускаете здесь.
const path = require('path'), fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const ROOT = path.resolve(__dirname, '..'), SITE = 'https://clever-newdiz.onrender.com/';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = /var RESTS = (\[[\s\S]*?\n    \]);/.exec(html);
if (!m) throw new Error('RESTS не найден в index.html');
const RESTS = new Function('return ' + m[1])();

const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };
const rating = r => r.rating.toFixed(1).replace('.', ',');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// главное «зачем» для плашки: акция, подарок, бесплатная доставка
function perk(r) {
    if (r.promo) return r.promo;
    if (r.gift) return 'Блюдо в подарок';
    if (!r.fee) return 'Бесплатная доставка';
    if (r.freeFrom) return 'Доставка бесплатно от ' + r.freeFrom + ' руб.';
    return '';
}
// картинки — прямо в карточке (data:): страница рисуется из памяти, а с неё браузер файлы с диска не берёт
const data = (file, type) => 'data:' + type + ';base64,' + fs.readFileSync(path.join(ROOT, file)).toString('base64');
function card(r) {
    const p = perk(r);
    return '<!doctype html><html><head><meta charset="utf-8"><style>' +
        'html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#1a1210}' +
        '.c{position:relative;width:1200px;height:630px;font-family:"Inter Display","Inter",sans-serif;color:#fff}' +
        '.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
        // слева — тёмная подложка под текст, к фото она тает; снизу чуть темнее — плашки читаются на любом снимке
        '.sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(22,12,10,.9) 0%,rgba(22,12,10,.78) 30%,rgba(22,12,10,.3) 60%,rgba(22,12,10,0) 82%),linear-gradient(0deg,rgba(22,12,10,.5),rgba(22,12,10,0) 45%)}' +
        '.in{position:absolute;left:72px;top:60px;bottom:64px;width:700px;display:flex;flex-direction:column}' +
        '.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:34px;letter-spacing:-.015em}' +
        '.brand img{width:54px;height:54px;border-radius:14px}.brand b{color:#ff4636;font-weight:800}' +
        '.sp{flex:1}' +
        'h1{margin:0;font-weight:800;font-size:' + (r.name.length > 16 ? 70 : 82) + 'px;line-height:1.02;letter-spacing:-.03em;text-wrap:balance}' +
        '.info{margin-top:18px;font-size:30px;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:-.005em}.info i{font-style:normal;color:#ffc21a}' +
        '.row{display:flex;gap:14px;margin-top:30px;align-items:center}' +
        '.pill{height:64px;padding:0 30px;border-radius:32px;display:flex;align-items:center;font-size:30px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}' +
        '.promo{background:#e3141c;color:#fff}.cta{background:#fff;color:#1b1214;gap:10px}' +
        '</style></head><body><div class="c"><img class="bg" src="' + data('img/' + r.cover + '.webp', 'image/webp') + '"><div class="sh"></div><div class="in">' +
        '<div class="brand"><img src="' + data('favicon.svg', 'image/svg+xml') + '"><span>clever<b>.by</b></span></div><div class="sp"></div>' +
        '<h1>' + esc(r.name) + '</h1>' +
        '<div class="info"><i>★</i> ' + rating(r) + ' · ' + r.reviews + ' ' + plural(r.reviews, 'отзыв', 'отзыва', 'отзывов') + ' · ' + r.time + ' мин</div>' +
        '<div class="row">' + (p ? '<span class="pill promo">' + esc(p) + '</span>' : '') + '<span class="pill cta">Заказать →</span></div>' +
        '</div></div></body></html>';
}
// текст превью: что за место, почему сейчас, что делать
function desc(r) {
    const p = perk(r);
    return '★ ' + rating(r) + ' · привезут за ' + r.time + ' минут' + (p ? ' · ' + p.charAt(0).toLowerCase() + p.slice(1) : '') + '. Загляните в меню — заказ в пару касаний';
}
function page(r) {
    const url = SITE + 'r/' + r.id + '.html', img = SITE + 'img/og/' + r.id + '.jpg', title = r.name + ' — Clever.by', go = '../#rest=' + r.id;
    return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc(r)) + '">\n' +
        '<meta property="og:type" content="website">\n<meta property="og:site_name" content="Clever.by">\n<meta property="og:locale" content="ru_RU">\n' +
        '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc(r)) + '">\n' +
        '<meta property="og:url" content="' + url + '">\n<meta property="og:image" content="' + img + '">\n' +
        '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="' + esc(r.name) + ' на Clever.by">\n' +
        '<meta name="twitter:card" content="summary_large_image">\n<link rel="canonical" href="' + url + '">\n' +
        '<meta http-equiv="refresh" content="0; url=' + go + '">\n</head>\n<body>\n<script>location.replace(' + JSON.stringify(go) + ');</script>\n' +
        '<a href="' + go + '">Открыть «' + esc(r.name) + '» на Clever.by</a>\n</body>\n</html>\n';
}

(async () => {
    const b = await pw.chromium.launch(); const pg = await (await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
    const only = process.argv.slice(2);
    for (const r of RESTS) {
        if (only.length && only.indexOf(r.id) < 0) continue;
        await pg.setContent(card(r), { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
        await pg.screenshot({ path: path.join(ROOT, 'img/og/' + r.id + '.jpg'), type: 'jpeg', quality: 86 });
        fs.writeFileSync(path.join(ROOT, 'r/' + r.id + '.html'), page(r));
        console.log(r.id, '—', perk(r) || '(без плашки)');
    }
    await b.close();
})();
