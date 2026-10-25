const C = require('./core.js');
const f = JSON.parse(require('fs').readFileSync('/mnt/user-data/attachments/41c905c5-17de-5fda-854e-d445bf24c0d9/c47bc1a4-Test.bridge.json'));
const S = f.bridge;
const d = { family: S.family, span: 200, overall: S.overall, height: S.height, panels: S.panels, ratio: S.ratio, diagLeft: S.diagLeft, diagMiddle: S.diagMiddle, vertLeft: S.vertLeft, approachDiag: S.approachDiag, edgeVert: S.edgeVert, deskVert: S.deskVert,
  deskMode: S.deskMode, deskPanels: S.deskPanels, overlap: S.overlap, bottom: S.bottom, curve: S.curve, deskEnds: S.deskEnds, supportMode: S.supportMode, topShape: S.topShape, topEnd: S.topEnd, botEnd: S.botEnd, edgeBear: S.edgeBear, bookContact: S.bookContact,
  claw: false, brace: false, tableThick: S.tableThick, braceDepth: S.braceDepth, fricK: S.fricK, fricMu: S.fricMu, supportOffset: S.supportOffset, sticks: {}, sideAngle: S.sideAngle, sideLean: S.sideLean, deck: 'top', bookLen: S.bookLen };
const tr = C.buildTruss(d), r = C.analyze(tr, Object.assign({}, C.DEFAULT_MAT, S.mat), S.load, S.opts);
console.log('stable', r.stable, 'passes', r.passes, 'nodes:');
tr.nodes.forEach((p, i) => console.log(' ', i, tr.keys[i], p.map(v => v.toFixed(1)).join(', ')));
const T = S.tableThick, inTable = (x, y) => (x < -0.05 || x > 200.05) && y < -0.05 && y > -T - 0.05;
tr.elems.forEach((e, k) => { const a = tr.nodes[e.i], b = tr.nodes[e.j]; let hit = false; for (let t = 0.02; t < 0.99; t += 0.02) { const x = a[0] + t * (b[0] - a[0]), y = a[1] + t * (b[1] - a[1]); if (inTable(x, y)) hit = true; }
  if (hit) console.log('THROUGH TABLE: member', k, e.type, tr.keys[e.i], '→', tr.keys[e.j]); });
console.log('warn', tr.warn);
