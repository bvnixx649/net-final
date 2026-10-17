// OSPF chapter: map hero (same LSDB, own SPF tree), LS vs DV view, operation steps, neighbor states, DR/BDR, areas, cost, SPF walk-through, comparison, drill.
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, easeIO, icon } = Hop;
  Hop.page(5);
  const b = (c, v) => `<b class="c-${c}">${v}</b>`;
  const fmt = n => Number(n).toLocaleString('en-US');

  /* ---------- the slide topology (Routing-3 p8-10) ---------- */
  const POS = { R1: [50, 150], R2: [180, 52], R3: [180, 150], R4: [180, 248], R5: [310, 150] };
  const LINKS = [
    { a: 'R1', b: 'R2', c: 20, net: '10.2.0.0' }, { a: 'R1', b: 'R3', c: 5, net: '10.3.0.0' }, { a: 'R1', b: 'R4', c: 20, net: '10.4.0.0' },
    { a: 'R3', b: 'R4', c: 10, net: '10.7.0.0' }, { a: 'R2', b: 'R5', c: 10, net: '10.9.0.0' }, { a: 'R4', b: 'R5', c: 10, net: '10.10.0.0' },
  ];
  const LANS = { R1: '10.1.0.0', R2: '10.5.0.0', R3: '10.6.0.0', R4: '10.8.0.0', R5: '10.11.0.0' };
  const LANC = 2;
  const STUB = { R1: [14, 150, 'v'], R2: [180, 14, 'h'], R3: [222, 150, 'v'], R4: [180, 286, 'h'], R5: [346, 150, 'v'] };
  const NAME = { R1: [0, 42, 'middle'], R2: [28, 6, 'start'], R3: [0, -27, 'middle'], R4: [28, 6, 'start'], R5: [0, 42, 'middle'] };
  const OFF = { R1: [0, -36], R2: [-50, 0], R3: [32, -24], R4: [-50, 0], R5: [0, -36] };
  const RS = Object.keys(POS);

  function dijkstra(root, links = LINKS) {
    const dist = {}, prev = {}, done = new Set(), steps = [];
    RS.forEach(r => dist[r] = Infinity); dist[root] = 0;
    while (done.size < RS.length) {
      let u = null;
      RS.forEach(r => { if (!done.has(r) && dist[r] < Infinity && (u === null || dist[r] < dist[u])) u = r; });
      if (!u) break;
      done.add(u);
      const upd = [];
      links.forEach(l => {
        const v = l.a === u ? l.b : l.b === u ? l.a : null;
        if (!v || done.has(v)) return;
        if (dist[u] + l.c < dist[v]) { upd.push({ v, from: dist[v], to: dist[u] + l.c, c: l.c }); dist[v] = dist[u] + l.c; prev[v] = u; }
      });
      steps.push({ u, dist: { ...dist }, prev: { ...prev }, done: [...done], upd });
    }
    return { dist, prev, steps };
  }
  const pathTo = (prev, r) => { const p = [r]; while (prev[p[0]]) p.unshift(prev[p[0]]); return p; };
  function routes(root, links = LINKS) {
    const { dist, prev } = dijkstra(root, links);
    const rows = [];
    Object.entries(LANS).forEach(([r, net]) => { if (r !== root && dist[r] < Infinity) rows.push({ net, cost: dist[r] + LANC, path: pathTo(prev, r) }); });
    links.forEach(l => {
      if (l.a === root || l.b === root) return;
      const via = dist[l.a] <= dist[l.b] ? l.a : l.b;
      rows.push({ net: l.net, cost: dist[via] + l.c, path: pathTo(prev, via) });
    });
    rows.sort((x, y) => +x.net.split('.')[1] - +y.net.split('.')[1]);
    return rows;
  }
  const treeLinks = (prev, links = LINKS) => links.map((l, i) => (prev[l.b] === l.a || prev[l.a] === l.b) ? i : -1).filter(i => i >= 0);

  // draws the 5-router network; returns handles for highlighting
  function Net(host, { keys = false, onPick = null } = {}) {
    const box = el('div', { class: 'topo onet' }); host.append(box);
    let s = '';
    RS.forEach(r => { const [x, y] = POS[r], [sx, sy, o] = STUB[r]; s += `<g class="lan" data-r="${r}"><line x1="${x}" y1="${y}" x2="${sx}" y2="${sy}"/>${o === 'v' ? `<line class="bar" x1="${sx}" y1="${sy - 15}" x2="${sx}" y2="${sy + 15}"/>` : `<line class="bar" x1="${sx - 15}" y1="${sy}" x2="${sx + 15}" y2="${sy}"/>`}</g>`; });
    LINKS.forEach((l, i) => { const [x1, y1] = POS[l.a], [x2, y2] = POS[l.b]; s += `<line class="lk" data-l="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="tr" data-l="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="100"/>`; });
    LINKS.forEach((l, i) => { const [x1, y1] = POS[l.a], [x2, y2] = POS[l.b]; const w = String(l.c).length * 8 + 14; s += `<g class="pill pcost" data-l="${i}"${keys ? ' data-k="cost"' : ''} transform="translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})"><rect rx="9" height="24" y="-12" x="${-w / 2}" width="${w}"/><text y="5" text-anchor="middle">${l.c}</text></g>`; });
    s += '<g class="dots"></g>';
    RS.forEach(r => {
      const [x, y] = POS[r], [nx, ny, na] = NAME[r], [ox, oy] = OFF[r];
      s += `<g class="rn" data-r="${r}" transform="translate(${x} ${y})"><circle class="halo" r="26"/><g class="gl">${Hop.dev('router', 0, 0, { c: 'currentColor', s: .9 })}</g>` +
        `<text class="nm" x="${nx}" y="${ny}" text-anchor="${na}">${r}</text>` +
        `<g class="badge" transform="translate(${ox} ${oy})"><rect x="-23" y="-11" width="46" height="22" rx="7"/><text y="4.5" text-anchor="middle">LSDB</text></g>` +
        `<g class="dl" transform="translate(${ox} ${oy})"><rect y="-12" height="24" rx="8"/><text y="5" text-anchor="middle"></text></g></g>`;
    });
    const svg = el('svg', { viewBox: '0 0 360 300', class: 'tsvg' }); svg.innerHTML = s; box.append(svg);
    if (onPick) svg.addEventListener('click', e => { const g = e.target.closest('.rn'); if (g) onPick(g.dataset.r); });
    const dotsG = $('.dots', svg);
    return {
      svg,
      cls(c) { svg.setAttribute('class', 'tsvg ' + c); },
      tree(idx = [], cls = 'on') { $$('.tr', svg).forEach(t => t.classList.toggle(cls, idx.includes(+t.dataset.l))); },
      node(r, c) { const g = $(`.rn[data-r="${r}"]`, svg); g.setAttribute('class', 'rn ' + (c || '')); },
      link(i, c) { $(`.lk[data-l="${i}"]`, svg).setAttribute('class', 'lk ' + (c || '')); },
      dist(r, v) { const g = $(`.rn[data-r="${r}"] .dl`, svg); const t = $('text', g), rc = $('rect', g); if (v == null) { g.style.opacity = 0; return; } g.style.opacity = 1; t.textContent = v; const w = String(v).length * 8 + 14; rc.setAttribute('width', w); rc.setAttribute('x', -w / 2); },
      // dots along links: list of [linkIndex, fromRouter], fraction f
      dots(list, f, color) {
        while (dotsG.children.length < list.length) dotsG.append(el('circle', { r: 6 }));
        [...dotsG.children].forEach((d, k) => {
          if (k >= list.length || f <= 0 || f >= 1) { d.setAttribute('opacity', 0); return; }
          const [i, from] = list[k], l = LINKS[i], A = POS[from], B = POS[from === l.a ? l.b : l.a], e = easeIO(f);
          d.setAttribute('cx', lerp(A[0], B[0], e)); d.setAttribute('cy', lerp(A[1], B[1], e)); d.setAttribute('fill', color);
          d.setAttribute('opacity', f < .1 ? f / .1 : f > .9 ? (1 - f) / .1 : 1);
        });
      },
    };
  }
  const bothWays = (idx = LINKS.map((_, i) => i)) => idx.flatMap(i => [[i, LINKS[i].a], [i, LINKS[i].b]]);
  const rtRows = (rows, mark = []) => `<div class="rt"><div class="rh"><span>ปลายทาง</span><span>เส้นทาง</span><span>cost</span></div>` + rows.map(r => `<div class="rr${mark.includes(r.net) ? ' chg' : ''}"><span>${r.net}/16</span><span>${r.path.join(' → ')}</span><span>${r.cost}</span></div>`).join('') + '</div>';

  /* ---------- map hero: same LSDB everywhere, own routing table ---------- */
  (() => {
    const host = $('#map');
    let root = 'R1';
    host.append(el('p', { class: 'lbl', text: 'เครือข่ายในสไลด์: router 5 ตัว ตัวเลขบนลิงก์คือ cost แตะ router แต่ละตัวเพื่อดูตารางของมัน' }));
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const net = Net(left, { keys: true, onPick: r => { root = r; draw(); } });
    const pick = el('div', { class: 'chips' }, RS.map(r => el('button', { class: 'chip', text: r, onclick: () => { root = r; draw(); } })));
    const nb = el('div', { class: 'blk' }), db = el('div', { class: 'blk' }), rt = el('div', { class: 'blk' });
    right.append(pick, nb, db, rt);
    const head = (k, t, sub) => `<button class="bh" data-k="${k}"><span>${t}</span>${icon('chev')}</button>${sub ? `<div class="bs">${sub}</div>` : ''}`;
    db.innerHTML = head('lsdb', `<span class="c-blue">LSDB</span>`, 'ทุก router ใน area มีชุดนี้เหมือนกันทุกตัว') + `<div class="lsdb">${LINKS.map(l => `<span>${l.a}–${l.b} <b>${l.c}</b></span>`).join('')}<span>LAN ทุกวง <b>2</b></span></div>`;
    function draw() {
      $$('.chip', pick).forEach(c => c.setAttribute('aria-pressed', String(c.textContent === root)));
      const { prev } = dijkstra(root);
      RS.forEach(r => net.node(r, r === root ? 'on root' : ''));
      net.tree([]);
      requestAnimationFrame(() => net.tree(treeLinks(prev)));
      const nbs = LINKS.filter(l => l.a === root || l.b === root).map(l => `${l.a === root ? l.b : l.a} <span class="muted">cost ${l.c}</span>`);
      nb.innerHTML = head('nbrtbl', `<span class="c-teal">Neighbor table</span> ของ ${root}`) + `<div class="nbl">${nbs.map(x => `<span>${x}</span>`).join('')}</div>`;
      rt.innerHTML = head('rtbl', `<span class="c-green">Routing table</span> ของ ${root}`, `ได้จาก ${Hop.t('spf', 'SPF')} ที่มี ${root} เป็นราก (เส้นสีม่วงคือ SPF tree)`) + rtRows(routes(root));
      db.classList.remove('flash'); void db.offsetWidth; db.classList.add('flash');
    }
    draw();
  })();

  /* ---------- link state vs distance vector view from R1 ---------- */
  (() => {
    const host = $('#fig-view');
    let mode = 'ls', raf = 0;
    const seg = el('div', { class: 'seg', role: 'group' },
      el('button', { 'aria-pressed': 'true', text: 'Link state (OSPF)', onclick: () => set('ls') }),
      el('button', { 'aria-pressed': 'false', text: 'Distance vector', onclick: () => set('dv') }));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 14px' }, seg));
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const net = Net(left);
    const side = el('div'); right.append(side);
    function set(m) {
      mode = m;
      $$('button', seg).forEach((x, i) => x.setAttribute('aria-pressed', String((i === 0) === (m === 'ls'))));
      net.cls('view-' + m);
      RS.forEach(r => net.node(r, r === 'R1' ? 'on root' : ['R2', 'R3', 'R4'].includes(r) ? 'nbr' : 'far'));
      LINKS.forEach((l, i) => net.link(i, l.a === 'R1' || l.b === 'R1' ? 'near' : 'farl'));
      if (m === 'ls') {
        side.innerHTML = `<p class="sayp">R1 รู้ทุกลิงก์และ cost ของมันครบ (${b('blue', 'LSDB')}) เหมือนที่ R2 ถึง R5 รู้ R1 จึงคำนวณได้เองว่าไป 10.11.0.0/16 ทางที่ดีที่สุดคือ R1 → R3 → R4 → R5 cost 5 + 10 + 10 + 2 = ${b('green', '27')}</p><p class="sayp muted">สิ่งที่วิ่งในเครือข่ายคือ LSA ที่บอกสถานะลิงก์ ส่งเฉพาะตอนลิงก์เปลี่ยน</p>`;
      } else {
        side.innerHTML = `<p class="sayp">R1 ไม่เห็นอะไรหลังเพื่อนบ้าน ได้ยินแค่ตัวเลขที่เพื่อนบ้านบอกมาว่า "ไป 10.11.0.0/16 ได้ ระยะเท่านี้" แล้วบวกระยะถึงเพื่อนบ้านเอง:</p>` +
          `<div class="rumor"><div><b>R2</b> บอก 12 <span class="muted">+ 20 =</span> 32</div><div class="win"><b>R3</b> บอก 22 <span class="muted">+ 5 =</span> 27</div><div><b>R4</b> บอก 12 <span class="muted">+ 20 =</span> 32</div></div>` +
          `<p class="sayp">ได้คำตอบเดียวกัน (ไปทาง R3, 27) แต่ R1 ไม่รู้ว่าเส้นทางจริงผ่านใครบ้าง และต้องรอเพื่อนบ้านส่งตารางมาเป็นรอบๆ (RIP ทุก 30 วินาที)</p>`;
      }
      play();
    }
    function play() {
      cancelAnimationFrame(raf);
      const t0 = performance.now(), dur = 1400;
      const list = mode === 'ls' ? bothWays() : LINKS.map((l, i) => l.a === 'R1' ? [i, l.b] : l.b === 'R1' ? [i, l.a] : null).filter(Boolean);
      const tick = now => { const f = (now - t0) / dur; net.dots(list, f, mode === 'ls' ? 'var(--c-amber)' : 'var(--ink)'); if (f < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    set('ls');
    Hop.onView(host, play);
  })();
  Hop.mcq($('#q-view'), {
    q: 'ข้อใดถูกเกี่ยวกับ LSDB และ routing table ของ router ใน area เดียวกัน',
    opts: ['LSDB เหมือนกันทุกตัว แต่ routing table ต่างกัน', 'LSDB และ routing table เหมือนกันทุกตัว', 'LSDB ต่างกัน แต่ routing table เหมือนกัน', 'แต่ละตัวมีแค่ routing table ไม่มี LSDB'], a: 0,
    whyWrong: { 1: 'routing table ไม่เหมือนกัน เพราะแต่ละตัวรัน SPF โดยมีตัวเองเป็นราก เส้นทางจาก R1 กับจาก R5 จึงต่างกัน (ลองแตะ router ในรูปแรก)', 2: 'กลับกัน LSDB คือแผนที่ชุดเดียวกันที่ทุกตัวได้จากการ flood LSA', 3: 'นั่นคือลักษณะของ distance vector แบบ RIP OSPF เก็บ neighbor table, LSDB และ routing table' },
    why: 'ทุกตัวได้ LSA ชุดเดียวกันจึงมี LSDB เหมือนกัน แต่ SPF tree ของแต่ละตัวมีรากเป็นตัวเอง routing table จึงต่างกัน',
  });

  /* ---------- operation steps on the topology ---------- */
  (() => {
    const host = $('#fig-ops');
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const net = Net(left);
    const panel = el('div', { class: 'blk ops' }); right.append(panel);
    const say = el('p', { class: 'say' }); host.append(say);
    const steps = $$('#steps li');
    const broken = LINKS.filter(l => !(l.a === 'R1' && l.b === 'R3'));
    const before = routes('R1'), after = routes('R1', broken);
    const changed = after.filter(r => { const o = before.find(x => x.net === r.net); return !o || o.cost !== r.cost || o.path.join() !== r.path.join(); }).map(r => r.net);
    const rid = LINKS.findIndex(l => l.a === 'R1' && l.b === 'R3');
    const P = [
      { h: 'ยังไม่มีอะไร', html: `<div class="bs">เพิ่งเปิดเครื่อง router รู้แค่ลิงก์ของตัวเอง ยังไม่รู้ว่ามีเพื่อนบ้านเป็นใคร</div>`, say: `เปิดเครื่องใหม่ router แต่ละตัวรู้แค่ interface ของตัวเอง neighbor table ยังว่าง` },
      { h: `<span class="c-teal">Neighbor table</span> ของ R1`, html: `<div class="nbl"><span>R2</span><span>R3</span><span>R4</span></div><div class="bs">Hello: multicast 224.0.0.5 ทุก 10 วินาที, dead interval 40 วินาที</div>`, say: `${b('teal', 'ขั้น 1 Hello')}: ทุกตัวส่ง Hello ออกทุก interface ใครตอบกลับก็กลายเป็นเพื่อนบ้าน เกิด adjacency และบันทึกใน neighbor table` },
      { h: `<span class="c-amber">LSA</span> ที่ R1 ส่งออกไป`, html: `<div class="nbl"><span>R1–R2 cost 20</span><span>R1–R3 cost 5</span><span>R1–R4 cost 20</span><span>LAN 10.1.0.0 cost 2</span></div><div class="bs">ทุกตัวส่ง LSA ของตัวเองแบบนี้ และส่งต่อของคนอื่นไปทั่ว area (flooding)</div>`, say: `${b('amber', 'ขั้น 2 แลก LSA')}: แต่ละตัวประกาศสถานะและ cost ของลิงก์ที่ต่อกับตัวเอง แล้ว LSA ถูกส่งต่อจนถึงทุกตัวใน area` },
      { h: `<span class="c-blue">LSDB</span> (เหมือนกันทั้ง 5 ตัว)`, html: `<div class="lsdb">${LINKS.map(l => `<span>${l.a}–${l.b} <b>${l.c}</b></span>`).join('')}<span>LAN ทุกวง <b>2</b></span></div>`, say: `${b('blue', 'ขั้น 3 สร้าง LSDB')}: รวม LSA ทั้งหมดเป็น topology table ทุกตัวได้แผนที่ฉบับเดียวกัน (show ip ospf database)` },
      { h: `<span class="c-violet">SPF tree</span> ของ R1`, html: `<div class="nbl"><span>R1 0</span><span>R3 5</span><span>R4 15</span><span>R2 20</span><span>R5 25</span></div><div class="bs">เส้นสีม่วงคือทางที่สั้นที่สุดจาก R1 ไปทุกตัว</div>`, say: `${b('violet', 'ขั้น 4 รัน SPF')}: R1 รัน Dijkstra บน LSDB โดยตั้งตัวเองเป็นราก ได้ต้นไม้เส้นทางสั้นที่สุด (ตัวอื่นก็รันของตัวเองเหมือนกัน)` },
      { h: `<span class="c-green">Routing table</span> ของ R1`, html: rtRows(before), say: `${b('green', 'ขั้น 5 Routing table')}: เส้นทางที่ดีที่สุดจาก SPF tree ถูกใส่ลง routing table พร้อม cost รวม ตรงกับตารางในสไลด์ ถึงจุดนี้เรียกว่า converge แล้ว` },
      { h: `<span class="c-green">Routing table</span> ใหม่ของ R1`, html: rtRows(after, changed), say: `หลังจากนั้น OSPF ไม่ส่งอะไรเป็นรอบๆ นอกจาก Hello จนกว่าจะมีการเปลี่ยนแปลง: ลิงก์ ${b('rose', 'R1–R3 ขาด')} → R1 กับ R3 flood ${b('amber', 'LSA')} ใหม่ → ทุกตัวอัปเดต LSDB แล้วรัน ${b('violet', 'SPF')} ใหม่ แถวที่เปลี่ยนถูกไฮไลต์` },
    ];
    let lastK = -1;
    Hop.scrub(host, {
      stops: [{ label: '<span class="k">เริ่ม</span> เปิดเครื่อง' }, { label: '<span class="k">1</span> Hello หาเพื่อนบ้าน' }, { label: '<span class="k">2</span> แลก LSA' }, { label: '<span class="k">3</span> สร้าง LSDB' }, { label: '<span class="k">4</span> รัน SPF' }, { label: '<span class="k">5</span> Routing table' }, { label: '<span class="k">หลังจากนั้น</span> ลิงก์ขาด' }],
      speed: 1700,
      onFrame(t) {
        const i = Math.floor(t), f = t - i, k = Math.round(t);
        if (i === 0) net.dots(bothWays(), f, 'var(--c-teal)');
        else if (i === 1) net.dots(bothWays(), f, 'var(--c-amber)');
        else if (i === 5) net.dots(bothWays(LINKS.map((_, j) => j).filter(j => j !== rid && ['R1', 'R3'].some(r => LINKS[j].a === r || LINKS[j].b === r))).filter(([j, from]) => from === 'R1' || from === 'R3'), f, 'var(--c-amber)');
        else net.dots([], 0);
        if (k === lastK) return; lastK = k;
        net.cls('ops k' + k);
        LINKS.forEach((l, j) => net.link(j, j === rid && k === 6 ? 'down' : k === 1 ? 'hello' : ''));
        RS.forEach(r => net.node(r, (k === 4 || k === 5 || k === 6) && r === 'R1' ? 'on root' : ''));
        const { prev } = dijkstra('R1', k === 6 ? broken : LINKS);
        net.tree(k >= 4 ? treeLinks(prev) : []);
        panel.innerHTML = `<div class="bh plain">${P[k].h}</div>` + P[k].html;
        say.innerHTML = P[k].say;
        steps.forEach((li, j) => li.classList.toggle('on', j === k - 1 || (k === 6 && j === 1)));
      },
    });
  })();
  Hop.mcq($('#q-ops'), {
    q: 'หลังจาก router ส่ง Hello จนได้ adjacency กับเพื่อนบ้านแล้ว ขั้นต่อไปของ OSPF คืออะไร',
    opts: ['แลก LSA ที่บอกสถานะและ cost ของลิงก์', 'รัน SPF ทันที', 'ส่ง routing table ทั้งหมดให้เพื่อนบ้านทุก 30 วินาที', 'ใส่เส้นทางลง routing table'], a: 0,
    whyWrong: { 1: 'ยังรัน SPF ไม่ได้ เพราะยังไม่มี LSDB ให้คำนวณ ต้องแลก LSA และสร้าง LSDB ก่อน', 2: 'การส่งตารางทั้งหมดเป็นรอบๆ คือ RIP OSPF ส่ง LSA และส่งใหม่เฉพาะตอนลิงก์เปลี่ยน', 3: 'routing table เป็นขั้นสุดท้าย ต้องผ่าน LSA, LSDB และ SPF ก่อน' },
    why: 'ลำดับคือ Hello → แลก LSA → สร้าง LSDB → รัน SPF → routing table',
  });
  Hop.mcq($('#q-ops'), {
    q: 'เมื่อเครือข่ายนิ่งแล้ว OSPF ส่งข้อมูลเส้นทางใหม่เมื่อไร',
    opts: ['เมื่อมีลิงก์เปลี่ยนสถานะ (event-triggered)', 'ทุก 30 วินาที', 'ทุก 10 วินาทีพร้อม Hello', 'ไม่ส่งอีกเลย'], a: 0,
    whyWrong: { 1: 'ทุก 30 วินาทีคือ RIP ที่ส่งตารางทั้งหมดเป็นรอบๆ', 2: 'Hello ทุก 10 วินาทีใช้เช็คว่าเพื่อนบ้านยังอยู่ ไม่ได้บรรจุ LSA', 3: 'ยังส่ง Hello อยู่ และถ้าลิงก์เปลี่ยนจะส่ง LSA ทันที' },
    why: 'สไลด์: "Routing changes trigger routing updates" OSPF จึงประหยัด bandwidth และ converge เร็ว',
  });

  /* ---------- neighbor states as a sequence diagram ---------- */
  (() => {
    const host = $('#fig-states');
    const M = [
      { st: ['Down', 'Down'], g: 'adj', msgs: [['r', 'Hello', 'multicast 224.0.0.5: "Router ID ฉันคือ 172.16.5.1 มีใครอยู่ในวงนี้ไหม"', 'teal']], say: `${b('teal', 'Down')}: ยังไม่ได้รับ Hello จากใคร R1 จึงส่ง Hello ออกไป` },
      { st: ['Down', 'Init'], g: 'adj', msgs: [['l', 'Hello', 'unicast ถึง 172.16.5.1: router ID 172.16.5.2 พร้อมรายชื่อเพื่อนบ้าน (172.16.5.1)', 'teal']], say: `${b('teal', 'Init')}: R2 ได้รับ Hello ที่มี router ID ของ R1 จึงเพิ่ม R1 ลง neighbor list แล้วตอบ Hello กลับ` },
      { st: ['Two-Way', 'Two-Way'], g: 'adj', msgs: [], say: `${b('teal', 'Two-Way')}: R1 เห็น router ID ของตัวเองอยู่ในรายชื่อของ R2 แปลว่าคุยกันได้สองทางแล้ว` },
      { st: ['BDR', 'DR'], g: 'adj', msgs: [['n', 'เลือก DR/BDR', 'priority เท่ากัน (1) → router ID สูงกว่าชนะ: R2 เป็น DR, R1 เป็น BDR', 'ink']], say: `ใน Two-Way บน Ethernet จะเลือก ${Hop.t('dr', 'DR')} และ ${Hop.t('bdr', 'BDR')}: R2 router ID สูงกว่าจึงเป็น DR` },
      { st: ['ExStart', 'ExStart'], g: 'sync', msgs: [['l', 'DBD', 'R2 router ID สูงกว่าเป็น master จึงเริ่มส่ง DBD ก่อน', 'blue']], say: `${b('blue', 'ExStart')}: ตกลงกันว่าใครเป็น master/slave และเลข sequence ของ DBD ตัว master เริ่มก่อน` },
      { st: ['Exchange', 'Exchange'], g: 'sync', msgs: [['r', 'DBD', 'สรุปรายการใน LSDB ของ R1', 'blue'], ['l', 'LSAck', 'รับทราบ', 'muted']], say: `${b('blue', 'Exchange')}: แลก DBD ซึ่งเป็นสรุปของ LSDB ถ้ามีรายการที่ยังไม่มีจะไป Loading ถ้าครบแล้วไป Full เลย` },
      { st: ['Loading', 'Loading'], g: 'sync', msgs: [['r', 'LSR', '"ขอข้อมูลเพิ่มของเครือข่าย 172.16.6.0"', 'blue'], ['l', 'LSU', '"นี่คือรายการของ 172.16.6.0/24"', 'amber'], ['r', 'LSAck', 'รับทราบ', 'muted']], say: `${b('blue', 'Loading')}: ใช้ LSR ขอรายการที่ขาด อีกฝั่งตอบด้วย LSU แล้วรับทราบด้วย LSAck` },
      { st: ['Full', 'Full'], g: 'sync', msgs: [], say: `${b('green', 'Full')}: ฐานข้อมูลของทั้งคู่ตรงกันแล้ว (converged databases) พร้อมรัน SPF` },
    ];
    const head = el('div', { class: 'seqh' },
      el('div', { class: 'who' }, el('b', { text: 'R1' }), el('span', { class: 'mono', text: '172.16.5.1' }), el('i', { class: 'stb' })),
      el('div', { class: 'who r' }, el('b', { text: 'R2' }), el('span', { class: 'mono', text: '172.16.5.2' }), el('i', { class: 'stb' })));
    const lane = el('div', { class: 'seq' });
    const say = el('p', { class: 'say' });
    const scHost = el('div', { class: 'schost' });
    host.append(head, scHost, say, lane);
    const rows = [];
    M.forEach((m, k) => {
      if (k === 0) rows.push(el('div', { class: 'grp', 'data-k': 'states', html: 'Establish neighbor adjacencies', 'data-s': k }));
      if (k === 4) rows.push(el('div', { class: 'grp', 'data-k': 'states', html: 'Synchronize OSPF databases', 'data-s': k }));
      rows.push(el('div', { class: 'stn', 'data-s': k, html: `<span>${m.st[0]}</span><span>${m.st[1]}</span>` }));
      m.msgs.forEach(([d, t, x, c]) => rows.push(el('div', { class: `msg ${d} c${c}`, 'data-s': k, html: `<div class="ar"><b>${t}</b></div><div class="tx">${x}</div>` })));
    });
    lane.append(...rows);
    let lastK = -1;
    Hop.scrub(scHost, {
      stops: M.map((m, k) => ({ label: `<span class="k">${k + 1}</span> ${k === 3 ? 'เลือก DR/BDR' : m.st[0] === m.st[1] ? m.st[0] : m.st[1]}` })), speed: 1300,
      onFrame(t) {
        const k = Math.round(t); if (k === lastK) return; lastK = k;
        rows.forEach(r => { const s = +r.dataset.s; r.classList.toggle('show', s <= k); r.classList.toggle('now', s === k); });
        $$('.stb', head).forEach((x, i) => { x.textContent = M[k].st[i]; x.className = 'stb ' + (M[k].g === 'adj' && k < 3 ? 'adj' : k === 3 ? 'ink' : k === 7 ? 'full' : 'sync'); });
        say.innerHTML = M[k].say;
      },
    });
  })();

  /* ---------- DR / BDR adjacency counter ---------- */
  (() => {
    const host = $('#fig-dr');
    let n = 5, dr = false;
    const seg = el('div', { class: 'seg', role: 'group' },
      el('button', { 'aria-pressed': 'true', text: 'ไม่มี DR', onclick: () => { dr = false; upd(); } }),
      el('button', { 'aria-pressed': 'false', text: 'มี DR/BDR', onclick: () => { dr = true; upd(); } }));
    const sl = el('input', { type: 'range', class: 'slider', min: 2, max: 10, value: n, 'aria-label': 'จำนวน router' });
    const nv = el('b', { class: 'mono' });
    sl.addEventListener('input', () => { n = +sl.value; upd(); });
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 10px' }, seg), el('div', { class: 'srow' }, el('span', {}, 'router ', nv, ' ตัว'), sl));
    const svgBox = el('div', { class: 'topo' }); host.append(svgBox);
    const big = el('div', { class: 'bigsum' }); host.append(big);
    const say = el('p', { class: 'say' }); host.append(say);
    function upd() {
      $$('button', seg).forEach((x, i) => x.setAttribute('aria-pressed', String((i === 1) === dr)));
      nv.textContent = n; sl.style.setProperty('--p', ((n - 2) / 8 * 100) + '%');
      const cx = 180, cy = 150, R = 112;
      const P = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
      const D = n - 1, B = n - 2;
      let s = '';
      P.forEach(p => { s += `<line class="sw" x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"/>`; });
      let cnt = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const on = !dr || i === D || j === D || i === B || j === B;
        if (on) { cnt++; s += `<line class="adjl${dr ? ' dr' : ''}" x1="${P[i][0]}" y1="${P[i][1]}" x2="${P[j][0]}" y2="${P[j][1]}"/>`; }
      }
      s += Hop.dev('switch', cx, cy, { s: .8 });
      P.forEach((p, i) => {
        const role = dr && i === D ? 'DR' : dr && i === B ? 'BDR' : '';
        const out = [p[0] - cx, p[1] - cy], L = Math.hypot(...out), lx = p[0] + out[0] / L * 34, ly = p[1] + out[1] / L * 30 + 5;
        s += `<g class="drn${role ? ' ' + role.toLowerCase() : ''}">${Hop.dev('router', p[0], p[1], { c: 'currentColor', s: .72 })}<text x="${lx}" y="${ly}" text-anchor="middle">R${i + 1}${role ? ' ' + role : ''}</text></g>`;
      });
      const svg = el('svg', { viewBox: '-20 0 400 300', class: 'tsvg drsvg' }); svg.innerHTML = s; svgBox.replaceChildren(svg);
      big.innerHTML = dr ? `<div class="lab">adjacency เมื่อมี DR/BDR</div><div class="eqn">${cnt}</div><div class="lab">ทุกตัวคุยกับ DR และ BDR เท่านั้น</div>` : `<div class="lab">adjacency แบบทุกคู่</div><div class="eqn">${n}(${n}−1)/2 = ${cnt}</div><div class="lab">n = 5 ได้ 10, n = 10 ได้ 45, n = 20 ได้ 190 (สไลด์)</div>`;
      say.innerHTML = dr ? `priority เท่ากันหมด (ค่าเริ่มต้น 1) จึงดู router ID: R${n} มี router ID สูงสุดเป็น DR, R${n - 1} เป็น BDR DR เป็นตัวเดียวที่ส่ง LSA ของวงนี้ จำนวน LSA และ adjacency จึงลดลงมาก` : `ถ้าไม่มี DR ทุกคู่ต้องสร้าง adjacency และแลก LSA กันเอง เพิ่ม router ทีละตัว จำนวนเส้นเพิ่มเร็วมาก`;
    }
    upd();
  })();

  /* ---------- areas ---------- */
  (() => {
    const host = $('#fig-area');
    const R = (x, y, name, role, k) => `<g class="arn"${k ? ` data-k="${k}"` : ''}>${Hop.dev('router', x, y, { s: .8 })}<text x="${x}" y="${y + 36}" text-anchor="middle" class="nm">${name}</text>${role ? `<text x="${x}" y="${y + 53}" text-anchor="middle" class="rl">${role}</text>` : ''}</g>`;
    let s = '';
    s += `<rect class="ar a1" x="8" y="8" width="164" height="112" rx="22" data-k="area"/><rect class="ar a2" x="188" y="8" width="164" height="112" rx="22" data-k="area"/>`;
    s += `<rect class="ar a0" x="8" y="138" width="344" height="134" rx="30" data-k="area0"/>`;
    s += `<text class="at" x="22" y="32" data-k="area">Area 1</text><text class="at" x="338" y="32" text-anchor="end" data-k="area">Area 2</text><text class="at a0t" x="22" y="164" data-k="area0">Area 0 (backbone)</text>`;
    const L = (a, c) => `<line class="al" x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}"/>`;
    const p = { R4: [56, 66], R5: [126, 66], R6: [270, 66], R1: [96, 196], R2: [264, 196], R3: [180, 232], ISP: [180, 316] };
    s += L(p.R4, p.R1) + L(p.R5, p.R1) + L(p.R6, p.R2) + L(p.R1, p.R2) + L(p.R1, p.R3) + L(p.R2, p.R3) + L(p.R3, p.ISP);
    s += R(...p.R4, 'R4') + R(...p.R5, 'R5') + R(...p.R6, 'R6') + R(...p.R1, 'R1', 'ABR', 'abr') + R(...p.R2, 'R2', 'ABR', 'abr');
    s += `<g class="arn" data-k="asbr">${Hop.dev('router', ...p.R3, { s: .8 })}<text x="${p.R3[0] - 26}" y="${p.R3[1] + 5}" text-anchor="end" class="nm">R3</text><text x="${p.R3[0] + 26}" y="${p.R3[1] + 5}" class="rl">ASBR</text></g>`;
    s += `<g>${Hop.dev('cloud', ...p.ISP, { s: .85 })}<text x="${p.ISP[0] + 32}" y="${p.ISP[1] + 5}" class="nm">R-ISP</text></g>`;
    const svg = el('svg', { viewBox: '0 0 360 345', class: 'tsvg areas' }); svg.innerHTML = s;
    host.append(el('div', { class: 'topo' }, svg), el('p', { class: 'say', html: `Area 1 และ Area 2 ต่อกับ ${'<b>Area 0</b>'} ผ่าน ABR (R1, R2) ส่วน R3 เป็น ASBR ที่ต่อออกไปหา ISP แต่ละ area มี LSDB ของตัวเอง การเปลี่ยนแปลงใน Area 1 จึงไม่ทำให้ router ใน Area 2 ต้องคำนวณใหม่ทั้งหมด` }));
  })();

  /* ---------- cost ---------- */
  Hop.eq($('#eq-cost'), [['cost', 'cost'], ' = ', ['refbw', 'reference bw'], ' / ', ['ifbw', 'interface bw']]);
  (() => {
    const host = $('#fig-cost');
    const IF = [['10 Gbps Ethernet', 1e10], ['1 Gbps Ethernet', 1e9], ['100 Mbps Ethernet', 1e8], ['10 Mbps Ethernet', 1e7], ['Serial 1.544 Mbps', 1544000], ['Serial 128 kbps', 128000], ['Serial 64 kbps', 64000]];
    const REF = [[1e8, '100 Mbps (ค่าเริ่มต้น)'], [1e9, '1,000 Mbps'], [1e10, '10,000 Mbps']];
    let ri = 0, sel = 4;
    const seg = el('div', { class: 'seg', role: 'group' }, REF.map((r, i) => el('button', { 'aria-pressed': String(i === ri), text: r[1].replace(' (ค่าเริ่มต้น)', ''), onclick: () => { ri = i; upd(); } })));
    host.append(el('div', { class: 'srow', style: 'margin-bottom:12px' }, el('span', { text: 'reference bandwidth' }), seg));
    const calc = el('div', { class: 'mwork' });
    const tbl = el('div', { class: 'ctab' });
    const note = el('p', { class: 'say' });
    host.append(calc, tbl, note);
    const bwS = v => v >= 1e9 ? fmt(v / 1e9) + ' Gbps' : v >= 1e6 ? fmt(v / 1e6) + ' Mbps' : fmt(v / 1e3) + ' kbps';
    function upd() {
      $$('button', seg).forEach((x, i) => x.setAttribute('aria-pressed', String(i === ri)));
      const ref = REF[ri][0], cost = v => Math.max(1, Math.floor(ref / v));
      const [nm, v] = IF[sel], exact = ref / v;
      calc.innerHTML = `<div>${nm}: cost = ${fmt(ref)} / ${fmt(v)} = ${exact < 1 ? exact.toFixed(2) : fmt(Math.round(exact * 100) / 100)}</div><div class="res">→ <b>${fmt(cost(v))}</b> <span class="muted">${exact < 1 ? '(ต่ำกว่า 1 ให้เป็น 1)' : exact % 1 ? '(ปัดเศษทิ้ง)' : ''}</span></div>`;
      const ones = IF.filter(([, w]) => cost(w) === 1).length;
      tbl.replaceChildren(...IF.map(([n2, w], i) => el('button', { class: 'crow' + (i === sel ? ' on' : '') + (cost(w) === 1 && ones > 1 ? ' tie' : ''), onclick: () => { sel = i; upd(); }, html: `<span>${n2}</span><b>${fmt(cost(w))}</b>` })));
      note.innerHTML = (ones > 1 ? `ตอนนี้มี ${ones} ชนิดที่ได้ cost 1 เท่ากัน (แถวที่ไฮไลต์สีแดง) OSPF จึงแยกไม่ออกว่าลิงก์ไหนเร็วกว่า วิธีแก้คือเพิ่ม reference bandwidth (ตั้งให้เท่ากันทุก router) ` : `เมื่อเพิ่ม reference แล้ว ลิงก์เร็วกับลิงก์ช้าได้ cost ต่างกันชัดเจน `) +
        (ri === 2 ? '(สไลด์พิมพ์ 6477 และ 78126 แต่ถ้าปัดเศษทิ้งตามแถวอื่นจะได้ 6476 และ 78125) ' : '') +
        `ตัวอย่างในสไลด์: R1 ไป LAN ของ R2 ผ่าน serial 1.544 Mbps (64) ต่อด้วย Gigabit LAN (1) ได้ <code>[110/65]</code> พอตั้ง reference เป็น 1,000 ได้ 647 + 1 = 648`;
    }
    upd();
  })();
  Hop.mcq($('#q-cost'), {
    q: 'ใช้ reference bandwidth ค่าเริ่มต้น (100 Mbps) ลิงก์ 1 Gbps กับ 100 Mbps มี cost เท่าไร',
    opts: ['1 ทั้งคู่ OSPF จึงแยกไม่ออก', '0.1 กับ 1', '10 กับ 1', '1 กับ 10'], a: 0,
    whyWrong: { 1: 'cost เป็นจำนวนเต็มและต่ำสุดคือ 1 ค่า 0.1 จึงกลายเป็น 1', 2: '10 กับ 1 ไม่ถูก 100,000,000 / 1,000,000,000 = 0.1 ไม่ใช่ 10', 3: '100 Mbps ได้ 100,000,000 / 100,000,000 = 1 ไม่ใช่ 10 (จะได้ 10 เมื่อ reference เป็น 1,000)' },
    why: '100,000,000 / 1,000,000,000 = 0.1 ปัดเป็น 1 และ 100,000,000 / 100,000,000 = 1 ได้ cost 1 เท่ากัน ต้องเพิ่ม reference bandwidth ถึงจะแยกได้',
  });

  /* ---------- SPF walk-through from R1 ---------- */
  (() => {
    const host = $('#fig-spf');
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const net = Net(left);
    const tbl = el('div', { class: 'blk' }); right.append(tbl);
    const say = el('p', { class: 'say' }); host.append(say);
    const { steps } = dijkstra('R1');
    const final = routes('R1');
    let lastK = -1;
    const stops = steps.map((st, i) => ({ label: `<span class="k">${i + 1}</span> ${i === 0 ? 'เริ่มที่ R1 = 0' : `ยืนยัน ${st.u} = ${st.dist[st.u]}`}` }));
    stops.push({ label: '<span class="k">ผล</span> routing table ของ R1' });
    Hop.scrub(host, {
      stops, speed: 1500,
      onFrame(t) {
        const k = Math.round(t); if (k === lastK) return; lastK = k;
        net.cls('spf');
        if (k < steps.length) {
          const st = steps[k];
          RS.forEach(r => { net.node(r, st.done.includes(r) ? (r === st.u ? 'on done' : 'done') : st.dist[r] < Infinity ? 'tent' : 'far'); net.dist(r, st.dist[r] < Infinity ? st.dist[r] : '∞'); });
          net.tree(treeLinks(Object.fromEntries(Object.entries(st.prev).filter(([v]) => st.done.includes(v)))));
          tbl.innerHTML = `<div class="bh plain">cost รวมจาก R1</div><div class="dtab">` + RS.map(r => { const d = st.dist[r], u = st.upd.find(x => x.v === r); return `<div class="${st.done.includes(r) ? 'dn' : ''}${r === st.u ? ' cur' : ''}"><span>${r}</span><span>${d < Infinity ? d : '∞'}</span><span>${st.done.includes(r) ? 'ยืนยันแล้ว' : u ? (u.from < Infinity ? `ลดจาก ${u.from}` : 'เพิ่งรู้') : ''}</span></div>`; }).join('') + '</div>';
          const ups = st.upd.map(u => `${u.v} = ${st.dist[st.u]} + ${u.c} = ${u.to}${u.from < Infinity ? ` (ดีกว่า ${u.from} เดิม)` : ''}`).join(', ');
          say.innerHTML = (k === 0 ? `เริ่มที่ราก R1 cost 0 ` : `ในตัวที่ยังไม่ยืนยัน ${st.u} มี cost ต่ำที่สุด (${st.dist[st.u]}) จึง${b('violet', 'ยืนยัน ' + st.u)} `) + (ups ? `แล้วอัปเดตเพื่อนบ้านของ ${st.u}: ${ups}` : `เพื่อนบ้านของ ${st.u} ไม่มีทางไหนดีขึ้น`);
        } else {
          const { prev } = dijkstra('R1');
          RS.forEach(r => { net.node(r, r === 'R1' ? 'on done' : 'done'); net.dist(r, null); });
          net.tree(treeLinks(prev));
          tbl.innerHTML = `<div class="bh plain"><span class="c-green">Routing table</span> ของ R1 (ตรงกับสไลด์)</div>` + rtRows(final);
          say.innerHTML = `cost ของเครือข่าย = cost ถึง router ที่ต่อเครือข่ายนั้น + cost ของ interface ขาออกไปเครือข่ายนั้น เช่น 10.11.0.0 = 25 (ถึง R5) + 2 (LAN) = 27 และ 10.7.0.0 = 5 (ถึง R3) + 10 = 15`;
        }
      },
    });
  })();

  /* ---------- compare two protocols row by row ---------- */
  const CMP = {
    rows: ['ประเภท', 'อัลกอริทึม', 'Metric', 'AD', 'การส่ง update', 'ตารางที่เก็บ', 'Convergence', 'ขนาดเครือข่าย', 'Classless (VLSM)', 'ข้อดี', 'ข้อเสีย'],
    RIP: ['Distance vector', 'Bellman-Ford', 'Hop count (สูงสุด 15)', '120', 'ส่งตารางทั้งหมดทุก 30 วินาที (v1 broadcast, v2 multicast 224.0.0.9)', 'routing table อย่างเดียว', 'ช้า (ข่าวเดินทีละ router ทุก 30 วินาที)', 'เล็ก (ไม่เกิน 15 hop)', 'v1 ไม่ได้, v2 ได้', 'ตั้งค่าง่าย', 'จำกัด 15 hop, ไม่สนความเร็วลิงก์, ส่งตารางเต็มซ้ำๆ เปลือง bandwidth'],
    EIGRP: ['Advanced distance vector (ลูกผสม) ของ Cisco', 'DUAL', 'Composite: bandwidth + delay', '90', 'ส่งเฉพาะส่วนที่เปลี่ยน (partial, bounded) มี Hello คอยเช็คเพื่อนบ้าน', 'neighbor, topology, routing', 'เร็ว (มี feasible successor สำรองไว้)', 'ใหญ่, รองรับหลายโปรโตคอล', 'ได้', 'converge เร็ว, มีทางสำรอง, load balance ได้ทั้ง equal และ unequal cost', 'เป็นของ Cisco (proprietary)'],
    OSPF: ['Link state, มาตรฐานเปิด', 'Dijkstra SPF', 'Cost = reference bw / interface bw', '110', 'ส่ง LSA เฉพาะตอนลิงก์เปลี่ยน (Hello ทุก 10 วินาที)', 'neighbor, LSDB (topology), routing', 'เร็ว', 'ใหญ่ ด้วยการแบ่ง area (Area 0)', 'ได้', 'เส้นทางสั้นที่สุดจากแผนที่เต็ม ไม่วนลูป, ขยายได้, มี authentication, ใช้ได้ทุกยี่ห้อ', 'ใช้ CPU และ memory มากกว่า, ออกแบบและตั้งค่าซับซ้อนกว่า'],
  };
  (() => {
    const host = $('#fig-cmp');
    let A = 'OSPF', B = 'RIP';
    const mk = side => el('div', { class: 'seg', role: 'group' }, ['RIP', 'EIGRP', 'OSPF'].map(p => el('button', { text: p, onclick: () => { if (side === 0) { if (p === B) B = A; A = p; } else { if (p === A) A = B; B = p; } upd(); } })));
    const sa = mk(0), sb = mk(1);
    host.append(el('div', { class: 'cmpsel' }, sa, el('span', { class: 'muted', text: 'เทียบกับ' }), sb));
    const tb = el('div', { class: 'cmpt' }); host.append(tb);
    function upd() {
      $$('button', sa).forEach(x => x.setAttribute('aria-pressed', String(x.textContent === A)));
      $$('button', sb).forEach(x => x.setAttribute('aria-pressed', String(x.textContent === B)));
      tb.replaceChildren(el('div', { class: 'ch' }, el('span'), el('b', { text: A }), el('b', { text: B })),
        ...CMP.rows.map((r, i) => el('div', { class: 'cr', style: `animation-delay:${i * 30}ms` }, el('span', { class: 'rk', text: r }), el('span', { text: CMP[A][i] }), el('span', { text: CMP[B][i] }))));
    }
    upd();
  })();
  Hop.mcq($('#q-cmp'), {
    q: 'router รู้จักเครือข่าย 10.9.0.0/16 จาก RIP, OSPF และ EIGRP พร้อมกัน (prefix เดียวกัน) จะใช้เส้นทางของโปรโตคอลไหน',
    opts: ['EIGRP เพราะ AD 90 ต่ำที่สุด', 'OSPF เพราะ cost แม่นที่สุด', 'RIP เพราะ hop count น้อยที่สุด', 'ตัวที่ metric ต่ำที่สุด'], a: 0,
    whyWrong: { 1: 'OSPF มี AD 110 สูงกว่า EIGRP (90)', 2: 'RIP มี AD 120 สูงที่สุดในสามตัว', 3: 'metric ของคนละโปรโตคอลใช้หน่วยต่างกัน เทียบกันไม่ได้ ต้องใช้ AD' },
    why: 'ต่างโปรโตคอลกันตัดสินด้วย AD ยิ่งน้อยยิ่งเชื่อ: EIGRP 90 &lt; OSPF 110 &lt; RIP 120',
  });
  Hop.mcq($('#q-cmp'), {
    q: 'ข้อใดเป็นข้อดีของ OSPF เมื่อเทียบกับ RIP',
    opts: ['ไม่มีขีดจำกัด 15 hop และ metric คิดจาก bandwidth', 'ตั้งค่าง่ายกว่าและใช้ memory น้อยกว่า', 'ส่งตารางทั้งหมดให้เพื่อนบ้านทุก 30 วินาที', 'เป็นโปรโตคอลของ Cisco'], a: 0,
    whyWrong: { 1: 'กลับกัน OSPF ใช้ CPU และ memory มากกว่าและตั้งค่าซับซ้อนกว่า (เก็บ LSDB และรัน SPF)', 2: 'นั่นคือพฤติกรรมของ RIP OSPF ส่งเฉพาะตอนลิงก์เปลี่ยน', 3: 'OSPF เป็นมาตรฐานเปิด EIGRP ต่างหากที่เป็นของ Cisco' },
    why: 'OSPF ขยายได้ด้วย area ไม่จำกัด hop และ cost สะท้อนความเร็วลิงก์ ส่วน RIP นับแค่ hop จึงอาจเลือกลิงก์ช้า',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    let mode = 'order';
    const ORDER = [
      { q: 'เรียงขั้นตอนการทำงานของ OSPF ตั้งแต่เปิดเครื่องจนได้ routing table', items: ['ส่ง Hello หาเพื่อนบ้าน สร้าง adjacency', 'แลก LSA (สถานะและ cost ของลิงก์)', 'สร้าง LSDB (topology table)', 'รัน SPF (Dijkstra) ได้ SPF tree', 'ใส่เส้นทางที่ดีที่สุดลง routing table'] },
      { q: 'เรียงสถานะของ OSPF neighbor จากเริ่มต้นจนฐานข้อมูลตรงกัน', items: ['Down', 'Init', 'Two-Way', 'ExStart', 'Exchange', 'Loading', 'Full'] },
      { q: 'เรียงเหตุการณ์การสร้าง adjacency ระหว่าง R1 (172.16.5.1) กับ R2 (172.16.5.2)', items: ['R1 ส่ง Hello แบบ multicast 224.0.0.5', 'R2 เข้า Init แล้วตอบ Hello พร้อมรายชื่อเพื่อนบ้าน', 'R1 เห็น router ID ตัวเองในรายชื่อ เข้า Two-Way', 'เลือก DR (R2) และ BDR (R1)'] },
      { q: 'เรียงขั้นตอนการซิงก์ฐานข้อมูลของ OSPF', items: ['ExStart: เลือก master (router ID สูงกว่า) เริ่มส่ง DBD', 'Exchange: แลก DBD สรุป LSDB และตอบ LSAck', 'Loading: ส่ง LSR ขอรายการที่ขาด', 'ได้ LSU ตอบกลับ แล้วส่ง LSAck', 'Full: ฐานข้อมูลตรงกัน'] },
    ];
    const EXPL = [
      { q: 'อธิบายขั้นตอนการทำงานของ OSPF ตั้งแต่เปิดเครื่องจนได้ routing table', a: ['1. ส่ง Hello (multicast 224.0.0.5 ทุก 10 วินาที, dead 40 วินาที) หาเพื่อนบ้าน สร้าง adjacency เก็บใน neighbor table บน Ethernet เลือก DR/BDR', '2. แลก LSA ซึ่งบอกสถานะและ cost ของลิงก์ของตัวเอง แล้ว flood ทั่ว area (ผ่าน ExStart, Exchange, Loading จนถึง Full)', '3. รวม LSA เป็น LSDB (topology table) ทุกตัวใน area มีเหมือนกัน', '4. แต่ละตัวรัน SPF (Dijkstra) โดยมีตัวเองเป็นราก ได้ SPF tree', '5. ใส่เส้นทางที่ cost รวมต่ำที่สุดลง routing table (AD 110) หลังจากนั้นส่ง LSA ใหม่เฉพาะเมื่อลิงก์เปลี่ยน'] },
      { q: 'OSPF ต่างจาก RIP อย่างไร (บอกอย่างน้อย 4 ข้อ)', a: ['ประเภท: OSPF เป็น link state, RIP เป็น distance vector', 'Metric: OSPF ใช้ cost จาก bandwidth, RIP ใช้ hop count (สูงสุด 15)', 'Update: OSPF ส่ง LSA เฉพาะตอนลิงก์เปลี่ยน, RIP ส่งตารางทั้งหมดทุก 30 วินาที', 'อัลกอริทึม: OSPF ใช้ Dijkstra SPF, RIP ใช้ Bellman-Ford', 'Convergence: OSPF เร็วกว่า, RIP ช้า', 'ขนาด: OSPF ขยายได้ด้วย area, RIP จำกัด 15 hop', 'AD: OSPF 110, RIP 120'] },
      { q: 'OSPF ต่างจาก EIGRP อย่างไร', a: ['ประเภท: OSPF เป็น link state (มีแผนที่ทั้งเครือข่าย), EIGRP เป็น advanced distance vector (รู้แค่ระยะที่เพื่อนบ้านบอก แต่เก็บ topology table)', 'อัลกอริทึม: OSPF ใช้ SPF (Dijkstra), EIGRP ใช้ DUAL', 'Metric: OSPF ใช้ cost จาก bandwidth, EIGRP ใช้ composite จาก bandwidth + delay', 'มาตรฐาน: OSPF เป็นมาตรฐานเปิด, EIGRP เป็นของ Cisco', 'AD: OSPF 110, EIGRP 90', 'ทางสำรอง: EIGRP เก็บ feasible successor ไว้ใช้ทันที, OSPF คำนวณ SPF ใหม่เมื่อมีการเปลี่ยนแปลง'] },
      { q: 'link state ต่างจาก distance vector อย่างไร', a: ['สิ่งที่รู้: link state รู้แผนที่ทั้งเครือข่าย (LSDB), distance vector รู้แค่ระยะและทิศทางจากเพื่อนบ้าน', 'สิ่งที่ส่ง: link state ส่ง LSA (สถานะลิงก์ของตัวเอง) เฉพาะตอนเปลี่ยน, distance vector ส่งสำเนา routing table เป็นรอบๆ', 'การคำนวณ: link state ให้แต่ละตัวรัน SPF เอง, distance vector เชื่อตัวเลขที่เพื่อนบ้านบอก (Bellman-Ford)', 'converge: link state เร็วกว่า', 'ตัวอย่าง: link state = OSPF, IS-IS; distance vector = RIP, EIGRP (advanced)'] },
      { q: 'ทำไม OSPF ต้องมี DR/BDR และเลือกอย่างไร', a: ['บนเครือข่าย multi-access (เช่น Ethernet ที่มีหลาย router ต่อ switch เดียวกัน) ถ้าทุกคู่สร้าง adjacency กันเองจะได้ n(n−1)/2 คู่ เช่น 10 ตัวได้ 45', 'DR เป็นตัวเดียวที่ส่ง LSA ของวงนั้น จึงลดจำนวน LSA และ adjacency, BDR เป็นตัวสำรอง', 'เลือกตั้งในสถานะ Two-Way: priority สูงสุดชนะ ถ้าเท่ากันดู router ID สูงสุด', 'ตัวอย่างสไลด์: R1 172.16.5.1 กับ R2 172.16.5.2 priority 1 เท่ากัน → R2 เป็น DR, R1 เป็น BDR'] },
      { q: 'ข้อดีของ OSPF มีอะไรบ้าง', a: ['Classless รองรับ VLSM/CIDR', 'Converge เร็ว ส่ง update ทันทีเมื่อลิงก์เปลี่ยน', 'ส่งเฉพาะตอนเปลี่ยน ประหยัด bandwidth', 'Scalable แบ่ง area เป็นลำดับชั้นได้ (Area 0)', 'Secure มี authentication (MD5/SHA ใน v2, IPsec ใน v3)', 'ได้เส้นทางสั้นที่สุดจากแผนที่เต็มด้วย SPF ไม่วนลูป, metric สะท้อน bandwidth', 'เป็นมาตรฐานเปิด ใช้ได้ทุกยี่ห้อ'] },
      { q: 'ทำไม OSPF แบ่ง area และ Area 0 คืออะไร', a: ['เครือข่ายใหญ่ถ้าอยู่ area เดียว LSDB จะใหญ่และ SPF ต้องคำนวณบ่อย', 'แบ่งเป็นหลาย area (multiarea) แต่ละ area มี LSDB ของตัวเอง การเปลี่ยนแปลงไม่ลามทั้งเครือข่าย', 'Area 0 คือ backbone ทุก area ต้องเชื่อมเข้า Area 0', 'ABR อยู่ระหว่าง area, ASBR ต่อออกนอกองค์กร (เช่น ISP)'] },
      { q: 'OSPF คิด cost อย่างไร และทำไมต้องปรับ reference bandwidth', a: ['cost = reference bandwidth / interface bandwidth ปัดเศษทิ้ง ต่ำสุดคือ 1 ค่าเริ่มต้น reference = 100 Mbps', 'cost ของเส้นทาง = ผลรวม cost ของ interface ขาออกตลอดทาง เช่น serial 64 + Gigabit 1 = 65', 'ปัญหา: 100 Mbps, 1 Gbps, 10 Gbps ได้ cost 1 เท่ากัน แยกความเร็วไม่ออก', 'แก้ด้วย auto-cost reference-bandwidth 1000 (หรือ 10000) ตั้งเท่ากันทุก router และตั้ง bandwidth ของ serial ให้ตรงความจริง'] },
    ];
    let qi = -1;
    function render() {
      host.innerHTML = '';
      const seg = el('div', { class: 'seg', role: 'group' },
        el('button', { 'aria-pressed': String(mode === 'order'), text: 'เรียงลำดับ', onclick: () => { mode = 'order'; render(); } }),
        el('button', { 'aria-pressed': String(mode === 'expl'), text: 'อธิบายความต่าง', onclick: () => { mode = 'expl'; render(); } }));
      host.append(el('div', { class: 'dhead' }, el('h3', { text: 'โจทย์' }), seg));
      const work = el('div');
      if (mode === 'order') {
        let k; do { k = Hop.rnd(0, ORDER.length - 1); } while (k === qi && ORDER.length > 1); qi = k;
        const Q = ORDER[k], pool = Hop.shuffle(Q.items.map((t, i) => ({ t, i })));
        const picked = [];
        host.append(el('p', { class: 'prompt', html: Q.q + ' <span class="muted">(แตะตามลำดับ แตะซ้ำในคำตอบเพื่อเอาออก)</span>' }));
        const src = el('div', { class: 'opool' }), ans = el('ol', { class: 'oans' });
        host.append(src, ans);
        const score = el('span', { class: 'score' });
        function draw() {
          src.replaceChildren(...pool.filter(p => !picked.includes(p)).map(p => el('button', { class: 'chip ot', text: p.t, onclick: () => { picked.push(p); draw(); } })));
          ans.replaceChildren(...picked.map((p, j) => el('li', {}, el('button', { class: 'oi', text: p.t, onclick: () => { picked.splice(j, 1); draw(); } }))));
          score.textContent = '';
        }
        draw();
        host.append(el('div', { class: 'bar2' },
          el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: () => { let ok = 0; $$('.oi', ans).forEach((x, j) => { const good = picked[j].i === j; x.classList.toggle('ok', good); x.classList.toggle('no', !good); if (good) ok++; }); score.textContent = picked.length < Q.items.length ? `เรียงแล้ว ${picked.length}/${Q.items.length}, ถูกตำแหน่ง ${ok}` : `ถูกตำแหน่ง ${ok}/${Q.items.length}`; } }),
          el('button', { class: 'btn', html: `${icon('eye')} ดูเฉลย`, onclick: () => Hop.work(work, Q.items.map((t, i) => ({ t: `${i + 1}. ${t}` })), { stagger: 80 }) }),
          el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render }), score), work);
      } else {
        let k; do { k = Hop.rnd(0, EXPL.length - 1); } while (k === qi && EXPL.length > 1); qi = k;
        const Q = EXPL[k];
        host.append(el('p', { class: 'prompt', text: Q.q }));
        host.append(el('textarea', { class: 'field ta', rows: 5, placeholder: 'ลองเขียนคำตอบของตัวเองก่อน (ไม่บังคับ)' }));
        host.append(el('div', { class: 'bar2' },
          el('button', { class: 'btn primary', html: `${icon('eye')} ดูคำตอบตัวอย่าง`, onclick: () => Hop.work(work, [{ note: true, t: 'ประเด็นที่ควรมีในคำตอบ' }, ...Q.a.map(t => ({ t }))], { stagger: 90 }) }),
          el('button', { class: 'btn ghost', html: `${icon('shuffle')} ข้อใหม่`, onclick: render })), work);
      }
    }
    render();
  })();
})();
