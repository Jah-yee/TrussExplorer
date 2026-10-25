import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
const D = '/tmp/claude-0/-home-claude/41c905c5-17de-5fda-854e-d445bf24c0d9/scratchpad/truss/';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(D + 'truss-explorer.html')); }).listen(8798);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8798/'); await p.waitForTimeout(25000);
const check = async tag => {
  const out = await p.evaluate(() => { const rows = __dbg.rows.filter(r => r.passes).sort((a, b) => a.wood - b.wood); const pick = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]; return pick.map(r => { const w = r.wood; __dbg.load(r); return [Math.round(w), Math.round(__dbg.res.wood), !!__dbg.res.mode3]; }); });
  console.log(tag, 'row wood vs loaded wood [row, loaded, loaded-in-3D]:', JSON.stringify(out), '| stale msg:', await p.isVisible('.staleMsg'));
};
await check('2D sweep, 2D mode:');
await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(3000);
await check('2D sweep, then 3D mode:');
console.log('stale text:', (await p.textContent('.staleMsg')).trim().slice(0, 140));
console.log('count:', await p.textContent('#sweepCount'), '| runSweep disabled:', await p.$eval('#runSweep', e => e.disabled));
await p.$eval('#runSweep', e => e.click()); await p.waitForTimeout(3000);
for (let i = 0; i < 60; i++) { const m = await p.textContent('#sweepMsg'); if (/done|designs|passed|pass/i.test(m) && !/running|…/.test(m)) break; await p.waitForTimeout(3000); }
console.log('msg:', (await p.textContent('#sweepMsg')).slice(0, 200));
await check('3D sweep, 3D mode:');
console.log('errors:', errs.length ? errs : 'none');
srv.close(); await b.close();
