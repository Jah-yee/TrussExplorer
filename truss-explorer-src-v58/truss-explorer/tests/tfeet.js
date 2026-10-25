const C = require('./core.js'), O = require('./core_v21_backup.js');
const mat = Object.assign({}, C.DEFAULT_MAT, { FS: 2 }), load = { mBook1: 1.5, mBook2: 1, g: 9.81, nTruss: 2 }, opts = { deflLimit: 2, minOverlap: 0 };
const base = { family:'warren', span:200, overall:300, height:45, panels:4, ratio:1, diagLeft:[], diagMiddle:'X', vertLeft:[], approachDiag:'P', edgeVert:true, deskVert:true, deskMode:'length', deskPanels:1, overlap:30, bottom:'flat', curve:0, deskEnds:'feet', supportMode:'all', supportOffset:0, sticks:{}, sideAngle:90, sideLean:'in', deck:'top', bookLen:242, tableThick:30, topShape:'parabola', topEnd:0 };
// unchanged when nothing new is used
let maxd = 0;
for (const v of [{}, { family:'grid', topShape:'flat', diagLeft:['P','P'], vertLeft:[true,true], deskEnds:'truss' }, { bottom:'parabola', curve:-20 }]) {
  const d = Object.assign({}, base, v), a = C.analyze(C.buildTruss(d), mat, load, opts), b = O.analyze(O.buildTruss(d), mat, load, opts);
  if (a.stable && b.stable) a.members.forEach((m, k) => { maxd = Math.max(maxd, Math.abs(m.F - b.members[k].F)); });
}
console.log('existing designs unchanged: max ΔF', maxd.toExponential(1));
const show = (lab, v) => { const tr = C.buildTruss(Object.assign({}, base, v)), r = C.analyze(tr, mat, load, opts);
  if (!r.stable) { console.log(lab.padEnd(34), 'UNSTABLE', tr.warn.join(' ')); return; }
  const sumY = r.activeSupports.reduce((s, q) => s + q.Ry, 0), sumX = r.activeSupports.reduce((s, q) => s + q.Rx, 0);
  console.log(lab.padEnd(34), `cap ${r.capKg.toFixed(1)} kg · D ${r.midDefl.toFixed(3)} · ΣRy ${sumY.toFixed(2)}/${r.Ptruss.toFixed(2)} ΣRx ${sumX.toFixed(3)} ·`, r.activeSupports.map(s => `${s.abut ? 'face' : s.corner ? 'corner' : s.pin ? 'pin' : 'roll'}(${s.Rx.toFixed(1)},${s.Ry.toFixed(1)})`).join(' '), r.slips.length ? `· SLIPS ${r.slips.length}` : '', r.released.length ? `· released ${r.released.map(q => q.kind).join(',')}` : ''); };
show('arch on corner, rollers', {});
show('arch on corner, ends bear on edge', { edgeBear: true });
show('arch Δh -15 into the face', { topEnd: -15 });
show('arch Δh 0, bottom Δp -15', { botEnd: -15, curve: 10, bottom: 'parabola' });
show('both ends in face', { topEnd: -10, botEnd: -25 });
show('both in face, μ 1.0', { topEnd: -10, botEnd: -25, fricMu: 1.0 });
