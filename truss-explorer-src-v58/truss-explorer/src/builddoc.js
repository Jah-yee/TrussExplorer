// ===== Build documents: joint styles, cut lengths and angles, parts list, cutting plan, and a printable document =====
(function (root) {
'use strict';
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], crs = (a, b) => a[0] * b[1] - a[1] * b[0];
const unit = a => { const L = Math.hypot(a[0], a[1]) || 1; return [a[0] / L, a[1] / L]; };
const perp = a => [-a[1], a[0]];
const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
// where does the line p + t*u meet the line q + s*c? returns t
function meet(p, u, q, c) { const den = crs(u, c); if (Math.abs(den) < 1e-12) return null; return crs(sub(q, p), c) / den; }

const TYPE_ORDER = { bot: 0, top: 1, end: 2, vert: 3, diag: 4, brace: 5, claw: 6 };
const isChord = e => e.type === 'top' || e.type === 'bot';

// the joints of the truss with the members that meet there (direction pointing away from the joint)
function jointsOf(tr) {
  return tr.nodes.map((p, n) => {
    const m = [];
    tr.elems.forEach((e, k) => { if (e.i === n || e.j === n) { const o = e.i === n ? e.j : e.i; m.push({ k, dir: unit(sub(tr.nodes[o], p)), type: e.type }); } });
    return { n, p, m };
  }).filter(J => J.m.length);
}

// the default rule for one joint. styles: 'through' (chords run through, the others cut flush to the chord face),
// 'square' (chords run through, the others cut square at 90°), 'mitre' (two-member joints mitred at the split, others flush)
function defaultJoint(J, style) {
  const chords = J.m.filter(q => isChord(q));
  let through = null;
  if (chords.length) {
    // prefer a chord that continues straight through this joint; else the chord with the most members against it
    const straight = chords.find(a => chords.some(b => b !== a && dot(a.dir, b.dir) < -Math.cos(0.5 * D2R)));
    through = (straight || chords[0]).k;
  } else if (J.m.length > 2) through = J.m.slice().sort((a, b) => (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]))[0].k;
  const two = J.m.length === 2;
  if (style === 'mitre' && two) return { through: null, end: 'mitre', split: 50 };
  if (two && !chords.length) return { through: null, end: 'mitre', split: 50 };
  return { through, end: style === 'square' ? 'square' : 'flush', split: 50 };
}

// cut geometry for every member end. b = stick width. cfg: { style, over: { [node]: { through, end, split } } }
function cutPlan(tr, b, cfg) {
  cfg = cfg || {}; const style = cfg.style || 'through', over = cfg.over || {};
  const J = jointsOf(tr), byNode = {};
  J.forEach(j => { byNode[j.n] = j; });
  const rule = n => Object.assign(defaultJoint(byNode[n], style), over[n] || {});
  // which members continue straight through a joint as one stick (a chord with its collinear partner at a through joint)
  const parent = tr.elems.map((e, k) => k);
  const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
  const cont = {};   // node -> set of member indices that pass through without a cut
  J.forEach(j => {
    const r = rule(j.n); if (r.through == null) return;
    const t = j.m.find(q => q.k === r.through); if (!t) return;
    const partner = j.m.find(q => q.k !== t.k && tr.elems[q.k].type === tr.elems[t.k].type && dot(q.dir, t.dir) < -Math.cos(0.5 * D2R));
    if (partner) { parent[find(partner.k)] = find(t.k); cont[j.n] = new Set([t.k, partner.k]); }
  });
  // end cut of member k at joint n: returns the cut-line distances (along the member, from the joint centre) for its two edges
  const ends = {};
  tr.elems.forEach((e, k) => {
    [e.i, e.j].forEach(n => {
      const j = byNode[n], p = j.p, me = j.m.find(q => q.k === k), u = me.dir, nrm = perp(u);
      const r = rule(n), key = k + '@' + n;
      if (cont[n] && cont[n].has(k)) { ends[key] = { kind: 'through', eA: null, eB: null, ang: 0 }; return; }
      const edge = (o, q, c) => meet(add(p, mul(nrm, o)), u, q, c);
      const others = j.m.filter(q => q.k !== k);
      if (!others.length) { ends[key] = { kind: 'free', eA: 0, eB: 0, ang: 0 }; return; }
      if (r.through === k || (r.through != null && cont[n] && cont[n].has(r.through) && false)) {
        // this member is the one on top / running through, and it ends here: square, reaching past the joint to cover the others
        ends[key] = { kind: 'end', eA: -b / 2, eB: -b / 2, ang: 0 }; return;
      }
      if (r.end === 'mitre' && others.length === 1 && r.through == null) {
        const o = others[0], phi = Math.acos(Math.max(-1, Math.min(1, dot(u, o.dir))));
        const sgn = crs(u, o.dir) >= 0 ? 1 : -1;
        const share = (tr.elems[k].i === n ? (r.split != null ? r.split : 50) : 100 - (r.split != null ? r.split : 50)) / 100;
        // the split belongs to the lower-numbered member; the partner takes the rest
        const mine = k < o.k ? (r.split != null ? r.split : 50) / 100 : 1 - (r.split != null ? r.split : 50) / 100;
        const beta = Math.max(1 * D2R, Math.min(phi - 1 * D2R, mine * phi));
        const c = rot(u, sgn * beta);
        ends[key] = { kind: 'mitre', eA: edge(b / 2, p, c), eB: edge(-b / 2, p, c), ang: 90 - beta * R2D, share: Math.round(mine * 100) };
        void share; return;
      }
      // flush or square against the member on top (the through member), or the nearest other member if none is set
      let t = r.through != null ? j.m.find(q => q.k === r.through) : null;
      if (!t || t.k === k) t = others.slice().sort((a, b2) => Math.abs(dot(u, b2.dir)) - Math.abs(dot(u, a.dir)))[0];
      const tl = t.dir;   // along the through member, from the joint
      const side = Math.sign(crs(tl, u)) || 1;
      const face = add(p, mul(perp(tl), side * b / 2));
      const theta = Math.acos(Math.min(1, Math.abs(dot(u, tl))));
      if (theta < 2 * D2R) { ends[key] = { kind: 'free', eA: 0, eB: 0, ang: 0 }; return; }
      const eA = edge(b / 2, face, tl), eB = edge(-b / 2, face, tl);
      if (r.end === 'square') { const e2 = Math.max(eA, eB); ends[key] = { kind: 'square', eA: e2, eB: e2, ang: 0, against: t.k }; }
      else ends[key] = { kind: 'flush', eA, eB, ang: 90 - theta * R2D, against: t.k };
    });
  });
  // pieces: members joined straight through a joint are one stick
  const groups = {};
  tr.elems.forEach((e, k) => { const g = find(k); (groups[g] = groups[g] || []).push(k); });
  const pieces = Object.values(groups).map(ks => {
    // order the members along the piece and find its two ends
    const nodesOf = {}; ks.forEach(k => { [tr.elems[k].i, tr.elems[k].j].forEach(n => { nodesOf[n] = (nodesOf[n] || 0) + 1; }); });
    const endNodes = Object.keys(nodesOf).filter(n => nodesOf[n] === 1).map(Number);
    const [n0, n1] = endNodes.length === 2 ? endNodes : [tr.elems[ks[0]].i, tr.elems[ks[ks.length - 1]].j];
    const L = ks.reduce((s, k) => s + Math.hypot(...sub(tr.nodes[tr.elems[k].j], tr.nodes[tr.elems[k].i])), 0);
    const k0 = ks.find(k => tr.elems[k].i === n0 || tr.elems[k].j === n0), k1 = ks.find(k => tr.elems[k].i === n1 || tr.elems[k].j === n1);
    const c0 = ends[k0 + '@' + n0], c1 = ends[k1 + '@' + n1];
    // edges A/B are left/right of each end's outward direction, so the same physical edge is A at one end and B at the other
    const e0A = c0.eA || 0, e0B = c0.eB || 0, e1A = c1.eA || 0, e1B = c1.eB || 0;
    const sideOne = L - e0A - e1B, sideTwo = L - e0B - e1A;
    const centre = L - (e0A + e0B) / 2 - (e1A + e1B) / 2;
    const e = tr.elems[ks[0]];
    return { members: ks.slice().sort((a, b2) => a - b2), type: e.type, n: e.n || 1, nodes: [n0, n1], L, centre, long: Math.max(sideOne, sideTwo), short: Math.min(sideOne, sideTwo),
      cut0: c0, cut1: c1 };
  }).sort((a, b2) => TYPE_ORDER[a.type] - TYPE_ORDER[b2.type] || a.members[0] - b2.members[0]);
  // parts list: identical pieces (to 0.5 mm and 1°) share an item number
  const keyOf = q => [q.type, (Math.round(q.long * 2) / 2).toFixed(1), (Math.round(q.short * 2) / 2).toFixed(1), [Math.round(q.cut0.ang), Math.round(q.cut1.ang)].sort((a, b2) => a - b2).join('/'), q.n].join('|');
  const items = [];
  pieces.forEach(q => { const key = keyOf(q); let it = items.find(i => i.key === key); if (!it) { it = { key, no: items.length + 1, type: q.type, long: q.long, short: q.short, cuts: [q.cut0, q.cut1], n: q.n, pieces: [] }; items.push(it); } it.pieces.push(q); q.item = it.no; });
  return { joints: J.map(j => Object.assign({ n: j.n, members: j.m.map(q => q.k) }, rule(j.n))), ends, pieces, items };
}

// first-fit decreasing: how to cut the pieces from stock sticks
function stockPlan(lengths, stock, kerf) {
  const bars = [];
  lengths.slice().sort((a, b) => b.len - a.len).forEach(p => {
    if (p.len > stock) { bars.push({ used: p.len, cuts: [p], over: true }); return; }
    const bar = bars.find(B => !B.over && B.used + kerf + p.len <= stock + 1e-9);
    if (bar) { bar.used += kerf + p.len; bar.cuts.push(p); } else bars.push({ used: p.len, cuts: [p] });
  });
  return bars;
}

const TL = { top: 'Top chord', bot: 'Bottom chord', end: 'End post', vert: 'Vertical', diag: 'Diagonal', brace: 'Edge brace', claw: 'Claw hook' };
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cutTxt = c => c.kind === 'through' ? 'runs through' : c.kind === 'end' ? 'square, runs past' : c.kind === 'free' ? 'square' : c.kind === 'square' ? 'square (90°)' : `${Math.round(c.ang)}° ${c.kind === 'mitre' ? 'mitre' : 'flush'}`;

// one colour and one line pattern per item, so a part can be told apart on screen and in black-and-white print
const PALETTE = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#393b79', '#ad494a'];
const DASHES = ['', '6 1.6', '1.6 1.2', '7 1.4 1.4 1.4', '3 1.5', '10 2', '4 1 1 1 1 1', '2 3', '8 1 2 1', '5 3', '1 1', '12 1.5 3 1.5'];
const colOf = no => PALETTE[(no - 1) % PALETTE.length], dashOf = no => DASHES[(no - 1) % DASHES.length];

// an aligned dimension between points a and b (model coordinates), offset d to the left of a->b. Y flips y for SVG.
function dimLine(a, b, d, txt, Y, sz) {
  sz = sz || 3.2;
  const u = unit(sub(b, a)), n = perp(u), A = add(a, mul(n, d)), B = add(b, mul(n, d)), g = 1, ex = 1.5;
  const P = q => `${q[0]},${Y(q[1])}`;
  const e1a = add(a, mul(n, Math.sign(d) * g)), e1b = add(A, mul(n, Math.sign(d) * ex)), e2a = add(b, mul(n, Math.sign(d) * g)), e2b = add(B, mul(n, Math.sign(d) * ex));
  const ah = 2.2, aw = 0.7;
  const arrow = (tip, dir) => { const base = sub(tip, mul(dir, ah)); return `<polygon points="${P(tip)} ${P(add(base, mul(perp(dir), aw)))} ${P(sub(base, mul(perp(dir), aw)))}" fill="#111"/>`; };
  const m = mul(add(A, B), 0.5), tp = add(m, mul(n, Math.sign(d || 1) * 1.6));
  let ang = Math.atan2(u[1], u[0]) * R2D; if (ang > 90.01) ang -= 180; if (ang < -90.01) ang += 180;
  return `<g stroke="#111" stroke-width=".22" fill="none"><line x1="${e1a[0]}" y1="${Y(e1a[1])}" x2="${e1b[0]}" y2="${Y(e1b[1])}"/><line x1="${e2a[0]}" y1="${Y(e2a[1])}" x2="${e2b[0]}" y2="${Y(e2b[1])}"/><line x1="${A[0]}" y1="${Y(A[1])}" x2="${B[0]}" y2="${Y(B[1])}"/></g>${arrow(A, mul(u, -1))}${arrow(B, u)}
    <text x="${tp[0]}" y="${Y(tp[1])}" font-size="${sz}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${-ang} ${tp[0]} ${Y(tp[1])})" font-family="Arial, sans-serif" fill="#111" paint-order="stroke" stroke="#fffdf5" stroke-width=".9">${txt}</text>`;
}

// side view as SVG. o: { highlight: Set, grey: Set, labels, balloons, b, color: 'part' | 'mono' | css colour, dash: true, dims: true }
function sideSVG(tr, plan, o) {
  o = o || {};
  const xs = tr.nodes.map(p => p[0]), ys = tr.nodes.map(p => p[1]);
  const pad = o.dims ? 26 : 14;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys, -6) - pad, y1 = Math.max(...ys, 6) + pad;
  const W = x1 - x0, H = y1 - y0, Y = y => y1 - y + y0;
  const b = o.b || 3.18, out = [];
  out.push(`<rect x="${x0}" y="${Y(0)}" width="${-x0}" height="${Math.min(10, -y0)}" fill="#e9e9e9"/><rect x="${tr.design.span || 200}" y="${Y(0)}" width="${x1 - (tr.design.span || 200)}" height="${Math.min(10, -y0)}" fill="#e9e9e9"/>`);
  const pieceOf = {}; plan.pieces.forEach(q => q.members.forEach(k => { pieceOf[k] = q; }));
  tr.elems.forEach((e, k) => {
    const p = tr.nodes[e.i], q = tr.nodes[e.j], it = pieceOf[k] ? pieceOf[k].item : 1;
    const hi = o.highlight ? o.highlight.has(k) : true, gr = o.grey && o.grey.has(k);
    if (o.highlight && !hi && !gr) return;
    const w = b * Math.sqrt(e.n || 1);
    const col = gr ? '#c8c8c8' : o.color === 'part' ? colOf(it) : o.color === 'mono' ? '#fff' : (o.color || '#1f4e8c');
    const d = sub(q, p), u = unit(d), nv = mul(perp(u), w / 2);
    const poly = [add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y(z[1])}`).join(' ');
    out.push(`<polygon points="${poly}" fill="${col}" stroke="${gr ? '#bbb' : '#111'}" stroke-width=".2" opacity="${gr ? 0.7 : 0.95}"/>`);
    if (o.dash && !gr) { const da = dashOf(it); if (da) out.push(`<line x1="${p[0]}" y1="${Y(p[1])}" x2="${q[0]}" y2="${Y(q[1])}" stroke="#111" stroke-width=".55" stroke-dasharray="${da}"/>`); }
  });
  tr.nodes.forEach(p => out.push(`<circle cx="${p[0]}" cy="${Y(p[1])}" r=".7" fill="#111"/>`));
  if (o.labels) {
    // an item is labelled once: identical parts are obvious from the parts list and the balloon
    const done = new Set();
    plan.pieces.forEach(q => {
      if (o.highlight && !q.members.some(k => o.highlight.has(k))) return;
      if (done.has(q.item)) return; done.add(q.item);
      const a = tr.nodes[q.nodes[0]], c = tr.nodes[q.nodes[1]], m = mul(add(a, c), 0.5), d = unit(sub(c, a)), nv = perp(d);
      // dimension on the outside of the truss: away from its centre
      const cen = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
      const side = dot(nv, sub(m, cen)) >= 0 ? 1 : -1;
      if (o.dims) out.push(dimLine(a, c, side * (b + 4), f1(q.long), Y));
      else { const tp = add(m, mul(nv, 5)); let ang = Math.atan2(d[1], d[0]) * R2D; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; out.push(`<text x="${tp[0]}" y="${Y(tp[1])}" font-size="3.3" text-anchor="middle" transform="rotate(${-ang} ${tp[0]} ${Y(tp[1])})" font-family="Arial, sans-serif">${f1(q.long)}</text>`); }
      if (o.balloons) {
        const bp = add(m, mul(nv, -side * (b + 7))), r = 2.9;
        out.push(`<line x1="${m[0]}" y1="${Y(m[1])}" x2="${bp[0]}" y2="${Y(bp[1])}" stroke="#111" stroke-width=".2"/><circle cx="${bp[0]}" cy="${Y(bp[1])}" r="${r}" fill="${o.color === 'part' ? colOf(q.item) : '#fff'}" stroke="#111" stroke-width=".3"/><text x="${bp[0]}" y="${Y(bp[1]) + 1.15}" font-size="3.2" font-weight="bold" text-anchor="middle" fill="${o.color === 'part' ? '#fff' : '#111'}" font-family="Arial, sans-serif">${q.item}</text>`);
      }
    });
  }
  if (o.dims) {
    const lo = Math.min(...xs), hi = Math.max(...xs), top = Math.max(...ys), bot = Math.min(...ys, 0);
    out.push(dimLine([lo, bot], [hi, bot], -(Math.abs(bot - Math.min(...ys)) + 16), f1(hi - lo) + ' overall', Y, 3.4));
    if (top > 0.5) out.push(dimLine([lo, 0], [lo, top], 12 + (Math.min(...xs) < 0 ? 0 : 0), f1(top), Y, 3.4));
  }
  return { svg: out.join(''), box: [x0, y0, W, H], Y };
}

// one part detail: the bar to scale along its length, with enlarged end details that show the cut
function partDetail(it, b, colour) {
  const q = it.pieces[0], L = q.L;
  const c0 = q.cut0, c1 = q.cut1, z = v => v == null ? 0 : v;
  // outline in the piece's own axes: x along the stick, y across (+b/2 is edge A at end 0)
  const pts = [[z(c0.eA), b / 2], [L - z(c1.eB), b / 2], [L - z(c1.eA), -b / 2], [z(c0.eB), -b / 2]];
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]));
  const len = x1 - x0, Wd = 120, sx = Wd / Math.max(len, 1), sy = Math.min(sx * 1.6, 2.2);   // the bar: true length, width shown thicker
  const P = p => `${(p[0] - x0) * sx + 4},${(-p[1]) * sy + 14}`;
  const bar = `<polygon points="${pts.map(P).join(' ')}" fill="${colour}" stroke="#111" stroke-width=".25"/>`;
  const dim = (xa, xb, y, t) => `<g stroke="#111" stroke-width=".2"><line x1="${(xa - x0) * sx + 4}" y1="${y}" x2="${(xb - x0) * sx + 4}" y2="${y}"/><line x1="${(xa - x0) * sx + 4}" y1="${y - 1.5}" x2="${(xa - x0) * sx + 4}" y2="${y + 1.5}"/><line x1="${(xb - x0) * sx + 4}" y1="${y - 1.5}" x2="${(xb - x0) * sx + 4}" y2="${y + 1.5}"/></g><text x="${((xa + xb) / 2 - x0) * sx + 4}" y="${y - 1.2}" font-size="3.2" text-anchor="middle" font-family="Arial">${t}</text>`;
  const top = [pts[0][0], pts[1][0]], botE = [pts[3][0], pts[2][0]];
  const longTop = top[1] - top[0] >= botE[1] - botE[0];
  let s = bar + dim(longTop ? top[0] : botE[0], longTop ? top[1] : botE[1], 6.5, `${f1(it.long)} long point`);
  if (Math.abs(it.long - it.short) > 0.05) s += dim(longTop ? botE[0] : top[0], longTop ? botE[1] : top[1], 23, `${f1(it.short)} short point`);
  // enlarged ends (×6) with the cut angle
  const end = (cut, which, ox) => {
    const k = 6, seg = 9;
    const loc = which === 0 ? [[pts[0][0], b / 2], [pts[3][0], -b / 2]] : [[pts[1][0], b / 2], [pts[2][0], -b / 2]];
    const ref = which === 0 ? Math.min(loc[0][0], loc[1][0]) : Math.max(loc[0][0], loc[1][0]);
    const T = p => [(p[0] - ref) * k * (which === 0 ? 1 : 1), p[1] * k];
    const inner = which === 0 ? ref + seg : ref - seg;
    const poly = which === 0 ? [loc[0], [inner, b / 2], [inner, -b / 2], loc[1]] : [[inner, b / 2], loc[0], loc[1], [inner, -b / 2]];
    const pp = poly.map(T).map(p => `${p[0] + ox},${-p[1] + 50}`).join(' ');
    const lbl = cut.kind === 'through' ? 'runs through' : cut.kind === 'end' || cut.kind === 'free' || cut.kind === 'square' || Math.abs(cut.ang) < 0.5 ? 'square cut' : `${Math.round(cut.ang)}° from square`;
    return `<polygon points="${pp}" fill="${colour}" stroke="#111" stroke-width=".3"/><text x="${ox + (which === 0 ? 0 : -54)}" y="${50 + b * k / 2 + 6}" font-size="3.2" font-family="Arial">${which === 0 ? 'end 1' : 'end 2'}: ${lbl}</text>`;
  };
  s += end(c0, 0, 6) + end(c1, 1, 122);
  return `<svg viewBox="0 0 130 66" class="pd">${s}</svg>`;
}

// the printable document (HTML; print it or save it as PDF). Every sheet is sized to fit one US-letter landscape page.
function documentHTML(tr, res, meta, plan, opt) {
  opt = opt || {};
  const b = meta.b || 3.18, nT = meta.nTruss || 2, colourMode = opt.colour === false ? 'mono' : 'part', dash = !!opt.dash;
  const today = new Date().toLocaleDateString();
  const allCuts = []; plan.pieces.forEach(q => { for (let t = 0; t < nT * q.n; t++) allCuts.push({ len: q.long, item: q.item }); });
  if (meta.ties && meta.ties.count) for (let t = 0; t < meta.ties.count; t++) allCuts.push({ len: meta.ties.len, item: 'T' });
  const kerf = meta.kerf == null ? 1 : meta.kerf, stock = meta.stock || 914;
  const bars = stockPlan(allCuts, stock, kerf), totalLen = allCuts.reduce((s, c) => s + c.len, 0);
  const swatch = no => colourMode === 'part' ? `<span class="sw" style="background:${colOf(no)}"></span>` : '';
  const pattern = no => dash ? `<svg width="34" height="6" style="vertical-align:middle"><line x1="1" y1="3" x2="33" y2="3" stroke="#111" stroke-width="1.4" stroke-dasharray="${(dashOf(no) || '40').split(' ').map(v => v * 2).join(' ')}"/></svg>` : '';
  const sheets = [];
  const sheet = (title, body, cls) => sheets.push({ title, body, cls });
  // 1. assembly drawing
  const v = sideSVG(tr, plan, { labels: true, balloons: true, dims: true, b, color: colourMode, dash });
  const partsRows = plan.items.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${it.pieces.length * nT * it.n}</td><td>${f1(it.long)}</td><td>${Math.abs(it.long - it.short) > 0.05 ? f1(it.short) : '—'}</td><td>${it.cuts.map(cutTxt).join(' / ')}</td><td>${TL[it.type] || it.type}${it.n > 1 ? ` (${it.n} sticks glued)` : ''}${pattern(it.no)}</td></tr>`).join('')
    + (meta.ties && meta.ties.count ? `<tr><td>T</td><td>${meta.ties.count}</td><td>${f1(meta.ties.len)}</td><td>—</td><td>square</td><td>Cross-tie between the trusses</td></tr>` : '');
  sheet('Assembly drawing', `<table class="parts"><tr><th colspan="6">PARTS LIST · ${nT} TRUSSES</th></tr><tr><th>ITEM</th><th>QTY</th><th>LENGTH</th><th>SHORT PT</th><th>END CUTS</th><th>DESCRIPTION</th></tr>${partsRows}</table>
    <svg class="view" viewBox="${v.box.join(' ')}">${v.svg}</svg>
    <p class="note">Side view of one truss, mm. Each part is dimensioned once (long point); identical parts carry the same item balloon. Build ${nT} identical trusses.
    Stick total ${f1(totalLen)} mm · ${meta.massNote || ''} · capacity ${meta.capNote || ''}.</p>`);
  // 2. part drawings, six to a sheet
  const per = 6;
  for (let s0 = 0; s0 < plan.items.length; s0 += per) {
    const cards = plan.items.slice(s0, s0 + per).map(it => `<div class="pcard"><div class="ph"><span class="ball" style="${colourMode === 'part' ? `background:${colOf(it.no)};color:#fff` : ''}">${it.no}</span> <b>${TL[it.type] || it.type}</b>${it.n > 1 ? ` · ${it.n} sticks glued` : ''}<span class="qty">QTY ${it.pieces.length * nT * it.n}</span></div>
      ${partDetail(it, b, colourMode === 'part' ? colOf(it.no) : '#fff')}
      <div class="pf">Balsa ${b} × ${meta.h || b} · long point <b>${f1(it.long)}</b>${Math.abs(it.long - it.short) > 0.05 ? ` · short point ${f1(it.short)}` : ''} · ends ${it.cuts.map(cutTxt).join(' / ')}${pattern(it.no)}</div></div>`).join('');
    sheet(`Part drawings ${plan.items.length > per ? `(${Math.floor(s0 / per) + 1})` : ''}`, `<div class="pgrid">${cards}</div>`);
  }
  // 3. cut list, cutting plan and joints
  const barSVG = bars.map((B, i) => { let x = 0;
    const segs = B.cuts.map(c => { const r = `<rect x="${x}" y="0" width="${c.len}" height="8" fill="${c.item === 'T' ? '#ddd' : colourMode === 'part' ? colOf(c.item) : '#fff'}" fill-opacity=".55" stroke="#333" stroke-width=".4"/><text x="${x + c.len / 2}" y="5.6" font-size="4.2" text-anchor="middle" font-family="Arial">${c.item}</text>`; x += c.len + kerf; return r; }).join('');
    return `<div class="bar"><span>Stick ${i + 1}${B.over ? ' (too long!)' : ''}</span><svg viewBox="-1 -1 ${stock + 2} 10" preserveAspectRatio="none">${segs}<rect x="0" y="0" width="${stock}" height="8" fill="none" stroke="#999" stroke-width=".3"/></svg></div>`; }).join('');
  const cutRows = plan.items.map(it => `<tr><td>${swatch(it.no)}${it.no}</td><td>${TL[it.type] || it.type}</td><td>${it.pieces.length * nT * it.n}</td><td><b>${f1(it.long)}</b></td><td>${f1(it.short)}</td><td>${cutTxt(it.cuts[0])}</td><td>${cutTxt(it.cuts[1])}</td></tr>`).join('');
  const jRows = plan.joints.map(j => `<tr><td>${j.n}</td><td>${j.members.join(', ')}</td><td>${j.through == null ? '—' : j.through}</td><td>${j.end}${j.end === 'mitre' ? ' ' + j.split + '/' + (100 - j.split) : ''}</td></tr>`).join('');
  sheet('Cut list and joints', `<div class="two"><div><h2>Cut list</h2><table class="grid"><tr><th>Item</th><th>Part</th><th>Qty</th><th>Long pt</th><th>Short pt</th><th>End 1</th><th>End 2</th></tr>${cutRows}</table>
    <p class="note">Measure the long point, mark the angle (part drawings, or the templates), and cut on the waste side. "Flush" ends sit flat on the member on top; "mitre" ends meet their partner on a shared line; "runs through" continues past the joint.</p>
    <h2>Cutting plan</h2><p class="note">${bars.length} stick${bars.length > 1 ? 's' : ''} of ${stock} mm, ${kerf} mm saw kerf.</p>${barSVG}</div>
    <div><h2>Joints</h2><table class="grid small"><tr><th>Joint</th><th>Members</th><th>On top</th><th>Others</th></tr>${jRows}</table></div></div>`);
  // 4. build steps
  if (opt.steps) {
    const order = [['bot', 'Lay the bottom chord'], ['top', 'Add the top chord'], ['end', 'Add the end posts'], ['vert', 'Glue in the verticals'], ['diag', 'Glue in the diagonals'], ['brace', 'Add the edge braces'], ['claw', 'Add the claws']];
    const done = new Set(); let stepNo = 0;
    const steps = order.map(([ty, title]) => {
      const ks = tr.elems.map((e, k) => e.type === ty ? k : -1).filter(k => k >= 0); if (!ks.length) return '';
      const hi = new Set(ks), gr = new Set(done); ks.forEach(k => done.add(k));
      const vv = sideSVG(tr, plan, { highlight: new Set([...hi, ...gr]), grey: gr, b, color: colourMode === 'part' ? 'part' : '#c0392b', dash });
      const its = {}; plan.pieces.filter(q => q.members.some(k => hi.has(k))).forEach(q => { its[q.item] = (its[q.item] || 0) + 1; });
      const callout = Object.entries(its).map(([no, c]) => `<div class="part"><b>${c}×</b> <span class="ball" style="${colourMode === 'part' ? `background:${colOf(+no)};color:#fff` : ''}">${no}</span> ${f1(plan.items[no - 1].long)}</div>`).join('');
      return `<div class="step"><div class="sn">${++stepNo}</div><div class="callout">${callout}</div><svg viewBox="${vv.box.join(' ')}">${vv.svg}</svg><p>${title}</p></div>`;
    }).filter(Boolean);
    for (let s0 = 0; s0 < steps.length; s0 += 4) sheet('Build steps', `<h2 style="margin:0 0 4px">Build steps <span class="note">(one truss; build ${nT === 2 ? 'the second' : 'the others'} the same way, then join them with the cross-ties)</span></h2><div class="steps">${steps.slice(s0, s0 + 4).join('')}</div>`);
  }
  // 5. full-size templates, tiled to fit the page
  let tplPages = '';
  if (opt.templates) {
    const tw = 240, th = 160, xs = tr.nodes.map(p => p[0]), ys = tr.nodes.map(p => p[1]);
    const X0 = Math.min(...xs) - 6, X1 = Math.max(...xs) + 6, Y0 = Math.min(...ys) - 6, Y1 = Math.max(...ys) + 6, hgt = Math.min(th, Y1 - Y0 + 24);
    const pieceOf = {}; plan.pieces.forEach(q => q.members.forEach(k => { pieceOf[k] = q; }));
    const edges = tr.elems.map((e, k) => { const p = tr.nodes[e.i], q = tr.nodes[e.j], d = unit(sub(q, p)), nv = mul(perp(d), b * Math.sqrt(e.n || 1) / 2);
      return `<polygon points="${[add(p, nv), add(q, nv), sub(q, nv), sub(p, nv)].map(z => `${z[0]},${Y1 - z[1]}`).join(' ')}" fill="${colourMode === 'part' ? colOf(pieceOf[k].item) : 'none'}" fill-opacity=".25" stroke="#000" stroke-width=".2"/><line x1="${p[0]}" y1="${Y1 - p[1]}" x2="${q[0]}" y2="${Y1 - q[1]}" stroke="#666" stroke-width=".15" stroke-dasharray="${dash ? dashOf(pieceOf[k].item) || '1 1' : '1 1'}"/>`; }).join('');
    const tiles = []; for (let tx = X0; tx < X1 - 1; tx += tw - 10) tiles.push(tx);
    tplPages = tiles.map((tx, i) => `<section class="sheet tpl"><p class="note">Full-size template · tile ${i + 1} of ${tiles.length} · print at 100% (actual size) and check that the bar measures 50 mm. Tiles overlap by 10 mm; line up the + marks.</p>
      <svg width="${tw}mm" height="${hgt}mm" viewBox="${tx} 0 ${tw} ${hgt}">${edges}
        <g stroke="#000" stroke-width=".3"><line x1="${tx + 5}" y1="${hgt - 6}" x2="${tx + 55}" y2="${hgt - 6}"/><line x1="${tx + 5}" y1="${hgt - 8}" x2="${tx + 5}" y2="${hgt - 4}"/><line x1="${tx + 55}" y1="${hgt - 8}" x2="${tx + 55}" y2="${hgt - 4}"/></g>
        <text x="${tx + 30}" y="${hgt - 1}" font-size="3" text-anchor="middle" font-family="Arial">50 mm</text>
        ${[tx + tw - 10, tx + 10].map(mx => `<path d="M${mx - 3} 6 h6 M${mx} 3 v6" stroke="#000" stroke-width=".3"/>`).join('')}</svg></section>`).join('');
  }
  const total = sheets.length;
  const html = sheets.map((s, i) => `<section class="sheet ${s.cls || ''}"><div class="frame"><div class="zones top"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="zones bot"><span>4</span><span>3</span><span>2</span><span>1</span></div><div class="content">${s.body}</div>
    <table class="title"><tr><td colspan="2" class="big">${esc(meta.name)}</td><td>SHEET ${i + 1} OF ${total}</td></tr>
    <tr><td>SE 310 Project I · balsa truss bridge</td><td>${esc(s.title)}</td><td>${today}</td></tr>
    <tr><td>Balsa ${b} × ${meta.h || b} mm</td><td>mm · angles from a square cut</td><td>${colourMode === 'part' ? 'colour = part' : 'black and white'}${dash ? ' · line pattern = part' : ''}</td></tr></table></div></section>`).join('');
  const css = `@page{size:letter landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#ddd}
    .sheet{width:263mm;height:199mm;margin:8mm auto;background:#fffdf5;padding:3mm;overflow:hidden;page-break-after:always;break-after:page;box-shadow:0 2px 10px rgba(0,0,0,.2)}
    .frame{border:.5mm solid #111;height:100%;position:relative;padding:6mm 5mm 22mm}
    .content{height:100%;overflow:hidden}
    .zones{position:absolute;left:0;right:0;display:flex;justify-content:space-around;font-size:8pt;color:#555}.zones.top{top:.5mm}.zones.bot{bottom:.5mm}
    .title{position:absolute;right:3mm;bottom:3mm;border-collapse:collapse;font-size:8pt;width:150mm;background:#fffdf5}.title td{border:.3mm solid #111;padding:1mm 2mm}.title .big{font-size:12pt;font-weight:bold}
    .parts{float:right;border-collapse:collapse;font-size:7.5pt;margin:0 0 3mm 4mm;background:#fffdf5}.parts th,.parts td{border:.25mm solid #111;padding:.6mm 1.6mm;text-align:center}.parts tr:first-child th{background:#eee}
    .view{width:100%;height:125mm;display:block}.note{font-size:8pt;color:#333}
    h2{font-size:11pt;margin:0 0 2mm}.two{display:grid;grid-template-columns:1.35fr 1fr;gap:6mm}
    .grid{border-collapse:collapse;font-size:8pt;width:100%}.grid th,.grid td{border:.25mm solid #444;padding:.8mm 1.6mm;text-align:left}.grid.small{font-size:7pt}
    .bar{display:flex;gap:2mm;align-items:center;font-size:7pt;margin:.6mm 0}.bar span{width:20mm}.bar svg{flex:1;height:5mm}
    .pgrid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4mm;height:100%}
    .pcard{border:.3mm solid #111;padding:2mm;display:flex;flex-direction:column;font-size:8pt}.ph{display:flex;gap:2mm;align-items:center}.ph .qty{margin-left:auto;font-weight:bold}
    .pd{width:100%;flex:1}.pf{font-size:7pt;color:#333}
    .sw{display:inline-block;width:3mm;height:3mm;border:.2mm solid #111;margin-right:1mm;vertical-align:middle}
    .steps{display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:3mm;height:calc(100% - 8mm)}
    .step{border:.4mm solid #3a6ea5;border-radius:3mm;padding:2mm;position:relative;background:#fff;display:flex;flex-direction:column}
    .step svg{width:100%;flex:1;min-height:0}.step p{margin:0;font-weight:bold;font-size:9pt}.sn{position:absolute;left:2mm;top:1mm;font-size:18pt;font-weight:bold;color:#3a6ea5}
    .callout{margin-left:10mm;display:flex;flex-wrap:wrap;gap:2mm;background:#e9f1fb;border-radius:2mm;padding:1mm 2mm;font-size:8.5pt}
    .ball{display:inline-block;border:.25mm solid #111;border-radius:50%;width:4.4mm;height:4.4mm;text-align:center;font-size:7pt;line-height:4.2mm;background:#fff;font-weight:bold}
    .tpl{height:auto;min-height:199mm}.tpl svg{display:block;margin:0 auto}
    @media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.name)} · build documents</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${html}${tplPages}</body></html>`;
}

const api = { jointsOf, defaultJoint, cutPlan, stockPlan, documentHTML, sideSVG, partDetail, cutTxt, TL, colOf, dashOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BuildDoc = api;
})(typeof window !== 'undefined' ? window : globalThis);
