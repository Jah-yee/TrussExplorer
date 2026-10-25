const C = require('./core.js'), T = require('./core3d.js'), O = require('./core3d_v24_backup.js');
const mat = Object.assign({}, C.DEFAULT_MAT, { FS: 2 }), load = { mBook1: 1.5, mBook2: 1, g: 9.81, nTruss: 2 };
const d = { family:'grid', span:200, overall:300, height:50, panels:4, ratio:1, diagLeft:['P','P'], diagMiddle:'X', vertLeft:[true,true], approachDiag:'P', edgeVert:true, deskVert:true, deskMode:'match', deskPanels:1, overlap:50, bottom:'flat', curve:0, deskEnds:'truss', supportMode:'one', supportOffset:0, sticks:{}, sideAngle:90, sideLean:'in', deck:'top', bookLen:242 };
const tr = C.buildTruss(d);
// legacy options give the same answer as before
const oldO = { width: 60, tilt: 8, bottomTies: true, topBrace: 'single', botBrace: 'x', sway: true };
const a = T.analyze3D(T.build3D(tr, oldO), mat, load), b = O.analyze3D(O.build3D(tr, oldO), mat, load);
console.log('legacy options unchanged:', a.stable && b.stable && Math.abs(a.maxUtil - b.maxUtil) < 1e-9 && Math.abs(a.deckDefl - b.deckDefl) < 1e-9);
const eqCheck = (m, r) => { const res = new Float64Array(3 * m.nodes.length);
  m.tr.trib.forEach(t => { const yf = m.nodes[t.node][1], yb = m.nodes[t.node + m.n][1], bk = (0 - yf) / (yb - yf); res[3 * t.node + 2] -= r.P * t.frac * (1 - bk); res[3 * (t.node + m.n) + 2] -= r.P * t.frac * bk; });
  r.members.forEach(mm => { const p = m.nodes[mm.i], q = m.nodes[mm.j], dd = [q[0]-p[0], q[1]-p[1], q[2]-p[2]], L = Math.hypot(...dd); for (let k = 0; k < 3; k++) { res[3 * mm.i + k] += mm.F * dd[k] / L; res[3 * mm.j + k] -= mm.F * dd[k] / L; } });
  const sup = new Set(); m.supports.forEach(s => { if (!r.lifted.includes(s.node)) s.dofs.forEach(k => sup.add(3 * s.node + k)); });
  let w = 0; for (let i = 0; i < res.length; i++) if (!sup.has(i)) w = Math.max(w, Math.abs(res[i])); return (w / r.P).toExponential(1); };
for (const [lab, o] of [
  ['frames every station D', { framePat: ['D'], topPat: ['S'], botPat: ['S'] }],
  ['frames X, lateral X', { framePat: ['X'], topPat: ['X'], botPat: ['X'] }],
  ['K frames, alt lateral', { framePat: ['K', 'N'], topPat: ['S', 'R'], botPat: ['S'] }],
  ['no frames', { framePat: ['N'], topPat: ['S'], botPat: ['S'] }],
  ['end frames only', { framePat: ['D', 'N', 'N'], topPat: ['S'], botPat: ['N'] }],
]) {
  const m = T.build3D(tr, Object.assign({ width: 60, tilt: 10, bottomTies: true }, o)), r = T.analyze3D(m, mat, load);
  console.log(lab.padEnd(26), 'stable', r.stable, r.stable ? `cap ${r.capKg.toFixed(1)} kg · D ${r.deckDefl.toFixed(3)} · sway ${r.sideSway.toFixed(3)} · wood ${r.wood.toFixed(0)} · frames ${m.frames.map(f => f.code).join('')} · joint balance ${eqCheck(m, r)}` : '');
}
