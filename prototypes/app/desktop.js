/* clever.by — десктопный сайт (12.11). Загружается только на компьютере (окно шире 860 px, мышь, стенд выключен) — см. загрузку
   после основных стилей в index.html и deskSync / deskApi там же. Всё приложение — в index.html; здесь только то, что меняет
   поведение на широком экране: шапка, корзина панелью справа, окна, стрелки лент, комета сквозь затемнение. Оформление —
   desktop.css (всё под классом html.desk). index.html вызывает отсюда только Desk.chrome / close / cartToggle / dishAdded */
window.cleverDesk = function (A) {
    'use strict';
    var S = A.S, app = A.app, $$ = A.$$, ic = A.ic, esc = A.esc, addr = A.addr, city = A.city, Splash = A.Splash, deskOn = A.deskOn, standOn = A.standOn, popScreen = A.popScreen, pushScreen = A.pushScreen, renderHome = A.renderHome, syncChrome = A.syncChrome, syncDish = A.syncDish, cntSet = A.cntSet, closeSheetNice = A.closeSheetNice, fxFly = A.fxFly, fxPt = A.fxPt, fxOff = A.fxOff;

    // что за экран наверху: страница под шапкой, панель справа или окно по центру
    function deskKind(id) { return !id ? '' : id === 'rest' ? 'page' : id === 'cart' || id === 'checkout' ? 'drawer' : 'win'; }
    // шапка: адрес, поле поиска, «Войти» — перерисовываем, только если что-то сменилось
    /* 21.11: «верх очень хороший у Клевера. Я только про десктоп. Сделай такой же». Шапка по образцу clever.by: серая полоса
       со ссылками сверху; ниже — логотип, переключатель «Доставка / Навынос», адрес в рамке («📍 Минск ▾ ул. …» или зелёное
       «Укажите адрес»), справа значки поиска, поддержки и профиля и наша кнопка корзины; под шапкой на главной — категории
       текстом в строку («Все» на красной плашке). Профиль без входа — значок открывает вход (кнопки «Войти» в шапке больше нет) */
    var PIN = '<svg class="dh-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.2s-6.8-5.9-6.8-11.4a6.8 6.8 0 0 1 13.6 0c0 5.5-6.8 11.4-6.8 11.4z"/><circle cx="12" cy="9.9" r="2.4"/></svg>';
    var TEL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 3.6h3l1.6 4-2 1.3a10.6 10.6 0 0 0 5.3 5.3l1.3-2 4 1.6v3a1.6 1.6 0 0 1-1.7 1.6A15.6 15.6 0 0 1 3.6 5.3 1.6 1.6 0 0 1 5.2 3.6z"/></svg>';
    function deskHead() {
        var a = addr(S.addr), c = city(), tb = document.getElementById('tabbar');
        var key = [a ? a.street : '', c.name, S.auth ? 1 : 0].join('|');
        if (tb._dk === key) return;
        tb._dk = key;
        document.getElementById('dAddr').innerHTML = PIN + '<b class="dh-city">' + esc(c.name) + '<i class="dh-caret"></i></b>' +
            (a ? '<span class="dh-st">' + esc(a.street) + '</span>' : '<span class="dh-tag">Укажите адрес</span>');
        var s = document.getElementById('dSearch');
        if (!s.firstChild) { s.innerHTML = ic('i-search'); s.setAttribute('aria-label', 'Поиск блюд и ресторанов'); }
        var lg = document.getElementById('dLogin'); lg.hidden = true;
    }
    // полоса со ссылками, переключатель, значок поддержки — один раз, при первом включении десктопа
    (function () {
        var tb = document.getElementById('tabbar'); if (!tb || tb.querySelector('.dstrip')) return;
        var st = document.createElement('nav'); st.className = 'dstrip'; st.setAttribute('aria-label', 'О сервисе');
        st.innerHTML = [['desk-home', '', 'Доставка еды'], ['cat-go', '', 'Рестораны и кафе'], ['cat-go', 'flowers', 'Подарки'], ['noop', '', 'Мобильное приложение'], ['open-chat', '', 'Сообщить о проблеме']]
            .map(function (l) { return '<button type="button" data-act="' + l[0] + '"' + (l[1] ? ' data-id="' + l[1] + '"' : '') + '>' + l[2] + '</button>'; }).join('<i aria-hidden="true">·</i>');
        tb.insertBefore(st, tb.firstChild);
        var seg = document.createElement('div'); seg.className = 'dseg'; seg.setAttribute('role', 'tablist');
        var pk = false; try { pk = localStorage.getItem('clever2-mode') === 'pick'; } catch (e) {}
        seg.innerHTML = '<i class="dseg__th" aria-hidden="true"></i><button type="button" role="tab" data-m="dl">Доставка</button><button type="button" role="tab" data-m="pk">Навынос</button>';
        var setM = function (on) { seg.classList.toggle('is-pk', on); [].forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', String((b.dataset.m === 'pk') === on)); }); };
        setM(pk);
        seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; e.stopPropagation(); var on = b.dataset.m === 'pk'; setM(on); try { localStorage.setItem('clever2-mode', on ? 'pick' : ''); } catch (er) {} });
        tb.insertBefore(seg, document.getElementById('dAddr'));
        var tel = document.createElement('button'); tel.type = 'button'; tel.className = 'dh dh-ic dh-tel'; tel.dataset.act = 'open-chat'; tel.setAttribute('aria-label', 'Поддержка'); tel.innerHTML = TEL;
        tb.insertBefore(tel, document.getElementById('dSearch').nextSibling);
        // профиль без входа — сразу вход
        tb.addEventListener('click', function (e) {
            var t = e.target.closest('.tab[data-tab="profile"]'); if (!t || !deskOn() || S.auth) return;
            e.stopPropagation(); e.preventDefault(); document.getElementById('dLogin').click();
        }, true);
    })();
    // категории на главной — текстом: «Все» и «Акции» впереди (их нет в разметке главной — добавляем после каждой отрисовки)
    function deskCats() {
        var row = document.querySelector('#homeScroll .cats'); if (!row || !deskOn()) return;
        var all = row.querySelector('.dcat-all'), pr = row.querySelector('.dcat-promo');
        if (!all) { all = document.createElement('button'); all.type = 'button'; all.className = 'cat dcat-all'; all.dataset.act = 'reset-filters'; all.innerHTML = '<span>Все</span>'; row.insertBefore(all, row.firstChild); }
        if (!pr) { pr = document.createElement('button'); pr.type = 'button'; pr.className = 'cat dcat-promo'; pr.dataset.act = 'filter'; pr.dataset.id = 'promo'; pr.innerHTML = '<span>🔥 Акции</span>'; row.insertBefore(pr, all.nextSibling); }
        all.setAttribute('aria-pressed', String(!S.cat && !S.filters.promo));
        // 21.11: «и так их и называй — акции»: заголовок над лентой акций, как у остальных блоков
        var pr0 = document.getElementById('promoRow'), sec = pr0 && pr0.closest('.sec');
        if (sec && !sec.querySelector('.dpromo-h')) { var hd = document.createElement('div'); hd.className = 'sec__head pad dpromo-h'; hd.innerHTML = '<h2 class="h">Акции</h2>'; sec.insertBefore(hd, sec.firstChild); }
        pr.setAttribute('aria-pressed', String(!!S.filters.promo));
    }
    (function () { var hs = document.getElementById('homeScroll'); if (!hs || !window.MutationObserver) return; new MutationObserver(deskCats).observe(hs, { childList: true }); deskCats(); })();
    // курьер в карточке заведения (21.11: «возьми бег курьера и ходьбу»): навели — идёт (crGame('walk')), через 0,7 с переходит на
    // бег (crGame('run')); увели — снова значок. Спрайты вставляем при первом наведении (SMIL-анимация идёт, только пока видна)
    app.addEventListener('mouseover', function (e) {
        if (!deskOn() || !A.crGame) return;
        var r = e.target.closest('.rest'), m = r && r.querySelector('.rest__meta > span:first-child');
        if (!m || r._dcr) return;
        r._dcr = 1;
        if (!m.querySelector('.dcr')) { var c = document.createElement('i'); c.className = 'dcr'; c.setAttribute('aria-hidden', 'true'); c.innerHTML = '<i class="dcr-w">' + A.crGame('walk', { bag: 'red' }) + '</i><i class="dcr-r">' + A.crGame('run', { bag: 'red' }) + '</i>'; m.insertBefore(c, m.firstChild); }
        r.classList.remove('dcr-run'); clearTimeout(r._dcrT); r._dcrT = setTimeout(function () { r.classList.add('dcr-run'); }, 700);
    });
    app.addEventListener('mouseout', function (e) {
        var r = e.target.closest('.rest'); if (!r || !r._dcr || (e.relatedTarget && r.contains(e.relatedTarget))) return;
        r._dcr = 0; clearTimeout(r._dcrT); r.classList.remove('dcr-run');
    });
    function deskChrome() {
        if (!deskOn()) { if (app.dataset.dtop != null) { delete app.dataset.dtop; delete app.dataset.dpage; } return; }
        var top = S.stack[S.stack.length - 1];
        app.dataset.dtop = deskKind(top);
        app.dataset.dpage = S.stack.indexOf('rest') >= 0 ? 'rest' : S.tab;
        // затемнение — прямо под первым экраном-панелью или окном: у экранов порядок слоёв — по глубине стопки (11, 12…)
        var k = 0; while (k < S.stack.length && deskKind(S.stack[k]) === 'page') k++;
        document.getElementById('dscrim').style.zIndex = String(10 + k);
        $$('.screen.dk-first').forEach(function (s) { if (s.id !== 's-' + S.stack[k]) s.classList.remove('dk-first'); });
        if (S.stack[k]) document.getElementById('s-' + S.stack[k]).classList.add('dk-first');
        deskHead(); deskCats();
    }
    // закрыть всё, что поверх страницы (панель корзины, окна): по затемнению и по Esc
    function deskClose() { var n = 0; while (/drawer|win/.test(deskKind(S.stack[S.stack.length - 1])) && n++ < 6) popScreen(); }
    // корзина в шапке: открыть панель справа; открыта — закрыть. Страница под ней остаётся
    function deskCartToggle() {
        if (S.stack.indexOf('cart') >= 0) { deskClose(); return; }
        deskClose(); pushScreen('cart');
    }
    document.addEventListener('keydown', function (e) {
        if (!deskOn() || e.isComposing) return;
        var ed = /^(INPUT|TEXTAREA)$/.test((e.target && e.target.tagName) || '');
        if (e.key === 'Escape') {
            if (A.sheetKind()) { closeSheetNice(); e.preventDefault(); }
            else if (/drawer|win/.test(deskKind(S.stack[S.stack.length - 1]))) { popScreen(); e.preventDefault(); }
            else if (S.stack.length) { popScreen(); e.preventDefault(); }
        } else if (e.key === '/' && !ed && !A.sheetKind() && !e.ctrlKey && !e.metaKey) { e.preventDefault(); document.getElementById('dSearch').click(); }
    });
    /* 12.11: окно блюда на десктопе. «Корзина сверху в этой форме лишняя. Комета должна лететь сразу в корзину родную, сверху
       которая. Как бы ныряя через слой затемнения. Если сделаешь эффект такой, как переход кометы в другое измерение — будет
       вообще пушка! Зелёная кнопка «Добавлено» не нужна. Просто красиво продавливай кнопку «Добавить»».
       • Кнопка продавливается (сжимается и пружинит), количество снова 1, надпись не меняется.
       • Комета летит в пакет в шапке. Там, где она пересекает край окна, — портал: вспышка и два кольца-ряби, сплюснутые вдоль
         края, как круги на воде. Дальше комета идёт уже под затемнением — приглушённая, «по ту сторону».
       • Долетела: затемнение над кнопкой корзины расступается (окно в вуали по форме кнопки), пакет ловит комету, сумма и число
         докручиваются; вуаль смыкается. Без эффектов (fxOff) — всё сразу */
    var deskPortals = 0;
    function deskDishAdded(btn, q, from) {
        A.dishState().qty = 1; cntSet(document.getElementById('dqty'), 1); syncDish();
        if (!fxOff() && btn && btn.isConnected) btn.animate([{ transform: 'none' }, { transform: 'scale(.92)', offset: .26, easing: 'cubic-bezier(.3, 0, .4, 1)' }, { transform: 'scale(1.025)', offset: .66 }, { transform: 'none' }], { duration: 480, easing: 'ease-out' });
        var bag = document.getElementById('cartBag');
        if (fxOff() || !from || !bag) return;
        var fxl = document.getElementById('fx'), sh = document.getElementById('sheet');
        var under = function (on) { deskPortals = Math.max(0, deskPortals + (on ? 1 : -1)); fxl.style.zIndex = deskPortals ? '60' : ''; };   // 60 — над шапкой, под затемнением (70)
        var dived = false;
        A.setFxTarget({ el: bag, kind: 'portal',
            path: function (at, dur) {   // первая точка пути вне окна — место и время перехода
                var r = sh.getBoundingClientRect(), a = fxPt(r.left, r.top), b = fxPt(r.right, r.bottom);
                for (var s = 0; s <= dur; s += 6) {
                    var p = at(s);
                    if (p[0] < a.x || p[0] > b.x || p[1] < a.y || p[1] > b.y) {
                        var edge = Math.abs(p[1] - a.y) < 14 || Math.abs(p[1] - b.y) < 14 ? 'h' : 'v';
                        setTimeout(function () { dived = true; under(true); deskRift(p[0], p[1], edge); }, s);
                        return;
                    }
                }
            },
            land: function () {
                if (dived) setTimeout(function () { under(false); }, 60);
                deskVeil(document.getElementById('cartTab'));
                bag.animate([{ scale: 1 }, { scale: '1.12 .84', offset: .24 }, { scale: '.95 1.06', offset: .52 }, { scale: 1 }], { duration: 600, easing: 'ease-out' });
            } });
        var d = fxFly(from, q);
        if (!d) A.setFxTarget(null);
    }
    // портал на краю окна: вспышка и две ряби, сплюснутые вдоль края (edge: h — верх или низ окна, v — бок)
    function deskRift(x, y, edge) {
        var box = document.createElement('div'); box.className = 'drift'; box.style.left = x + 'px'; box.style.top = y + 'px';
        if (edge === 'v') box.style.rotate = '90deg';
        box.innerHTML = '<i class="drift__flash"></i><i class="drift__ring"></i><i class="drift__ring drift__ring--2"></i>';
        app.appendChild(box);
        var k = box.children, R = Math.random, sx = (1 + R() * .25).toFixed(2);
        k[0].animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: .22 }, { transform: 'scale(1.6, .6)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'both' });
        k[1].animate([{ transform: 'scale(.15, .05)', opacity: .95 }, { transform: 'scale(' + sx + ', .34)', opacity: 0 }], { duration: 640, easing: 'cubic-bezier(.15, .7, .3, 1)', fill: 'both' });
        var last = k[2].animate([{ transform: 'scale(.1, .04)', opacity: .8 }, { transform: 'scale(' + (sx * 1.5).toFixed(2) + ', .46)', opacity: 0 }], { duration: 860, delay: 90, easing: 'cubic-bezier(.15, .7, .3, 1)', fill: 'both' });
        last.onfinish = last.oncancel = function () { box.remove(); };
    }
    // вуаль расступается над кнопкой: окно в затемнении по форме кнопки, раскрывается и смыкается
    function deskVeil(el) {
        var sc = document.getElementById('scrim'); if (!el || !sc.classList.contains('is-on')) return;
        var r = el.getBoundingClientRect(), a = app.getBoundingClientRect(), cx = r.left - a.left + r.width / 2, cy = r.top - a.top + r.height / 2;
        var rx = r.width / 2 + 18, ry = r.height / 2 + 16, t0 = performance.now(), D = 1150, my = ++deskVeil.n;
        var f = function (now) {
            if (my !== deskVeil.n) return;
            var u = Math.min(1, (now - t0) / D), e = u < .22 ? 1 - Math.pow(1 - u / .22, 3) : u < .55 ? 1 : 1 - Math.pow((u - .55) / .45, 2), k = Math.max(0, e);
            var g = k < .01 ? '' : 'radial-gradient(ellipse ' + (rx * k).toFixed(1) + 'px ' + (ry * k).toFixed(1) + 'px at ' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px, transparent 62%, #000 100%)';
            sc.style.webkitMaskImage = sc.style.maskImage = g;
            if (u < 1) requestAnimationFrame(f); else sc.style.webkitMaskImage = sc.style.maskImage = '';
        };
        requestAnimationFrame(f);
    }
    deskVeil.n = 0;
    /* стрелки у горизонтальных лент (мышью ленту не протянуть): две общие кнопки встают по краям ленты под курсором */
    (function () {
        var cur = null, B = [-1, 1].map(function (d) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'hsnav'; b.setAttribute('aria-label', d < 0 ? 'Назад' : 'Вперёд');
            b.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + (d < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
            b.addEventListener('click', function (e) { e.stopPropagation(); if (cur) cur.scrollBy({ left: d * Math.max(200, cur.clientWidth * .8), behavior: 'smooth' }); });
            app.appendChild(b); return b;
        });
        function put() {
            if (!cur || !cur.isConnected || !deskOn()) { B[0].classList.remove('is-on'); B[1].classList.remove('is-on'); cur = null; return; }
            var r = cur.getBoundingClientRect(), a = app.getBoundingClientRect(), max = cur.scrollWidth - cur.clientWidth, sm = r.height < 190 || r.width < 520, hw = sm ? 18 : 22;
            var host = cur.closest('.sheet') ? 85 : cur.closest('.screen:not(.is-tab):not(#s-rest)') ? 26 : cur.closest('#s-rest') ? 11 : 2;
            var x0 = r.left - a.left, x1 = r.right - a.left, box = cur.closest('.sheet, .screen:not(.is-tab):not(#s-rest)');
            if (box) { var br = box.getBoundingClientRect(); x0 = Math.max(x0, br.left - a.left + hw + 8); x1 = Math.min(x1, br.right - a.left - hw - 8); }
            B.forEach(function (b) { b.classList.toggle('is-sm', sm); b.style.zIndex = host; b.style.top = (r.top - a.top + r.height / 2 - hw) + 'px'; });
            B[0].style.left = Math.max(8, x0 - hw) + 'px'; B[1].style.left = Math.min(a.width - hw * 2 - 8, x1 - hw) + 'px';
            B[0].classList.toggle('is-on', cur.scrollLeft > 4); B[1].classList.toggle('is-on', cur.scrollLeft < max - 4);
        }
        app.addEventListener('mouseover', function (e) {
            if (!deskOn() || e.target.closest('.hsnav')) return;
            var h = e.target.closest('.hscroll, .filters, .rtabs__row, .ri-tks, .cdays, .slots');
            if (h && h.scrollWidth - h.clientWidth < 8) h = null;
            if (h !== cur) { cur = h; put(); }
        });
        app.addEventListener('mouseleave', function () { cur = null; put(); });
        app.addEventListener('scroll', function () { if (cur) put(); }, true);
    })();

    return { kind: deskKind, chrome: deskChrome, close: deskClose, cartToggle: deskCartToggle, dishAdded: deskDishAdded };
};
