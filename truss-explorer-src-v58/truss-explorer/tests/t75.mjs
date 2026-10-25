import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs';
const D = '/tmp/claude-0/-home-claude/41c905c5-17de-5fda-854e-d445bf24c0d9/scratchpad/truss/';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(D + 'truss-explorer.html')); }).listen(8803);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:8803/'); await p.waitForTimeout(20000);
await p.click('#anaSwitch [data-ana="3d"]'); await p.waitForTimeout(800);
await p.$eval('#bigSearch', e => e.click());
for (let i = 0; i < 60; i++) { await p.waitForTimeout(1500); if (await p.$('#bigFull')) break; }
console.log('bigBox visible (notes hidden):', await p.isVisible('#bigBox'), '| bigFull:', await p.isVisible('#bigFull'));
const bb = await p.$eval('#bigBox', e => { const r = e.getBoundingClientRect(); return [r.width, e.scrollWidth, e.clientWidth, [...e.querySelectorAll('td')].map(t => t.getBoundingClientRect().right).reduce((a, c) => Math.max(a, c), 0) - r.right]; });
console.log('box width, scrollWidth, clientWidth, overflow px:', bb);
await (await p.$('#bigBox')).screenshot({ path: D + 'v58_pilot_min.png' });
await p.click('#toggleData2'); await p.waitForTimeout(300);
console.log('after show notes:', await p.$eval('#bigBox', e => { const r = e.getBoundingClientRect(); return [r.width, e.scrollWidth]; }));
await (await p.$('#bigBox')).screenshot({ path: D + 'v58_pilot_full.png' });
srv.close(); await b.close();
