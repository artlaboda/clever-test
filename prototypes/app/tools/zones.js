/* Зоны доставки шторки «О заведении» — по дорогам (16.11).
   16.11: «Сейчас они у тебя на карте нарисованы просто пикселями. Когда увеличиваешь — это видно. А в реальности это
   взаимодействие с апи и рисование зон по дорогам с захватом некоторых домов. Сделай зоны именно так. Интегрируй их в карту.
   И ещё. Углы у зон делай приятными закруглёнными, а не острыми. Т.е. если где-то поворот по дороге — делай с радиусом».
   В продукте зоны отдаёт API маршрутизации (изохроны по дорожному графу); прототип везёт готовый результат — его считает этот
   скрипт по настоящим данным OpenStreetMap (векторные плитки OpenFreeMap, z14: дороги, дома, вода):
   1. Сетка 12 м. Дороги — со скоростью по классу (магистраль 60 км/ч … проезд во двор 12 км/ч), вне дорог — пешком 1,2 м/с,
      вода без моста — нельзя.
   2. Дейкстра от точек заведения — время в пути до каждой клетки.
   3. Порог времени — такой, чтобы дорог в зоне было столько же, сколько в круге прежнего радиуса (4,6 + 0,55 × число зон км;
      зелёная — 0,38 его): у точек в центре зона меньше, вдоль проспектов — длиннее.
   4. Зона = дороги, до которых успеваем, и по 90 м по обе стороны от них (ряд домов), плюс дома, которых коснулась эта полоса
      (с двором 30 м). Дыры залиты; вогнутые углы скруглены замыканием (110 м), выпуклые — самим расширением.
   5. Остальные зоны — соседи вокруг зелёной (10.11: «зоны рисуй не радиусами, а стыкуй рядом»): внешняя область делится между
      «центрами районов» по времени в пути от них — граница идёт по кварталам между дорогами; углы на стыках скруглены (60 м).
      Клочок района, оторванный от него и прижатый к зелёной (между зелёными зонами соседних точек), — зелёный.
   6. Контур — по сглаженной (~40 м) сетке 36 м, без лишних точек (4 м); в index.html — закодированными ломаными (Google polyline, 1e-5).
      Приложение раскодирует их и ещё раз скругляет углы (Чайкин, три прохода).
   Запуск: node tools/zones.js [папка для кэша плиток] [--geojson файл] — пишет блок AB_GEO в index.html между метками
   «AB_GEO:начало» и «AB_GEO:конец» (сначала проверяет метки, потом пишет файл). Нужны curl и сеть до tiles.openfreemap.org */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), os = require('os'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), HTML = path.join(ROOT, 'index.html');
const args = process.argv.slice(2), gjI = args.indexOf('--geojson'), GJ = gjI > -1 ? args.splice(gjI, 2)[1] : null;
const CACHE = args[0] || path.join(os.tmpdir(), 'clever-zones-tiles');
const Z = 14, G = 12, SQ2 = Math.SQRT2;
const SPEED = { motorway: 16.7, trunk: 13.9, primary: 11.1, secondary: 9.7, tertiary: 8.3, minor: 6.1, service: 3.3 };   // м/с
const WALK = 1.2, CAP = 90, YARD = 30, CLOSE = 110, ROUND = 60, STRIDE = 3, TOL = 4;

// ── точки и число зон — из index.html (PICKS, PICK_SETS, PICK_BY, restPicks, AB_ZN), чтобы не разойтись с приложением ──
const src = fs.readFileSync(HTML, 'utf8');
function grab(re) { const m = src.match(re); if (!m) throw new Error('нет в index.html: ' + re); return m[0]; }
const ctx = {}; vm.createContext(ctx);
vm.runInContext([grab(/var PICKS = \{[\s\S]*?\n {4}\};/), grab(/var PICK_SETS = [^\n]*?\];/), grab(/var PICK_BY = \{[^\n]*?\};/),
    grab(/function restPicks\(r\) \{[^\n]*\n/), grab(/var AB_ZN = \{[^\n]*?\};/),
    'this.PICKS = PICKS; this.restPicks = restPicks; this.AB_ZN = AB_ZN;'].join('\n'), ctx);
const rests = grab(/var RESTS = \[[\s\S]*?\n {4}\];/).split('\n').map(l => l.match(/\{ id: '(\w+)'/) && !/courier: 'clever'/.test(l) ? l.match(/\{ id: '(\w+)'/)[1] : null).filter(Boolean);
const JOBS = rests.map(id => ({ id, n: ctx.AB_ZN[id] || 3, pts: ctx.restPicks({ id }).map(k => ctx.PICKS[k].ll) }));
function seedRnd(seed) { let h = 7; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0; return () => { h = (h * 1103515245 + 12345) | 0; return ((h >>> 16) & 0x7fff) / 0x7fff; }; }

// ── плитки ──
const lng2x = (lng, z) => (lng + 180) / 360 * Math.pow(2, z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z); };
const x2lng = (x, z) => x / Math.pow(2, z) * 360 - 180;
const y2lat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / Math.pow(2, z)))) * 180 / Math.PI;
function curl(a) { return cp.execFileSync('curl', ['-sSf', '--retry', '3'].concat(a), { maxBuffer: 1 << 26 }); }
let TPL = null;
function fetchTiles(list) {
    if (!TPL) TPL = JSON.parse(curl(['https://tiles.openfreemap.org/planet']).toString()).tiles[0];
    const dir = path.join(CACHE, TPL.split('/').slice(-4, -3)[0] || 'v'); fs.mkdirSync(dir, { recursive: true });
    const need = list.filter(t => !fs.existsSync(path.join(dir, t.join('-') + '.pbf')));
    for (let i = 0; i < need.length; i += 64) {   // по 64 за раз, параллельно
        const cfg = need.slice(i, i + 64).map(t => 'url = "' + TPL.replace('{z}', Z).replace('{x}', t[0]).replace('{y}', t[1]) + '"\noutput = "' + path.join(dir, t.join('-') + '.pbf') + '"').join('\n');
        const f = path.join(dir, '.cfg'); fs.writeFileSync(f, cfg); curl(['--parallel', '--parallel-max', '8', '-K', f]);
        process.stdout.write('\rплитки: ' + Math.min(need.length, i + 64) + ' из ' + need.length);
    }
    if (need.length) process.stdout.write('\n');
    return t => { let b = fs.readFileSync(path.join(dir, t.join('-') + '.pbf')); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); return b; };
}
// ── Mapbox Vector Tile: свой маленький разбор protobuf (без зависимостей) ──
function pb(buf, s, e, cb) {
    let p = s;
    const vi = () => { let r = 0, m = 1, b; do { b = buf[p++]; r += (b & 0x7f) * m; m *= 128; } while (b & 0x80); return r; };
    while (p < e) {
        const k = vi(), f = Math.floor(k / 8), t = k & 7;
        if (t === 0) cb(f, t, vi());
        else if (t === 1) { cb(f, t, buf.readDoubleLE(p)); p += 8; }
        else if (t === 2) { const n = vi(); cb(f, t, [p, p + n]); p += n; }
        else if (t === 5) { cb(f, t, buf.readFloatLE(p)); p += 4; }
        else throw new Error('protobuf: тип ' + t);
    }
}
function packed(buf, r) { const out = []; let p = r[0]; while (p < r[1]) { let v = 0, m = 1, b; do { b = buf[p++]; v += (b & 0x7f) * m; m *= 128; } while (b & 0x80); out.push(v); } return out; }
function mvt(buf, want) {   // { слой: [{ type, props, geom: [[[x, y], …], …] (в долях плитки 0..1) }] }
    const out = {};
    pb(buf, 0, buf.length, (f, t, r) => {
        if (f !== 3) return;
        let name = '', ext = 4096; const keys = [], vals = [], feats = [];
        pb(buf, r[0], r[1], (f2, t2, v) => {
            if (f2 === 1) name = buf.toString('utf8', v[0], v[1]);
            else if (f2 === 3) keys.push(buf.toString('utf8', v[0], v[1]));
            else if (f2 === 4) { let x = null; pb(buf, v[0], v[1], (f3, t3, w) => { x = t3 === 2 ? buf.toString('utf8', w[0], w[1]) : w; }); vals.push(x); }
            else if (f2 === 5) ext = v;
            else if (f2 === 2) feats.push(v);
        });
        if (want.indexOf(name) < 0) return;
        out[name] = feats.map(fr => {
            let type = 0, tags = [], g = [];
            pb(buf, fr[0], fr[1], (f3, t3, v) => { if (f3 === 3) type = v; else if (f3 === 2) tags = packed(buf, v); else if (f3 === 4) g = packed(buf, v); });
            const props = {}; for (let i = 0; i < tags.length; i += 2) props[keys[tags[i]]] = vals[tags[i + 1]];
            const geom = []; let x = 0, y = 0, ring = null;
            for (let i = 0; i < g.length;) {
                const c = g[i] & 7, n = g[i] >> 3; i++;
                if (c === 7) { if (ring && ring.length) ring.push(ring[0]); continue; }
                for (let j = 0; j < n; j++) {
                    const dx = g[i++], dy = g[i++]; x += (dx >> 1) ^ (-(dx & 1)); y += (dy >> 1) ^ (-(dy & 1));
                    if (c === 1) { ring = []; geom.push(ring); }
                    ring.push([x / ext, y / ext]);
                }
            }
            return { type, props, geom };
        });
    });
    return out;
}

// ── сетка ──
function Grid(c0, ext) {   // равнопромежуточная проекция вокруг c0 (обратно — той же формулой: в долготе/широте всё точно)
    const kx = 111320 * Math.cos(c0[0] * Math.PI / 180), ky = 111320;
    const g = { lat0: c0[0], lng0: c0[1], W: Math.ceil(2 * ext.x / G), H: Math.ceil(2 * ext.y / G), ex: ext.x, ey: ext.y };
    g.N = g.W * g.H;
    g.toXY = (lat, lng) => [((lng - g.lng0) * kx + g.ex) / G, (g.ey - (lat - g.lat0) * ky) / G];   // клетки; y — вниз
    g.toLL = (x, y) => [g.lat0 + (g.ey - y * G) / ky, g.lng0 + (x * G - g.ex) / kx];
    g.bbox = () => { const a = g.toLL(0, 0), b = g.toLL(g.W, g.H); return { n: a[0], w: a[1], s: b[0], e: b[1] }; };
    return g;
}
function rasterLine(g, a, b, fn) {
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= n; i++) { const x = Math.round(a[0] + dx * i / n - .5), y = Math.round(a[1] + dy * i / n - .5); if (x >= 0 && y >= 0 && x < g.W && y < g.H) fn(y * g.W + x); }
}
function rasterPoly(g, rings, fn) {   // чётно-нечётное по центрам клеток; мелкие (меньше клетки) — клетка первой вершины
    let y0 = Infinity, y1 = -Infinity; rings.forEach(r => r.forEach(p => { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
    let hit = 0;
    for (let y = Math.max(0, Math.floor(y0 - .5)); y <= Math.min(g.H - 1, Math.ceil(y1)); y++) {
        const cy = y + .5, xs = [];
        rings.forEach(r => { for (let i = 0; i + 1 < r.length; i++) { const p = r[i], q = r[i + 1]; if ((p[1] <= cy) !== (q[1] <= cy)) xs.push(p[0] + (cy - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); } });
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - .5)); x <= Math.min(g.W - 1, Math.floor(xs[k + 1] - .5)); x++) { fn(y * g.W + x); hit++; }
    }
    if (!hit && rings[0] && rings[0][0]) { const x = Math.floor(rings[0][0][0]), y = Math.floor(rings[0][0][1]); if (x >= 0 && y >= 0 && x < g.W && y < g.H) fn(y * g.W + x); }
}
function houses(geom) {
    const out = [];
    geom.forEach(r => { let a = 0; for (let i = 0; i + 1 < r.length; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; if (a > 0) out.push([r]); else if (a < 0 && out.length) out[out.length - 1].push(r); });
    return out;
}
function load(g, tileOf) {
    const bb = g.bbox(), tx0 = Math.floor(lng2x(bb.w, Z)), tx1 = Math.floor(lng2x(bb.e, Z)), ty0 = Math.floor(lat2y(bb.n, Z)), ty1 = Math.floor(lat2y(bb.s, Z));
    const speed = new Float32Array(g.N), water = new Uint8Array(g.N), bld = new Int32Array(g.N).fill(-1); let nb = 0;
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
        const L = mvt(tileOf([tx, ty]), ['transportation', 'building', 'water']);
        const xy = p => g.toXY(y2lat(ty + p[1], Z), x2lng(tx + p[0], Z));
        (L.water || []).forEach(f => { if (f.type === 3) rasterPoly(g, f.geom.map(r => r.map(xy)), i => { water[i] = 1; }); });
        // в плитке дома одной высоты слиты в один объект (сотни колец на всю плитку) — делим на отдельные дома: внешнее кольцо
        // (площадь > 0 по формуле землемера в координатах плитки) и его дыры
        (L.building || []).forEach(f => { if (f.type === 3) houses(f.geom).forEach(rings => { const id = nb++; rasterPoly(g, rings.map(r => r.map(xy)), i => { bld[i] = id; }); }); });
        (L.transportation || []).forEach(f => {
            const v = SPEED[f.props.class]; if (!v || f.type !== 2) return;
            f.geom.forEach(r => { const q = r.map(xy); for (let i = 0; i + 1 < q.length; i++) rasterLine(g, q[i], q[i + 1], j => { if (speed[j] < v) speed[j] = v; }); });
        });
    }
    const cost = new Float32Array(g.N);   // секунд на клетку
    for (let i = 0; i < g.N; i++) cost[i] = speed[i] ? G / speed[i] : water[i] ? Infinity : G / WALK;
    return { speed, water, bld, cost, nb };
}
// ── Дейкстра по сетке (8 соседей); lab — метка источника, переходит по пути ──
function dijkstra(g, cost, seeds, lab) {
    const T = new Float64Array(g.N).fill(Infinity), W = g.W;
    let cap = 1 << 20, hk = new Float64Array(cap), hv = new Int32Array(cap), n = 0;
    const push = (k, v) => {
        if (n === cap) { cap *= 2; const a = new Float64Array(cap), b = new Int32Array(cap); a.set(hk); b.set(hv); hk = a; hv = b; }
        let i = n++; while (i) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v;
    };
    const pop = () => {
        const v = hv[0], k = hk[0], lk = hk[--n], lv = hv[n]; let i = 0;
        for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hk[c + 1] < hk[c]) c++; if (hk[c] >= lk) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; }
        hk[i] = lk; hv[i] = lv; popK = k; return v;
    };
    let popK = 0;
    seeds.forEach(s => { T[s.i] = 0; if (lab) lab[s.i] = s.lab; push(0, s.i); });
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    while (n) {
        const i = pop(), t = popK; if (t > T[i]) continue;
        const x = i % W, y = (i - x) / W, ci = cost[i];
        for (let d = 0; d < 8; d++) {
            const nx = x + DX[d], ny = y + DY[d]; if (nx < 0 || ny < 0 || nx >= W || ny >= g.H) continue;
            const j = ny * W + nx, c = (ci + cost[j]) * (d < 4 ? .5 : SQ2 / 2); if (!(c < Infinity)) continue;
            const nt = t + c; if (nt < T[j]) { T[j] = nt; if (lab) lab[j] = lab[i]; push(nt, j); }
        }
    }
    return T;
}
// ── морфология: точное евклидово расстояние (Felzenszwalb–Huttenlocher), в клетках² ──
function edt(g, site) {
    const W = g.W, H = g.H, INF = 1e20, D = new Float32Array(g.N), M = Math.max(W, H), f = new Float64Array(M), d = new Float64Array(M), v = new Int32Array(M), z = new Float64Array(M + 1);
    const pass = (n) => {
        let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
        for (let q = 1; q < n; q++) { let s; for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; } if (s <= z[k]) { v[0] = q; z[0] = -INF; z[1] = INF; k = 0; continue; } k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
        k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    };
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = site[y * W + x] ? 0 : INF; pass(H); for (let y = 0; y < H; y++) D[y * W + x] = d[y]; }
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = D[y * W + x]; pass(W); for (let x = 0; x < W; x++) D[y * W + x] = d[x]; }
    return D;
}
const dilate = (g, m, r) => { const D = edt(g, m), q = (r / G) * (r / G), o = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) o[i] = D[i] <= q ? 1 : 0; return o; };
const erode = (g, m, r) => { const n = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) n[i] = m[i] ? 0 : 1; const D = edt(g, n), q = (r / G) * (r / G), o = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) o[i] = D[i] > q ? 1 : 0; return o; };
const close = (g, m, r) => erode(g, dilate(g, m, r), r), open = (g, m, r) => dilate(g, erode(g, m, r), r);
function fillHoles(g, m) {   // всё, до чего снаружи не дойти, — внутри
    const W = g.W, H = g.H, out = new Uint8Array(g.N), st = new Int32Array(g.N); let n = 0;
    const add = i => { if (!m[i] && !out[i]) { out[i] = 1; st[n++] = i; } };
    for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); } for (let y = 0; y < H; y++) { add(y * W); add(y * W + W - 1); }
    while (n) { const i = st[--n], x = i % W; if (x > 0) add(i - 1); if (x < W - 1) add(i + 1); if (i >= W) add(i - W); if (i < g.N - W) add(i + W); }
    const o = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) o[i] = out[i] ? 0 : 1; return o;
}
function dropSmall(g, m, minCells, share) {   // убрать крошки: связные куски меньше minCells (и меньше доли share всей маски)
    const W = g.W, seen = new Uint8Array(g.N), st = new Int32Array(g.N), o = m.slice();
    if (share) { let t = 0; for (let i = 0; i < g.N; i++) t += m[i]; minCells = Math.max(minCells, t * share); }
    for (let s = 0; s < g.N; s++) {
        if (!m[s] || seen[s]) continue;
        let n = 0, k = 0; st[n++] = s; seen[s] = 1;
        while (k < n) { const i = st[k++], x = i % W;
            if (x > 0 && m[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; st[n++] = i - 1; } if (x < W - 1 && m[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; st[n++] = i + 1; }
            if (i >= W && m[i - W] && !seen[i - W]) { seen[i - W] = 1; st[n++] = i - W; } if (i < g.N - W && m[i + W] && !seen[i + W]) { seen[i + W] = 1; st[n++] = i + W; } }
        if (n < minCells) for (let q = 0; q < n; q++) o[st[q]] = 0;
    }
    return o;
}
function comps(g, m) {   // связные куски маски (списками клеток)
    const W = g.W, seen = new Uint8Array(g.N), out = [];
    for (let s = 0; s < g.N; s++) {
        if (!m[s] || seen[s]) continue;
        const c = [s]; seen[s] = 1;
        for (let k = 0; k < c.length; k++) { const i = c[k], x = i % W; for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < g.N && m[j] && !seen[j]) { seen[j] = 1; c.push(j); } }
        out.push(c);
    }
    return out;
}
function boxBlur(g, f, r, passes) {   // r — полуширина в клетках; несколько проходов — почти гауссово
    const W = g.W, H = g.H, n = 2 * r + 1, a = Float32Array.from(f), b = new Float32Array(g.N);
    for (let p = 0; p < passes; p++) {
        for (let y = 0; y < H; y++) { const o = y * W; let s = 0; for (let x = -r; x <= r; x++) s += a[o + Math.min(W - 1, Math.max(0, x))];
            for (let x = 0; x < W; x++) { b[o + x] = s / n; s += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
        for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(H - 1, Math.max(0, y)) * W + x];
            for (let y = 0; y < H; y++) { a[y * W + x] = s / n; s += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x]; } }
    }
    return a;
}
// ── зона по порогу времени ──
function region(g, D, T, thr) {
    const road = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) if (D.speed[i] && T[i] <= thr) road[i] = 1;
    const tube = dilate(g, road, CAP), take = new Uint8Array(D.nb), hs = new Uint8Array(g.N);
    for (let i = 0; i < g.N; i++) if (tube[i] && D.bld[i] > -1) take[D.bld[i]] = 1;
    for (let i = 0; i < g.N; i++) if (D.bld[i] > -1 && take[D.bld[i]]) hs[i] = 1;
    const yard = dilate(g, hs, YARD), m = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) m[i] = tube[i] || yard[i] ? 1 : 0;
    return fillHoles(g, close(g, fillHoles(g, m), CLOSE));
}
// ── контур: маска → сглаженное поле на сетке STRIDE → «бегущие квадраты» → кольца в [широта, долгота] ──
function contours(g, m) {
    const f0 = new Float32Array(g.N); for (let i = 0; i < g.N; i++) f0[i] = m[i];
    const f = boxBlur(g, f0, 3, 3), s = STRIDE, w = Math.floor((g.W - 1) / s) + 1, h = Math.floor((g.H - 1) / s) + 1;
    const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : f[(y * s) * g.W + x * s] - .5;
    // рёбра: горизонтальное (x,y)-(x+1,y) → id 2*(y*(w+1)+x), вертикальное (x,y)-(x,y+1) → 2*(...)+1; точка на ребре — по линейной доле
    const pt = (e) => { const k = e >> 1, x = k % (w + 1), y = (k - x) / (w + 1); if (e & 1) { const a = v(x, y), b = v(x, y + 1); return [x, y + a / (a - b)]; } const a = v(x, y), b = v(x + 1, y); return [x + a / (a - b), y]; };
    const E = (x, y, d) => 2 * (y * (w + 1) + x) + d, next = new Map();
    for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {   // зона края сетки не касается (проверено выше)
        const a = v(x, y) > 0, b = v(x + 1, y) > 0, c = v(x + 1, y + 1) > 0, d = v(x, y + 1) > 0;
        const T = E(x, y, 0), R = E(x + 1, y, 1), B = E(x, y + 1, 0), L = E(x, y, 1);
        const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
        // обход: внутри — слева (в координатах сетки, y вниз)
        const seg = (p, q) => next.set(p, q);
        switch (code) {
            case 1: seg(L, B); break; case 2: seg(B, R); break; case 3: seg(L, R); break; case 4: seg(R, T); break;
            case 6: seg(B, T); break; case 7: seg(L, T); break; case 8: seg(T, L); break; case 9: seg(T, B); break;
            case 11: seg(T, R); break; case 12: seg(R, L); break; case 13: seg(R, B); break; case 14: seg(B, L); break;
            case 5: { const ctr = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) > 0; if (ctr) { seg(L, T); seg(R, B); } else { seg(L, B); seg(R, T); } break; }
            case 10: { const ctr = (v(x, y) + v(x + 1, y) + v(x + 1, y + 1) + v(x, y + 1)) > 0; if (ctr) { seg(B, L); seg(T, R); } else { seg(T, L); seg(B, R); } break; }
        }
    }
    const rings = [];
    for (const st of next.keys()) {
        if (!next.has(st)) continue;
        const r = []; let e = st;
        while (next.has(e)) { const q = next.get(e); next.delete(e); const p = pt(e); r.push([p[0] * s, p[1] * s]); e = q; }
        if (r.length > 3) rings.push(r);
    }
    return rings;   // в клетках сетки
}
function area(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; }
function inside(p, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; }
function dp(pts, tol) {   // Дуглас — Пекер, замкнутое кольцо (точки — в метрах)
    const keep = new Uint8Array(pts.length); keep[0] = 1;
    let far = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } } keep[far] = 1;
    const st = [[0, far], [far, pts.length]];
    while (st.length) {
        const [a, b] = st.pop(), A = pts[a], B = pts[b % pts.length]; let mi = -1, md = tol;
        const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-9;
        for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - A[0]) * dy - (pts[i][1] - A[1]) * dx) / L; if (d > md) { md = d; mi = i; } }
        if (mi > -1) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
    }
    return pts.filter((p, i) => keep[i]);
}
function enc(ring) {   // Google polyline, [широта, долгота], точность 1e-5
    let s = '', pl = 0, pg = 0;
    const one = v => { v = v < 0 ? ~(v << 1) : v << 1; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } s += String.fromCharCode(v + 63); };
    ring.forEach(p => { const a = Math.round(p[0] * 1e5), b = Math.round(p[1] * 1e5); if (a === pl && b === pg && s) return; one(a - pl); one(b - pg); pl = a; pg = b; });
    return s;
}
// маска → многоугольники (GeoJSON-порядок: внешние кольца — против часовой в долготе/широте, дыры — по часовой)
function ccw(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][1] - r[i][1]) * (r[j][0] + r[i][0]); return a > 0; }   // r — [широта, долгота]
function polys(g, m, minKm2) {
    const rs = contours(g, m).map(r => ({ r, a: area(r) * G * G / 1e6 })).filter(o => Math.abs(o.a) > .02);
    if (!rs.length) return [];
    const sg = Math.sign(rs.reduce((b, o) => Math.abs(o.a) > Math.abs(b.a) ? o : b).a);   // самое большое кольцо — внешнее
    const outer = rs.filter(o => Math.sign(o.a) === sg && Math.abs(o.a) >= minKm2), holes = rs.filter(o => Math.sign(o.a) !== sg);
    const P = outer.map(o => [o.r]);
    holes.forEach(h => { let k = -1; outer.forEach((o, i) => { if (inside(h.r[0], o.r) && (k < 0 || Math.abs(o.a) < Math.abs(outer[k].a))) k = i; }); if (k > -1) P[k].push(h.r); });
    return P.map(rings => rings.map((r, j) => {
        const q = dp(r.map(p => [p[0] * G, p[1] * G]), TOL).map(p => g.toLL(p[0] / G, p[1] / G));
        return ccw(q) === (j === 0) ? q : q.reverse();
    }));
}

// ── одна заведение ──
function job(J, tileOf) {
    const n = J.n, P = J.pts, c0 = [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
    const Rout = (4.6 + .55 * n) * 1000, Rin = .38 * Rout, kx = 111320 * Math.cos(c0[0] * Math.PI / 180);
    let sx = 0, sy = 0; P.forEach(q => { sx = Math.max(sx, Math.abs(q[1] - c0[1]) * kx); sy = Math.max(sy, Math.abs(q[0] - c0[0]) * 111320); });
    const g = Grid(c0, { x: sx + 1.7 * Rout, y: sy + 1.7 * Rout });
    const D = load(g, tileOf), pts = P.map(q => g.toXY(q[0], q[1])).map(p => Math.floor(p[1]) * g.W + Math.floor(p[0]));
    const T = dijkstra(g, D.cost, pts.map(i => ({ i, lab: 0 })), null);
    // порог: дорог в зоне — как в круге радиуса R от ближайшей точки
    const thr = R => {
        const inR = [], all = [];
        for (let i = 0; i < g.N; i++) {
            if (!D.speed[i] || D.speed[i] < SPEED.minor) continue;
            const x = (i % g.W) * G, y = Math.floor(i / g.W) * G; let best = Infinity;
            pts.forEach(p => { const px = (p % g.W) * G, py = Math.floor(p / g.W) * G; best = Math.min(best, Math.hypot(x - px, y - py)); });
            if (best <= R) inR.push(1); if (T[i] < Infinity) all.push(T[i]);
        }
        all.sort((a, b) => a - b); return all[Math.min(all.length - 1, inR.length)];
    };
    const tOut = thr(Rout), tIn = thr(Rin);
    const A = region(g, D, T, tOut), Gz = region(g, D, T, tIn);
    // край сетки не тронут — иначе запас мал
    for (let x = 0; x < g.W; x++) if (A[x] || A[(g.H - 1) * g.W + x]) throw new Error(J.id + ': зона упёрлась в край сетки');
    const zones = [Gz.slice()];
    if (n > 1) {
        // «центры районов» — по кругу вокруг точек; район — те места, куда из его центра ближе всего по дорогам
        const rnd = seedRnd(J.id + 'z'), a0 = rnd() * Math.PI * 2, Rs = Math.max(sx, sy) + .62 * Rout, seeds = [];
        for (let k = 1; k < n; k++) {
            const t = a0 + (k - 1) / (n - 1) * Math.PI * 2, p = g.toXY(c0[0] + Math.sin(t) * Rs / 111320, c0[1] + Math.cos(t) * Rs / kx);
            let bi = -1, bd = Infinity; const px = Math.round(p[0]), py = Math.round(p[1]);
            for (let y = Math.max(0, py - 80); y < Math.min(g.H, py + 80); y++) for (let x = Math.max(0, px - 80); x < Math.min(g.W, px + 80); x++) { const i = y * g.W + x; if (D.speed[i] >= SPEED.tertiary) { const d = (x - px) * (x - px) + (y - py) * (y - py); if (d < bd) { bd = d; bi = i; } } }
            seeds.push({ i: bi > -1 ? bi : py * g.W + px, lab: k });
        }
        // вода районы не делит: для разметки районов её можно «переплыть» (медленно) — у озера нет дыры в зоне
        const cl = D.cost.map(c => c < Infinity ? c : 3 * G / WALK), lab = new Int8Array(g.N).fill(-1); dijkstra(g, cl, seeds, lab);
        // границы районов — плавные: доля каждого района вокруг (размытие ~150 м), берём бо́льшую
        const best = new Float32Array(g.N).fill(-1), L2 = new Int8Array(g.N).fill(-1);
        for (let k = 1; k < n; k++) {
            const f = new Float32Array(g.N); for (let i = 0; i < g.N; i++) f[i] = lab[i] === k ? 1 : 0;
            const b = boxBlur(g, f, 12, 3); for (let i = 0; i < g.N; i++) if (b[i] > best[i]) { best[i] = b[i]; L2[i] = k; }
        }
        // клочок района, оторванный от него (например, между двумя зелёными зонами соседних точек), — зелёный: он ближе
        const part = k => { const m = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) m[i] = A[i] && !zones[0][i] && L2[i] === k ? 1 : 0; return m; };
        // (только если касается зелёной; оторванный у внешнего края — просто убираем)
        let bits = 0; const add = new Uint8Array(g.N), near = dilate(g, zones[0], 2 * G);
        for (let k = 1; k < n; k++) {
            const m = part(k), big = dropSmall(g, m, Math.round(.6e6 / (G * G)), .08), bit = new Uint8Array(g.N); for (let i = 0; i < g.N; i++) bit[i] = m[i] && !big[i] ? 1 : 0;
            comps(g, bit).forEach(c => { if (c.some(i => near[i])) c.forEach(i => { add[i] = 1; bits++; }); });
        }
        if (bits) { const m = zones[0].slice(); for (let i = 0; i < g.N; i++) if (add[i]) m[i] = 1; const c = close(g, m, CLOSE); for (let i = 0; i < g.N; i++) m[i] = c[i] && A[i] ? 1 : 0; zones[0] = fillHoles(g, m); }
        for (let k = 1; k < n; k++) zones.push(dropSmall(g, open(g, part(k), ROUND), Math.round(.15e6 / (G * G))));
    }
    const out = zones.map(m => polys(g, m, .1));
    return { out, tOut, tIn, g };
}

// ── главное ──
(function main() {
    const begin = '/* AB_GEO:начало', end = '/* AB_GEO:конец */';
    const a = src.indexOf(begin), b = src.indexOf(end);
    if (a < 0 || b < a) throw new Error('в index.html нет меток ' + begin + ' … ' + end);
    // плитки — одним заходом на все заведения
    const need = new Set();
    JOBS.forEach(J => {
        const P = J.pts, Rout = (4.6 + .55 * J.n) * 1000, m = 1.7 * Rout + 1500;
        const la0 = Math.min(...P.map(q => q[0])) - m / 111320, la1 = Math.max(...P.map(q => q[0])) + m / 111320, k = 111320 * Math.cos(P[0][0] * Math.PI / 180);
        const lg0 = Math.min(...P.map(q => q[1])) - m / k, lg1 = Math.max(...P.map(q => q[1])) + m / k;
        for (let x = Math.floor(lng2x(lg0, Z)); x <= Math.floor(lng2x(lg1, Z)); x++) for (let y = Math.floor(lat2y(la1, Z)); y <= Math.floor(lat2y(la0, Z)); y++) need.add(x + ',' + y);
    });
    const tileOf = fetchTiles([...need].map(s => s.split(',').map(Number)));
    const data = {}, fc = { type: 'FeatureCollection', features: [] };
    JOBS.forEach(J => {
        const t0 = Date.now(), r = job(J, tileOf);
        data[J.id] = r.out.map(z => z.map(poly => poly.map(enc)));
        r.out.forEach((z, i) => fc.features.push({ type: 'Feature', properties: { id: J.id, z: i }, geometry: { type: 'MultiPolygon', coordinates: z.map(poly => poly.map(ring => ring.map(p => [p[1], p[0]]))) } }));
        console.log(J.id + ': зон ' + J.n + ', точек ' + J.pts.length + ', зелёная до ' + (r.tIn / 60).toFixed(1) + ' мин, вся до ' + (r.tOut / 60).toFixed(1) + ' мин; вершин ' +
            r.out.reduce((s, z) => s + z.reduce((s2, p) => s2 + p.reduce((s3, q) => s3 + q.length, 0), 0), 0) + ', ' + JSON.stringify(data[J.id]).length + ' байт, сетка ' + r.g.W + '×' + r.g.H + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с');
    });
    if (GJ) fs.writeFileSync(GJ, JSON.stringify(fc));
    const js = JSON.stringify(data);
    const block = begin + ' (tools/zones.js, ' + new Date().toISOString().slice(0, 10) + ') */\n    var AB_GEO = ' + js + ';\n    ';
    fs.writeFileSync(HTML, src.slice(0, a) + block + src.slice(b));
    console.log('AB_GEO: ' + js.length + ' байт → index.html');
})();
