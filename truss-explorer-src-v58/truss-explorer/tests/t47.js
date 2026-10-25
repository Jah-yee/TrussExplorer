const C = require('./core.js'), T = require('./core3d.js');
const load = { mBook1: 1.5, mBook2: 1, g: 9.81, nTruss: 2 }, mat = Object.assign({}, C.DEFAULT_MAT, { FS: 2 }), opts = { deflLimit: 2, minOverlap: 5, width: 60 };
for (const v of [{ family: 'warren', panels: 6, bottom: 'parabola', curve: 20 }, { family: 'warren', panels: 6, bottom: 'parabola', curve: 20, sideAngle: 60 }, { family: 'grid', panels: 6, diagLeft: ['P','P','P'], vertLeft: [false,false,false], edgeVert: false, deskVert: false, bottom: 'parabola', curve: 20 }]) {
  const d = Object.assign({ family:'grid', span:200, overall:300, height:40, panels:4, ratio:1, diagLeft:['P','P'], diagMiddle:'X', vertLeft:[true,true], approachDiag:'P', edgeVert:true, deskVert:true, deskMode:'panels', deskPanels:1, overlap:30, bottom:'flat', curve:0, deskEnds:'truss', supportMode:'all', supportOffset:0, sticks:{}, sideAngle:90, sideLean:'in', deck:'top', bookLen:242 }, v);
  const tr = C.buildTruss(d), r = C.analyze(tr, mat, load, opts);
  if (!r.stable) { console.log(JSON.stringify(v), '2D unstable'); continue; }
  for (const br of [{ topPat: ['S'], botPat: ['S'], framePat: ['D','N'], bottomTies: true }, { topPat: ['N'], botPat: ['N'], framePat: ['X'], bottomTies: true }]) {
    const m3 = T.build3D(tr, Object.assign({ width: 60, tilt: process.argv[2] ? +process.argv[2] : 0 }, br)); const q = T.analyze3D(m3, mat, load);
    const outer = m3.supports.filter(s => !s.ghost && !s.main).map(s => s.node);
    console.log(JSON.stringify(v).slice(0, 70), '| 2D lifted', r.lifted.map(s => tr.keys[s.node]).join(','), '| 3D', q.stable ? 'lifted ' + q.lifted.map(n => tr.keys[n % tr.nodes.length] + (n >= tr.nodes.length ? 'b' : 'f')).join(',') : 'unstable', '| bracing', JSON.stringify(br.botPat));
  }
}
