// Shared SVG kit for the security chapters (6, 8): responsive scene mount, self-sizing pills, path helpers.
const SecKit = (() => {
  const { $, $$, el, clamp, lerp } = Hop;
  const REBUILD = [];
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => REBUILD.forEach(f => f()));
  let UID = 0;

  /* ---------- svg kit ---------- */
  function svgRoot(W, H) {
    const s = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene' });
    const id = 'mk' + (++UID);
    const cols = { ink: 'var(--ink)', rose: 'var(--c-rose)', muted: 'var(--muted)', teal: 'var(--c-teal)', blue: 'var(--c-blue)', amber: 'var(--c-amber)', violet: 'var(--c-violet)', green: 'var(--c-green)' };
    s.innerHTML = `<defs>${Object.entries(cols).map(([k, c]) => `<marker id="${id}-${k}" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M0 0.5L10 5L0 9.5z" fill="${c}"/></marker>`).join('')}</defs>`;
    s.mk = k => `url(#${id}-${k})`;
    s.W = W; s.H = H;
    return s;
  }
  const add = (svg, html) => svg.insertAdjacentHTML('beforeend', html);
  function cloud(cx, cy, w, h, label) {
    const b = [[-.36, .1, .42], [-.13, -.2, .56], [.15, -.16, .52], [.37, .08, .42], [0, .16, .5]].map(([dx, dy, r]) => `<circle cx="${cx + dx * w}" cy="${cy + dy * h}" r="${r * h}"/>`).join('');
    const base = `<rect x="${cx - .42 * w}" y="${cy - .05 * h}" width="${.84 * w}" height="${.52 * h}" rx="${.26 * h}"/>`;
    return `<g data-r="net"><g fill="var(--line-2)" stroke="var(--line-2)" stroke-width="5">${base}${b}</g><g fill="var(--surface)">${base}${b}</g>${label ? `<text x="${cx}" y="${cy + .34 * h}" text-anchor="middle" class="lb s">${label}</text>` : ''}</g>`;
  }
  function track(svg, d) { const p = el('path', { d, fill: 'none', stroke: 'none' }); svg.append(p); return p; }
  function at(p, f) { if (!p._L) p._L = p.getTotalLength(); const q = p.getPointAtLength(clamp(f, 0, 1) * p._L); return [q.x, q.y]; }
  function route(pts, f) { // even-split polyline
    const n = pts.length - 1, s = clamp(f, 0, 1) * n, i = Math.min(n - 1, Math.floor(s)), k = s - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  }
  // a label pill that sizes itself to its text
  function pill(svg, { c = 'var(--ink)', bg = 'var(--bg)', fs = 13, h = 26, anchor = 'middle' } = {}) {
    const g = el('g', { class: 'pkt' }), r = el('rect', { rx: 8, height: h, y: -h / 2, fill: bg, stroke: c, 'stroke-width': 2 });
    const tx = el('text', { y: fs * .36, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 600, style: `fill:${c}` });
    g.append(r, tx); svg.append(g); g.style.opacity = 0;
    let cur = null, w = 0;
    const api = {
      text(s, col) {
        if (s !== cur) { cur = s; tx.textContent = s; w = (tx.getComputedTextLength() || s.length * 7) + 20; r.setAttribute('width', w); r.setAttribute('x', -w / 2); }
        if (col) { tx.style.fill = col; r.setAttribute('stroke', col); }
        return api;
      },
      at(x, y, op = 1) {
        let cx = anchor === 'end' ? x - w / 2 : anchor === 'start' ? x + w / 2 : x;
        cx = clamp(cx, w / 2 + 3, svg.W - w / 2 - 3);
        g.setAttribute('transform', `translate(${cx.toFixed(1)} ${y.toFixed(1)})`); g.style.opacity = op; return api;
      },
      hide() { g.style.opacity = 0; return api; },
      g,
      get w() { return w; },
    };
    return api;
  }
  const lbl = (x, y, t, { c, anchor = 'middle', cls = 'lb', r } = {}) => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}"${c ? ` style="fill:${c}"` : ''}${r ? ` data-r="${r}"` : ''}>${t}</text>`;
  const ramp = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  // mount a responsive scene: build(stage, mob) -> S ; draw(S) ; rebuilds when crossing the phone breakpoint
  function mount(stage, build, draw) {
    let mob = null, S = null;
    const go = () => { mob = stage.clientWidth < 560; S = build(stage, mob); draw(S); };
    const onR = () => { if (!stage.isConnected) { removeEventListener('resize', onR); return; } if ((stage.clientWidth < 560) !== mob) go(); };
    addEventListener('resize', onR); REBUILD.push(() => { if (stage.isConnected) go(); });
    go();
    return { redraw: () => S && draw(S), get S() { return S; } };
  }

  function star(cx, cy, R, r, n) { let s = ''; for (let i = 0; i < n * 2; i++) { const a = Math.PI * i / n - Math.PI / 2, rr = i % 2 ? r : R; s += `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)} `; } return s; }
  const gaugeSet = (gEl, f) => { if (!gEl) return; const H = 40 * clamp(f, 0, 1); gEl.setAttribute('height', H); gEl.setAttribute('y', +gEl.previousElementSibling.getAttribute('y') + 40 - H); };
  return { svgRoot, add, cloud, track, at, route, pill, lbl, ramp, mount, star, gaugeSet, REBUILD };
})();
