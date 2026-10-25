import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
const D = '/tmp/claude-0/-home-claude/41c905c5-17de-5fda-854e-d445bf24c0d9/scratchpad/truss/';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(D + 'truss-explorer.html')); }).listen(8795);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8795/'); await p.waitForTimeout(25000);
await p.evaluate(() => { const d = document.getElementById('s-track'); d.open = true; });
await p.selectOption('#groupBy', 'pattern'); await p.waitForTimeout(500);
for (const tab of ['trade', 'c3', 'curve']) {
  await p.evaluate(t => { __dbg.S.tab = t; __dbg.drawTrackers(); }, tab); await p.waitForTimeout(400);
  const lg = { trade: '#tradeLegend', c3: '#c3Legend', curve: '#curveLegend' }[tab];
  const ha = await p.$(lg + ' [data-hideall]');
  if (ha) await ha.click(); else await p.evaluate(l => document.querySelectorAll(l + ' [data-g]').forEach(s => __dbg.S.hideG[(__dbg.S.groupBy) + '|' + s.dataset.g] = 1), lg), await p.evaluate(() => __dbg.drawTrackers());
  await p.waitForTimeout(300);
  console.log(await p.evaluate(l => document.querySelector(l).innerHTML.slice(0,200), lg));
  console.log(await p.evaluate(l => [__dbg.S.groupBy, __dbg.S.tab, document.querySelectorAll(l+' [data-g]').length, document.querySelectorAll(l+' [data-g].off').length, document.querySelectorAll('.allhid').length], lg));
  const vis = await p.isVisible('.allhid');
  if (vis) { await p.click('.allhid button'); await p.waitForTimeout(300); }
  console.log(tab, 'notice shown:', vis, '| gone after Show all:', !(await p.isVisible('.allhid')));
}
await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(500);
const st = () => p.evaluate(() => JSON.stringify([__v3.yaw, __v3.zoom]));
const c = await (await p.$('#c3d')).boundingBox(); const drag = async () => { await p.$eval('#c3d', e => e.scrollIntoView({block:'center'})); const c = await (await p.$('#c3d')).boundingBox(); console.log('at', await p.evaluate(([x,y]) => { const e = document.elementFromPoint(x,y); return e.id || e.className; }, [c.x + c.width/2, c.y + c.height/2])); await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await p.mouse.down(); await p.mouse.move(c.x + c.width / 2 + 150, c.y + c.height / 2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(150); };
const s0 = await st(); await drag(); console.log('locked moves:', s0 !== await st(), '| button:', await p.textContent('#free3d'));
await p.click('#free3d'); await drag(); console.log('unlocked moves:', s0 !== await st(), '| cube shown:', await p.isVisible('#topD3Slot .navcube'), '| button:', await p.textContent('#free3d'));
await p.click('#free3d'); console.log('relocked resets:', s0 === await st());
await p.screenshot({ path: D + 'v52.png' });
console.log('errors:', errs.length ? errs : 'none');
srv.close(); await b.close();
