// Shared helpers for chapter 2 (routing) and chapter 3 (rip): pixel-true topology SVG, route lines, RIP simulator.
const RT = (() => {
  const { el, esc, clamp, lerp } = Hop;

  /* pixel-true SVG: the viewBox width equals the on-screen width, so a 12px label is 12px on a phone too */
  function fit(host, render) {
    const svg = el('svg', { class: 'pt' });
    host.append(svg);
    const api = { svg, W: 0, h: 0, after: null, draw };
    function draw() {
      const w = Math.round(svg.getBoundingClientRect().width) || host.clientWidth || 600;
      api.W = w;
      const r = render(w);
      api.h = r.h;
      svg.setAttribute('viewBox', `0 0 ${w} ${r.h}`);
      svg.innerHTML = r.html;
      if (api.after) api.after();
    }
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const w = Math.round(svg.getBoundingClientRect().width); if (w && Math.abs(w - api.W) > 1) draw(); }); }).observe(host);
    return api;
  }

  /* topology layout: node positions are [fraction of width, y px] per orientation (h = wide, v = phone) */
  function layout(spec, W) {
    const o = W < (spec.bp != null ? spec.bp : 560) ? 'v' : 'h';
    const P = {};
    spec.nodes.forEach(n => { const p = n[o] || n.h; P[n.id] = { x: Math.round(p[0] * W), y: p[1], n }; });
    return { o, P, H: (spec.H && (spec.H[o] || spec.H.h)) || 300 };
  }
  const tw = (s, px = 12) => String(s).length * px * .6 + 14; // rough mono width
  // a tappable text label with a padded hit box
  function tag(x, y, text, { anchor = 'middle', cls = 'nl', k, id, px = 12.5 } = {}) {
    const w = tw(text, px), x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + 7 : x - 7;
    return `<g class="tag${k ? ' hot' : ''}"${k ? ` data-k="${k}"` : ''}${id ? ` data-tag="${id}"` : ''}><rect class="tagbg" x="${x0}" y="${y - 15}" width="${w}" height="26" rx="8"/><text class="${cls}" x="${x}" y="${y + 3}" text-anchor="${anchor}">${esc(text)}</text></g>`;
  }
  function linkPath(l, P) {
    const a = P[l.a], b = P[l.b];
    if (l.bend) { const mx = (a.x + b.x) / 2 + (l.bend[0] || 0), my = (a.y + b.y) / 2 + (l.bend[1] || 0); return { d: `M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`, mid: { x: (a.x + 2 * mx + b.x) / 4, y: (a.y + 2 * my + b.y) / 4 } }; }
    return { d: `M${a.x} ${a.y}L${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
  function links(spec, L) {
    let s = '';
    for (const l of spec.links) {
      const { d, mid } = linkPath(l, L.P);
      s += `<g class="lk" data-link="${l.id}"><path class="ln${l.cls ? ' ' + l.cls : ''}" d="${d}"/>${l.cut ? `<path class="hit" d="${d}" data-cut="${l.id}"/>` : ''}</g>`;
    }
    for (const l of spec.links) {
      const a = L.P[l.a], b = L.P[l.b], { mid } = linkPath(l, L.P);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const horiz = Math.abs(dx) >= Math.abs(dy);
      const lp = (l.lpos && l.lpos[L.o]) || (horiz ? 'a' : 'r');
      if (l.label) {
        const off = l.loff || 0;
        if (lp === 'a') s += tag(mid.x, mid.y - 15 + off, l.label, { k: l.k || 'network', id: l.id, cls: l.lcls || 'nl' });
        else if (lp === 'b') s += tag(mid.x, mid.y + 17 + off, l.label, { k: l.k || 'network', id: l.id, cls: l.lcls || 'nl' });
        else if (lp === 'l') s += tag(mid.x - 12, mid.y + off, l.label, { anchor: 'end', k: l.k || 'network', id: l.id, cls: l.lcls || 'nl' });
        else s += tag(mid.x + 12, mid.y + off, l.label, { anchor: 'start', k: l.k || 'network', id: l.id, cls: l.lcls || 'nl' });
      }
      // interface labels: 'a' end above the line, 'b' end below (horizontal); both left (vertical)
      const ifl = (end, txt, which) => {
        if (!txt) return '';
        const p = end === 'a' ? a : b, sg = end === 'a' ? 1 : -1, d0 = l.ifd || 30;
        const x = p.x + ux * d0 * sg, y = p.y + uy * d0 * sg;
        if (horiz) { const below = which === 'b'; return tag(x + (sg > 0 ? -2 : 2) * (ux > 0 ? 1 : -1), y + (below ? 18 : -12), txt, { anchor: (ux * sg > 0) ? 'start' : 'end', cls: 'il', k: 'iface', px: 12 }); }
        const vs = l.vside || (Math.abs(dx) > 8 && dx * sg > 0 ? 'r' : 'l');
        return vs === 'r' ? tag(x + 10, y, txt, { anchor: 'start', cls: 'il', k: 'iface', px: 12 }) : tag(x - 10, y, txt, { anchor: 'end', cls: 'il', k: 'iface', px: 12 });
      };
      s += ifl('a', l.ia, l.iaPos || 'b') + ifl('b', l.ib, l.ibPos || 'b');
    }
    return s;
  }
  function node(n, p, o, extra = '') {
    const side = (n.side && (n.side[o] || n.side.h)) || 'b', sc = n.s || .9;
    let lab = '';
    const nm = n.label ? esc(n.label) : '', sub = n.sub ? esc(n.sub) : '';
    if (side === 'b') lab = (nm ? `<text class="dn" x="${p.x}" y="${p.y + 40}" text-anchor="middle">${nm}</text>` : '') + (sub ? `<text class="ds" x="${p.x}" y="${p.y + 56}" text-anchor="middle">${sub}</text>` : '');
    else if (side === 't') lab = (nm ? `<text class="dn" x="${p.x}" y="${p.y - (sub ? 46 : 31)}" text-anchor="middle">${nm}</text>` : '') + (sub ? `<text class="ds" x="${p.x}" y="${p.y - 30}" text-anchor="middle">${sub}</text>` : '');
    else { const r = side === 'r', x = p.x + (r ? 28 : -28), an = r ? 'start' : 'end'; lab = (nm ? `<text class="dn" x="${x}" y="${p.y + (sub ? -3 : 5)}" text-anchor="${an}">${nm}</text>` : '') + (sub ? `<text class="ds" x="${x}" y="${p.y + 14}" text-anchor="${an}">${sub}</text>` : ''); }
    return `<g class="nd${n.k ? ' hot' : ''}" data-id="${n.id}"${n.k ? ` data-k="${n.k}"` : ''}><circle class="ring" cx="${p.x}" cy="${p.y}" r="28"/>${Hop.dev(n.type, p.x, p.y, { s: sc, c: n.c })}${lab}${extra}</g>`;
  }
  function nodes(spec, L) { return spec.nodes.map(n => node(n, L.P[n.id], L.o)).join(''); }
  const envelope = (id, c = 'var(--c-blue)', cls = '') => `<g class="pkt ${cls}" ${id ? `id="${id}"` : ''} style="--pc:${c}" opacity="0"><rect x="-13" y="-9.5" width="26" height="19" rx="5"/><path d="M-12 -7.5 L0 1.5 L12 -7.5"/></g>`;

  // point along a polyline at fraction f (by length)
  function along(pts, f) {
    const segs = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); tot += d; }
    let rem = clamp(f, 0, 1) * tot;
    for (let i = 0; i < segs.length; i++) { if (rem <= segs[i] || i === segs.length - 1) { const k = segs[i] ? rem / segs[i] : 0; return { x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) }; } rem -= segs[i]; }
    return pts[pts.length - 1];
  }
  const place = (g, p, op = 1) => { if (!g) return; g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); g.setAttribute('opacity', op); };

  /* IPv4 helpers (no IP calculation is asked in this part, these only drive the figures) */
  const ip = s => s.split('.').reduce((a, o) => a * 256 + +o, 0) >>> 0;
  const mask = p => p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
  const inNet = (d, net, p) => ((ip(d) & mask(p)) >>> 0) === ip(net);

  /* a route line as tappable fields: [{t, k, c, f}] -> html */
  const fieldHtml = (f) => f.k ? `<button class="rf${f.c ? ' c-' + f.c : ''}" data-f="${f.f || ''}" data-k="${f.k}">${esc(f.t)}</button>` : `<span class="rf plain">${esc(f.t)}</span>`;

  /* RIP simulator: routers {id, ifs:[{n: ifname, net}]}, nets {id: {name, lan}}; returns rounds of tables until stable */
  function ripSim(routers, { split = true, maxRounds = 20 } = {}) {
    const byNet = {};
    routers.forEach(r => r.ifs.forEach(f => (byNet[f.net] = byNet[f.net] || []).push({ r: r.id, ifc: f.n })));
    let T = {};
    routers.forEach(r => { T[r.id] = {}; r.ifs.forEach(f => { T[r.id][f.net] = { hop: 0, ifc: f.n, via: null, isNew: true }; }); });
    const rounds = [{ T: clone(T), msgs: [] }];
    Object.values(T).forEach(t => Object.values(t).forEach(e => e.isNew = false));
    for (let k = 0; k < maxRounds; k++) {
      const snap = clone(T), msgs = [];
      let changed = false;
      routers.forEach(r => r.ifs.forEach(f => {
        (byNet[f.net] || []).filter(x => x.r !== r.id).forEach(nb => {
          // r sends its table out f to nb (arrives on nb.ifc)
          const entries = Object.entries(snap[r.id]).filter(([net, e]) => !(split && e.via && e.ifc === f.n)).map(([net, e]) => ({ net, hop: e.hop }));
          const res = entries.map(en => {
            const cand = en.hop + 1, cur = T[nb.r][en.net];
            let act;
            if (cand > 15) act = 'drop16';
            else if (!cur) { T[nb.r][en.net] = { hop: cand, ifc: nb.ifc, via: r.id, isNew: true }; act = 'new'; changed = true; }
            else if (cand < cur.hop) { T[nb.r][en.net] = { hop: cand, ifc: nb.ifc, via: r.id, isNew: true }; act = 'better'; changed = true; }
            else if (cand === cur.hop && cur.via && cur.via !== r.id) act = 'tie';
            else act = 'keep';
            return { ...en, cand, act, had: cur ? cur.hop : null };
          });
          msgs.push({ from: r.id, to: nb.r, out: f.n, inIf: nb.ifc, net: f.net, entries: res });
        });
      }));
      rounds.push({ T: clone(T), msgs, changed });
      Object.values(T).forEach(t => Object.values(t).forEach(e => e.isNew = false));
      if (!changed) break;
    }
    return rounds;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* BFS hop answer for a converged RIP table of router `me` (ties keep every equal exit) */
  function ripAnswer(routers, me) {
    const R = Object.fromEntries(routers.map(r => [r.id, r]));
    const byNet = {}; routers.forEach(r => r.ifs.forEach(f => (byNet[f.net] = byNet[f.net] || []).push({ r: r.id, ifc: f.n })));
    const dist = { [me]: 0 }, first = { [me]: [] }, path = { [me]: [me] };
    const q = [me];
    while (q.length) {
      const u = q.shift();
      R[u].ifs.forEach(f => (byNet[f.net] || []).forEach(nb => {
        if (nb.r === u) return;
        const d = dist[u] + 1;
        const exits = u === me ? [f.n] : first[u];
        if (dist[nb.r] == null) { dist[nb.r] = d; first[nb.r] = [...exits]; path[nb.r] = [...path[u], nb.r]; q.push(nb.r); }
        else if (dist[nb.r] === d) exits.forEach(x => { if (!first[nb.r].includes(x)) first[nb.r].push(x); });
      }));
    }
    const out = {};
    Object.keys(byNet).forEach(net => {
      let best = null;
      byNet[net].forEach(({ r }) => { if (dist[r] == null) return; if (!best || dist[r] < best.hop) best = { hop: dist[r], ifs: r === me ? [R[me].ifs.find(f => f.net === net).n] : [...first[r]], at: r, path: path[r] }; else if (dist[r] === best.hop && r !== me) first[r].forEach(x => { if (!best.ifs.includes(x)) best.ifs.push(x); }); });
      out[net] = best;
    });
    return out;
  }

  return { fit, layout, tag, links, node, nodes, linkPath, envelope, along, place, ip, mask, inNet, fieldHtml, ripSim, ripAnswer, tw };
})();
