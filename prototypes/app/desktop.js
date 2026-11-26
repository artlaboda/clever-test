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
        var seg = document.createElement('div'); seg.className = 'cseg dseg'; seg.dataset.key = 'desk-mode';
        seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', 'Как получить');
        var pk = false; try { pk = localStorage.getItem('clever2-mode') === 'pick'; } catch (e) {}
        seg.style.setProperty('--n', 2);
        seg.innerHTML = '<span class="cseg__th" aria-hidden="true"></span>' +
            '<button type="button" role="radio" data-m="dl">Доставка</button>' +
            '<button type="button" role="radio" data-m="pk"><span>Навынос</span><em class="dseg__sale"><i>\u221215%</i></em></button>';
        var setM = function (on) {
            seg.classList.toggle('is-pk', on);
            seg.style.setProperty('--i', on ? 1 : 0);
            [].forEach.call(seg.querySelectorAll(':scope > button'), function (b) {
                var sel = (b.dataset.m === 'pk') === on;
                b.setAttribute('aria-pressed', String(sel));
                b.setAttribute('aria-checked', String(sel));
            });
        };
        setM(pk);
        /* 24.11: маленькие искры из-под капсулы «−15%» при клике/переключении на «Навынос» */
        function deskPickSparks(btn, delay) {
            if (fxOff() || !btn) return;
            var pill = btn.querySelector('.dseg__sale'); if (!pill) return;
            var run = function () {
                if (pill.animate) pill.animate(
                    [{ transform: 'scale(1)' }, { transform: 'scale(.92)', offset: .2 }, { transform: 'scale(1.1)', offset: .55 }, { transform: 'scale(1)' }],
                    { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }
                );
                var fx = document.createElement('div');
                fx.className = 'dseg__fx';
                fx.setAttribute('aria-hidden', 'true');
                fx.style.left = (btn.offsetLeft + pill.offsetLeft + pill.offsetWidth / 2) + 'px';
                fx.style.top = (btn.offsetTop + pill.offsetTop + pill.offsetHeight / 2) + 'px';
                var glow = document.createElement('i');
                glow.className = 'dseg__glow';
                fx.appendChild(glow);
                if (glow.animate) glow.animate([
                    { transform: 'scale(.72)', opacity: .45 },
                    { transform: 'scale(1.65)', opacity: 0 }
                ], { duration: 440, easing: 'cubic-bezier(.16, .84, .32, 1)', fill: 'both' });
                var cols = ['#ff3b2f', '#ff7a1a', '#ffb800', '#e3141c', '#ff5533', '#ffc82e'];
                var rx = pill.offsetWidth * .44, ry = pill.offsetHeight * .38, N = 14;
                for (var i = 0; i < N; i++) {
                    var dot = i % 3 === 1, sp = document.createElement('i');
                    sp.className = dot ? 'dseg__sp dseg__sp--dot' : 'dseg__sp';
                    sp.style.color = cols[i % cols.length];
                    var deg = i * (360 / N) + (Math.random() - .5) * 18;
                    var rad = deg * Math.PI / 180;
                    var sx = Math.cos(rad) * rx, sy = Math.sin(rad) * ry;
                    var dist = (dot ? 20 : 24) + Math.random() * 14;
                    var ex = Math.cos(rad) * (rx + dist), ey = Math.sin(rad) * (ry + dist * .86) + 4 + Math.random() * 4;
                    var rot = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI + 90;
                    fx.appendChild(sp);
                    if (sp.animate) sp.animate([
                        { transform: 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(.35)', opacity: 0 },
                        { transform: 'translate(' + (sx + (ex - sx) * .36).toFixed(1) + 'px,' + (sy + (ey - sy) * .36).toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(' + (dot ? '1.2' : '1,1.3') + ')', opacity: 1, offset: .22 },
                        { transform: 'translate(' + ex.toFixed(1) + 'px,' + ey.toFixed(1) + 'px) rotate(' + rot.toFixed(0) + 'deg) scale(.15)', opacity: 0 }
                    ], { duration: 540 + Math.round(Math.random() * 200), delay: (i % 4) * 16, easing: 'cubic-bezier(.16, .84, .32, 1)', fill: 'both' });
                }
                seg.appendChild(fx);
                setTimeout(function () { fx.remove(); }, 840);
            };
            if (delay) setTimeout(run, delay); else run();
        }
        seg.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            e.stopPropagation();
            var on = b.dataset.m === 'pk', prev = seg.classList.contains('is-pk') ? 1 : 0, next = on ? 1 : 0;
            if (prev === next) {
                if (on) deskPickSparks(b, 0);
                return;
            }
            setM(on);
            if (A.segPlay && A.segStart) A.segPlay(seg, A.segStart(prev), next);
            if (on) deskPickSparks(b, 140);
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
        promoShadows(sec, row);
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
        row.addEventListener('mouseleave', function () {
            promoShadows(sec, row).forEach(function (s) { s.classList.remove('is-on'); });
        });
        sync();
    }
    function promoShadows(sec, row) {
        var list = sec.querySelectorAll(':scope > .dpromo-shadow'), n = row.children.length;
        if (list.length !== n) {
            for (var i = list.length; i < n; i++) {
                var sh = document.createElement('div');
                sh.className = 'dpromo-shadow';
                sh.setAttribute('aria-hidden', 'true');
                sec.insertBefore(sh, row);
            }
            for (var j = list.length - 1; j >= n; j--) list[j].remove();
            list = sec.querySelectorAll(':scope > .dpromo-shadow');
        }
        return list;
    }
    function placePromoShadow(row) {
        var sec = row.parentElement; if (!sec) return;
        var cards = row.children, shadows = promoShadows(sec, row);
        var hovered = row.querySelector('.promo:hover');
        var track = row.getBoundingClientRect(), host = sec.getBoundingClientRect();
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i], sh = shadows[i];
            var box = card.getBoundingClientRect();
            var inView = box.left >= track.left - 1 && box.right <= track.right + 1;
            var banner = card.querySelector('.promo__banner');
            if (inView && banner) {
                sh.style.left = (box.left - host.left) + 'px';
                sh.style.top = (box.top - host.top) + 'px';
                sh.style.width = box.width + 'px';
                sh.style.height = banner.offsetHeight + 'px';
            }
            sh.classList.toggle('is-on', card === hovered && inView && !!banner);
        }
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
    (function () { var rs = document.getElementById('s-rest'); if (!rs || !window.MutationObserver) return; new MutationObserver(function () { if (deskOn()) { deskPlaceHead(); deskRestMount(); deskPop(); } }).observe(rs, { childList: true }); })();
    // курьер в карточке заведения: при наведении сразу бежит (crGame('run')) ровно из позы статичной иконки #i-courier
    // (кадр 22 — максимальное совпадение силуэта, головы, сумки, передней ноги и рук при viewBox 0.7 0.1 19.5 19.5);
    // begin="indefinite" + beginElement() при каждом наведении гарантирует старт строго с кадра 22 без случайного сдвига фазы SMIL
    var RUN_KT = '0;0.0511;0.105;0.1559;0.1997;0.2387;0.2767;0.3059;0.33;0.3444;0.3718;0.3918;0.4067;0.4257;0.4527;0.488;0.528;0.5699;0.612;0.6532;0.6945;0.7374;0.7809;0.8226;0.8566;0.8791;0.8898;0.9004;0.9225;0.9562;1';
    function deskRunSvg() {
        return A.crGame('run', { bag: 'red', rate: .86 })
            .replace('viewBox="0 0 21 21"', 'viewBox="0.7 0.1 19.5 19.5"')
            .replace(/(<path\b[^>]*?\bd=")([^"]*)("[^>]*><animate\b[^>]*?) repeatCount="indefinite" values="([^"]+)"/g, function (m, p1, d0, p3, vals) {
                var f = vals.split(';'); if (f.length !== 31) return m;
                var r = f.slice(22, 30).concat(f.slice(0, 22)); r.push(r[0]);
                return p1 + r[0] + p3 + ' begin="indefinite" keyTimes="' + RUN_KT + '" repeatCount="indefinite" values="' + r.join(';') + '"';
            });
    }
    app.addEventListener('mouseover', function (e) {
        if (!deskOn() || !A.crGame) return;
        var r = e.target.closest('.rest'), m = r && r.querySelector('.rest__meta > span:first-child');
        if (!m || r._dcr) return;
        r._dcr = 1;
        var c = m.querySelector('.dcr'), cour = m.querySelector('.cour');
        if (!c) {
            c = document.createElement('i');
            c.className = cour ? 'dcr' : 'dcr dcr--own';
            c.setAttribute('aria-hidden', 'true');
            c.innerHTML = deskRunSvg();
            if (cour) cour.appendChild(c);
            else m.insertBefore(c, m.firstChild);
            void c.offsetWidth;
        }
        var sv = c.querySelector('svg');
        if (sv) {
            try {
                if (sv.unpauseAnimations) sv.unpauseAnimations();
                [].forEach.call(sv.querySelectorAll('animate'), function (a) { if (a.beginElement) a.beginElement(); });
            } catch (er) {}
        }
    });
    app.addEventListener('mouseout', function (e) {
        var r = e.target.closest('.rest'); if (!r || !r._dcr || (e.relatedTarget && r.contains(e.relatedTarget))) return;
        r._dcr = 0;
        var sv = r.querySelector('.dcr svg');
        if (sv) { try { if (sv.pauseAnimations) sv.pauseAnimations(); } catch (er) {} }
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
        } else if (st.tab === 'search') document.title = (A.tr ? A.tr('Поиск') : 'Поиск') + ' — clever.by';
        else if (st.tab === 'profile') document.title = (A.tr ? A.tr('Профиль') : 'Профиль') + ' — clever.by';
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
    /* 24.11: шапка — статичный блок в потоке активной страницы (не плавает и не догоняет скролл через JS) */
    var lastHeadTab = '';
    function deskPlaceHead() {
        var tb = document.getElementById('tabbar'); if (!tb) return;
        if (!deskOn()) { if (tb.parentNode !== app) app.appendChild(tb); return; }
        var onRest = S.stack.indexOf('rest') >= 0;
        var host = onRest ? document.getElementById('restScroll') : document.getElementById('s-' + S.tab);
        if (host && tb.parentNode !== host) host.insertBefore(tb, host.firstChild);
        if (!onRest && lastHeadTab && lastHeadTab !== S.tab && host) host.scrollTop = 0;
        if (!onRest) lastHeadTab = S.tab;
    }
    app.addEventListener('scroll', function (e) {
        if (askEl && deskOn() && e.target && e.target.scrollTop > 24) hideAskAddr();
    }, true);
    /* 24.11: страница заведения на десктопе — кнопки .rtop на самой обложке .rhero, а при прокрутке к меню .rtabs
       прилипает к верхнему краю: слева выезжают кнопка «Назад», мини-аватар и название заведения, справа — живая корзина */
    function deskRestMount() {
        if (!deskOn() || S.stack.indexOf('rest') < 0) return;
        var scr = document.getElementById('s-rest'); if (!scr) return;
        var hero = scr.querySelector('.rhero'), rtop = document.getElementById('rtop');
        if (hero && rtop && rtop.parentNode !== hero) hero.appendChild(rtop);
        var cap = scr.querySelector('#rtabs > .rtabs__cap'), row = cap && cap.querySelector('.rtabs__row');
        if (!cap || !row || cap.querySelector('.drnav-cart')) return;
        var r = A.rest && A.curRest && A.rest(A.curRest());
        var himg = hero && hero.querySelector('img'), src = himg ? himg.getAttribute('src') : '';
        var idEl = document.createElement('div');
        idEl.className = 'drnav-id';
        idEl.innerHTML =
            '<button type="button" class="drnav-back" data-act="back" aria-label="Назад">' + ic('i-back') + '</button>' +
            '<button type="button" class="drnav-who" aria-label="Наверх страницы">' +
                (src ? '<img src="' + esc(src) + '" alt="">' : '') +
                '<span>' + esc(r ? r.name : '') + '</span>' +
            '</button>';
        idEl.querySelector('.drnav-who').addEventListener('click', function (e) {
            e.stopPropagation();
            var sc = document.getElementById('restScroll');
            if (sc) sc.scrollTo({ top: 0, behavior: fxOff() ? 'auto' : 'smooth' });
        });
        cap.insertBefore(idEl, row);
        var cartEl = document.createElement('div');
        cartEl.className = 'drnav-cart';
        cartEl.innerHTML =
            '<button type="button" class="drnav-cart__btn" aria-label="Открыть корзину">' +
                '<span class="drnav-cart__bag" aria-hidden="true">' + ic('i-bag') + '<span class="drnav-cart__n" hidden>0</span></span>' +
                '<span class="drnav-cart__sum">Корзина</span>' +
            '</button>';
        cartEl.querySelector('.drnav-cart__btn').addEventListener('click', function (e) {
            e.stopPropagation();
            deskCartToggle();
        });
        cap.appendChild(cartEl);
        var n = A.cartCount ? A.cartCount() : 0;
        var sum = n && A.cartTotals && A.moneyShort ? A.moneyShort(A.cartTotals().total) + '\u00a0' + (A.BYN || '⃅') : '';
        deskCartSync(n, sum, 0, 0);
    }
    /* 25.11: плавающая круглая корзина на главной (.dfcart) с живой водой:
       • при добавлении блюда со скроллом выпрыгивает справа и ловит комету; при повторном скролле вниз с товарами
         плавно появляется справа фейд-ином;
       • при подъезде вверх (−135…+2 px) кружок оживает капиллярными волнами по контуру (SVG-сплайн) и вытягивает
         подвижный носик капли к ближайшему краю кнопки #cartTab;
       • как только #cartTab выехала целиком (ctTop ≥ 2 px), вся масса без фейд-аута быстро врезается в неё по
         естественной траектории (справа, снизу-справа или снизу — в зависимости от ширины окна) на слое z-index:0,
         поднимая брызги и несимметричную, долго стихающую волну по контуру — без transform на самой #cartTab,
         поэтому жирность цены остаётся идеально чёткой */
    var homeFloatEl = null, homeFloatFly = null, homeFloatOn = false, homeFloatDocking = false, homeFloatRaf = 0;
    var homeDropSt = { pull: 0, target: 0, ang: Math.PI, raf: 0, imp: [], E: 0, lastImp: -1e9 };
    var homeFloatLast = (function () {
        var n = A.cartCount ? A.cartCount() : 0;
        var sum = n && A.cartTotals && A.moneyShort ? A.moneyShort(A.cartTotals().total) + '\u00a0' + (A.BYN || '⃅') : '';
        return { n: n, sum: sum };
    })();
    var DROP_CIRC = 'M58 29A29 29 0 1 0 0 29A29 29 0 1 0 58 29Z';
    function homeCanFloat() {
        return deskOn() && S.tab === 'home' && S.stack.indexOf('rest') < 0;
    }
    function homeCartTop() {
        var ct = document.getElementById('cartTab');
        if (!ct) return 999;
        var cr = ct.getBoundingClientRect(), ar = app.getBoundingClientRect();
        return cr.top - ar.top;
    }
    function homeCartHidden() {
        var hs = document.getElementById('s-home');
        return !!(hs && hs.scrollTop > 92 && homeCartTop() < -22);
    }
    function homeFloatFlyClear() {
        if (homeFloatFly) { homeFloatFly.remove(); homeFloatFly = null; }
    }
    function homeFloatEnsure() {
        if (homeFloatEl) return homeFloatEl;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dfcart';
        b.hidden = true;
        b.setAttribute('aria-label', 'Открыть корзину');
        b.innerHTML =
            '<span class="dfcart__in">' +
                '<span class="dfcart__sh" aria-hidden="true"></span>' +
                '<svg class="dfcart__svg" viewBox="-260 -260 578 578" aria-hidden="true"><path class="dfcart__p" d="' + DROP_CIRC + '"/></svg>' +
                '<span class="dfcart__bag" aria-hidden="true">' + ic('i-bag') + '</span>' +
                '<span class="dfcart__n num" hidden>0</span>' +
            '</span>';
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            deskCartToggle();
        });
        app.appendChild(b);
        homeFloatEl = b;
        return b;
    }
    // живой, каждый раз разный водяной всплеск по контуру круглой плашки .dfcart при прилёте товара (без красных волн;
    // при серии добавлений волны складываются и энергия копится — капля волнуется сильнее)
    function homeDropSplash() {
        if (fxOff() || !homeFloatEl || !homeFloatOn || homeFloatDocking) return;
        var R = function (a, b) { return a + Math.random() * (b - a); }, now = performance.now();
        homeDropSt.E = homeDropSt.E * Math.exp(-(now - homeDropSt.lastImp) / 1400) + 1;
        homeDropSt.lastImp = now;
        var boost = Math.min(1.55, 1 + .25 * (homeDropSt.E - 1));
        // удар преимущественно с левой/нижней стороны (откуда прилетает комета), но со случайным углом и фазами
        var a0 = R(1.75, 3.55), dir = Math.random() < .5 ? 1 : -1;
        homeDropSt.imp.push({
            t0: now,
            end: R(2250, 2750) * Math.min(1.2, .96 + .08 * homeDropSt.E),
            a0: a0,
            dir: dir,
            amp: R(3.0, 3.9) * boost,
            f0: R(2.35, 3.05), tau0: R(480, 650),
            f2: R(2.0, 2.65), tau2: R(700, 940), ph2: R(0, 6.28), k2: R(.52, .72),
            f3: R(2.9, 3.7), tau3: R(600, 820), ph3: R(0, 6.28), k3: R(.38, .56),
            f4: R(3.8, 4.7), tau4: R(440, 620), ph4: R(0, 6.28), k4: R(.18, .3),
            spL: R(2.4, 3.3), spR: R(2.0, 2.9)
        });
        if (homeDropSt.imp.length > 6) homeDropSt.imp.shift();
        homeDropWake();
    }
    function homeFloatPaint(n, sum, pop) {
        if (!homeFloatEl) return;
        var cnt = homeFloatEl.querySelector('.dfcart__n');
        if (cnt) {
            cnt.hidden = !n;
            cnt.textContent = String(n);
            if (pop && n > 0 && !fxOff() && cnt.animate) cnt.animate([{ scale: .4 }, { scale: 1.28, offset: .52 }, { scale: 1 }], { duration: 400, easing: 'cubic-bezier(.22, 1.25, .36, 1)' });
        }
        if (pop && n > 0 && !fxOff() && homeFloatOn && !homeFloatDocking) {
            homeDropSplash();
        }
    }
    // живой контур капли: замкнутый Catmull-Rom сплайн из 40 точек — вытягивание носика к #cartTab + водяные волны от попаданий
    function homeDropRender(now, pull, ang, noseBoost, waveBoost, scaleAll, pathEl) {
        var path = pathEl || (homeFloatEl && homeFloatEl.querySelector('.dfcart__p'));
        if (!path) return;
        var imps = !pathEl ? homeDropSt.imp : null;
        if (imps && imps.length) {
            homeDropSt.imp = imps = imps.filter(function (w) { return now - w.t0 < w.end; });
        }
        var hasImp = !!(imps && imps.length);
        if (pull <= .004 && !waveBoost && !hasImp) { path.setAttribute('d', DROP_CIRC); return; }
        var M = 40, pts = [], t = now * .001, R0 = 29 * (scaleAll || 1);
        var nb = noseBoost != null ? noseBoost : 13.5;
        var wAmp = (.6 + 1.65 * Math.min(1, pull)) * (waveBoost != null ? waveBoost : 1) * Math.min(1, pull * 2.2);
        var ss = function (u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
        // предвычисляем временные коэффициенты активных водяных всплесков один раз на кадр
        var act = null;
        if (hasImp) {
            act = [];
            for (var m = 0; m < imps.length; m++) {
                var w = imps[m], dt = now - w.t0;
                if (dt <= 0 || dt >= w.end) continue;
                var q = dt / w.end, fade = 1 - ss((q - .68) / .32), rise = ss(dt / 45), s = dt * .001;
                var c0 = fade * rise * w.amp * Math.exp(-dt / w.tau0) * -Math.sin(2 * Math.PI * w.f0 * s);
                var c2 = fade * rise * w.amp * w.k2 * Math.exp(-dt / w.tau2);
                var c3 = fade * rise * w.amp * w.k3 * Math.exp(-dt / w.tau3);
                var c4 = fade * rise * w.amp * w.k4 * Math.exp(-dt / w.tau4);
                var crest = fade * ss(dt / 60) * w.amp * .62 * Math.exp(-dt / 640);
                act.push({
                    a0: w.a0, dir: w.dir, c0: c0,
                    c2: c2, om2: 2 * Math.PI * w.f2 * s + w.ph2,
                    c3: c3, om3: 2 * Math.PI * w.f3 * s + w.ph3,
                    c4: c4, om4: 2 * Math.PI * w.f4 * s + w.ph4,
                    crest: crest, pL: w.spL * s, pR: w.spR * s
                });
            }
        }
        var wrap = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
        for (var i = 0; i < M; i++) {
            var th = (i / M) * Math.PI * 2;
            var d = wrap(th - ang);
            var nose = pull * nb * Math.exp(-(d * d) / .29);
            var pinch = -pull * (3.2 * (scaleAll || 1)) * Math.sin(d) * Math.sin(d);
            var ww = wAmp * (
                Math.sin(3 * d - t * 6.6) * .52 +
                Math.sin(4 * d + t * 9.1 + 1.3) * .30 +
                Math.sin(2 * d - t * 4.5 + 2.7) * .36
            );
            var impR = 0;
            if (act) {
                for (var k = 0; k < act.length; k++) {
                    var a = act[k], da = wrap(th - a.a0);
                    // локальное вмятие/выплеск в точке удара + два асинхронных бегущих гребня по ободу + мягкие капиллярные моды
                    var loc = a.c0 * Math.exp(-(da * da) / .42);
                    var dL = wrap(da - a.pL), dR = wrap(da + a.pR);
                    var run = a.crest * (Math.exp(-(dL * dL) / .28) + .82 * Math.exp(-(dR * dR) / .34));
                    var modes = a.c2 * Math.cos(2 * da - a.dir * a.om2)
                        + a.c3 * Math.cos(3 * da + a.dir * a.om3)
                        + a.c4 * Math.cos(4 * da - a.dir * a.om4);
                    impR += loc + run + modes;
                }
                // мягкое насыщение, чтобы при серии быстрых кликов волнение заметно нарастало, но оставалось округлым
                impR = 8.2 * Math.tanh(impR / 8.2);
            }
            var r = Math.max(6, R0 + nose + pinch + ww + impR);
            pts.push([29 + Math.cos(th) * r, 29 + Math.sin(th) * r]);
        }
        var dStr = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
        for (var j = 0; j < M; j++) {
            var p0 = pts[(j - 1 + M) % M], p1 = pts[j], p2 = pts[(j + 1) % M], p3 = pts[(j + 2) % M];
            var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
            var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
            dStr += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
        }
        path.setAttribute('d', dStr + 'Z');
    }
    function homeDropStop() {
        if (homeDropSt.raf) { cancelAnimationFrame(homeDropSt.raf); homeDropSt.raf = 0; }
        homeDropSt.pull = 0;
        homeDropSt.target = 0;
        homeDropSt.imp = [];
        homeDropSt.E = 0;
    }
    function homeDropWake() {
        if (homeDropSt.raf || fxOff()) return;
        (function tick(now) {
            if (!homeFloatOn || homeFloatDocking || !homeFloatEl) { homeDropSt.raf = 0; return; }
            homeDropSt.pull += (homeDropSt.target - homeDropSt.pull) * .22;
            homeDropSt.imp = homeDropSt.imp.filter(function (w) { return now - w.t0 < w.end; });
            if (homeDropSt.target === 0 && homeDropSt.pull < .008 && !homeDropSt.imp.length) {
                homeDropSt.pull = 0;
                homeDropSt.raf = 0;
                homeDropRender(now, 0, homeDropSt.ang);
                return;
            }
            homeDropRender(now, homeDropSt.pull, homeDropSt.ang);
            homeDropSt.raf = requestAnimationFrame(tick);
        })(performance.now());
    }
    function homeFloatResetStyle() {
        homeDropStop();
        homeFloatFlyClear();
        if (!homeFloatEl) return;
        homeFloatEl.style.top = '22px';
        homeFloatEl.style.right = '24px';
        homeFloatEl.style.left = '';
        homeFloatEl.style.width = '58px';
        homeFloatEl.style.height = '58px';
        homeFloatEl.style.transform = '';
        homeFloatEl.style.opacity = '';
        var bag = homeFloatEl.querySelector('.dfcart__bag'), cnt = homeFloatEl.querySelector('.dfcart__n');
        if (bag) bag.style.opacity = '';
        if (cnt) cnt.style.opacity = '';
        homeDropRender(0, 0, Math.PI);
    }
    function homeFloatHide(immediate) {
        homeFloatOn = false;
        homeFloatDocking = false;
        homeDropStop();
        homeFloatFlyClear();
        if (homeFloatRaf) { cancelAnimationFrame(homeFloatRaf); homeFloatRaf = 0; }
        if (!homeFloatEl || homeFloatEl.hidden) return;
        homeFloatEl.classList.remove('is-on', 'is-morphing');
        if (immediate || fxOff()) {
            homeFloatEl.hidden = true;
            homeFloatResetStyle();
            return;
        }
        var el = homeFloatEl, inn = el.querySelector('.dfcart__in');
        var anim = inn && inn.animate ? inn.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'translateX(14px) scale(.65)', opacity: 0 }], { duration: 210, easing: 'ease-in', fill: 'forwards' }) : null;
        if (anim) anim.onfinish = function () { if (!homeFloatOn) { el.hidden = true; homeFloatResetStyle(); inn.getAnimations().forEach(function (a) { a.cancel(); }); } };
        else { el.hidden = true; homeFloatResetStyle(); }
    }
    /* мягкая, живая несимметричная водная волна по контуру #cartTab (в духе мобильного стики-бара, но под удар капли):
       • мягкая амплитуда и плавные перекошенные гребни без мелкой тряски;
       • живая скорость пробега (0,82–1,06 с) + два мягких переотражения туда-обратно;
       • верхняя и нижняя кромки вразнобой, спокойное доигрывание ~3,4–3,9 с.
       Сама #cartTab не трансформируется — шрифт цены сохраняет идеальную жирность */
    var DC_PADX = 12, DC_PADY = 22;
    var dcSS = function (u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    // несимметричный профиль гребня (крутой фронт, более пологий хвост — без зеркальной симметрии)
    var dcWave = function (u, skew) {
        if (u <= -4.2 || u >= 4.2) return 0;
        var s = u > 0 ? u * skew : u / skew;
        return (1 - s * s) * Math.exp(-s * s / 2);
    };
    function homeCartWaterImpact(ct, ix, iy, ivx, ivy) {
        if (!ct || fxOff()) return;
        var W = ct.offsetWidth, H = ct.offsetHeight;
        if (!W || !H) return;
        var st = ct._dwv || (ct._dwv = { list: [], raf: 0 }), now = performance.now();
        var R = function (a, b) { return a + Math.random() * (b - a); };
        var xi = ix != null ? ix : W * .78;
        var yi = iy != null ? iy : H * .55;
        // основное направление импульса: если удар справа — волна идёт влево (−1), если снизу ближе к центру — расходится в обе стороны
        var fromRight = xi > W * .52;
        var fromBottom = yi > H * .58 || (ivy != null && ivy < -40);
        var mainDir = fromRight ? -1 : 1;
        var A = H * .092 * R(.9, 1.12);

        // 1. мягкий локальный всплеск в точке входа (спокойный отклик 2–3 Гц, без резкого дребезга)
        var xiTop = Math.max(14, Math.min(W - 14, xi + R(-12, 8) + mainDir * R(3, 10)));
        var xiBot = Math.max(14, Math.min(W - 14, xi + R(-8, 12)));
        var sdTop = R(20, 28), sdBot = R(22, 31);
        var fTop = R(2.0, 2.65), fBot = R(2.4, 3.1);
        var tauTop = R(540, 740), tauBot = R(480, 680);
        var topLag = fromBottom ? R(22, 46) : R(0, 18);
        var botLag = fromBottom ? 0 : R(14, 36);
        var topK = R(.62, .84), botK = fromBottom ? R(.72, .94) : R(.52, .76);
        var T0 = R(1800, 2300);
        var hCapSign = xi > W * .55 ? 1 : (xi < W * .45 ? -1 : 0);
        var hCapK = hCapSign ? R(.28, .44) : R(.12, .22), fCap = R(1.9, 2.6);
        st.list.push({
            t0: now, end: T0,
            f: function (t) {
                if (t <= 0 || t >= T0) return null;
                var fade = 1 - dcSS((t / T0 - .7) / .3);
                var tt = t > topLag ? fade * topK * A * dcSS((t - topLag) / 48) * Math.exp(-(t - topLag) / tauTop) * Math.cos(2 * Math.PI * fTop * (t - topLag) / 1000) : 0;
                var bt = t > botLag ? fade * botK * A * dcSS((t - botLag) / 44) * Math.exp(-(t - botLag) / tauBot) * Math.cos(2 * Math.PI * fBot * (t - botLag) / 1000) : 0;
                var hc = fade * hCapK * A * dcSS(t / 46) * Math.exp(-t / 480) * Math.cos(2 * Math.PI * fCap * t / 1000);
                var invT = 1 / (sdTop * sdTop), invB = 1 / (sdBot * sdBot);
                return function (x) {
                    var dt = x - xiTop, db = x - xiBot;
                    return [
                        tt * Math.exp(-dt * dt * invT),
                        bt * Math.exp(-db * db * invB),
                        hCapSign >= 0 ? hc : 0,
                        hCapSign < 0 ? hc : 0
                    ];
                };
            }
        });

        // 2. плавные асинхронные гребни (верх и низ вразнобой) + пара мягких переотражений
        var env = function (q) { return (q < .11 ? dcSS(q / .11) : 1 - .52 * dcSS((q - .11) / .71)) * (1 - dcSS((q - .78) / .22)); };
        var makeCrest = function (edgeIdx, d, a, sw, dur, x0, x1, skew, bleed, bleedShift, wallPush) {
            return { t0: now, end: d + dur, f: function (t) {
                var q = (t - d) / dur; if (q <= 0 || q >= 1) return null;
                var c = x0 + (x1 - x0) * (1 - Math.pow(1 - q, 1.38)), w = sw * (1 + .42 * q), h = a * env(q);
                var wp = wallPush ? wallPush * Math.exp(-Math.pow((q - .25) / .15, 2)) : 0;
                return function (x) {
                    var primary = h * dcWave((x - c) / w, skew);
                    var other = bleed ? bleed * h * dcWave((x - c + bleedShift) / (w * 1.15), 1 / skew) : 0;
                    return edgeIdx === 0
                        ? [primary, other, 0, wp]
                        : [other, primary, wp * .5, 0];
                };
            } };
        };
        var sBase = Math.max(20, Math.min(30, W * .165));
        var xStart = Math.max(8, Math.min(W - 8, xi));
        var xFar = mainDir < 0 ? -28 : W + 28;
        var xNear = mainDir < 0 ? W + 24 : -24;
        var xWallFar = mainDir < 0 ? 8 : W - 8;
        var xWallNear = mainDir < 0 ? W - 8 : 8;

        // верхняя кромка: основной гребень + второй + два мягких отражения
        var tTop = R(820, 1060), skTop = mainDir < 0 ? R(1.16, 1.34) : R(.74, .87);
        st.list.push(makeCrest(0, R(0, 26), A * R(.92, 1.1), sBase * R(.88, 1.12), tTop, xStart, xFar, skTop, R(.16, .3) * (Math.random() < .35 ? -1 : 1), R(-14, 16), A * .24));
        st.list.push(makeCrest(0, R(210, 310), A * R(.5, .68), sBase * R(1.04, 1.26), tTop * R(.94, 1.12), xStart + R(-8, 8), xFar, skTop * R(.92, 1.08), R(.1, .22), R(-12, 14), 0));
        st.list.push(makeCrest(0, R(560, 740), A * R(.36, .52), sBase * R(1.12, 1.34), R(960, 1220), xWallFar, xNear, 1 / skTop, R(.1, .22) * -1, R(-14, 14), 0));
        st.list.push(makeCrest(0, R(1240, 1520), A * R(.2, .32), sBase * R(1.22, 1.46), R(1120, 1420), xWallNear, xFar, skTop * R(.92, 1.08), R(.06, .16), R(-12, 12), 0));

        // нижняя кромка: свой ритм, другая скорость и независимое мягкое отражение
        var tBot = tTop * R(.86, 1.16), skBot = mainDir < 0 ? R(1.12, 1.32) : R(.76, .89);
        st.list.push(makeCrest(1, R(38, 102), A * R(.78, 1.04), sBase * R(.92, 1.18), tBot, xStart + R(-10, 10), xFar, skBot, R(.14, .26) * (Math.random() < .4 ? -1 : 1), R(-14, 14), 0));
        st.list.push(makeCrest(1, R(290, 415), A * R(.4, .58), sBase * R(1.08, 1.32), tBot * R(.92, 1.1), xStart + R(-8, 10), xFar, skBot, R(.08, .2), R(-14, 14), 0));
        st.list.push(makeCrest(1, R(710, 920), A * R(.26, .42), sBase * R(1.18, 1.42), R(1000, 1280), xWallFar, xNear, 1 / skBot, R(.08, .18), R(-12, 12), 0));
        if (Math.random() < .75) st.list.push(makeCrest(1, R(1440, 1740), A * R(.14, .24), sBase * R(1.26, 1.5), R(1140, 1440), xWallNear, xFar, skBot * R(.92, 1.08), R(.05, .14), R(-10, 12), 0));

        // если удар пришёлся ближе к центру — мягкая встречная волна в обратную сторону
        if (xi < W * .78) {
            st.list.push(makeCrest(Math.random() < .5 ? 0 : 1, R(20, 65), A * R(.46, .66), sBase * R(.86, 1.08), R(760, 960), xStart, xNear, R(.76, .89), R(.12, .24), R(-10, 10), 0));
        }

        // 3. спокойное несимметричное доигрывание (мягкий slosh 1,5–2,6 Гц без мелкой тряски) — плавно тает ~3,4–3,9 с
        var tSlosh = R(3400, 3950), tauS = R(1150, 1450);
        var fS1 = R(1.5, 1.95), fS2 = R(2.1, 2.65), ph1 = R(0, 6.28), ph2 = R(0, 6.28);
        var aS1 = A * R(.24, .34), aS2 = A * R(.2, .3);
        var dirS = Math.random() < .5 ? 1 : -1;
        st.list.push({
            t0: now, end: tSlosh,
            f: function (t) {
                if (t <= 0 || t >= tSlosh) return null;
                var q = t / tSlosh;
                var dec = dcSS(t / 130) * Math.exp(-t / tauS) * (1 - dcSS((q - .7) / .3));
                var om1 = 2 * Math.PI * fS1 * t / 1000 + ph1;
                var om2 = 2 * Math.PI * fS2 * t / 1000 + ph2;
                return function (x) {
                    var u = x / W;
                    var sTop = dec * aS1 * (Math.sin(Math.PI * (u * 1.4 + .15) + dirS * om1) * .68 + Math.sin(Math.PI * (u * 2.15) - om2) * .32);
                    var sBot = dec * aS2 * (Math.sin(Math.PI * (u * 1.2 + .45) - dirS * om2) * .64 + Math.sin(Math.PI * (u * 1.9) + om1) * .36);
                    return [sTop, sBot, 0, 0];
                };
            }
        });

        if (!st.raf) homeCartWaterRun(ct);
    }
    /* iOS smooth corners (continuous corners, сглаживание 60% — ровно по алгоритму Figma / Apple HIG, как в index.html):
       используем тот же контур и в статическом ободке тёмной темы, и как базовую форму во время волны — без скачка углов */
    var DC_SQ_SMOOTH = .6, DC_CART_R = 15;
    function dcSqCorner(r, bud) {
        r = Math.min(r, bud);
        var s = Math.max(0, Math.min(DC_SQ_SMOOTH, bud / r - 1)), p = Math.min((1 + s) * r, bud);
        var arc = 90 * (1 - s), L = Math.sin(arc / 2 * Math.PI / 180) * r * Math.SQRT2;
        var al = (90 - arc) / 2, p34 = r * Math.tan(al / 2 * Math.PI / 180), be = 45 * s;
        var c = p34 * Math.cos(be * Math.PI / 180), d = c * Math.tan(be * Math.PI / 180);
        var b = (p - L - c - d) / 3, a = 2 * b;
        return { r: r, a: a, b: b, c: c, d: d, p: p, L: L, be: be };
    }
    function dcSqPath(w, h, r, ox, oy) {
        var bud = Math.min(w, h) / 2, k = dcSqCorner(r, bud), f = function (v) { return Math.round(v * 100) / 100; };
        var p = k.p, a = k.a, b = k.b, c = k.c, d = k.d, L = k.L, x = ox || 0, y = oy || 0;
        return 'M' + f(x + w - p) + ' ' + f(y) +
            'c' + f(a) + ' 0 ' + f(a + b) + ' 0 ' + f(a + b + c) + ' ' + f(d) +
            'a' + f(k.r) + ' ' + f(k.r) + ' 0 0 1 ' + f(L) + ' ' + f(L) +
            'c' + f(d) + ' ' + f(c) + ' ' + f(d) + ' ' + f(b + c) + ' ' + f(d) + ' ' + f(a + b + c) +
            'L' + f(x + w) + ' ' + f(y + h - p) +
            'c0 ' + f(a) + ' 0 ' + f(a + b) + ' ' + f(-d) + ' ' + f(a + b + c) +
            'a' + f(k.r) + ' ' + f(k.r) + ' 0 0 1 ' + f(-L) + ' ' + f(L) +
            'c' + f(-c) + ' ' + f(d) + ' ' + f(-(b + c)) + ' ' + f(d) + ' ' + f(-(a + b + c)) + ' ' + f(d) +
            'L' + f(x + p) + ' ' + f(y + h) +
            'c' + f(-a) + ' 0 ' + f(-(a + b)) + ' 0 ' + f(-(a + b + c)) + ' ' + f(-d) +
            'a' + f(k.r) + ' ' + f(k.r) + ' 0 0 1 ' + f(-L) + ' ' + f(-L) +
            'c' + f(-d) + ' ' + f(-c) + ' ' + f(-d) + ' ' + f(-(b + c)) + ' ' + f(-d) + ' ' + f(-(a + b + c)) +
            'L' + f(x) + ' ' + f(y + p) +
            'c0 ' + f(-a) + ' 0 ' + f(-(a + b)) + ' ' + f(d) + ' ' + f(-(a + b + c)) +
            'a' + f(k.r) + ' ' + f(k.r) + ' 0 0 1 ' + f(L) + ' ' + f(-L) +
            'c' + f(c) + ' ' + f(-d) + ' ' + f(b + c) + ' ' + f(-d) + ' ' + f(a + b + c) + ' ' + f(-d) + 'Z';
    }
    // дискретизация iOS smooth-corner контура в [x, y, ny, nx] с точными внешними нормалями для волн на #cartTab
    function dcSqPts(W, H, R0) {
        var bud = Math.min(W, H) / 2, k = dcSqCorner(R0, bud), r = k.r;
        var pts = [], push = function (x, y, nx, ny) { var l = Math.hypot(nx, ny) || 1; pts.push([x, y, ny / l, nx / l]); };
        var cubic = function (x0, y0, x1, y1, x2, y2, x3, y3, n, skipLast) {
            var lim = skipLast ? n - 1 : n;
            for (var i = 1; i <= lim; i++) {
                var t = i / n, it = 1 - t;
                var x = it * it * it * x0 + 3 * it * it * t * x1 + 3 * it * t * t * x2 + t * t * t * x3;
                var y = it * it * it * y0 + 3 * it * it * t * y1 + 3 * it * t * t * y2 + t * t * t * y3;
                var tx = 3 * it * it * (x1 - x0) + 6 * it * t * (x2 - x1) + 3 * t * t * (x3 - x2);
                var ty = 3 * it * it * (y1 - y0) + 6 * it * t * (y2 - y1) + 3 * t * t * (y3 - y2);
                push(x, y, ty, -tx);
            }
        };
        var arcSeg = function (cx, cy, a0, a1, n) {
            for (var i = 1; i <= n; i++) {
                var a = a0 + (a1 - a0) * i / n;
                push(cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a));
            }
        };
        var p = k.p, a = k.a, b = k.b, c = k.c, d = k.d, L = k.L, eX = Math.max(0, W - 2 * p), eY = Math.max(0, H - 2 * p);
        var nxTop = Math.max(2, Math.round(eX / 3)), nySide = Math.max(0, Math.round(eY / 4)), nb = 5, na = 5, i;
        var aRad = k.be * Math.PI / 180;
        for (i = 0; i <= nxTop; i++) push(p + eX * i / nxTop, 0, 0, -1);
        var tx = W - p, ty = 0;
        cubic(tx, ty, tx + a, ty, tx + a + b, ty, tx + a + b + c, ty + d, nb);
        arcSeg(tx + a + b + c - r * Math.sin(aRad), ty + d + r * Math.cos(aRad), -Math.PI / 2 + aRad, -aRad, na);
        var trx2 = tx + a + b + c + L, try2 = ty + d + L;
        cubic(trx2, try2, trx2 + d, try2 + c, trx2 + d, try2 + b + c, W, p, nb);
        for (i = 1; i <= nySide; i++) push(W, p + eY * i / nySide, 1, 0);
        var brx = W, bry = H - p;
        cubic(brx, bry, brx, bry + a, brx, bry + a + b, brx - d, bry + a + b + c, nb);
        arcSeg(brx - d - r * Math.cos(aRad), bry + a + b + c - r * Math.sin(aRad), aRad, Math.PI / 2 - aRad, na);
        var brx2 = brx - d - L, bry2 = bry + a + b + c + L;
        cubic(brx2, bry2, brx2 - c, bry2 + d, brx2 - (b + c), bry2 + d, W - p, H, nb);
        for (i = 1; i <= nxTop; i++) push(W - p - eX * i / nxTop, H, 0, 1);
        var blx = p, bly = H;
        cubic(blx, bly, blx - a, bly, blx - (a + b), bly, blx - (a + b + c), bly - d, nb);
        arcSeg(blx - (a + b + c) + r * Math.sin(aRad), bly - d - r * Math.cos(aRad), Math.PI / 2 + aRad, Math.PI - aRad, na);
        var blx2 = blx - (a + b + c) - L, bly2 = bly - d - L;
        cubic(blx2, bly2, blx2 - d, bly2 - c, blx2 - d, bly2 - (b + c), 0, H - p, nb);
        for (i = 1; i <= nySide; i++) push(0, H - p - eY * i / nySide, -1, 0);
        var tlx = 0, tly = p;
        cubic(tlx, tly, tlx, tly - a, tlx, tly - (a + b), tlx + d, tly - (a + b + c), nb);
        arcSeg(tlx + d + r * Math.cos(aRad), tly - (a + b + c) + r * Math.sin(aRad), Math.PI + aRad, 1.5 * Math.PI - aRad, na);
        var tlx2 = tlx + d + L, tly2 = tly - (a + b + c) - L;
        cubic(tlx2, tly2, tlx2 + c, tly2 - d, tlx2 + (b + c), tly2 - d, p, 0, nb, true);
        return pts;
    }
    // iOS smooth corners + тонкий 1px ободок тёмной темы на #cartTab (в светлой теме stroke прозрачен)
    function homeCartRingSync(ct) {
        if (!ct || !deskOn() || ct.classList.contains('is-wave')) return;
        var W = ct.offsetWidth, H = ct.offsetHeight;
        if (!W || !H) return;
        var bodyD = 'path("' + dcSqPath(W, H, DC_CART_R, 0, 0) + '")';
        if (ct.getAttribute('data-sq') !== 'clip') ct.setAttribute('data-sq', 'clip');
        if (ct.style.getPropertyValue('--sq') !== bodyD) ct.style.setProperty('--sq', bodyD);
        var NS = 'http://www.w3.org/2000/svg', sv = ct.querySelector(':scope > .dcart-ring');
        if (!sv) {
            sv = document.createElementNS(NS, 'svg');
            sv.setAttribute('class', 'dcart-ring');
            sv.setAttribute('aria-hidden', 'true');
            sv.innerHTML = '<path/>';
            ct.insertBefore(sv, ct.firstChild);
        }
        var d = dcSqPath(W - 1, H - 1, DC_CART_R - .5, .5, .5);
        if (sv.firstChild.getAttribute('d') !== d) sv.firstChild.setAttribute('d', d);
        if (!ct._dSqRo && window.ResizeObserver) {
            ct._dSqRo = new ResizeObserver(function () { homeCartRingSync(ct); });
            ct._dSqRo.observe(ct);
        }
    }
    function homeCartWaterRun(ct) {
        var st = ct._dwv, NS = 'http://www.w3.org/2000/svg';
        var bg = ct.querySelector(':scope > .dcart-bg'), sv = ct.querySelector(':scope > .dcart-ring');
        if (!bg) { bg = document.createElement('span'); bg.className = 'dcart-bg'; bg.setAttribute('aria-hidden', 'true'); ct.insertBefore(bg, ct.firstChild); }
        if (!sv) { sv = document.createElementNS(NS, 'svg'); sv.setAttribute('class', 'dcart-ring'); sv.setAttribute('aria-hidden', 'true'); sv.innerHTML = '<path/>'; ct.insertBefore(sv, bg.nextSibling); }
        var ring = sv.firstChild;
        var ringCol = getComputedStyle(ct).getPropertyValue('--cta-ring-c');
        var ringOn = !/^\s*$|transparent|rgba\(0, 0, 0, 0\)/.test(ringCol);
        var W = ct.offsetWidth, H = ct.offsetHeight;
        // базовый контур — точные iOS smooth corners (60%), чтобы углы оставались гладкими и во время волны
        var pts = dcSqPts(W, H, DC_CART_R);
        var OM = .21 * H, IM = .13 * H, HM = 3.6;
        var sat = function (v) { return v > 0 ? OM * Math.tanh(v / OM) : IM * Math.tanh(v / IM); };
        var satX = function (v) { return HM * Math.tanh(v / HM); };
        var stop = function () {
            cancelAnimationFrame(st.raf); st.raf = 0; st.list = [];
            ct.classList.remove('is-wave');
            bg.style.webkitClipPath = bg.style.clipPath = '';
            homeCartRingSync(ct);
        };
        var frame = function (now) {
            if (!bg.isConnected || !ct.isConnected) { stop(); return; }
            var fs = [], k, still = true;
            st.list = st.list.filter(function (w) { return now - w.t0 < w.end; });
            st.list.forEach(function (w) { var f = w.f(now - w.t0); if (f) fs.push(f); });
            var edge = function (x) {
                var t = 0, b = 0, hr = 0, hl = 0, v;
                for (k = 0; k < fs.length; k++) { v = fs[k](x); t += v[0]; b += v[1]; hr += v[2]; hl += v[3]; }
                return [sat(t), sat(b), satX(hr), satX(hl)];
            };
            var cp = '', rd = '', j, p, e, x, y, cache = {};
            for (j = 0; j < pts.length; j++) {
                p = pts[j]; e = cache[p[0]] || (cache[p[0]] = edge(p[0]));
                x = p[3] > 0 ? p[0] + p[3] * e[2] : (p[3] < 0 ? p[0] + p[3] * e[3] : p[0]);
                y = p[2] < 0 ? p[1] + p[2] * e[0] : p[1] + p[2] * e[1];
                if (Math.abs(y - p[1]) > .04 || Math.abs(x - p[0]) > .04) still = false;
                cp += (j ? 'L' : 'M') + (x + DC_PADX).toFixed(1) + ' ' + (y + DC_PADY).toFixed(1);
                if (ringOn) rd += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(2);
            }
            bg.style.webkitClipPath = bg.style.clipPath = 'path("' + cp + 'Z")';
            if (ringOn) ring.setAttribute('d', rd + 'Z');
            if (!st.list.length && still) { stop(); return; }
            st.raf = requestAnimationFrame(frame);
        };
        ct.classList.add('is-wave');
        frame(performance.now());
    }
    // живые баллистические брызги жидкости из реальной точки и направления удара (единый SVG-слой на z-index:0)
    function homeCartSplash(ct, ix, iy, ivx, ivy) {
        if (!ct || fxOff()) return;
        var NS = 'http://www.w3.org/2000/svg';
        var st = ct._dsp || (ct._dsp = { list: [], raf: 0, last: 0 });
        var sv = ct.querySelector(':scope > .dcart-sp');
        if (!sv) {
            sv = document.createElementNS(NS, 'svg');
            sv.setAttribute('class', 'dcart-sp');
            sv.setAttribute('aria-hidden', 'true');
            sv.innerHTML = '<path/>';
            ct.insertBefore(sv, ct.firstChild);
        }
        var path = sv.firstChild, now = performance.now(), W = ct.offsetWidth || 150, H = ct.offsetHeight || 48;
        var R = function (a, b) { return a + Math.random() * (b - a); };
        var inAng = Math.atan2(ivy || -40, ivx || -100), outAng = inAng + Math.PI;
        var spawn = function (baseAng, spreadMin, spreadMax, spMin, spMax, rMin, rMax, sx, sy) {
            var a = baseAng + R(spreadMin, spreadMax) * Math.PI / 180, sp = R(spMin, spMax);
            st.list.push({
                x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                r: R(rMin, rMax), t0: now, life: R(360, 560)
            });
        };
        // отбойный веер и касательные брызги от реальной точки и угла удара + 1–2 перелива через противоположный край
        spawn(outAng, -58, -14, 130, 225, 3.4, 5.4, ix, iy);
        spawn(outAng, 14, 62, 120, 210, 3.0, 4.8, ix, iy);
        spawn(outAng, -108, -68, 125, 215, 2.8, 4.6, ix, iy);
        spawn(outAng, 68, 112, 115, 200, 2.4, 4.2, ix, iy);
        spawn(outAng, -42, 42, 180, 275, 1.6, 2.8, ix, iy);
        spawn(outAng, -95, 95, 170, 265, 1.5, 2.6, ix, iy);
        var farY = iy > H * .5 ? 3 : H - 3;
        var farX = Math.max(12, Math.min(W - 12, ix + Math.cos(inAng) * 14));
        spawn(iy > H * .5 ? -Math.PI / 2 : Math.PI / 2, -48, 48, 125, 205, 2.6, 4.2, farX, farY);
        if (Math.random() < .75) spawn(iy > H * .5 ? -Math.PI / 2 : Math.PI / 2, -65, 65, 155, 235, 1.6, 2.8, farX, farY);
        if (st.raf) return;
        st.last = now;
        (function tick(t) {
            if (!sv.isConnected || !ct.isConnected) { st.raf = 0; st.list = []; return; }
            var dt = Math.min(.04, Math.max(.004, (t - st.last) / 1000));
            st.last = t;
            var drag = Math.exp(-2.0 * dt), d = '', alive = [];
            for (var i = 0; i < st.list.length; i++) {
                var p = st.list[i], age = (t - p.t0) / p.life;
                if (age >= 1) continue;
                p.vx *= drag;
                p.vy = p.vy * drag + 480 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                var pop = age < .12 ? .55 + .45 * (age / .12) : 1;
                var rad = p.r * pop * Math.pow(1 - age, .72);
                if (rad < .3) continue;
                var spd = Math.hypot(p.vx, p.vy), ang = Math.atan2(p.vy, p.vx);
                var k = 1 + Math.min(1.15, spd / 205), rx = rad * k, ry = rad / Math.sqrt(k);
                var dx = rx * Math.cos(ang), dy = rx * Math.sin(ang), deg = (ang * 180 / Math.PI).toFixed(1);
                d += 'M' + (p.x - dx).toFixed(1) + ' ' + (p.y - dy).toFixed(1) +
                    'A' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ' ' + deg + ' 1 0 ' + (p.x + dx).toFixed(1) + ' ' + (p.y + dy).toFixed(1) +
                    'A' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ' ' + deg + ' 1 0 ' + (p.x - dx).toFixed(1) + ' ' + (p.y - dy).toFixed(1) + 'Z';
                alive.push(p);
            }
            st.list = alive;
            if (!alive.length) {
                st.raf = 0;
                sv.remove();
                return;
            }
            path.setAttribute('d', d);
            st.raf = requestAnimationFrame(tick);
        })(now);
    }
    /* летящая капля — струна: на старте (u=0, extraL=0) задняя половина — точный полукруг радиуса R0 (целая круглая плашка),
       с первого же кадра плашка сама вытягивается в каплю и затем в тонкую нить (1−u)^1.85 с сохранением массы */
    function homeDropStringRender(path, hist, cx, cy, now, tailMs, tailMax, R0, ang, ph, nosePull, minBack, uFlight) {
        if (!path) return '';
        var cut = now - tailMs, raw = [[cx, cy]], i, k;
        for (i = hist.length - 2; i >= 0; i--) {
            var h = hist[i], nx = hist[i + 1];
            if (h.t >= cut) { raw.push([h.x, h.y]); continue; }
            var f = (nx.t - cut) / Math.max(1, nx.t - h.t);
            raw.push([nx.x + (h.x - nx.x) * f, nx.y + (h.y - nx.y) * f]);
            break;
        }
        var acc = [0];
        for (i = 1; i < raw.length; i++) acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
        var Lraw = acc[acc.length - 1], minL = minBack != null ? minBack : R0;
        // пока кончик хвоста короче minL (на первых кадрах), дотягиваем ось до задней кромки плашки — задняя половина не срезается
        if (Lraw < minL) {
            var bdx, bdy;
            if (raw.length >= 2 && Lraw > .5) {
                var last = raw[raw.length - 1], prev = raw[raw.length - 2];
                bdx = last[0] - prev[0]; bdy = last[1] - prev[1];
                var bl = Math.hypot(bdx, bdy) || 1; bdx /= bl; bdy /= bl;
            } else {
                bdx = -Math.cos(ang); bdy = -Math.sin(ang);
            }
            var end = raw[raw.length - 1];
            raw.push([end[0] + bdx * (minL - Lraw), end[1] + bdy * (minL - Lraw)]);
            acc.push(minL);
            Lraw = minL;
        }
        var ss = function (u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
        var L = Math.min(tailMax, Lraw);
        var extraL = Math.max(0, L - R0);
        // морфинг из круглой плашки в каплю начинается с самого старта полёта (работает и на узких экранах, и при быстром скролле)
        var stretch = Math.max(ss((uFlight || 0) / .42), ss(extraL / 52));
        var rH = Math.max(R0 * .38, R0 / Math.sqrt(1 + extraL / (1.3 * 29) + stretch * .35));
        var noseEnv = Math.max(nosePull || 0, Math.sin(Math.min(1, (uFlight || 0) / .38) * Math.PI) * .55);
        var noseKeep = noseEnv * (1 - ss(Math.max((uFlight || 0) / .38, extraL / 44)));
        var toLoc = function (x, y) { return [x - cx + 29, y - cy + 29]; };
        var pts = [], t = now * .001, N = 16, sp = [];
        for (i = 0, k = 1; i < N; i++) {
            var s = L * i / (N - 1);
            while (k < acc.length - 1 && acc[k] < s) k++;
            var seg = acc[k] - acc[k - 1] || 1, q = Math.max(0, Math.min(1, (s - acc[k - 1]) / seg));
            sp.push([raw[k - 1][0] + (raw[k][0] - raw[k - 1][0]) * q, raw[k - 1][1] + (raw[k][1] - raw[k - 1][1]) * q]);
        }
        var hdx = sp[0][0] - sp[1][0], hdy = sp[0][1] - sp[1][1];
        var hAng = Math.hypot(hdx, hdy) > .5 ? Math.atan2(hdy, hdx) : ang;
        // передняя полуокружность головы (с плавно уходящим носиком noseKeep)
        for (i = 0; i <= 10; i++) {
            var a = hAng + Math.PI / 2 - Math.PI * i / 10, da = a - hAng, fr = Math.cos(da);
            var nH = noseKeep * 12 * Math.exp(-(da * da) / .3);
            var pH = -noseKeep * 3.0 * Math.sin(da) * Math.sin(da);
            var wHead = (.3 + .55 * stretch) * Math.sin(3 * a - t * 9 + ph);
            var r = Math.max(2, rH * (1 - .07 * stretch * Math.max(0, fr)) + nH + pH + wHead);
            pts.push(toLoc(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
        }
        // задняя часть: плавный морф от полукруга sqrt(1−u²) к тонкой струне (1−u)^1.85 с тем же pinch на экваторе
        var side = function (j, sign) {
            var p = sp[j], a1 = sp[Math.max(0, j - 1)], b1 = sp[Math.min(N - 1, j + 1)];
            var ta = Math.atan2(a1[1] - b1[1], a1[0] - b1[0]), u = j / (N - 1);
            var circ = Math.sqrt(Math.max(0, 1 - u * u));
            var str = Math.pow(1 - u, 1.85);
            var prof = circ * (1 - stretch) + str * stretch;
            var wob = 1 + .14 * stretch * u * Math.sin(u * 11 - t * 14 + ph + (sign > 0 ? 0 : 1.7));
            var rSide = Math.max(2, rH - noseKeep * 3.0 * (1 - u));
            var w = Math.max(.7 * stretch, rSide * prof) * wob;
            var na = ta + sign * Math.PI / 2;
            return toLoc(p[0] + Math.cos(na) * w, p[1] + Math.sin(na) * w);
        };
        for (i = 1; i < N - 1; i++) pts.push(side(i, -1));
        pts.push(toLoc(sp[N - 1][0], sp[N - 1][1]));
        for (i = N - 2; i >= 1; i--) pts.push(side(i, 1));
        var M = pts.length, d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
        for (var j = 0; j < M; j++) {
            var p0 = pts[(j - 1 + M) % M], p1 = pts[j], p2 = pts[(j + 1) % M], p3 = pts[(j + 2) % M];
            d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ' ' +
                (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ' ' +
                p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
        }
        var res = d + 'Z';
        path.setAttribute('d', res);
        return res;
    }
    function homeFloatLaunchMagnet(ct) {
        if (!homeFloatEl || homeFloatDocking) return;
        if (fxOff() || !ct) { homeFloatHide(true); return; }
        // сохраняем текущее вытягивание носика до остановки цикла — чтобы не было ни кадра схлопывания в круг
        var pull0 = homeDropSt.pull, ang0 = homeDropSt.ang;
        homeDropStop();
        homeFloatFlyClear();
        homeFloatDocking = true;
        var el = homeFloatEl, inn = el.querySelector('.dfcart__in');
        if (inn) inn.getAnimations().forEach(function (a) { a.cancel(); });
        var ar0 = app.getBoundingClientRect(), er = el.getBoundingClientRect(), cr0 = ct.getBoundingClientRect();
        var tw0 = cr0.width || 150, th0 = cr0.height || 48;
        // летит САМА круглая плашка .dfcart (в координатах app — ничего не исчезает и не обрезается скроллом #s-home!)
        var p0x = (er.left + er.width / 2) - ar0.left;
        var p0y = (er.top + er.height / 2) - ar0.top;
        el.classList.add('is-morphing');
        el.style.right = 'auto';
        el.style.left = (p0x - 29).toFixed(1) + 'px';
        el.style.top = (p0y - 29).toFixed(1) + 'px';
        el.style.transform = '';
        var elPath = el.querySelector('.dfcart__p'), bag = el.querySelector('.dfcart__bag');
        var R = function (a, b) { return a + Math.random() * (b - a); };
        var near = Math.hypot((cr0.left - ar0.left + tw0 * .5) - p0x, (cr0.top - ar0.top + th0 * .5) - p0y) < 160;
        var rx = near ? R(.3, .54) : R(.46, .72), ry = R(.38, .62);
        var p2x0 = (cr0.left - ar0.left) + tw0 * rx, p2y0 = (cr0.top - ar0.top) + th0 * ry;
        var dist0 = Math.hypot(p2x0 - p0x, p2y0 - p0y) || 1;
        var bend = (near ? R(22, 34) : R(12, 26)) * (Math.random() < .5 ? 1 : -1);
        var t0 = null, D = Math.min(440, Math.max(300, 220 + dist0 * .45)), DRAIN = 150;
        var tailMs = 165, tailMax = Math.max(58, Math.min(280, dist0 * .9)), ph = R(0, 6.28);
        var initAng = pull0 > .05 ? ang0 : Math.atan2(p2y0 - p0y, p2x0 - p0x);
        var hist = null;
        var absorbed = false, uHit = 1, lastAng = initAng;
        var fly = null, flyPath = null;
        homeFloatRaf = requestAnimationFrame(function step(now) {
            if (!homeFloatDocking || !ct.isConnected) return;
            // t0 берём строго из первого rAF-кадра: в Chrome now может быть меньше performance.now() из scroll,
            // из-за чего раньше tt < 0 давало Math.pow(u, 1.85) === NaN и отравляло hist на 165 мс (кружок исчезал!)
            if (t0 === null) {
                t0 = now;
                hist = [
                    { x: p0x - Math.cos(initAng) * 29, y: p0y - Math.sin(initAng) * 29, t: t0 - 115 },
                    { x: p0x, y: p0y, t: t0 }
                ];
            }
            var ar = app.getBoundingClientRect(), cr = ct.getBoundingClientRect();
            var offX = cr.left - ar.left, offY = cr.top - ar.top, tw = cr.width || tw0, th = cr.height || th0;
            // цель отслеживает живое положение #cartTab (скролл вверх не сдвигает плашку с места!)
            var p2x = offX + tw * rx, p2y = offY + th * ry;
            var ddx = p2x - p0x, ddy = p2y - p0y, dist = Math.hypot(ddx, ddy) || 1;
            var p1x = (p0x + p2x) * .5 + (-ddy / dist) * bend;
            var p1y = (p0y + p2y) * .5 + (ddx / dist) * bend;
            var tt = Math.max(0, now - t0), u = Math.max(0, Math.min(1, tt / D));
            // мягкий ненулевой старт: плашка трогается сразу с первого кадра и сама вытягивается в комету
            var e = .14 * u + .86 * Math.pow(u, 1.85), ie = 1 - e;
            var cx = u < 1 ? (ie * ie * p0x + 2 * ie * e * p1x + e * e * p2x) : p2x;
            var cy = u < 1 ? (ie * ie * p0y + 2 * ie * e * p1y + e * e * p2y) : p2y;
            var vx = 2 * ie * (p1x - p0x) + 2 * e * (p2x - p1x);
            var vy = 2 * ie * (p1y - p0y) + 2 * e * (p2y - p1y);
            if (u < 1) lastAng = Math.atan2(vy, vx);
            if (tt > 0) hist.push({ x: cx, y: cy, t: now });
            while (hist.length > 2 && hist[0].t < now - 280) hist.shift();
            // локальные координаты головы относительно #cartTab; не срабатываем раньше u >= 0.42, чтобы на ноутбуках
            // (где #cartTab рядом с .dfcart) плашка сначала успела зримо превратиться в каплю, а не исчезла в 1-м кадре
            var relX = cx - offX, relY = cy - offY;
            var clX = Math.max(0, Math.min(tw, relX)), clY = Math.max(0, Math.min(th, relY));
            if (!absorbed && ((u >= .42 && Math.hypot(relX - clX, relY - clY) <= 12) || u >= .82)) {
                absorbed = true;
                uHit = Math.min(.9, u);
                // только в момент касания #cartTab переносим хвост в .dcart-fly (z-index:0 внутри #cartTab),
                // чтобы белая цена #cartLabel оставалась строго поверх — переключение в одном paint-кадре, без шва
                fly = document.createElement('span');
                fly.className = 'dcart-fly is-in';
                fly.setAttribute('aria-hidden', 'true');
                fly.innerHTML = '<svg class="dfcart__svg" viewBox="-260 -260 578 578" aria-hidden="true"><path class="dfcart__p"/></svg>';
                flyPath = fly.querySelector('.dfcart__p');
                ct.insertBefore(fly, ct.firstChild);
                homeFloatFly = fly;
                el.hidden = true;
                el.classList.remove('is-on', 'is-morphing');
                homeCartWaterImpact(ct, clX, clY, vx, vy);
                homeCartSplash(ct, clX, clY, vx, vy);
            }
            var inP = absorbed ? Math.max(0, Math.min(1, (tt / D - uHit) / Math.max(.08, 1 - uHit + DRAIN / D))) : 0;
            var sc = !absorbed ? 1.0 : Math.max(.22, 1.0 - Math.pow(inP, 1.1) * .78);
            var activePath = absorbed ? flyPath : elPath;
            if (absorbed && fly) {
                fly.style.left = (relX - 29).toFixed(1) + 'px';
                fly.style.top = (relY - 29).toFixed(1) + 'px';
            } else {
                el.style.left = (cx - 29).toFixed(1) + 'px';
                el.style.top = (cy - 29).toFixed(1) + 'px';
            }
            homeDropStringRender(activePath, hist, cx, cy, now, tailMs, tailMax, 29 * sc, lastAng, ph, pull0, 29 * sc * (1 - inP), u);
            if (!absorbed) {
                if (bag) bag.style.opacity = String(Math.max(0, 1 - u * 4.2));
            } else if (flyPath) {
                flyPath.style.strokeOpacity = String(Math.max(0, 1 - inP * 2.4));
            }
            if (tt < D + DRAIN) {
                homeFloatRaf = requestAnimationFrame(step);
            } else {
                homeFloatRaf = 0;
                homeFloatOn = false;
                homeFloatDocking = false;
                homeFloatResetStyle();
            }
        });
    }
    function homeFloatShow(mode) {
        if (!homeCanFloat() || !homeCartHidden()) return null;
        var el = homeFloatEnsure(), wasOn = homeFloatOn, wasDocking = homeFloatDocking;
        if (wasDocking) {
            homeFloatDocking = false;
            if (homeFloatRaf) { cancelAnimationFrame(homeFloatRaf); homeFloatRaf = 0; }
        }
        homeFloatOn = true;
        el.hidden = false;
        el.classList.remove('is-morphing');
        el.classList.add('is-on');
        if (!wasOn || wasDocking) homeFloatResetStyle();
        if (!wasOn) {
            var inn = el.querySelector('.dfcart__in');
            if (inn) inn.getAnimations().forEach(function (a) { a.cancel(); });
            homeFloatPaint(homeFloatLast.n, homeFloatLast.sum, false);
            if (!fxOff() && inn && inn.animate) {
                if (mode === 'fade') {
                    inn.animate([
                        { transform: 'translateX(18px) scale(.86)', opacity: 0 },
                        { transform: 'translateX(0) scale(1)', opacity: 1 }
                    ], { duration: 320, easing: 'cubic-bezier(.22, 1, .36, 1)' });
                } else {
                    inn.animate([
                        { transform: 'scale(.32) translateY(-8px)', opacity: 0 },
                        { transform: 'scale(1.08) translateY(0)', opacity: 1, offset: .62 },
                        { transform: 'scale(1) translateY(0)', opacity: 1 }
                    ], { duration: 380, easing: 'cubic-bezier(.22, 1.15, .36, 1)' });
                }
            }
        }
        return el.querySelector('.dfcart__bag');
    }
    function homeFloatScroll() {
        if (!homeCanFloat()) { if (homeFloatOn) homeFloatHide(true); return; }
        var hs = document.getElementById('s-home'), ct = document.getElementById('cartTab');
        if (!hs || !ct) return;
        var ctTop = homeCartTop();
        var n = A.cartCount ? A.cartCount() : homeFloatLast.n;
        // листаем вниз, а в корзине уже есть товары — плавно показываем кружок справа фейд-ином
        if (!homeFloatOn) {
            if (n > 0 && hs.scrollTop > 115 && ctTop < -44) {
                homeFloatLast.n = n;
                homeFloatShow('fade');
            }
            return;
        }
        if (homeFloatDocking || !homeFloatEl) return;
        // подкатываем вверх: как только #cartTab выехала целиком (ctTop ≥ 2 px), капля срывается и естественно врезается в неё
        if (ctTop >= 2 || hs.scrollTop <= 69) {
            homeFloatLaunchMagnet(ct);
            return;
        }
        if (ctTop > -135) {
            var pull = Math.max(0, Math.min(1, (ctTop + 135) / 137));
            var e = Math.pow(pull, 1.12);
            var cr = ct.getBoundingClientRect(), ar = app.getBoundingClientRect();
            var baseCx = ar.width - 24 - 29, baseCy = 22 + 29;
            // тянемся к ближайшей части #cartTab от реального положения кружка
            var tcx = Math.max(cr.left - ar.left + 20, Math.min(cr.right - ar.left - 16, baseCx));
            var tcy = Math.max(cr.top - ar.top + 12, Math.min(cr.bottom - ar.top - 8, baseCy));
            var dx = tcx - baseCx, dy = tcy - baseCy, dist = Math.hypot(dx, dy) || 1;
            var move = Math.min(18, Math.max(0, (dist - 80) * .12)) * e;
            homeFloatEl.style.transform = move > .2 ? 'translate(' + (dx / dist * move).toFixed(1) + 'px,' + (dy / dist * move).toFixed(1) + 'px)' : '';
            homeDropSt.target = e;
            homeDropSt.ang = Math.atan2(dy, dx);
            homeDropWake();
        } else {
            homeFloatEl.style.transform = '';
            homeDropSt.target = 0;
        }
    }
    var homeScrEl = document.getElementById('s-home');
    if (homeScrEl) homeScrEl.addEventListener('scroll', homeFloatScroll, { passive: true });
    window.addEventListener('resize', function () { if (homeFloatOn) homeFloatScroll(); });

    function deskCartSync(n, sum, dir, delay) {
        if (dir > 0 && n > 0 && homeCanFloat() && homeCartHidden() && !homeFloatOn) homeFloatShow('pop');
        var run = function () {
            homeFloatLast = { n: n, sum: sum || '' };
            if (n <= 0 && homeFloatOn) homeFloatHide(false);
            else if (homeFloatEl) homeFloatPaint(n, sum, dir > 0);
            var btn = document.querySelector('#s-rest .drnav-cart__btn');
            if (!btn || !btn.isConnected) return;
            var cnt = btn.querySelector('.drnav-cart__n'), sm = btn.querySelector('.drnav-cart__sum');
            btn.classList.toggle('has-sum', n > 0);
            if (cnt) {
                cnt.hidden = !n;
                cnt.textContent = String(n);
                if (n > 0 && dir > 0 && !fxOff() && cnt.animate) cnt.animate([{ scale: .45 }, { scale: 1.24, offset: .55 }, { scale: 1 }], { duration: 380, easing: 'cubic-bezier(.22, 1.2, .36, 1)' });
            }
            if (sm) sm.textContent = n > 0 && sum ? sum : 'Корзина';
            if (dir > 0 && n > 0 && !fxOff() && btn.animate && btn.closest('.rtabs.is-stuck')) {
                btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: .35 }, { transform: 'scale(.98)', offset: .72 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
            }
        };
        if (delay) setTimeout(run, delay); else run();
    }
    function deskCartBag() {
        if (deskOn() && S.stack.indexOf('rest') >= 0) {
            var stuck = document.querySelector('#s-rest #rtabs.is-stuck .drnav-cart__bag');
            if (stuck) return stuck;
        }
        if (homeCanFloat() && homeCartHidden()) {
            var fb = homeFloatShow('pop');
            if (fb) return fb;
        }
        return document.getElementById('cartBag');
    }
    function deskChrome() {
        if (!deskOn()) { homeFloatHide(true); deskAddrStop(); deskPlaceHead(); var tb = document.getElementById('tabbar'); if (tb) tb._dk = ''; if (askEl) hideAskAddr(true); if (app.dataset.dtop != null) { delete app.dataset.dtop; delete app.dataset.dpage; } return; }
        if (askEl && (S.tab !== 'home' || S.stack.length || A.sheetKind())) hideAskAddr();
        var top = S.stack[S.stack.length - 1];
        app.dataset.dtop = deskKind(top);
        app.dataset.dpage = S.stack.indexOf('rest') >= 0 ? 'rest' : S.tab;
        // затемнение — прямо под первым экраном-панелью или окном: у экранов порядок слоёв — по глубине стопки (11, 12…)
        var k = 0; while (k < S.stack.length && deskKind(S.stack[k]) === 'page') k++;
        document.getElementById('dscrim').style.zIndex = String(10 + k);
        $$('.screen.dk-first').forEach(function (s) { if (s.id !== 's-' + S.stack[k]) s.classList.remove('dk-first'); });
        if (S.stack[k]) document.getElementById('s-' + S.stack[k]).classList.add('dk-first');
        deskPlaceHead(); deskHead(); deskCats(); deskRestMount(); deskPop(); deskNavSync();
        homeCartRingSync(document.getElementById('cartTab'));
        homeFloatScroll();
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
        var bag = deskCartBag();
        var veilBtn = bag && (bag.closest('.drnav-cart__btn') || bag.closest('.dfcart')) || document.getElementById('cartTab');
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
                deskVeil(veilBtn);
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

    /* 26.11: карточка товара на десктопе — двухколоночное окно без прокрутки и без скруглений у фото:
       слева во всю высоту фото (с переключением кадров, если их несколько), справа — название, описание, КБЖУ,
       размер / 2×2 борт / добавки и закреплённый в правой колонке футер со степпером и кнопкой добавления */
    function deskDishFmt(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
    function deskDishPhotos(stage) {
        var track = stage && stage.querySelector('.dph');
        var slides = track ? track.querySelectorAll('.dph__s') : null;
        if (!slides || slides.length < 2 || stage.querySelector('.ddish-pnav')) return;
        var dots = stage.querySelectorAll('.dph__dots i'), idx = 0, total = slides.length;
        var prev = document.createElement('button');
        prev.type = 'button'; prev.className = 'ddish-pnav ddish-pnav--prev'; prev.setAttribute('aria-label', 'Предыдущее фото');
        prev.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
        var next = document.createElement('button');
        next.type = 'button'; next.className = 'ddish-pnav ddish-pnav--next'; next.setAttribute('aria-label', 'Следующее фото');
        next.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
        var go = function (k) {
            idx = (k + total) % total;
            track.style.transform = 'translateX(' + (-idx * 100) + '%)';
            dots.forEach(function (dot, i) { dot.classList.toggle('is-on', i === idx); });
        };
        prev.addEventListener('click', function (e) { e.stopPropagation(); go(idx - 1); });
        next.addEventListener('click', function (e) { e.stopPropagation(); go(idx + 1); });
        dots.forEach(function (dot, i) { dot.addEventListener('click', function (e) { e.stopPropagation(); go(i); }); });
        stage.appendChild(prev); stage.appendChild(next);
    }
    function deskDishSync() {
        var sh = document.getElementById('sheet');
        if (!sh || !deskOn() || A.sheetKind() !== 'dish') return;
        var ds = A.dishState && A.dishState(), d = ds && A.DISHES && A.DISHES[ds.id];
        if (!d) return;
        var pg = sh.querySelector('.dpg.is-cur') || sh;
        var body = pg.querySelector('.dish__body');
        if (!body) return;
        var adKeys = A.dishAddons ? A.dishAddons(ds.id) : [];
        var nutr = A.dishNutr ? A.dishNutr(ds.id) : null;
        var sweet = ds.id === 'cinnabon' || ds.id === 'pancakes' || ds.id === 'syrniki' || ds.id === 'bliny';
        sh.classList.toggle('is-dish-cfg', !!d.pizza);
        sh.classList.toggle('is-dish-add', !d.pizza && adKeys.length > 0);
        if (!pg.querySelector('.ddish-grid')) {
            var scr = pg.querySelector('.scroll'), stage = scr && scr.querySelector('.dish__stage'), foot = pg.querySelector('.sheet__foot.dfoot');
            if (scr && stage && body) {
                var grid = document.createElement('div'); grid.className = 'ddish-grid';
                var side = document.createElement('div'); side.className = 'ddish-side';
                grid.appendChild(stage);
                side.appendChild(body);
                if (foot) side.appendChild(foot);
                grid.appendChild(side);
                scr.parentNode.insertBefore(grid, scr);
                scr.remove();
                // убираем мобильную пустую распорку в конце .dish__body
                var last = body.lastElementChild;
                if (last && last.tagName === 'DIV' && !last.className && last.style.height) last.remove();
                // название заведения тонкой подписью над заголовком
                var r = ds.rest && A.rest ? A.rest(ds.rest) : null;
                var head = body.firstElementChild;
                if (r && head && !head.querySelector('.ddish-eyebrow')) {
                    var ey = document.createElement('div'); ey.className = 'ddish-eyebrow'; ey.textContent = r.name;
                    head.insertBefore(ey, head.firstChild);
                }
                // красиво оформленный блок КБЖУ
                if (nutr) {
                    var pK = nutr[1] * 4, fK = nutr[2] * 9, cK = nutr[3] * 4, totK = pK + fK + cK;
                    var perLabel = d.ml ? 'на 100 мл' : 'на 100 г';
                    var unitG = ' г';
                    var nEl = document.createElement('div'); nEl.className = 'ddish-nutr';
                    nEl.innerHTML =
                        '<div class="ddish-nutr__top">' +
                            '<span class="ddish-nutr__title">Пищевая ценность</span>' +
                            '<span class="ddish-nutr__dot" aria-hidden="true">·</span>' +
                            '<span class="ddish-nutr__per">' + perLabel + '</span>' +
                            '<span class="ddish-nutr__serv num"></span>' +
                        '</div>' +
                        '<div class="ddish-nutr__cols">' +
                            '<div class="ddish-nutr__c is-kcal"><b class="num">' + Math.round(nutr[0]) + '</b><span>ккал</span></div>' +
                            '<div class="ddish-nutr__c is-p"><b class="num">' + deskDishFmt(nutr[1]) + unitG + '</b><span>Белки</span></div>' +
                            '<div class="ddish-nutr__c is-f"><b class="num">' + deskDishFmt(nutr[2]) + unitG + '</b><span>Жиры</span></div>' +
                            '<div class="ddish-nutr__c is-c"><b class="num">' + deskDishFmt(nutr[3]) + unitG + '</b><span>Углеводы</span></div>' +
                        '</div>' +
                        (totK > .5 ? '<div class="ddish-nutr__bar" aria-hidden="true">' +
                            '<i class="is-p" style="flex:' + pK.toFixed(1) + '"></i>' +
                            '<i class="is-f" style="flex:' + fK.toFixed(1) + '"></i>' +
                            '<i class="is-c" style="flex:' + cK.toFixed(1) + '"></i>' +
                        '</div>' : '');
                    var descEl = body.querySelector('.dish__desc');
                    if (descEl && descEl.nextSibling) body.insertBefore(nEl, descEl.nextSibling);
                    else body.appendChild(nEl);
                }
                // размер — с общим заголовком секции, в ритм «Борта» и «Добавок»
                var szSeg = body.querySelector('.cseg[data-key="size"]');
                if (szSeg && !szSeg.parentElement.classList.contains('ddish-size')) {
                    var szWrap = document.createElement('div'); szWrap.className = 'ddish-size';
                    szWrap.innerHTML = '<h3>Размер</h3>';
                    szSeg.parentNode.insertBefore(szWrap, szSeg);
                    szWrap.appendChild(szSeg);
                }
                // борт — компактной сеткой 2×2 вместо длинного списка
                var opts = body.querySelector('.opts');
                if (opts && !opts.querySelector('.ddish-crust')) {
                    var cg = document.createElement('div'); cg.className = 'ddish-crust';
                    $$(':scope > .opt', opts).forEach(function (opt) {
                        var inp = opt.querySelector('input[type="radio"]');
                        var sm = opt.querySelector('small');
                        if (inp && inp.value === 'classic' && sm) sm.textContent = 'Базовый';
                        cg.appendChild(opt);
                    });
                    opts.appendChild(cg);
                }
                // добавки / топпинги
                if (adKeys.length && A.ADDONS) {
                    var adBox = document.createElement('div'); adBox.className = 'ddish-addons';
                    adBox.innerHTML =
                        '<div class="ddish-addons__head">' +
                            '<h3>' + (sweet ? 'Топпинги' : 'Добавки') + '</h3>' +
                            '<span class="ddish-addons__cnt num" hidden></span>' +
                        '</div>' +
                        '<div class="ddish-addons__grid ' + (adKeys.length <= 4 ? 'ddish-addons__grid--2' : 'ddish-addons__grid--3') + '">' +
                        adKeys.map(function (k) {
                            var a = A.ADDONS[k]; if (!a) return '';
                            return '<button type="button" class="ddish-addon" data-act="addon" data-id="' + k + '" aria-pressed="false">' +
                                '<span class="ddish-addon__txt"><b>' + esc(a.name) + '</b><small class="num">+' + A.moneyShort(a.add) + '\u00a0' + (A.BYN || '⃅') + '</small></span>' +
                                '<span class="ddish-addon__ck" aria-hidden="true">' +
                                    '<svg class="i ddish-addon__plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>' +
                                    '<svg class="i ddish-addon__ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
                                '</span></button>';
                        }).join('') +
                        '</div>';
                    body.appendChild(adBox);
                }
                deskDishPhotos(stage);
            }
        }
        // живые обновления: калорийность порции (меняется с размером пиццы), активный борт и добавки
        var servEl = body.querySelector('.ddish-nutr__serv');
        if (servEl && nutr) {
            var w = d.w;
            if (d.pizza && A.SIZES) {
                var sz = A.SIZES.filter(function (s) { return s.k === ds.size; })[0] || A.SIZES[0];
                w = Math.round(d.w * sz.mul / 5) * 5;
            }
            var servKcal = Math.round(nutr[0] * w / 100);
            servEl.textContent = servKcal > 0 ? 'В порции ~' + servKcal + ' ккал' : '';
        }
        $$('.ddish-crust .opt', body).forEach(function (opt) {
            var inp = opt.querySelector('input[type="radio"]');
            opt.classList.toggle('is-on', !!(inp && inp.value === ds.base));
        });
        var selAds = ds.addons || [];
        $$('.ddish-addon', body).forEach(function (btn) {
            var on = selAds.indexOf(btn.dataset.id) >= 0;
            btn.classList.toggle('is-on', on);
            btn.setAttribute('aria-pressed', String(on));
        });
        var cntEl = body.querySelector('.ddish-addons__cnt');
        if (cntEl) {
            cntEl.hidden = !selAds.length;
            if (selAds.length) cntEl.textContent = 'Выбрано: ' + selAds.length;
        }
    }
    (function () {
        var sh = document.getElementById('sheet');
        if (!sh || !window.MutationObserver) return;
        new MutationObserver(function () {
            if (!sh.classList.contains('is-dish') && (sh.classList.contains('is-dish-cfg') || sh.classList.contains('is-dish-add'))) {
                sh.classList.remove('is-dish-cfg', 'is-dish-add');
            }
        }).observe(sh, { attributes: true, attributeFilter: ['class'] });
    })();

    return { kind: deskKind, chrome: deskChrome, close: deskClose, cartToggle: deskCartToggle, dishAdded: deskDishAdded, askAddr: askAddr, cartSync: deskCartSync, cartBag: deskCartBag, syncDish: deskDishSync };
};
