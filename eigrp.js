// EIGRP chapter: map hero, protocol spectrum, three tables, metric, FD/RD, feasibility, slide triangle, failover, drill.
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, easeIO, icon } = Hop;
  Hop.page(4);
  const fmt = n => Number(n).toLocaleString('en-US');
  const C = { cost: 'var(--c-teal)', rd: 'var(--c-amber)', fd: 'var(--c-violet)', succ: 'var(--c-green)', fs: 'var(--c-blue)', no: 'var(--muted)', bad: 'var(--c-rose)' };
  const ROLE = { succ: { t: 'Successor', k: 'successor', cls: 'succ' }, fs: { t: 'FS', k: 'fs', cls: 'fs' }, no: { t: 'ไม่ใช่ FS', k: 'fc', cls: 'no' } };
  const b = (cls, v) => `<b class="c-${cls}">${v}</b>`;

  // successor = lowest FD (ties = all successors); FS = RD strictly below the successor's FD
  function analyze(paths) {
    const fd = paths.map(p => p.fd != null ? p.fd : p.cost + p.rd);
    const best = Math.min(...fd);
    const succ = fd.indexOf(best);
    const roles = paths.map((p, i) => fd[i] === best ? 'succ' : p.rd < best ? 'fs' : 'no');
    return { fd, best, succ, roles };
  }

  function explain(paths, an, i, { big = false } = {}) {
    const p = paths[i], fd = an.fd[i], best = an.best, F = big ? fmt : x => x;
    const sum = p.cost != null ? `cost ถึง ${p.name} = ${b('teal', F(p.cost))} บวก RD ที่ ${p.name} บอกมา ${b('amber', F(p.rd))} ได้ FD = ${b('violet', F(fd))}` : `FD = ${b('violet', F(fd))}, RD = ${b('amber', F(p.rd))}`;
    const r = an.roles[i];
    if (r === 'succ') {
      const ties = an.roles.filter(x => x === 'succ').length;
      return `ทาง ${p.name}: ${sum} ` + (ties > 1 ? `เท่ากับทางที่ดีที่สุดอีกทาง EIGRP ใช้ทั้งสองทางเป็น ${b('green', 'successor')} พร้อมกัน (equal-cost load balancing)` : `ต่ำที่สุดในทุกทาง ${p.name} จึงเป็น ${b('green', 'successor')}`);
    }
    if (r === 'fs') return `ทาง ${p.name}: ${sum} ไม่ใช่ทางที่ดีที่สุด แต่ RD ${b('amber', F(p.rd))} &lt; ${b('violet', F(best))} (FD ของ successor) ${p.name} จึงเป็น ${b('blue', 'feasible successor')} ใช้สำรองได้ทันที`;
    return `ทาง ${p.name}: ${sum} และ RD ${b('amber', F(p.rd))} ${p.rd === best ? 'เท่ากับ' : 'มากกว่า'} FD ของ successor (${b('violet', F(best))}) ไม่ผ่านเงื่อนไข RD &lt; FD ${p.name} จึงไม่ใช่ FS`;
  }

  /* ---------- topology: source R fans out to n neighbours, all reach destination X ---------- */
  function Topo(host, opt = {}) {
    const o = Object.assign({ keys: false, showFD: true, showIP: false, src: 'R', dest: 'X', onPick: null }, opt);
    const box = el('div', { class: 'topo' });
    host.append(box);
    let n = -1, G, svg, paths = [], an = null, raf = 0;
    const pillSvg = (cls, key) => `<g class="pill ${cls}"${key ? ` data-k="${key}"` : ''}><rect rx="9" height="24" y="-12"/><text y="5" text-anchor="middle"></text></g>`;
    function geom(k) {
      const sp = k <= 2 ? 130 : k === 3 ? 112 : k === 4 ? 106 : 96, pad = 62;
      const ys = Array.from({ length: k }, (_, i) => pad + i * sp);
      const H = ys[k - 1] + pad, cy = H / 2;
      return { H, S: [36, cy], D: [322, cy], N: ys.map(y => [186, y]) };
    }
    function build(k) {
      n = k; G = geom(k);
      const { S, D, N, H } = G;
      let s = '<g class="lk">';
      N.forEach(([x, y], i) => {
        s += `<g class="pl" data-i="${i}"><line class="s1" x1="${S[0]}" y1="${S[1]}" x2="${x}" y2="${y}"/><line class="s2" x1="${x}" y1="${y}" x2="${D[0]}" y2="${D[1]}"/>` +
          `<line class="hit" x1="${S[0]}" y1="${S[1]}" x2="${x}" y2="${y}"/><line class="hit" x1="${x}" y1="${y}" x2="${D[0]}" y2="${D[1]}"/></g>`;
      });
      s += '</g><path class="loopx" d="" fill="none"/><g class="pls">';
      N.forEach((_, i) => { s += pillSvg('pc', o.keys ? 'cost' : null).replace('<g ', `<g data-i="${i}" `) + pillSvg('pr', o.keys ? 'rd' : null).replace('<g ', `<g data-i="${i}" `); });
      s += '</g>';
      s += Hop.dev('router', S[0], S[1], { label: o.src, s: .9 });
      s += `<g class="dst"${o.keys ? ' data-k="dest"' : ''}>${Hop.dev('cloud', D[0], D[1], { label: o.dest, s: .95 })}</g>`;
      N.forEach(([x, y], i) => {
        s += `<g class="nb" data-i="${i}" transform="translate(${x} ${y})"><circle class="halo" r="26"/><g class="gl">${Hop.dev('router', 0, 0, { c: 'currentColor', s: .9 })}</g>` +
          `<text class="nm" y="-30" text-anchor="middle"></text><text class="ip" y="42" text-anchor="middle"></text>` +
          `<g class="pill pf"${o.keys ? ' data-k="fd"' : ''} transform="translate(0 44)"><rect rx="9" height="24" y="-12"/><text y="5" text-anchor="middle"></text></g></g>`;
      });
      s += '<circle class="pkt" r="7" opacity="0"/>';
      svg = el('svg', { viewBox: `0 0 360 ${H}`, class: 'tsvg' });
      svg.innerHTML = s;
      box.replaceChildren(svg);
      const pick = e => {
        const g = e.target.closest('[data-i]'); if (!g || !o.onPick) return;
        if (o.keys && e.target.closest('[data-k]')) return;
        o.onPick(+g.dataset.i);
      };
      svg.addEventListener('click', pick);
      // midpoints of the two segments
      N.forEach(([x, y], i) => {
        const pc = $(`.pc[data-i="${i}"]`, svg), pr = $(`.pr[data-i="${i}"]`, svg);
        pc.setAttribute('transform', `translate(${(S[0] + x) / 2 + 2} ${(S[1] + y) / 2})`);
        pr.setAttribute('transform', `translate(${(x + D[0]) / 2 - 2} ${(y + D[1]) / 2})`);
      });
    }
    function setPill(g, txt) {
      const t = g.querySelector('text'), r = g.querySelector('rect');
      t.textContent = txt;
      const w = Math.max(28, String(txt).length * 8 + 14);
      r.setAttribute('width', w); r.setAttribute('x', -w / 2);
    }
    function set(ps, { sel = -1, roles = true, fdFmt = x => x, showFD = o.showFD, hideNums = false } = {}) {
      paths = ps; if (ps.length !== n) build(ps.length);
      an = analyze(ps);
      ps.forEach((p, i) => {
        const r = roles ? an.roles[i] : null, on = i === sel;
        const pl = $(`.pl[data-i="${i}"]`, svg), nb = $(`.nb[data-i="${i}"]`, svg);
        pl.setAttribute('class', 'pl' + (r ? ' r-' + r : '') + (on ? ' on' : '') + (sel >= 0 && !on ? ' dim' : ''));
        nb.setAttribute('class', 'nb' + (r ? ' r-' + r : '') + (on ? ' on' : ''));
        $('.nm', nb).textContent = p.name;
        $('.ip', nb).textContent = o.showIP && !showFD ? p.ip : '';
        const pf = $('.pf', nb); pf.style.display = showFD ? '' : 'none';
        if (showFD) setPill(pf, 'FD ' + fdFmt(an.fd[i]));
        setPill($(`.pc[data-i="${i}"]`, svg), hideNums ? '?' : fdFmt(p.cost));
        setPill($(`.pr[data-i="${i}"]`, svg), hideNums ? '?' : fdFmt(p.rd));
      });
      return an;
    }
    // packet travels S -> N[i] -> D
    function send(i, { color = 'var(--ink)', dur = 1300 } = {}) {
      cancelAnimationFrame(raf);
      const dot = $('.pkt', svg), { S, D, N } = G, M = N[i];
      const l1 = Math.hypot(M[0] - S[0], M[1] - S[1]), l2 = Math.hypot(D[0] - M[0], D[1] - M[1]), L = l1 + l2;
      dot.setAttribute('fill', color);
      const t0 = performance.now();
      const tick = now => {
        const k = clamp((now - t0) / dur, 0, 1), d = easeIO(k) * L;
        const [x, y] = d < l1 ? [lerp(S[0], M[0], d / l1), lerp(S[1], M[1], d / l1)] : [lerp(M[0], D[0], (d - l1) / l2), lerp(M[1], D[1], (d - l1) / l2)];
        dot.setAttribute('cx', x); dot.setAttribute('cy', y);
        dot.setAttribute('opacity', k < .08 ? k / .08 : k > .92 ? (1 - k) / .08 : 1);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    // dashed loop overlay: neighbour i -> R -> neighbour j -> X
    function loop(i, j, on) {
      const p = $('.loopx', svg); if (!p) return;
      if (!on) { p.setAttribute('d', ''); return; }
      const { S, D, N } = G;
      p.setAttribute('d', `M${N[i][0] - 14} ${N[i][1] + 12} L${S[0] + 14} ${S[1] + 6} L${N[j][0] - 14} ${N[j][1] + 10} L${D[0] - 18} ${D[1] + 8}`);
    }
    return { box, set, send, loop, get an() { return an; }, get svg() { return svg; } };
  }

  /* ---------- path list (the "fast method" table, live) ---------- */
  function PathList(host, { onPick, cost = true, big = false, sub = false } = {}) {
    const box = el('div', { class: 'plist' + (cost ? '' : ' nocost') });
    host.append(box);
    function render(paths, an, sel = -1, { roles = true, hidden = [] } = {}) {
      const F = big ? fmt : x => x;
      const head = el('div', { class: 'pr head', html: `<span>ทาง</span>${cost ? `<span>${Hop.t('cost', 'cost')}</span>` : ''}<span>${Hop.t('rd', 'RD')}</span><span>${Hop.t('fd', 'FD')}</span><span>บทบาท</span>` });
      const rows = paths.map((p, i) => {
        const r = an.roles[i], R = ROLE[r], hid = hidden.includes(i);
        const row = el('button', { class: 'pr' + (i === sel ? ' on' : '') + (hid ? ' hid' : '') + (roles ? ' r-' + r : ''), onclick: e => { if (e.target.closest('[data-k]')) return; onPick && onPick(i); } });
        row.innerHTML = `<span class="nm">${esc(p.name)}${sub && p.sub ? `<i>${esc(p.sub)}</i>` : ''}</span>` + (cost ? `<span class="c-teal">${F(p.cost)}</span>` : '') +
          `<span class="c-amber">${F(p.rd)}</span><span class="c-violet">${F(an.fd[i])}</span>` +
          `<span>${roles ? `<span class="role ${R.cls}" data-k="${R.k}">${R.t}</span>` : ''}</span>`;
        return row;
      });
      box.replaceChildren(head, ...rows);
    }
    return { box, render };
  }

  /* ---------- the running example: router R, 4 neighbours, network X ---------- */
  const EX = [
    { name: 'A', ip: '10.0.1.2', ifc: 'G0/1', cost: 20, rd: 30 },
    { name: 'B', ip: '10.0.2.2', ifc: 'G0/2', cost: 10, rd: 25 },
    { name: 'C', ip: '10.0.3.2', ifc: 'G0/3', cost: 5, rd: 40 },
    { name: 'D', ip: '10.0.4.2', ifc: 'S0/0/0', cost: 33, rd: 15 },
  ];

  /* ---------- map hero ---------- */
  (() => {
    const host = $('#map');
    let sel = 1;
    host.append(el('p', { class: 'lbl', html: `router R ต้องส่งแพ็กเก็ตไปเครือข่าย X (10.9.0.0/24) ได้ 4 ทาง แตะแต่ละทาง หรือแตะตัวเลขเพื่อดูว่าคืออะไร` }));
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const topo = Topo(left, { keys: true, onPick: i => pick(i) });
    const list = PathList(right, { onPick: i => pick(i) });
    const say = el('p', { class: 'say' }); right.append(say);
    const ans = el('div', { class: 'ans' }); right.append(ans);
    const an = analyze(EX);
    const fsList = EX.filter((_, i) => an.roles[i] === 'fs');
    ans.innerHTML = `<div><span class="role succ" data-k="successor">Successor</span> B, next hop 10.0.2.2 ออกทาง G0/2</div><div><span class="role fd" data-k="fd">FD</span> 35</div><div><span class="role fs" data-k="fs">FS</span> ${fsList.map(p => `${p.name} (${p.ip})`).join(', ')}</div>`;
    function pick(i) { sel = i; draw(); topo.send(i, { color: an.roles[i] === 'succ' ? C.succ : an.roles[i] === 'fs' ? C.fs : 'var(--ink)' }); }
    function draw() {
      topo.set(EX, { sel });
      list.render(EX, an, sel);
      say.innerHTML = explain(EX, an, sel);
    }
    draw();
    Hop.onView(host, () => { [1, 3, 0, 2].forEach((i, k) => setTimeout(() => { sel = i; draw(); topo.send(i, { color: an.roles[i] === 'succ' ? C.succ : an.roles[i] === 'fs' ? C.fs : 'var(--ink)', dur: 1000 }); }, 300 + k * 1150)); setTimeout(() => { sel = 1; draw(); }, 300 + 4 * 1150); });
  })();

  /* ---------- spectrum DV <-> LS ---------- */
  (() => {
    const host = $('#fig-spectrum');
    const P = {
      RIP: { x: 9, type: 'Distance vector', knows: 'ระยะ (จำนวน hop) กับทิศทาง ที่ได้ยินจากเพื่อนบ้าน ไม่เห็นแผนที่', metric: 'Hop count (สูงสุด 15 hop)', alg: 'Bellman-Ford', ad: '120', upd: 'ส่งตารางทั้งหมดทุก 30 วินาที' },
      EIGRP: { x: 32, type: 'Advanced distance vector (ลูกผสม)', knows: 'ระยะของเพื่อนบ้านทุกตัว เก็บใน topology table แต่ไม่เห็นแผนที่ทั้งหมด', metric: 'Composite: bandwidth + delay (ค่าเริ่มต้น)', alg: 'DUAL', ad: '90', upd: 'ส่งเฉพาะส่วนที่เปลี่ยน (partial, bounded)' },
      OSPF: { x: 94, type: 'Link state', knows: 'แผนที่ทั้งเครือข่าย (LSDB) เหมือนกันทุกตัว', metric: 'Cost = reference bandwidth / interface bandwidth', alg: 'Dijkstra SPF', ad: '110', upd: 'ส่ง LSA เมื่อลิงก์เปลี่ยนเท่านั้น' },
    };
    let cur = 'EIGRP';
    const track = el('div', { class: 'spec' }, el('div', { class: 'rail' }), el('span', { class: 'end l', text: 'Distance vector' }), el('span', { class: 'end r', text: 'Link state' }));
    const btns = Object.keys(P).map(k => { const bt = el('button', { class: 'dotp', style: `left:${P[k].x}%`, text: k, onclick: () => { cur = k; upd(); } }); track.append(bt); return bt; });
    const kv = el('dl', { class: 'kv' });
    host.append(track, kv);
    function upd() {
      btns.forEach(bt => bt.setAttribute('aria-pressed', String(bt.textContent === cur)));
      const p = P[cur];
      kv.innerHTML = [['ประเภท', p.type], ['รู้อะไรบ้าง', p.knows], ['Metric', p.metric], ['อัลกอริทึม', p.alg], ['AD', p.ad], ['การอัปเดต', p.upd]].map(([a, v]) => `<dt>${a}</dt><dd${a === 'Metric' ? ' class="c-violet"' : ''}>${v}</dd>`).join('');
    }
    upd();
  })();

  /* ---------- three tables of router R ---------- */
  (() => {
    const host = $('#fig-tables');
    const an = analyze(EX);
    const order = EX.map((p, i) => i).sort((a, c) => an.fd[a] - an.fd[c]);
    const tb = (k, title, lines) => el('div', { class: 'tb' }, el('button', { class: 'h', 'data-k': k, html: `${title}${icon('chev')}` }), el('div', { class: 'cli', html: lines.join('\n') }));
    const nb = tb('nbrtbl', 'Neighbor table', EX.map(p => `${p.name}  ${p.ip.padEnd(9)}  ${p.ifc}`));
    const tp = tb('topotbl', 'Topology table', [`P 10.9.0.0/24, 1 successors, FD is <span class="c-violet">35</span>`, ...order.map(i => { const p = EX[i], r = an.roles[i]; return `<span class="ln r-${r}">  via ${p.ip} (<span class="c-violet">${an.fd[i]}</span>/<span class="c-amber">${p.rd}</span>), ${p.ifc}</span>`; }), `<span class="muted note">คำสั่ง show ip eigrp topology ปกติแสดงเฉพาะ successor กับ FS ทาง C จึงไม่ขึ้นในคำสั่งนี้</span>`]);
    const rt = tb('rtbl', 'Routing table', [`<span class="ln r-succ">D 10.9.0.0/24 [90/<span class="c-violet">35</span>]\n  via 10.0.2.2, G0/2</span>`]);
    const arrow = t => el('div', { class: 'arr', html: `<span>${t}</span>${icon('arrow')}` });
    const row = el('div', { class: 'tbls' }, nb, arrow('เพื่อนบ้านบอกเส้นทางมา'), tp, arrow(`${Hop.t('dual', 'DUAL')} เลือกทางที่ดีที่สุด`), rt);
    host.append(row);
    const say = el('p', { class: 'say', html: `เส้นทางผ่าน ${b('green', 'B')} ถูกส่งลง routing table ส่วน ${b('blue', 'A')} กับ ${b('blue', 'D')} รออยู่ใน topology table เป็นทางสำรอง ตัวเลขในวงเล็บคือ (${b('violet', 'FD')}/${b('amber', 'RD')}) ของแต่ละทาง` });
    host.append(say);
    Hop.onView(host, () => row.classList.add('go'));
  })();

  /* ---------- metric formula ---------- */
  Hop.eq($('#eq-full'), [['metric', 'metric'], ' = ([', ['kval', 'K1'], '×', ['bw', 'bandwidth'], ' + (', ['kval', 'K2'], '×', ['bw', 'bandwidth'], ') / (256 − ', ['load', 'load'], ') + ', ['kval', 'K3'], '×', ['delay', 'delay'], '] × [', ['kval', 'K5'], ' / (', ['rel', 'reliability'], ' + ', ['kval', 'K4'], ')]) × 256'], { sym: { kval: 'K1–K5' } });
  Hop.eq($('#eq-short'), [['metric', 'metric'], ' = (', ['bw', 'bandwidth'], ' + ', ['delay', 'delay'], ') × 256'], { legend: false });
  Hop.eq($('#eq-short'), [['bw', 'bandwidth'], ' = 10,000,000 / bandwidth ที่ช้าที่สุด (kb/s)'], { legend: false });
  Hop.eq($('#eq-short'), [['delay', 'delay'], ' = delay รวมทุก interface (µs) / 10'], { legend: false });
  (() => {
    const host = $('#fig-metric');
    const L = (from, bw, dly, kind) => ({ from, bw, dly, kind });
    const OPTS = [
      { t: 'R2 → R3 → LAN', d: 'FD ของทางผ่าน R3', links: [L('R2 S0/0/1', 1024, 20000, 'Serial'), L('R3 G0/0', 1000000, 10, 'Gigabit')], role: 'fd' },
      { t: 'R2 → R1 → R3 → LAN', d: 'FD ของทางผ่าน R1', links: [L('R2 S0/0/0', 64, 20000, 'Serial'), L('R1 S0/0/1', 1544, 20000, 'Serial'), L('R3 G0/0', 1000000, 10, 'Gigabit')], role: 'fd' },
      { t: 'R1 → R3 → LAN', d: 'RD ที่ R1 บอก R2', links: [L('R1 S0/0/1', 1544, 20000, 'Serial'), L('R3 G0/0', 1000000, 10, 'Gigabit')], role: 'rd' },
      { t: 'R3 → LAN', d: 'RD ที่ R3 บอก R2', links: [L('R3 G0/0', 1000000, 10, 'Gigabit')], role: 'rd' },
    ];
    let cur = 0;
    const seg = el('div', { class: 'chips' });
    OPTS.forEach((op, i) => seg.append(el('button', { class: 'chip', text: op.t, onclick: () => { cur = i; upd(); } })));
    const chain = el('div', { class: 'chain' });
    const work = el('div', { class: 'mwork' });
    host.append(seg, chain, work);
    const bwTxt = k => k >= 1000000 ? '1 Gb/s' : fmt(k) + ' kb/s';
    function upd() {
      $$('.chip', seg).forEach((c, i) => c.setAttribute('aria-pressed', String(i === cur)));
      const op = OPTS[cur], slow = Math.min(...op.links.map(l => l.bw));
      const bwT = Math.floor(1e7 / slow), dsum = op.links.reduce((a, l) => a + l.dly, 0), dT = Math.floor(dsum / 10), m = (bwT + dT) * 256;
      chain.replaceChildren(...op.links.map(l => el('div', { class: 'lnk' + (l.bw === slow ? ' slow' : ''), html: `<b>${l.from}</b><span>${l.kind} ${bwTxt(l.bw)}</span><span>delay ${fmt(l.dly)} µs</span>` })));
      work.innerHTML = `<div>bandwidth = 10,000,000 / ${fmt(slow)} = <b>${fmt(bwT)}</b> <span class="muted">(ลิงก์ที่ช้าที่สุด)</span></div>` +
        `<div>delay = (${op.links.map(l => fmt(l.dly)).join(' + ')}) / 10 = <b>${fmt(dT)}</b></div>` +
        `<div class="res">metric = (${fmt(bwT)} + ${fmt(dT)}) × 256 = <b class="c-${op.role === 'rd' ? 'amber' : 'violet'}">${fmt(m)}</b> <span class="muted">${op.d}</span></div>`;
    }
    upd();
  })();

  /* ---------- FD = cost + RD ---------- */
  Hop.eq($('#eq-fd'), [['fd', 'FD'], ' = ', ['cost', 'cost'], ' + ', ['rd', 'RD']]);
  (() => {
    const host = $('#fig-fd');
    let sel = 0;
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const topo = Topo(left, { onPick: i => { sel = i; upd(true); } });
    const big = el('div', { class: 'bigsum' });
    const sums = el('div', { class: 'sums' });
    right.append(big, sums);
    const say = el('p', { class: 'say' }); right.append(say);
    function upd(send) {
      const an = topo.set(EX, { sel, roles: false });
      const p = EX[sel];
      big.innerHTML = `<div class="lab">FD ผ่าน ${p.name}</div><div class="eqn"><span class="c-violet">${an.fd[sel]}</span> = <span class="c-teal">${p.cost}</span> + <span class="c-amber">${p.rd}</span></div>`;
      sums.replaceChildren(...EX.map((q, i) => el('button', { class: 'sm' + (i === sel ? ' on' : ''), onclick: () => { sel = i; upd(true); }, html: `<b>${q.name}</b><span><span class="c-teal">${q.cost}</span> + <span class="c-amber">${q.rd}</span> = <span class="c-violet">${an.fd[i]}</span></span>` })));
      say.innerHTML = `ท่อนแรก R ถึง ${p.name} เป็น ${b('teal', 'cost ' + p.cost)} ที่ R เห็นเอง ท่อนสอง ${p.name} บอกมาว่าจากตัวมันถึง X อีก ${b('amber', 'RD ' + p.rd)} รวมกันได้ ${b('violet', 'FD ' + an.fd[sel])}`;
      if (send) topo.send(sel, { color: C.fd });
    }
    upd(false);
  })();
  Hop.mcq($('#q-fd'), {
    q: 'R ไปเครือข่าย Y ผ่านเพื่อนบ้าน E ได้ ลิงก์ R ถึง E มี cost 12 และ E รายงานว่าจาก E ถึง Y มีระยะ 18 ทางผ่าน E มี FD และ RD เท่าไร',
    opts: ['FD = 30, RD = 18', 'FD = 18, RD = 30', 'FD = 30, RD = 12', 'FD = 18, RD = 12'], a: 0,
    whyWrong: { 1: 'สลับกัน RD คือระยะที่ E บอกมา (18) ส่วน FD คือผลรวมทั้งเส้น', 2: '12 คือ cost ของลิงก์ระหว่าง R กับ E ไม่ใช่ RD RD ไม่รวมลิงก์ระหว่างเรากับเพื่อนบ้าน', 3: 'FD ต้องรวมทั้งเส้นตั้งแต่ R ไม่ใช่แค่ส่วนที่ E บอก' },
    why: 'RD = ระยะที่ E รายงาน = 18 ส่วน FD = cost ถึง E + RD = 12 + 18 = 30',
  });

  /* ---------- successor + feasibility, live sliders ---------- */
  Hop.eq($('#eq-fc'), [['successor', 'Successor'], ' = ทางที่ ', ['fd', 'FD'], ' ต่ำสุด'], { legend: false });
  Hop.eq($('#eq-fc'), [['fs', 'FS'], ' ⇔ ', ['rd', 'RD ของทางนั้น'], ' < ', ['fd', 'FD ของ successor']]);
  (() => {
    const host = $('#fig-fs');
    const P = EX.map(p => ({ ...p }));
    const CI = 2; // path C is the one we play with
    let why = false;
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const topo = Topo(left, { onPick: () => {} });
    const nl = el('div', { class: 'nline' }); right.append(nl);
    const mk = (lab, cls, min, max, key) => {
      const v = el('b', { class: cls });
      const s = el('input', { type: 'range', class: 'slider ' + cls, min, max, value: P[CI][key], 'aria-label': lab });
      s.addEventListener('input', () => { P[CI][key] = +s.value; upd(); });
      right.append(el('div', { class: 'srow' }, el('span', { html: `${lab} ` }, v), s));
      return { s, v };
    };
    const sc = mk('cost ถึง C', 'c-teal', 1, 45, 'cost');
    const sr = mk('RD ของ C', 'c-amber', 2, 60, 'rd');
    const whyB = el('button', { class: 'btn small', html: 'ทำไม C ถึงไม่ปลอดภัย', onclick: () => { why = !why; upd(); } });
    const reset = el('button', { class: 'btn small ghost', html: `${icon('replay')} ค่าเดิม`, onclick: () => { P[CI].cost = 5; P[CI].rd = 40; sc.s.value = 5; sr.s.value = 40; why = false; upd(); } });
    right.append(el('div', { class: 'ctrls' }, whyB, reset));
    const say = el('p', { class: 'say' }); right.append(say);
    function upd() {
      const an = topo.set(P, { sel: -1, roles: true });
      sc.v.textContent = P[CI].cost; sr.v.textContent = P[CI].rd;
      [sc.s, sr.s].forEach(s => s.style.setProperty('--p', ((s.value - s.min) / (s.max - s.min) * 100) + '%'));
      numberLine(nl, P, an);
      const cRole = an.roles[CI];
      whyB.hidden = cRole !== 'no';
      if (cRole !== 'no') why = false;
      topo.loop(CI, an.succ, why);
      whyB.innerHTML = why ? 'ซ่อนเส้นวน' : 'ทำไม C ถึงไม่ปลอดภัย';
      const best = an.best, sname = P[an.succ].name;
      if (why) say.innerHTML = `ถ้า C ส่งไป X ผ่าน R เอง ระยะของ C จะเป็นระยะของ R (${b('violet', best)}) บวกลิงก์ C–R อีก ${b('teal', P[CI].cost)} = ${best + P[CI].cost} ซึ่งไม่มีทางน้อยกว่า ${best} พอ C บอกว่า ${b('amber', P[CI].rd)} (ไม่น้อยกว่า ${best}) R จึงแยกไม่ออกว่า C วิ่งผ่านตัวเองหรือเปล่า ถ้าส่งให้ C แพ็กเก็ตอาจวนกลับมา (เส้นสีแดง)`;
      else say.innerHTML = explain(P, an, CI) + (an.succ !== 1 && an.roles[1] !== 'succ' ? '' : '') + (an.roles[CI] === 'succ' ? ` ตอนนี้ทุกทางต้องเทียบ RD กับ ${b('violet', best)} แทน` : '');
    }
    upd();
  })();

  // FD dots on top row, RD dots on bottom row, a violet line at the successor's FD; RD left of the line = FS zone
  function numberLine(host, P, an) {
    const all = [...an.fd, ...P.map(p => p.rd)];
    const max = Math.ceil((Math.max(...all) + 4) / 10) * 10;
    const X = v => (v / max * 100);
    const row = (cls, title, vals, roleOf, label) => {
      const r = el('div', { class: 'nrow ' + cls }, el('div', { class: 'nt', html: title }), el('div', { class: 'nax' }));
      const ax = r.lastChild;
      const sorted = vals.map((v, i) => ({ v, i })).sort((a, c) => a.v - c.v);
      let lastX = -99, lift = 0;
      sorted.forEach(({ v, i }) => {
        const x = X(v); lift = (x - lastX) < 9 ? lift + 1 : 0; lastX = x;
        ax.append(el('div', { class: 'nd ' + roleOf(i), style: `left:${x}%` }, el('i'), el('span', { style: `--lift:${lift}`, html: label(i, v) })));
      });
      return r;
    };
    const fdRow = row('fdr', `${Hop.t('fd', 'FD')} ของแต่ละทาง`, an.fd, i => 'r-' + an.roles[i], (i, v) => `${P[i].name} <small>${v}</small>`);
    const rdRow = row('rdr', `${Hop.t('rd', 'RD')} ของแต่ละทาง`, P.map(p => p.rd), i => an.roles[i] === 'succ' ? 'r-me' : 'r-' + an.roles[i], (i, v) => `${P[i].name} <small>${v}</small>`);
    const line = el('div', { class: 'cut', style: `left:${X(an.best)}%` }, el('span', { html: `FD ของ successor = ${an.best}` }));
    const zone = el('div', { class: 'zone', style: `width:${X(an.best)}%` }, el('span', { text: 'โซน FS (RD น้อยกว่าเส้นนี้)' }));
    const scale = el('div', { class: 'nscale' }, ...[0, max / 2, max].map(v => el('span', { style: `left:${X(v)}%`, text: v })));
    const wrap = el('div', { class: 'nwrap' }, fdRow, rdRow, zone, line, scale);
    host.replaceChildren(wrap);
  }
  Hop.mcq($('#q-fs'), {
    q: 'successor มี FD = 35 เพื่อนบ้าน E รายงาน RD = 35 พอดี และ FD ผ่าน E = 47 E เป็น feasible successor หรือไม่',
    opts: ['ไม่เป็น เพราะ RD ต้องน้อยกว่า FD ของ successor เท่ากันไม่ผ่าน', 'เป็น เพราะ RD ไม่เกิน FD ของ successor', 'ไม่เป็น เพราะ FD ผ่าน E (47) มากกว่า 35', 'เป็น เพราะ FD ผ่าน E เป็นอันดับสอง'], a: 0,
    whyWrong: { 1: 'เงื่อนไขคือ "น้อยกว่า" อย่างเคร่งครัด RD 35 ไม่น้อยกว่า 35', 2: 'คำตอบถูกแต่เหตุผลผิด FD ของทางนั้นไม่ใช่สิ่งที่ใช้ตัดสิน ถ้า RD ของ E เป็น 34 ต่อให้ FD เป็น 47 E ก็เป็น FS', 3: 'อันดับของ FD ใช้เลือก successor เท่านั้น ส่วน FS ดูที่ RD' },
    why: 'Feasibility condition: RD &lt; FD ของ successor → 35 &lt; 35 ไม่จริง E จึงไม่ใช่ FS (เป็นแค่เส้นทางที่รู้จักใน topology table)',
  });
  Hop.mcq($('#q-fs'), {
    q: 'จากตาราง: ทาง P มี FD 20 (RD 12), ทาง Q มี FD 26 (RD 4), ทาง S มี FD 22 (RD 21) ข้อใดถูก',
    opts: ['Successor = P, FS = Q', 'Successor = Q เพราะ RD ต่ำที่สุด', 'Successor = P, FS = Q และ S', 'Successor = P, FS = S เพราะ FD 22 เป็นอันดับสอง'], a: 0,
    whyWrong: { 1: 'successor เลือกจาก FD (ระยะรวมทั้งเส้น) ไม่ใช่ RD Q มี FD 26 ซึ่งมากกว่า P (20)', 2: 'S มี RD 21 ซึ่งไม่น้อยกว่า 20 (FD ของ successor) จึงไม่ผ่าน', 3: 'S มี FD อันดับสองก็จริง แต่ FS ดูที่ RD: 21 &lt; 20 ไม่จริง' },
    why: 'FD ต่ำสุดคือ 20 (P) → successor = P, FD = 20 แล้วเทียบ RD: Q 4 &lt; 20 จริง → FS, S 21 &lt; 20 ไม่จริง → ไม่ใช่ FS',
  });

  /* ---------- slide triangle (R2, R1, R3) ---------- */
  const TRI = {
    R2: [180, 64], R1: [56, 228], R3: [304, 228], LAN: [304, 290],
  };
  function triSvg() {
    const { R2, R1, R3, LAN } = TRI;
    const ln = (a, c, cls = 'base') => `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${c[0]}" y2="${c[1]}"/>`;
    const poly = (pts, cls) => `<polyline class="${cls}" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
    let s = '';
    s += ln(R2, R1, 'base l21') + ln(R2, R3, 'base l23') + ln(R1, R3, 'base l13') + ln(R3, LAN, 'base l3l');
    s += `<line class="base lanbar" x1="${LAN[0] - 44}" y1="${LAN[1]}" x2="${LAN[0] + 44}" y2="${LAN[1]}"/>`;
    // overlays: path via R3 and via R1, each split into cost part and RD part
    s += `<g class="ov">` +
      poly([R2, R3], 'p3 c') + poly([R3, LAN], 'p3 r') + poly([R2, R1], 'p1 c') + poly([R1, R3, LAN], 'p1 r') +
      poly([R2, R1, R3, LAN], 'p1 role') + poly([R2, R3, LAN], 'p3 role') + `</g>`;
    // link labels
    s += `<text class="bw" x="104" y="140" text-anchor="end">64 kb/s</text><text class="sn" x="104" y="157" text-anchor="end">172.16.3.0/30</text>`;
    s += `<text class="bw" x="256" y="140">1024 kb/s</text><text class="sn" x="256" y="157">192.168.10.8/30</text>`;
    s += `<text class="bw" x="180" y="218" text-anchor="middle">1544 kb/s</text><text class="sn" x="180" y="248" text-anchor="middle">192.168.10.4/30</text>`;
    s += `<text class="ifc" x="152" y="84" text-anchor="end">S0/0/0</text><text class="ifc" x="208" y="84">S0/0/1</text>`;
    s += `<text class="ifc" x="70" y="192" text-anchor="end">.1</text><text class="ifc" x="290" y="192" text-anchor="end">.10</text>`;
    s += `<text class="sn" x="${LAN[0]}" y="${LAN[1] + 22}" text-anchor="middle">192.168.1.0/24</text>`;
    s += `<g class="cutx" transform="translate(217 113)"><circle r="15"/><path d="M-6 -6l12 12M6 -6l-12 12"/></g>`;
    s += `<g class="nb r2" transform="translate(${R2[0]} ${R2[1]})"><circle class="halo" r="26"/><g class="gl">${Hop.dev('router', 0, 0, { c: 'currentColor', s: .9 })}</g><text class="nm" y="-30" text-anchor="middle">R2</text></g>`;
    s += `<g class="nb r1" transform="translate(${R1[0]} ${R1[1]})"><circle class="halo" r="26"/><g class="gl">${Hop.dev('router', 0, 0, { c: 'currentColor', s: .9 })}</g><text class="nm" y="42" text-anchor="middle">R1</text></g>`;
    s += `<g class="nb r3" transform="translate(${R3[0]} ${R3[1]})"><circle class="halo" r="26"/><g class="gl">${Hop.dev('router', 0, 0, { c: 'currentColor', s: .9 })}</g><text class="nm" x="30" y="-22" text-anchor="start">R3</text></g>`;
    s += `<circle class="pkt" r="7" opacity="0"/>`;
    const svg = el('svg', { viewBox: '0 0 360 320', class: 'tsvg tri' });
    svg.innerHTML = s;
    return svg;
  }
  // move a dot along a polyline at fraction f
  function along(pts, f) {
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); L += l; }
    let d = clamp(f, 0, 1) * L;
    for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const k = segs[i] ? d / segs[i] : 0; return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)]; } d -= segs[i]; }
  }
  const dotAt = (svg, pts, f, color) => {
    const dot = $('.pkt', svg);
    if (pts == null) { dot.setAttribute('opacity', 0); return; }
    const [x, y] = along(pts, f); dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('fill', color);
    dot.setAttribute('opacity', f < .06 ? f / .06 : f > .94 ? (1 - f) / .06 : 1);
  };
  const P3 = [TRI.R2, TRI.R3, TRI.LAN], P1 = [TRI.R2, TRI.R1, TRI.R3, TRI.LAN];
  const TRIPATHS = [
    { name: 'ผ่าน R3', sub: '192.168.10.10, Serial0/0/1', rd: 2816, fd: 3012096 },
    { name: 'ผ่าน R1', sub: '172.16.3.1, Serial0/0/0', rd: 2170112, fd: 41024256 },
  ];

  (() => {
    const host = $('#fig-tri');
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const svg = triSvg(); left.append(el('div', { class: 'topo' }, svg));
    const list = PathList(right, { cost: false, big: true, sub: true });
    const cmp = el('div', { class: 'cmp' }); right.append(cmp);
    const cli = el('div', { class: 'cli big' }); host.append(cli);
    const say = el('p', { class: 'say' }); host.append(say);
    const an = analyze(TRIPATHS);
    const CLI = [
      ['h', 'R2# show ip eigrp topology'],
      ['top', `P 192.168.1.0/24, 1 successors, FD is <span class="c-violet">3012096</span>`],
      ['l3', `  via 192.168.10.10 (<span class="c-violet">3012096</span>/<span class="c-amber">2816</span>), Serial0/0/1`],
      ['l1', `  via 172.16.3.1 (<span class="c-violet">41024256</span>/<span class="c-amber">2170112</span>), Serial0/0/0`],
      ['h', ''],
      ['h', 'R2# show ip route'],
      ['rt', `D 192.168.1.0/24 [90/<span class="c-violet">3012096</span>]
  via 192.168.10.10, 00:12:32, Serial0/0/1`],
    ];
    cli.innerHTML = CLI.map(([k, t]) => `<div class="ln k-${k}">${t || ' '}</div>`).join('');
    const SAY = [
      `R2 ต้องส่งแพ็กเก็ตไป 192.168.1.0/24 ซึ่งเป็น LAN หลัง R3 มีสองทาง: ตรงไป R3 หรืออ้อมไป R1 ก่อน ตัวเลขบนลิงก์คือ bandwidth (ลิงก์ R2–R1 ช้าที่สุดแค่ 64 kb/s)`,
      `ทางผ่าน R3: ${b('teal', 'R2 → R3')} แล้ว ${b('amber', 'R3 → LAN')} R3 รายงาน RD = ${b('amber', '2,816')} (R3 ต่อ LAN ตรงด้วย Gigabit) รวมทั้งเส้นได้ FD = ${b('violet', '3,012,096')}`,
      `ทางผ่าน R1: ${b('teal', 'R2 → R1')} แล้ว ${b('amber', 'R1 → R3 → LAN')} R1 รายงาน RD = ${b('amber', '2,170,112')} แต่ลิงก์ R2–R1 ช้ามาก FD รวมจึงเป็น ${b('violet', '41,024,256')}`,
      `FD ต่ำสุดคือ ${b('violet', '3,012,096')} ทางผ่าน R3 จึงเป็น ${b('green', 'successor')} คือ next hop 192.168.10.10 ออกทาง Serial0/0/1 และ FD ของเส้นทางนี้คือ 3,012,096`,
      `เช็ค R1 ด้วย RD ไม่ใช่ FD: ${b('amber', '2,170,112')} &lt; ${b('violet', '3,012,096')} จริง R1 จึงเป็น ${b('blue', 'feasible successor')} แม้ FD ของทางนี้ (41,024,256) จะสูงกว่ามากก็ตาม`,
      `ทุกตัวเลขอยู่ใน topology table: แต่ละบรรทัดคือ via IP เพื่อนบ้าน (${b('violet', 'FD')}/${b('amber', 'RD')}) และ routing table เก็บแค่ successor พร้อม [AD 90/FD]`,
    ];
    let lastK = -1;
    Hop.scrub(host, {
      stops: [{ label: '<span class="k">โจทย์</span> R2 ไป 192.168.1.0/24' }, { label: '<span class="k">ทาง 1</span> ผ่าน R3' }, { label: '<span class="k">ทาง 2</span> ผ่าน R1' }, { label: '<span class="k">FD ต่ำสุด</span> Successor = R3' }, { label: '<span class="k">RD &lt; FD</span> R1 เป็น FS' }, { label: '<span class="k">ตาราง</span> show ip eigrp topology' }],
      speed: 1700,
      onFrame(t) {
        const k = Math.round(t), i = Math.floor(t), f = t - i;
        // dot: during 0->1 along via R3, 1->2 along via R1
        if (i === 0 && f > 0) dotAt(svg, P3, f, C.fd); else if (i === 1 && f > 0) dotAt(svg, P1, f, C.fd); else dotAt(svg, null);
        if (k === lastK) return; lastK = k;
        svg.setAttribute('class', 'tsvg tri s' + k);
        const hidden = k < 1 ? [0, 1] : k < 2 ? [1] : [];
        list.render(TRIPATHS, an, k === 1 ? 0 : k === 2 ? 1 : -1, { roles: k >= 3, hidden });
        if (k < 3) { $$('.role', list.box).forEach(r => r.remove()); }
        if (k === 3) { const fsr = $$('.pr', list.box)[2]; if (fsr) $('.role', fsr) && $('.role', fsr).remove(); }
        cmp.innerHTML = k >= 4 ? `<div class="lab">เช็ค R1</div><div class="eqn"><span class="c-amber">2,170,112</span> &lt; <span class="c-violet">3,012,096</span></div><div class="lab c-blue">จริง → R1 เป็น FS</div>` : k === 3 ? `<div class="lab">FD ต่ำสุด</div><div class="eqn"><span class="c-violet">3,012,096</span> &lt; <span class="c-violet">41,024,256</span></div><div class="lab c-green">→ successor ผ่าน R3</div>` : '';
        $$('.ln', cli).forEach(l => { const kk = [...l.classList].find(c => c.startsWith('k-')).slice(2); l.classList.toggle('lit', (k === 1 && kk === 'l3') || (k === 2 && kk === 'l1') || (k === 3 && (kk === 'top' || kk === 'rt' || kk === 'l3')) || (k === 4 && kk === 'l1') || k === 5); });
        say.innerHTML = SAY[k];
      },
    });
    host.append(el('div', { class: 'answer', html: `<div class="h">เขียนในกระดาษคำตอบ</div><div>Successor ของ R2 ไป 192.168.1.0/24 คือ R3 (next hop 192.168.10.10) ส่งออกทาง Serial0/0/1</div><div>FD = 3,012,096</div><div>Feasible successor คือ R1 (172.16.3.1) ทาง Serial0/0/0 เพราะ RD ของ R1 = 2,170,112 &lt; 3,012,096</div>` }));
  })();
  Hop.mcq($('#q-tri'), {
    q: 'ใน topology table เดียวกัน R2 ไป 172.16.1.0/24 (LAN ของ R1) มีสองบรรทัด: via 192.168.10.10 (3524096/2170112) และ via 172.16.3.1 (40512256/2816) ข้อใดถูก',
    opts: ['Successor คือ R3 (192.168.10.10) และ R1 เป็น FS', 'Successor คือ R1 เพราะ LAN นี้ต่อกับ R1 ตรงๆ', 'Successor คือ R3 และไม่มี FS', 'Successor คือ R1 เพราะ RD ต่ำกว่า'], a: 0,
    whyWrong: { 1: 'ต่อตรงแต่ลิงก์ R2–R1 ช้าแค่ 64 kb/s FD ผ่าน R1 คือ 40,512,256 สูงกว่าทางอ้อมผ่าน R3 (3,524,096)', 2: 'RD ของ R1 คือ 2,816 ซึ่งน้อยกว่า 3,524,096 R1 จึงผ่านเงื่อนไข', 3: 'successor เลือกจาก FD ไม่ใช่ RD' },
    why: 'FD ต่ำสุด 3,524,096 อยู่ที่ via 192.168.10.10 → successor = R3 แล้วเช็ค R1: RD 2,816 &lt; 3,524,096 จริง → R1 เป็น FS (ตัวเลขชุดนี้อยู่ในสไลด์หน้า 22 จริง)',
  });

  /* ---------- successor fails: FS promoted vs active + query ---------- */
  (() => {
    const host = $('#fig-fail');
    let mode = 'fs';
    const seg = el('div', { class: 'seg', role: 'group' },
      el('button', { 'aria-pressed': 'true', text: 'R1 เป็น FS (ตามสไลด์)', onclick: () => setMode('fs') }),
      el('button', { 'aria-pressed': 'false', text: 'สมมติไม่มี FS', onclick: () => setMode('nofs') }));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 14px' }, seg));
    const grid = el('div', { class: 'mapgrid' }); host.append(grid);
    const left = el('div'), right = el('div', { class: 'side' }); grid.append(left, right);
    const svg = triSvg(); left.append(el('div', { class: 'topo' }, svg));
    const N = (id, t, cls = '') => el('div', { class: 'fn ' + cls, 'data-n': id, html: t });
    const fsm = el('div', { class: 'fsm' },
      N('lost', 'ขาดการติดต่อกับ successor', 'wide'),
      N('q', 'มี feasible successor ไหม', 'wide dia'),
      el('div', { class: 'br' }, el('div', { class: 'yes', text: 'มี' }), el('div', { class: 'no', text: 'ไม่มี' })),
      el('div', { class: 'cols' },
        el('div', {}, N('promote', 'ยก FS ขึ้นเป็น successor'), N('install', 'ใส่ลง routing table ทันที')),
        el('div', {}, N('active', 'เข้า active state'), N('query', 'ส่ง query ถามเพื่อนบ้าน'), N('nbr', 'เพื่อนบ้านมีทางไหม'), N('select', 'เลือก successor ใหม่ แล้วใส่ routing table'))));
    right.append(fsm);
    const rt = el('div', { class: 'cli' }); right.append(rt);
    const say = el('p', { class: 'say' }); host.append(say);
    const scHost = el('div'); host.append(scHost);
    const RT_OLD = `D 192.168.1.0/24 [90/<span class="c-violet">3012096</span>]\n  via 192.168.10.10, Serial0/0/1`;
    const RT_NEW = `D 192.168.1.0/24 [90/<span class="c-violet">41024256</span>]\n  via 172.16.3.1, Serial0/0/0`;
    const V = {
      fs: {
        stops: ['<span class="k">ปกติ</span> ส่งผ่าน R3', '<span class="k">ลิงก์ขาด</span> R2–R3 ใช้ไม่ได้', '<span class="k">เช็ค</span> มี FS อยู่แล้ว', '<span class="k">ทันที</span> R1 ขึ้นเป็น successor', '<span class="k">ส่งต่อ</span> ผ่าน R1'],
        nodes: [[], ['lost'], ['lost', 'q', 'yes'], ['lost', 'q', 'yes', 'promote'], ['lost', 'q', 'yes', 'promote', 'install']],
        say: [
          `ตอนปกติ R2 ส่งแพ็กเก็ตไป 192.168.1.0/24 ผ่าน ${b('green', 'R3')} (successor) และมี ${b('blue', 'R1')} รออยู่ใน topology table เป็น FS`,
          `ลิงก์ R2–R3 ขาด R2 เสีย successor ไป`,
          `DUAL ดูใน topology table ก่อน พบว่ามี ${b('blue', 'R1')} ซึ่งผ่านเงื่อนไข RD &lt; FD ไว้แล้วตั้งแต่ตอนแรก`,
          `R1 ถูกยกเป็น ${b('green', 'successor')} ทันที ไม่ต้องคำนวณใหม่ ไม่ต้องถามใคร FD ใหม่ = ${b('violet', '41,024,256')}`,
          `แพ็กเก็ตวิ่งต่อผ่าน R1 ได้เลย นี่คือเหตุผลที่ EIGRP converge เร็ว`,
        ],
      },
      nofs: {
        stops: ['<span class="k">ปกติ</span> ส่งผ่าน R3', '<span class="k">ลิงก์ขาด</span> R2–R3 ใช้ไม่ได้', '<span class="k">ไม่มี FS</span> เข้า active', '<span class="k">Query</span> ถาม R1', '<span class="k">Reply</span> R1 ตอบกลับ', '<span class="k">เลือกใหม่</span> R1 เป็น successor'],
        nodes: [[], ['lost'], ['lost', 'q', 'no', 'active'], ['lost', 'q', 'no', 'active', 'query'], ['lost', 'q', 'no', 'active', 'query', 'nbr'], ['lost', 'q', 'no', 'active', 'query', 'nbr', 'select']],
        say: [
          `สมมติว่า R1 รายงาน RD = 3,500,000 ซึ่งไม่น้อยกว่า FD 3,012,096 R1 จึงไม่ผ่านเงื่อนไข ตอนนี้ R2 มีแค่ successor ผ่าน R3 ไม่มีทางสำรอง`,
          `ลิงก์ R2–R3 ขาด R2 เสีย successor ไป`,
          `ใน topology table ไม่มี FS R2 จึงใส่ปลายทางนี้เข้า ${b('rose', 'active state')} ระหว่างนี้ยังส่งแพ็กเก็ตไปปลายทางไม่ได้`,
          `R2 ส่ง ${b('rose', 'query')} ถามเพื่อนบ้าน (R1) ว่ามีทางไป 192.168.1.0/24 ไหม แล้วต้องรอคำตอบ`,
          `R1 ตอบ reply ว่ามีทาง (R1 → R3 → LAN)`,
          `R2 จึงเลือก R1 เป็น ${b('green', 'successor')} ใหม่ ช้ากว่ากรณีมี FS เพราะต้องรอ query กับ reply ก่อน (ถ้าไม่มีเพื่อนบ้านตัวไหนมีทาง ปลายทางนี้จะถูกลบออกจากตาราง)`,
        ],
      },
    };
    function setMode(m) {
      mode = m;
      $$('button', seg).forEach((x, i) => x.setAttribute('aria-pressed', String((i === 0) === (m === 'fs'))));
      fsm.classList.toggle('m-nofs', m === 'nofs');
      build();
    }
    function build() {
      const v = V[mode]; let lastK = -1;
      scHost.innerHTML = '';
      Hop.scrub(scHost, {
        stops: v.stops.map(label => ({ label })), speed: 1600,
        onFrame(t) {
          const k = Math.round(t), i = Math.floor(t), f = t - i;
          const promoted = mode === 'fs' ? k >= 3 : k >= 5;
          // dots
          if (i === 0 && f > 0) dotAt(svg, P3, f, C.succ);
          else if (mode === 'fs' && i === 3 && f > 0) dotAt(svg, P1, f, C.succ);
          else if (mode === 'nofs' && i === 2 && f > 0) dotAt(svg, [TRI.R2, TRI.R1], f, C.bad);
          else if (mode === 'nofs' && i === 3 && f > 0) dotAt(svg, [TRI.R1, TRI.R2], f, C.bad);
          else if (mode === 'nofs' && i === 4 && f > 0) dotAt(svg, P1, f, C.succ);
          else if (t >= v.stops.length - 1 - 1e-6) dotAt(svg, null);
          else dotAt(svg, null);
          if (k === lastK) return; lastK = k;
          svg.setAttribute('class', `tsvg tri f-${mode} k${k}` + (k >= 1 ? ' cut' : '') + (promoted ? ' promoted' : '') + (mode === 'nofs' && k >= 2 && k < 5 ? ' activ' : ''));
          $$('.fn, .yes, .no', fsm).forEach(nd => nd.classList.remove('on'));
          v.nodes[k].forEach(id => { const nd = id === 'yes' || id === 'no' ? $('.' + id, fsm) : $(`[data-n="${id}"]`, fsm); if (nd) nd.classList.add('on'); });
          rt.innerHTML = `<div class="muted">R2# show ip route</div>` + (promoted ? `<div class="ln lit">${RT_NEW}</div>` : k >= 1 ? `<div class="ln gone">${RT_OLD}</div>` : `<div class="ln">${RT_OLD}</div>`);
          say.innerHTML = v.say[k];
        },
      });
    }
    setMode('fs');
  })();
  Hop.mcq($('#q-fail'), {
    q: 'ถ้า successor ล่มและมี feasible successor อยู่ใน topology table EIGRP ทำอะไร',
    opts: ['ยก feasible successor ขึ้นเป็น successor ทันที ไม่ต้องส่ง query', 'ส่ง query ถามเพื่อนบ้านทุกตัวก่อน แล้วค่อยเลือก', 'รอ update รอบถัดไปจากเพื่อนบ้าน 30 วินาที', 'ลบปลายทางออกจาก routing table'], a: 0,
    whyWrong: { 1: 'query ใช้เฉพาะตอนไม่มี FS (active state)', 2: 'การรอ update เป็นระยะเป็นพฤติกรรมของ RIP ไม่ใช่ EIGRP', 3: 'ลบออกเฉพาะเมื่อไม่มี FS และเพื่อนบ้านไม่มีใครมีทาง' },
    why: 'FS ผ่านเงื่อนไข RD &lt; FD ไว้แล้วจึงรับประกันว่าไม่วนลูป DUAL จึงใช้ได้ทันที นี่คือเหตุผลที่ EIGRP converge เร็ว',
  });

  Hop.mcq($('#q-method'), {
    q: 'R มี 4 ทางไปปลายทาง (FD/RD): W 40/22, X 31/28, Y 33/31, Z 52/30 ข้อใดถูก',
    opts: ['Successor = X (FD 31), FS = W และ Z', 'Successor = W เพราะ RD ต่ำสุด, FS = X', 'Successor = X, FS = W, Y และ Z', 'Successor = X, FS = Y เพราะ FD 33 ใกล้ที่สุด'], a: 0,
    whyWrong: { 1: 'successor เลือกจาก FD ต่ำสุด ซึ่งคือ X (31) ไม่ใช่ W', 2: 'Y มี RD 31 เท่ากับ FD ของ successor เท่ากันไม่ผ่าน', 3: 'FD ที่ใกล้ไม่ได้ทำให้เป็น FS Y มี RD 31 ไม่น้อยกว่า 31' },
    why: 'FD ต่ำสุด = 31 (X) → successor X แล้วเทียบ RD กับ 31: W 22 &lt; 31 เป็น FS, Y 31 &lt; 31 ไม่จริง, Z 30 &lt; 31 เป็น FS (แม้ FD 52 จะสูงสุด) ถ้า X ล่ม W (FD 40) ขึ้นแทน',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    const R = Hop.rnd;
    let mode = 'topo', cur, topo;
    function gen() {
      for (let tries = 0; tries < 400; tries++) {
        const n = R(3, 5), best = R(24, 48), srd = R(6, best - 6);
        const items = [{ cost: best - srd, rd: srd }];
        const kinds = Hop.shuffle(['fsbig', 'eq', 'no', 'close', 'fs', 'lowrd', Math.random() < .5 ? 'no' : 'fs']).slice(0, n - 1);
        for (const k of kinds) {
          let rd, cost;
          if (k === 'fsbig') { rd = R(4, best - 2); cost = best - rd + R(14, 40); }
          else if (k === 'fs') { rd = R(4, best - 1); cost = best - rd + R(2, 12); }
          else if (k === 'lowrd') { rd = R(2, Math.max(2, srd - 2)); cost = best - rd + R(5, 22); }
          else if (k === 'eq') { rd = best; cost = R(2, 12); }
          else if (k === 'close') { rd = best + R(1, 2); cost = R(1, 3); }
          else { rd = best + R(3, 24); cost = R(2, 15); }
          items.push({ cost, rd });
        }
        const fds = items.map(p => p.cost + p.rd);
        if (new Set(fds).size !== fds.length || fds.slice(1).some(f => f <= best) || items.some(p => p.cost < 1)) continue;
        const ifs = Hop.shuffle(['G0/0', 'G0/1', 'G0/2', 'S0/0/0', 'S0/0/1', 'S0/1/0']);
        const order = Hop.shuffle(items);
        const paths = order.map((p, i) => ({ ...p, name: 'R' + (i + 2), ip: `10.1.${i + 1}.2`, ifc: ifs[i] }));
        const net = `172.${R(16, 31)}.${R(1, 254)}.0/24`;
        if (mode === 'table') {
          const f = 256 * R(90, 420);
          paths.forEach(p => { p.fd = (p.cost + p.rd) * f; p.rd = p.rd * f; p.cost = null; });
        }
        return { paths, net, an: analyze(paths) };
      }
    }
    function render() {
      cur = gen();
      const { paths, net, an } = cur, big = mode === 'table';
      host.innerHTML = '';
      const seg = el('div', { class: 'seg', role: 'group' },
        el('button', { 'aria-pressed': String(mode === 'topo'), text: 'รูป topology', onclick: () => { mode = 'topo'; render(); } }),
        el('button', { 'aria-pressed': String(mode === 'table'), text: 'topology table', onclick: () => { mode = 'table'; render(); } }));
      host.append(el('div', { class: 'dhead' }, el('h3', { text: 'โจทย์' }), seg));
      if (!big) {
        host.append(el('p', { class: 'prompt', html: `R1 ต้องการส่งแพ็กเก็ตไป <b class="mono">${net}</b> (X) ได้ ${paths.length} ทาง ตัวเลขบนลิงก์ R1 ถึงเพื่อนบ้านคือ ${b('teal', 'cost')} ตัวเลขระหว่างเพื่อนบ้านกับ X คือ ${b('amber', 'RD')} ที่เพื่อนบ้านรายงาน จงหา FD ของแต่ละทาง, successor, FD ของเส้นทาง และ feasible successor` }));
        const fig = el('div', { class: 'dfig' }); host.append(fig);
        topo = Topo(fig, { showFD: false, showIP: true, src: 'R1', dest: 'X' });
        topo.set(paths, { roles: false });
        host.append(el('div', { class: 'given' }, paths.map(p => el('div', { class: 'g', html: `${p.name} = <b>${p.ip}</b> ต่อกับ ${p.ifc} ของ R1` }))));
      } else {
        host.append(el('p', { class: 'prompt', html: `ผลจากคำสั่ง <code>show ip eigrp topology</code> บน R1 สำหรับปลายทาง <b class="mono">${net}</b> เป็นดังนี้ (ตัวเลขในวงเล็บคือ ${b('violet', 'FD')}/${b('amber', 'RD')}) จงหา successor, FD ของเส้นทาง และ feasible successor` }));
        host.append(el('div', { class: 'cli big', html: `<div class="ln">P ${net}, ? successors, FD is ?</div>` + paths.map(p => `<div class="ln">  via ${p.ip} (<span class="c-violet">${p.fd}</span>/<span class="c-amber">${p.rd}</span>), ${p.ifc}</div>`).join('') }));
      }
      const form = el('div', { class: 'dform' }); host.append(form);
      let fdIn = [];
      if (!big) {
        const tbl = el('div', { class: 'fdgrid' });
        fdIn = paths.map((p, i) => { const inp = el('input', { class: 'field', inputmode: 'numeric', autocomplete: 'off', placeholder: 'FD' }); tbl.append(el('label', {}, el('span', { html: `FD ผ่าน ${p.name}` }), inp)); return inp; });
        form.append(el('div', { class: 'fl', html: `1. ${Hop.t('fd', 'FD')} ของแต่ละทาง` }), tbl);
      }
      const lab = p => big ? p.ip : p.name;
      const sChips = el('div', { class: 'pick' }), fChips = el('div', { class: 'pick' });
      let sPick = -1; const fPick = new Set(); let none = false;
      paths.forEach((p, i) => {
        sChips.append(el('button', { class: 'chip', text: lab(p), onclick: e => { sPick = i; $$('.chip', sChips).forEach((c, j) => c.setAttribute('aria-pressed', String(j === i))); } }));
        fChips.append(el('button', { class: 'chip', text: lab(p), onclick: e => { none = false; fPick.has(i) ? fPick.delete(i) : fPick.add(i); syncF(); } }));
      });
      const noneB = el('button', { class: 'chip', text: 'ไม่มี', onclick: () => { none = !none; if (none) fPick.clear(); syncF(); } });
      fChips.append(noneB);
      function syncF() { $$('.chip', fChips).forEach((c, j) => c.setAttribute('aria-pressed', String(j < paths.length ? fPick.has(j) : none))); }
      const fdRoute = el('input', { class: 'field', inputmode: 'numeric', autocomplete: 'off', placeholder: big ? 'เช่น 3012096' : 'เช่น 35' });
      const k0 = big ? 1 : 2;
      form.append(el('div', { class: 'fl', html: `${k0}. ${Hop.t('successor', 'Successor')} คือทางไหน` }), sChips,
        el('div', { class: 'fl', html: `${k0 + 1}. ${Hop.t('fd', 'FD')} ของเส้นทาง` }), el('div', { class: 'one' }, fdRoute),
        el('div', { class: 'fl', html: `${k0 + 2}. ${Hop.t('fs', 'Feasible successor')} (เลือกได้หลายตัว)` }), fChips);
      const score = el('span', { class: 'score' });
      const work = el('div');
      host.append(el('div', { class: 'bar2' },
        el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: check }),
        el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => show(work) }),
        el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render }), score), work);
      const num = s => +String(s).replace(/[,\s]/g, '');
      function check() {
        let ok = 0, tot = 0;
        const mark = (node, good) => { node.classList.toggle('ok', good); node.classList.toggle('no', !good); tot++; if (good) ok++; };
        fdIn.forEach((inp, i) => mark(inp, inp.value.trim() !== '' && num(inp.value) === an.fd[i]));
        $$('.chip', sChips).forEach((c, j) => c.classList.remove('ok', 'no'));
        const sGood = an.roles[sPick] === 'succ';
        if (sPick >= 0) $$('.chip', sChips)[sPick].classList.add(sGood ? 'ok' : 'no');
        tot++; if (sGood) ok++;
        mark(fdRoute, fdRoute.value.trim() !== '' && num(fdRoute.value) === an.best);
        const want = new Set(paths.map((_, i) => i).filter(i => an.roles[i] === 'fs'));
        const fGood = want.size === 0 ? none : (!none && want.size === fPick.size && [...want].every(i => fPick.has(i)));
        $$('.chip', fChips).forEach((c, j) => { c.classList.remove('ok', 'no', 'miss'); if (j < paths.length) { if (fPick.has(j)) c.classList.add(want.has(j) ? 'ok' : 'no'); else if (want.has(j)) c.classList.add('miss'); } else if (none) c.classList.add(want.size === 0 ? 'ok' : 'no'); });
        tot++; if (fGood) ok++;
        score.textContent = `ถูก ${ok}/${tot} ข้อ`;
      }
    }
    function show(work) {
      const { paths, net, an } = cur, big = mode === 'table', F = big ? fmt : x => x;
      const s = an.succ, S = paths[s], best = an.best;
      const fsI = paths.map((_, i) => i).filter(i => an.roles[i] === 'fs').sort((a, c) => an.fd[a] - an.fd[c]);
      const lines = [];
      if (!big) {
        lines.push({ note: true, t: 'ขั้น 1: FD = cost + RD ทุกทาง' });
        paths.forEach((p, i) => lines.push({ html: `${p.name}: <span class="c-teal">${p.cost}</span> + <span class="c-amber">${p.rd}</span> = <span class="c-violet">${an.fd[i]}</span>` }));
      } else {
        lines.push({ note: true, t: 'ขั้น 1: อ่าน (FD/RD) จากแต่ละบรรทัด ตัวแรกคือ FD ของทางนั้น' });
      }
      lines.push({ note: true, t: `ขั้น 2: FD ที่ต่ำที่สุด` });
      lines.push({ html: `FD ต่ำสุด = <span class="c-violet">${F(best)}</span> ${big ? '' : `(ทาง ${S.name}, ${S.ip})`} → <b class="c-green">Successor = ${big ? S.ip : S.name}</b>` });
      lines.push({ note: true, t: `ขั้น 3: ทางที่เหลือ เทียบ RD กับ ${F(best)}` });
      paths.forEach((p, i) => {
        if (i === s) return;
        const r = an.roles[i];
        lines.push({ html: `${big ? p.ip : p.name}: RD <span class="c-amber">${F(p.rd)}</span> &lt; ${F(best)} ${r === 'fs' ? '<b class="c-blue">จริง → FS</b>' : `ไม่จริง${p.rd === best ? ' (เท่ากันไม่ผ่าน)' : ''} → ไม่ใช่ FS`}` });
      });
      lines.push({ note: true, t: 'คำตอบ' });
      lines.push({ html: `<b class="c-green">Successor</b>: ${S.name !== S.ip && !big ? S.name + ', ' : ''}next hop ${S.ip} ส่งออกทาง ${S.ifc}` });
      lines.push({ html: `<b class="c-violet">FD</b> = ${F(best)}` });
      lines.push({ html: `<b class="c-blue">Feasible successor</b>: ` + (fsI.length ? fsI.map(i => big ? `${paths[i].ip} (${paths[i].ifc})` : `${paths[i].name} (${paths[i].ip}, ${paths[i].ifc})`).join(', ') : 'ไม่มี') });
      lines.push({ note: true, t: 'เขียนเป็นประโยค' });
      const backup = fsI.length ? `ถ้า ${big ? S.ip : S.name} ล่ม จะสลับไปใช้ ${big ? paths[fsI[0]].ip : paths[fsI[0]].name} ทันที${fsI.length > 1 ? ` (FD ต่ำสุดในกลุ่ม FS = ${F(an.fd[fsI[0]])})` : ''}` : `ไม่มีทางสำรองที่ผ่านเงื่อนไข ถ้า ${big ? S.ip : S.name} ล่ม R1 ต้องเข้า active state แล้วส่ง query ถามเพื่อนบ้าน`;
      lines.push({ t: `R1 ส่งแพ็กเก็ตไป ${net} ผ่าน ${big ? S.ip : `${S.name} (${S.ip})`} ทาง ${S.ifc} ${backup}` });
      Hop.work(work, lines, { stagger: 70 });
      if (!big && topo) topo.set(paths, { roles: true, showFD: true });
    }
    render();
  })();
})();
