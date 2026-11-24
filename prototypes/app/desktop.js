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
    /* 23.11: бегущая строка длинного адреса в десктопной шапке — по образцу мобильной headRun/headEdge:
       края мягко тают маской (mask-image), работает одинаково чисто и в светлой, и в тёмной теме */
    function deskAddrEdge(t, l, r, now) {
        var from = t._edge || { l: 0, r: 0 }, t0 = performance.now();
        cancelAnimationFrame(t._edgeRaf);
        var put = function (a, b) {
            t._edge = { l: a, r: b };
            var g = a < .1 && b < .1 ? '' : 'linear-gradient(90deg, transparent, #000 ' + a.toFixed(1) + 'px, #000 calc(100% - ' + b.toFixed(1) + 'px), transparent)';
            t.style.webkitMaskImage = g; t.style.maskImage = g;
        };
        if (now) { put(l, r); return; }
        (function step(ts) {
            var k = Math.min(1, ((ts || performance.now()) - t0) / 500), e = k < .5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2;
            put(from.l + (l - from.l) * e, from.r + (r - from.r) * e);
            if (k < 1 && document.body.contains(t)) t._edgeRaf = requestAnimationFrame(step);
        })(t0);
    }
    function deskAddrStop(t) {
        t = t || document.querySelector('#dAddr .dh-st'); if (!t) return;
        clearTimeout(t._run); t._run = 0;
        cancelAnimationFrame(t._edgeRaf);
        if (t._anim) { t._anim.onfinish = null; t._anim.cancel(); t._anim = null; }
    }
    function deskAddrRun() {
        var t = document.querySelector('#dAddr .dh-st'), run = t && t.querySelector('.dh-st__run');
        if (!t || !run) return;
        deskAddrStop(t);
        if (!deskOn()) { deskAddrEdge(t, 0, 0, true); return; }
        var over = Math.ceil(run.offsetWidth - t.clientWidth);
        if (over <= 1) { deskAddrEdge(t, 0, 0, true); return; }
        deskAddrEdge(t, 0, 26, true);
        if (fxOff()) return;
        var dur = Math.max(1800, over / 30 * 1000);
        var go = function (fwd, then) {
            deskAddrEdge(t, 20, 26);
            var a = t._anim = run.animate(
                [{ transform: 'translateX(' + (fwd ? 0 : -over) + 'px)' }, { transform: 'translateX(' + (fwd ? -over : 0) + 'px)' }],
                { duration: dur, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }
            );
            a.onfinish = function () {
                if (t._anim !== a) return;
                deskAddrEdge(t, fwd ? 20 : 0, fwd ? 0 : 26);
                t._run = setTimeout(then, fwd ? 2000 : 3600);
            };
        };
        var loop = function () { if (document.body.contains(t) && deskOn()) go(true, function () { go(false, loop); }); };
        t._run = setTimeout(loop, 2400);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (deskOn()) deskAddrRun(); });
    function deskHead() {
        var a = addr(S.addr), c = city(), tb = document.getElementById('tabbar');
        var key = [a ? a.street : '', a ? a.flat : '', c.name, S.auth ? 1 : 0].join('|');
        if (tb._dk === key) return;
        tb._dk = key;
        deskAddrStop();
        document.getElementById('dAddr').innerHTML =
            '<button type="button" class="dh-city" data-act="open-city" aria-label="Город: ' + esc(c.name) + '. Сменить">' +
                PIN + '<span>' + esc(c.name) + '</span>' +
            '</button>' +
            '<span class="dh-sep" aria-hidden="true">·</span>' +
            '<button type="button" class="dh-place" data-act="open-addr" aria-label="Адрес доставки">' +
                (a ? '<span class="dh-st"><span class="dh-st__run">' + esc(a.street) + '</span></span>' : '<span class="dh-tag">Укажите адрес</span>') +
            '</button>';
        var s = document.getElementById('dSearch');
        if (!s.firstChild) { s.innerHTML = ic('i-search'); s.setAttribute('aria-label', 'Поиск блюд и ресторанов'); }
        var lg = document.getElementById('dLogin'); lg.hidden = true;
        requestAnimationFrame(deskAddrRun);
        if (askEl) placeAskAddr();
    }
    /* 23.11: красивое тёмное окошко с уточнением адреса при первом запуске главной на десктопе.
       Показывает последний адрес (из cookie или по умолчанию) прямо под верхним контролом города и адреса.
       «Да, верно» — подтверждает и сохраняет в cookie; «Изменить» — открывает окно адреса */
    var askEl = null, askShown = false, askTimer = 0, askOutDoc = null;
    function placeAskAddr() {
        if (!askEl || !askEl.isConnected) return;
        if (!deskOn()) { hideAskAddr(true); return; }
        var anchor = document.getElementById('dAddr');
        if (!anchor) return;
        var r = anchor.getBoundingClientRect(), a = app.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var pw = askEl.offsetWidth || 372;
        var anchorCenter = r.left - a.left + r.width / 2;
        var left = Math.max(16, Math.min(a.width - pw - 16, anchorCenter - pw / 2));
        var top = r.bottom - a.top + 12;
        var tipX = Math.max(28, Math.min(pw - 28, anchorCenter - left));
        askEl.style.left = Math.round(left) + 'px';
        askEl.style.top = Math.round(top) + 'px';
        askEl.style.setProperty('--tip-x', Math.round(tipX) + 'px');
    }
    function hideAskAddr(instant) {
        clearTimeout(askTimer); askTimer = 0;
        if (askOutDoc) { document.removeEventListener('pointerdown', askOutDoc, true); askOutDoc = null; }
        if (!askEl) return;
        var el = askEl; askEl = null;
        el.classList.remove('is-on');
        if (instant || fxOff()) { el.remove(); return; }
        el.classList.add('is-out');
        setTimeout(function () { if (el.isConnected) el.remove(); }, 260);
    }
    function askAddr() {
        if (askShown || !deskOn()) return;
        askShown = true;
        clearTimeout(askTimer);
        askTimer = setTimeout(function () {
            askTimer = 0;
            if (!deskOn() || S.tab !== 'home' || S.stack.length || A.sheetKind() || askEl) return;
            var a = addr(S.addr), c = city();
            var el = document.createElement('aside');
            el.className = 'daddr-ask';
            el.id = 'dAddrAsk';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-label', 'Уточнение адреса доставки');
            var line = a
                ? esc(c.name) + ', ' + esc(a.street) + (a.flat ? ', кв.\u00a0' + esc(a.flat) : '')
                : esc(c.name) + ' — адрес не\u00a0указан';
            el.innerHTML =
                '<i class="daddr-ask__tip" aria-hidden="true"></i>' +
                '<button type="button" class="daddr-ask__x" data-ask="close" aria-label="Закрыть">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
                '</button>' +
                '<div class="daddr-ask__head">' +
                    '<span class="daddr-ask__ic" aria-hidden="true">' + PIN + '</span>' +
                    '<div class="daddr-ask__txt">' +
                        '<span class="daddr-ask__eyebrow">' + (a ? 'Адрес указан правильно?' : 'Уточните адрес доставки') + '</span>' +
                        '<b class="daddr-ask__val">' + line + '</b>' +
                    '</div>' +
                '</div>' +
                '<div class="daddr-ask__acts">' +
                    (a
                        ? '<button type="button" class="daddr-ask__btn daddr-ask__ok" data-ask="ok">Да, верно</button>' +
                          '<button type="button" class="daddr-ask__btn daddr-ask__edit" data-ask="edit">Изменить</button>'
                        : '<button type="button" class="daddr-ask__btn daddr-ask__ok" data-ask="edit">Указать адрес</button>' +
                          '<button type="button" class="daddr-ask__btn daddr-ask__edit" data-ask="city">Сменить город</button>') +
                '</div>';
            el.addEventListener('click', function (e) {
                var b = e.target.closest('[data-ask]'); if (!b) return;
                e.stopPropagation();
                var act = b.dataset.ask;
                if (act === 'ok') {
                    if (A.confirmAddr) A.confirmAddr();
                    hideAskAddr();
                } else if (act === 'edit') {
                    hideAskAddr();
                    if (A.openSheet) A.openSheet('addr');
                } else if (act === 'city') {
                    hideAskAddr();
                    if (A.openSheet) A.openSheet('city');
                } else {
                    hideAskAddr();
                }
            });
            askEl = el;
            app.appendChild(el);
            placeAskAddr();
            requestAnimationFrame(function () {
                if (askEl === el) { placeAskAddr(); el.classList.add('is-on'); }
            });
            askOutDoc = function (e) {
                if (!askEl || askEl.contains(e.target)) return;
                hideAskAddr();
            };
            document.addEventListener('pointerdown', askOutDoc, true);
        }, fxOff() ? 0 : 380);
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
        seg.innerHTML = '<i class="dseg__th" aria-hidden="true"></i><button type="button" role="tab" data-m="dl">Доставка</button><button type="button" role="tab" data-m="pk"><span>Навынос</span><em class="dseg__sale"><i>\u221215%</i></em></button>';
        var setM = function (on) { seg.classList.toggle('is-pk', on); [].forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', String((b.dataset.m === 'pk') === on)); }); };
        setM(pk);
        /* 24.11: маленькие искры из-под капсулы «−15%» при клике/переключении на «Навынос» */
        function deskPickSparks(btn) {
            if (fxOff() || !btn) return;
            var pill = btn.querySelector('.dseg__sale'); if (!pill) return;
            if (pill.animate) pill.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(.91)', offset: .22 }, { transform: 'scale(1.1)', offset: .58 }, { transform: 'scale(1)' }],
                { duration: 400, easing: 'cubic-bezier(.22, 1, .36, 1)' }
            );
            var fx = document.createElement('span');
            fx.className = 'dseg__fx';
            fx.setAttribute('aria-hidden', 'true');
            fx.style.left = (pill.offsetLeft + pill.offsetWidth / 2) + 'px';
            fx.style.top = (pill.offsetTop + pill.offsetHeight / 2) + 'px';
            var cols = ['#ff4733', '#ff8a2b', '#ffc226', '#ff2e4c', '#ff6b4a', '#ffd447'];
            var N = 12;
            for (var i = 0; i < N; i++) {
                var dot = i % 3 === 1, sp = document.createElement('i');
                sp.className = dot ? 'dseg__sp dseg__sp--dot' : 'dseg__sp';
                sp.style.color = cols[i % cols.length];
                var deg = i * (360 / N) + (Math.random() - .5) * 20;
                var rad = deg * Math.PI / 180;
                var sx = Math.cos(rad) * 14, sy = Math.sin(rad) * 6;
                var dist = (dot ? 22 : 25) + Math.random() * 11;
                var ex = Math.cos(rad) * (14 + dist), ey = Math.sin(rad) * (6 + dist * .78) + 3 + Math.random() * 4;
                var rot = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI + 90;
                fx.appendChild(sp);
                if (sp.animate) sp.animate([
                    { transform: 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(.3)', opacity: 0 },
                    { transform: 'translate(' + (sx + (ex - sx) * .35).toFixed(1) + 'px,' + (sy + (ey - sy) * .35).toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(' + (dot ? '1.15' : '1,1.25') + ')', opacity: 1, offset: .24 },
                    { transform: 'translate(' + ex.toFixed(1) + 'px,' + ey.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(.15)', opacity: 0 }
                ], { duration: 480 + Math.round(Math.random() * 170), delay: (i % 4) * 14, easing: 'cubic-bezier(.16, .84, .32, 1)', fill: 'both' });
            }
            btn.appendChild(fx);
            setTimeout(function () { fx.remove(); }, 760);
        }
        seg.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            e.stopPropagation();
            var on = b.dataset.m === 'pk';
            setM(on);
            if (on) deskPickSparks(b);
            try { localStorage.setItem('clever2-mode', on ? 'pick' : ''); } catch (er) {}
        });
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
        deskPromo();
        pr.setAttribute('aria-pressed', String(!!S.filters.promo));
    }
    function deskPromo() {
        var row = document.getElementById('promoRow'), sec = row && row.closest('.sec');
        if (!sec || sec.querySelector('.dpromo-h')) return;
        var hd = document.createElement('div'); hd.className = 'sec__head pad dpromo-h';
        hd.innerHTML = '<h2 class="h">Акции</h2><span class="dpromo-nav">' +
            '<button type="button" aria-label="Назад" aria-controls="promoRow">' + ic('i-right') + '</button>' +
            '<button type="button" aria-label="Вперёд" aria-controls="promoRow">' + ic('i-right') + '</button></span>';
        sec.insertBefore(hd, row);
        var shadow = document.createElement('div');
        shadow.className = 'dpromo-shadow';
        shadow.setAttribute('aria-hidden', 'true');
        sec.insertBefore(shadow, row);
        var buttons = hd.querySelectorAll('button');
        function sync() {
            buttons[0].disabled = row.scrollLeft < 1;
            buttons[1].disabled = row.scrollLeft >= row.scrollWidth - row.clientWidth - 1;
            placePromoShadow(row);
        }
        [-1, 1].forEach(function (direction, i) {
            buttons[i].addEventListener('click', function () {
                if (row.children.length < 2) return;
                var pitch = row.children[1].getBoundingClientRect().left - row.children[0].getBoundingClientRect().left;
                var next = (Math.round(row.scrollLeft / pitch) + direction) * pitch;
                row.scrollTo({ left: next, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            });
        });
        row.addEventListener('scroll', sync, { passive: true });
        row.addEventListener('mouseover', function () { placePromoShadow(row); });
        row.addEventListener('mouseleave', function () { shadow.classList.remove('is-on'); });
        sync();
    }
    function placePromoShadow(row) {
        var card = row.querySelector('.promo:hover'), sec = row.parentElement;
        var shadow = sec.querySelector('.dpromo-shadow');
        if (!shadow) return;
        if (!card) { shadow.classList.remove('is-on'); return; }
        var box = card.getBoundingClientRect(), track = row.getBoundingClientRect();
        if (box.left < track.left - 1 || box.right > track.right + 1) { shadow.classList.remove('is-on'); return; }
        var host = sec.getBoundingClientRect();
        shadow.style.left = (box.left - host.left) + 'px';
        shadow.style.top = (box.top - host.top) + 'px';
        shadow.style.width = box.width + 'px';
        shadow.style.height = card.querySelector('.promo__banner').offsetHeight + 'px';
        shadow.classList.add('is-on');
    }
    /* 24.11: карусель «Популярное» на странице заведения — ровно 3 (или 2) целых карточки и стрелки в шапке секции, как у «Акций» */
    function deskPop() {
        var sec = document.getElementById('m-popular'), row = sec && sec.querySelector('.pop-row');
        if (!sec || !row || !deskOn()) return;
        var hd = sec.querySelector('.dpop-h');
        if (!hd) {
            var title = sec.querySelector(':scope > h2.h');
            if (!title) return;
            hd = document.createElement('div'); hd.className = 'dpop-h';
            sec.insertBefore(hd, title);
            hd.appendChild(title);
            var nav = document.createElement('span'); nav.className = 'dpromo-nav';
            nav.innerHTML = '<button type="button" aria-label="Назад">' + ic('i-right') + '</button>' +
                '<button type="button" aria-label="Вперёд">' + ic('i-right') + '</button>';
            hd.appendChild(nav);
            var btns = nav.querySelectorAll('button');
            var sync = row._dpopSync = function () {
                var max = row.scrollWidth - row.clientWidth;
                nav.hidden = max < 8;
                btns[0].disabled = row.scrollLeft < 2;
                btns[1].disabled = row.scrollLeft >= max - 2;
            };
            [-1, 1].forEach(function (dir, i) {
                btns[i].addEventListener('click', function () {
                    if (row.children.length < 2) return;
                    var pitch = row.children[1].getBoundingClientRect().left - row.children[0].getBoundingClientRect().left;
                    if (!pitch) return;
                    var next = (Math.round(row.scrollLeft / pitch) + dir) * pitch;
                    row.scrollTo({ left: next, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
                });
            });
            row.addEventListener('scroll', sync, { passive: true });
        }
        if (row._dpopSync) requestAnimationFrame(row._dpopSync);
    }
    window.addEventListener('resize', function () {
        var row = document.getElementById('promoRow');
        if (deskOn() && row) placePromoShadow(row);
        if (deskOn()) deskPop();
        if (askEl) placeAskAddr();
        clearTimeout(deskAddrRun._t); deskAddrRun._t = setTimeout(deskAddrRun, 180);
    });
    (function () { var hs = document.getElementById('homeScroll'); if (!hs || !window.MutationObserver) return; new MutationObserver(deskCats).observe(hs, { childList: true }); deskCats(); })();
    (function () { var rs = document.getElementById('restScroll'); if (!rs || !window.MutationObserver) return; new MutationObserver(deskPop).observe(rs, { childList: true }); deskPop(); })();
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
    /* 24.11: навигация браузера («Назад» / «Вперёд») на десктопе: переходы на страницу заведения и между вкладками
       пишутся в history.pushState, а нажатие кнопки «Назад» в браузере (или на странице заведения) возвращает обратно */
    var BASE_TITLE = document.title;
    var navReady = false, navKey = '', navIdx = 0, navTrail = [], fromPop = false;
    function navStateNow() {
        var rid = A.curRest && A.curRest();
        if (S.stack.indexOf('rest') >= 0 && rid) return { dnav: 1, key: 'rest:' + rid, page: 'rest', id: rid };
        return { dnav: 1, key: 'tab:' + S.tab, page: 'tab', tab: S.tab };
    }
    function navUrl(st) {
        var base = location.pathname + location.search;
        if (st.page === 'rest') return base + '#rest=' + st.id;
        if (st.tab && st.tab !== 'home') return base + '#' + st.tab;
        return base;
    }
    function navTitle(st) {
        if (st.page === 'rest') {
            var r = A.rest && A.rest(st.id);
            document.title = r ? r.name + ' — clever.by' : BASE_TITLE;
        } else if (st.tab === 'search') document.title = 'Поиск — clever.by';
        else if (st.tab === 'profile') document.title = 'Профиль — clever.by';
        else document.title = BASE_TITLE;
    }
    function deskNavSync() {
        if (!deskOn() || fromPop) return;
        var st = navStateNow();
        if (!navReady) {
            if (st.page === 'tab' && st.tab === 'home' && /^#rest=([\w-]+)$/.test(location.hash || '')) return;
            navReady = true;
            navKey = st.key;
            var prev = history.state && history.state.dnav ? history.state : null;
            navIdx = prev && typeof prev.idx === 'number' ? prev.idx : 0;
            st.idx = navIdx;
            navTrail[navIdx] = st.key;
            navTrail.length = navIdx + 1;
            try { history.replaceState(st, '', navUrl(st)); } catch (e) {}
            navTitle(st);
            return;
        }
        if (st.key === navKey) { navTitle(st); return; }
        navKey = st.key;
        navIdx++;
        st.idx = navIdx;
        navTrail[navIdx] = st.key;
        navTrail.length = navIdx + 1;
        try { history.pushState(st, '', navUrl(st)); } catch (e) {}
        navTitle(st);
    }
    function canHistBack() {
        return deskOn() && navReady && navIdx > 0 && S.stack.length === 1 && S.stack[0] === 'rest' && navTrail[navIdx - 1] === 'tab:' + S.tab;
    }
    function applyNavState(st) {
        fromPop = true;
        navKey = st.key;
        navIdx = typeof st.idx === 'number' ? st.idx : 0;
        navTrail[navIdx] = st.key;
        try {
            if (A.sheetKind && A.sheetKind() && A.closeSheet) A.closeSheet();
            deskClose();
            if (st.page === 'rest' && A.rest && A.rest(st.id)) {
                if (S.stack[S.stack.length - 1] !== 'rest' || (A.curRest && A.curRest() !== st.id)) {
                    if (S.stack.length && A.resetStack) A.resetStack();
                    pushScreen('rest', st.id);
                }
            } else {
                var tab = st.tab || 'home';
                if (S.stack.length === 1 && S.stack[0] === 'rest' && S.tab === tab) {
                    popScreen();
                } else {
                    var had = S.stack.length;
                    if (had && A.resetStack) A.resetStack();
                    if ((S.tab !== tab || had) && A.setTab) A.setTab(tab, had ? 2 : 1);
                }
            }
            navTitle(st);
        } finally {
            fromPop = false;
        }
    }
    window.addEventListener('popstate', function (e) {
        if (!deskOn()) return;
        var st = e.state && e.state.dnav ? e.state : null;
        if (!st) {
            var h = location.hash || '', m = /^#rest=([\w-]+)$/.exec(h);
            if (m && A.rest && A.rest(m[1])) st = { dnav: 1, idx: 0, page: 'rest', id: m[1], key: 'rest:' + m[1] };
            else if (h === '#search' || h === '#profile' || h === '#fav' || h === '#orders') {
                var tb = h.slice(1);
                st = { dnav: 1, idx: 0, page: 'tab', tab: tb, key: 'tab:' + tb };
            } else st = { dnav: 1, idx: 0, page: 'tab', tab: 'home', key: 'tab:home' };
        }
        applyNavState(st);
    });
    app.addEventListener('click', function (e) {
        if (!deskOn()) return;
        var b = e.target.closest('#s-rest [data-act="back"]');
        if (!b || !canHistBack()) return;
        e.stopPropagation();
        e.preventDefault();
        history.back();
    }, true);
    /* 24.11: вся верхняя шапка не фиксирована — плавно уезжает вверх 1:1 с прокруткой активной страницы */
    function activePageScroll() {
        if (S.stack.indexOf('rest') >= 0) return document.getElementById('restScroll');
        return document.querySelector('#s-' + S.tab + ' > .scroll');
    }
    function deskHeadScrollSync(sc) {
        if (!deskOn()) { deskHeadScrollSync._v = null; app.style.removeProperty('--dhead-y'); return; }
        sc = sc || activePageScroll();
        var dh = parseFloat(getComputedStyle(app).getPropertyValue('--dh')) || 150;
        var y = sc ? Math.max(0, sc.scrollTop) : 0;
        var off = y >= dh ? dh + 2 : y;
        if (deskHeadScrollSync._v !== off) {
            deskHeadScrollSync._v = off;
            app.style.setProperty('--dhead-y', off.toFixed(1) + 'px');
        }
        if (askEl) {
            if (y > 40) hideAskAddr();
            else placeAskAddr();
        }
    }
    app.addEventListener('scroll', function (e) {
        if (!deskOn()) return;
        var sc = activePageScroll();
        if (e.target !== sc) return;
        deskHeadScrollSync(sc);
    }, true);
    function deskChrome() {
        if (!deskOn()) { deskAddrStop(); deskHeadScrollSync(); var tb = document.getElementById('tabbar'); if (tb) tb._dk = ''; if (askEl) hideAskAddr(true); if (app.dataset.dtop != null) { delete app.dataset.dtop; delete app.dataset.dpage; } return; }
        if (askEl && (S.tab !== 'home' || S.stack.length || A.sheetKind())) hideAskAddr();
        var top = S.stack[S.stack.length - 1];
        app.dataset.dtop = deskKind(top);
        app.dataset.dpage = S.stack.indexOf('rest') >= 0 ? 'rest' : S.tab;
        // затемнение — прямо под первым экраном-панелью или окном: у экранов порядок слоёв — по глубине стопки (11, 12…)
        var k = 0; while (k < S.stack.length && deskKind(S.stack[k]) === 'page') k++;
        document.getElementById('dscrim').style.zIndex = String(10 + k);
        $$('.screen.dk-first').forEach(function (s) { if (s.id !== 's-' + S.stack[k]) s.classList.remove('dk-first'); });
        if (S.stack[k]) document.getElementById('s-' + S.stack[k]).classList.add('dk-first');
        deskHead(); deskCats(); deskPop(); deskNavSync(); deskHeadScrollSync();
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
            if (askEl) { hideAskAddr(); e.preventDefault(); }
            else if (A.sheetKind()) { closeSheetNice(); e.preventDefault(); }
            else if (/drawer|win/.test(deskKind(S.stack[S.stack.length - 1]))) { popScreen(); e.preventDefault(); }
            else if (S.stack.length) { if (canHistBack()) history.back(); else popScreen(); e.preventDefault(); }
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
        if (cy < 0) return;
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
            var h = e.target.closest('.hscroll:not(#promoRow):not(.pop-row), .filters, .rtabs__row, .ri-tks, .cdays, .slots');
            if (h && h.scrollWidth - h.clientWidth < 8) h = null;
            if (h !== cur) { cur = h; put(); }
        });
        app.addEventListener('mouseleave', function () { cur = null; put(); });
        app.addEventListener('scroll', function () { if (cur) put(); }, true);
    })();

    return { kind: deskKind, chrome: deskChrome, close: deskClose, cartToggle: deskCartToggle, dishAdded: deskDishAdded, askAddr: askAddr };
};
