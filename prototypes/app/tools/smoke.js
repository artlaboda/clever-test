// Дымовая проверка перед выкладкой: приложение открывается, блюдо добавляется, корзина считает доставку, скрытые настройки открываются; печатает «ошибки: нет»
// node tools/smoke.js index.html
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node-tools/node_modules/playwright'); }
const path = require('path');
(async () => { const b = await pw.chromium.launch(); const errs = [], out = [];
  for (const v of ['soft', 'mix']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const m = await ctx.newPage();
    m.on('pageerror', e => errs.push(e.message)); await m.route(/unpkg|openfreemap|nominatim/, r => r.abort()); await m.goto('file://' + path.resolve(process.argv[2]));
    await m.evaluate(v => { localStorage.clear(); localStorage.setItem('clever2-city', 'minsk'); localStorage.setItem('clever2-fxv', JSON.stringify({ dlv: v })); }, v); await m.reload(); await m.waitForTimeout(800); if (await m.isVisible('#splash')) await m.tap('#splash'); await m.waitForTimeout(1800);
    await m.evaluate(() => document.querySelector('[data-act="open-rest"][data-id="terra"]').click()); await m.waitForTimeout(1300);
    await m.evaluate(() => document.querySelector('#s-rest [data-act="quick-add"][data-id="steak"]').click()); await m.waitForTimeout(1200);
    await m.evaluate(() => document.getElementById('cartbar').click()); await m.waitForTimeout(1200);
    const msg = () => m.evaluate(() => document.querySelector('#dlv [data-dlv="msg"]').textContent.replace(/ /g, ' '));
    const a = await msg(); for (let i = 0; i < 2; i++) { await m.evaluate(() => document.querySelector('#s-cart .citem [data-d="1"]').click()); await m.waitForTimeout(700); }
    out.push(v + ': 24,90 — «' + a + '»; 74,70 — «' + await msg() + '»');
    if (v === 'mix') {   // скрытые настройки: строка вариантов призыва
      await m.evaluate(() => document.querySelector('[data-act="back"]').click()); await m.waitForTimeout(700);
      await m.evaluate(() => document.querySelector('[data-act="back"]').click()); await m.waitForTimeout(700);
      await m.evaluate(() => document.querySelector('.tab[data-tab="profile"]').click()); await m.waitForTimeout(400);
      await m.evaluate(() => { for (let i = 0; i < 5; i++) document.querySelector('#profileScroll [data-act="dev-tap"]').click(); }); await m.waitForTimeout(500);
      out.push('настройки: ' + await m.evaluate(() => [...document.querySelectorAll('[data-act="fxv"][data-k="dlv"]')].map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '✓' : '')).join(' / ')));
      out.push('touch-action у «+»: ' + await m.evaluate(() => getComputedStyle(document.querySelector('.tab')).touchAction));
    }
    await ctx.close();
  }
  out.forEach(x => console.log(x)); console.log('ошибки:', errs.join('; ') || 'нет'); await b.close(); })();
