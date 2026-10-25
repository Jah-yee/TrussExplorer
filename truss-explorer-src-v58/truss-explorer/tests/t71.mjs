import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
const D = '/tmp/claude-0/-home-claude/41c905c5-17de-5fda-854e-d445bf24c0d9/scratchpad/truss/';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(D + 'truss-explorer.html')); }).listen(8799);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8799/'); await p.waitForTimeout(20000);
const mode = process.argv[2] || '2d';
if (mode === '3d') { await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(1500); console.log('stale text 3D:', (await p.textContent('.staleMsg')).trim().slice(0, 120)); }
await p.evaluate(() => {
  const set = (k, a, b2, s) => { const on = k === 'O' ? document.getElementById('swVaryOv') : document.getElementById('swOn' + k); if (!on.checked) on.click(); for (const [id, v] of [['sw' + k + '0', a], ['sw' + k + '1', b2], ['sw' + k + 's', s]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
  set('H', 10, 100, 0.01); set('D', -60, 120, 0.01); set('O', 0, 50, 0.01); set('S', 0, 50, 0.01); set('R', 0.5, 2, 0.001); set('A', 20, 90, 0.01);
});
await p.waitForTimeout(800);
console.log('count:', await p.textContent('#sweepCount'));
const t0 = Date.now(); await p.$eval('#bigSearch', e => e.click());
for (let i = 0; i < 100; i++) { await p.waitForTimeout(2000); if (await p.$('#bigFull')) break; }
console.log('pilot took', ((Date.now() - t0) / 1000).toFixed(0), 's; pilot box:', (await p.textContent('#bigBox')).replace(/\s+/g, ' ').slice(0, 260));
await p.click('#bigFull'); await p.waitForTimeout(300);
await p.fill('#bigHrs', '0.01'); await p.$eval('#bigHrs', e => e.dispatchEvent(new Event('change'))); await p.waitForTimeout(300);
console.log('modal:', (await p.textContent('#bigModalText')).replace(/\s+/g, ' ').slice(0, 520));
await p.click('#bigGo'); const t1 = Date.now();
for (let i = 0; i < 60; i++) { await p.waitForTimeout(3000); const m = await p.textContent('#sweepMsg'); if (/Time limit|Full search:|Cancelled/.test(m)) break; }
console.log('run took', ((Date.now() - t1) / 1000).toFixed(0), 's:', (await p.textContent('#sweepMsg')).slice(0, 240));
console.log('rows kept:', await p.evaluate(() => __dbg.rows.length), '| sample idx:', await p.evaluate(() => __dbg.rows.slice(0, 2).map(r => r.idx)));
console.log('errors:', errs.length ? errs : 'none');
srv.close(); await b.close();
