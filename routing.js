// Chapter 2: how a router chooses a path
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, easeIO, icon } = Hop;
  Hop.page(2);
  const T = (k, l) => Hop.t(k, l);

  // run a callback every frame while the host is on screen; phase = seconds since start
  function loop(host, fn) {
    let raf = 0, on = false, t0 = 0;
    const tick = now => { if (!on) return; fn((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    new IntersectionObserver(es => { const v = es[0].isIntersecting; if (v && !on) { on = true; t0 = performance.now(); raf = requestAnimationFrame(tick); } else if (!v) { on = false; cancelAnimationFrame(raf); } }, { threshold: .05 }).observe(host);
    return { restart() { t0 = performance.now(); } };
  }
  const seg = (opts, cur, onPick, label) => {
    const g = el('div', { class: 'seg', role: 'group', 'aria-label': label || '' });
    opts.forEach(([v, txt]) => g.append(el('button', { 'aria-pressed': String(v === cur), 'data-v': v, html: txt, onclick: () => { $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); onPick(v); } })));
    return g;
  };
  const pathPts = (P, ids) => ids.map(id => ({ x: P[id].x, y: P[id].y }));

  /* ======================= shared R1/R2 topology (map + interfaces) ======================= */
  const TABLES = {
    r1: [
      { code: 'C', net: '192.168.1.0/24', via: null, ifc: 'G0/0' }, { code: 'L', net: '192.168.1.1/32', via: null, ifc: 'G0/0' },
      { code: 'C', net: '192.168.3.0/24', via: null, ifc: 'G0/1' }, { code: 'L', net: '192.168.3.1/32', via: null, ifc: 'G0/1' },
      { code: 'C', net: '10.0.0.0/30', via: null, ifc: 'S0/0/0' }, { code: 'L', net: '10.0.0.1/32', via: null, ifc: 'S0/0/0' },
      { code: 'S', net: '192.168.2.0/24', via: '10.0.0.2', ifc: 'S0/0/0', adm: '[1/0]' }],
    r2: [
      { code: 'C', net: '10.0.0.0/30', via: null, ifc: 'S0/0/0' }, { code: 'L', net: '10.0.0.2/32', via: null, ifc: 'S0/0/0' },
      { code: 'C', net: '192.168.2.0/24', via: null, ifc: 'G0/0' }, { code: 'L', net: '192.168.2.1/32', via: null, ifc: 'G0/0' },
      { code: 'S', net: '192.168.1.0/24', via: '10.0.0.1', ifc: 'S0/0/0', adm: '[1/0]' }, { code: 'S', net: '192.168.3.0/24', via: '10.0.0.1', ifc: 'S0/0/0', adm: '[1/0]' }],
  };
  const CODEK = { C: 'connected', L: 'local', S: 'static', R: 'rip', D: 'eigrp', O: 'ospf', 'S*': 'defroute' };
  function rtab(rows, { cols = 'map', extra } = {}) {
    const t = el('table', { class: 'rtab' });
    t.innerHTML = `<thead><tr><th>Code</th><th>ปลายทาง</th><th>ไปทาง</th><th>ขาออก</th>${extra ? `<th>${extra}</th>` : ''}</tr></thead>`;
    const tb = el('tbody');
    rows.forEach((r, i) => tb.append(el('tr', { 'data-i': i, html:
      `<td><button class="cd" data-k="${CODEK[r.code] || 'code'}">${r.code}</button></td>` +
      `<td><button class="c-blue" data-k="network">${r.net}</button></td>` +
      `<td>${r.via ? `<button class="c-violet" data-k="nexthop">via ${r.via}</button>` : '<button class="mut" data-k="connected">ต่อตรง</button>'}</td>` +
      `<td><button class="c-teal" data-k="exitif">${r.ifc}</button></td>${extra ? '<td class="mx"></td>' : ''}` })));
    t.append(tb);
    return t;
  }

  const MAPSPEC = {
    bp: 560, H: { h: 250, v: 530 },
    nodes: [
      { id: 'pc1', type: 'pc', k: 'destip', label: 'PC1', sub: '192.168.1.10', h: [.07, 72], v: [.3, 40], side: { h: 'b', v: 'r' } },
      { id: 'r1', type: 'router', k: 'router', label: 'R1', h: [.36, 72], v: [.3, 180], side: { h: 't', v: 'l' } },
      { id: 'pc2', type: 'pc', k: 'destip', label: 'PC2', sub: '192.168.3.30', h: [.36, 200], v: [.8, 180], side: { h: 'r', v: 'b' } },
      { id: 'r2', type: 'router', k: 'router', label: 'R2', h: [.64, 72], v: [.3, 330], side: { h: 't', v: 'l' } },
      { id: 'srv', type: 'server', k: 'destip', label: 'Server', sub: '192.168.2.20', h: [.93, 72], v: [.3, 470], side: { h: 'b', v: 'r' } },
    ],
    links: [
      { id: 'l1', a: 'pc1', b: 'r1', label: '192.168.1.0/24', ib: 'G0/0' },
      { id: 'l2', a: 'r1', b: 'pc2', label: '192.168.3.0/24', ia: 'G0/1', vside: 'r', ifd: 44, lpos: { h: 'l' } },
      { id: 'l3', a: 'r1', b: 'r2', label: '10.0.0.0/30', ia: 'S0/0/0', ib: 'S0/0/0' },
      { id: 'l4', a: 'r2', b: 'srv', label: '192.168.2.0/24', ia: 'G0/0' },
    ],
  };

  /* ---------- map hero ---------- */
  (() => {
    const host = $('#map');
    const fa = RT.fit(host, W => { const L = RT.layout(MAPSPEC, W); fa.L = L; return { h: L.H, html: RT.links(MAPSPEC, L) + RT.nodes(MAPSPEC, L) + RT.envelope('mp') }; });
    let cur = 'r1';
    const ctr = el('div', { class: 'ctrls' });
    const sw = seg([['r1', 'ตารางของ R1'], ['r2', 'ตารางของ R2']], cur, v => show(v), 'เลือกตาราง');
    const go1 = el('button', { class: 'btn small primary', html: `${icon('play')} PC1 ส่งถึง Server`, onclick: () => send(['pc1', 'r1', 'r2', 'srv']) });
    const go2 = el('button', { class: 'btn small', html: `${icon('replay')} Server ตอบกลับ`, onclick: () => send(['srv', 'r2', 'r1', 'pc1']) });
    ctr.append(sw, go1, go2);
    const tw = el('div', { class: 'tw' });
    const say = el('p', { class: 'say' });
    host.append(ctr, tw, say);
    function show(r, hi = -1) {
      cur = r; $$('button', sw).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === r)));
      tw.replaceChildren(el('div', { class: 'tcap', html: `${T('rtable', 'Routing table')} ของ ${r.toUpperCase()}` }), rtab(TABLES[r]));
      if (hi >= 0) $$('tbody tr', tw)[hi].classList.add('win');
      $$('.nd', fa.svg).forEach(n => n.classList.toggle('on', n.dataset.id === r));
    }
    fa.after = () => { show(cur); };
    fa.draw();
    say.innerHTML = 'แตะได้ทุกส่วนของรูป ทั้งเครื่อง ขา interface ชื่อวง และทุกช่องในตาราง กดส่งแพ็กเก็ตเพื่อดูว่าแต่ละ router ใช้บรรทัดไหน';
    fa.svg.addEventListener('click', e => { const n = e.target.closest('.nd'); if (n && TABLES[n.dataset.id]) show(n.dataset.id); });
    let token = 0;
    function send(ids) {
      const my = ++token;
      const P = fa.L.P, pk = $('#mp', fa.svg);
      const dst = ids[ids.length - 1] === 'srv' ? '192.168.2.20' : '192.168.1.10';
      const rowOf = r => TABLES[r].findIndex(x => x.code !== 'L' && RT.inNet(dst, ...x.net.split('/').map((v, i) => i ? +v : v)));
      let i = 0;
      const hop = () => {
        if (my !== token) return;
        if (i >= ids.length - 1) { say.innerHTML = `ถึง ${dst === '192.168.2.20' ? 'Server' : 'PC1'} แล้ว ` + (dst === '192.168.2.20' ? 'ลองกด Server ตอบกลับ ขากลับ R2 ต้องใช้ตารางของตัวเอง ไม่ได้ใช้ของ R1' : 'ขากลับใช้บรรทัด S 192.168.1.0/24 ของ R2 ซึ่งผู้ดูแลต้องตั้งแยกจากของ R1'); return; }
        const a = P[ids[i]], b = P[ids[i + 1]], t0 = performance.now(), dur = 700;
        const step = now => {
          if (my !== token) return;
          const k = easeIO(clamp((now - t0) / dur, 0, 1));
          RT.place(pk, { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
          if (k < 1) return requestAnimationFrame(step);
          i++;
          const at = ids[i];
          if (TABLES[at]) {
            const ri = rowOf(at), row = TABLES[at][ri];
            show(at, ri);
            say.innerHTML = `<b>${at.toUpperCase()}</b> อ่าน ${T('destip')} <b style="color:var(--c-blue)">${dst}</b> แล้วเจอบรรทัด <b>${row.code} ${row.net}</b> ` + (row.via ? `จึงส่งต่อให้ ${T('nexthop')} <b style="color:var(--c-violet)">${row.via}</b> ออกขา <b style="color:var(--c-teal)">${row.ifc}</b>` : `ซึ่งเป็น${T('connected', 'วงที่ต่อตรง')} จึงส่งถึงเครื่องปลายทางทางขา <b style="color:var(--c-teal)">${row.ifc}</b>`);
            setTimeout(hop, 1500);
          } else hop();
        };
        requestAnimationFrame(step);
      };
      RT.place(pk, P[ids[0]]);
      hop();
    }
  })();

  /* ---------- 1. interfaces = different networks ---------- */
  (() => {
    const host = $('#fig-ifaces');
    const IFS = { 'G0/0': { ip: '192.168.1.1', p: 24, net: '192.168.1.0/24', link: 'a', full: 'GigabitEthernet0/0' }, 'G0/1': { ip: '192.168.3.1', p: 24, net: '192.168.3.0/24', link: 'b', full: 'GigabitEthernet0/1' }, 'S0/0/0': { ip: '10.0.0.1', p: 30, net: '10.0.0.0/30', link: 'c', full: 'Serial0/0/0' } };
    const spec = { bp: 0, H: { h: 270 },
      nodes: [{ id: 'pc1', type: 'pc', label: 'PC1', h: [.1, 80] }, { id: 'r1', type: 'router', k: 'router', label: 'R1', h: [.5, 80], side: { h: 't' } }, { id: 'r2', type: 'router', label: 'R2', h: [.9, 80] }, { id: 'pc2', type: 'pc', label: 'PC2', h: [.5, 215], side: { h: 'r' } }],
      links: [{ id: 'a', a: 'pc1', b: 'r1', label: '192.168.1.0/24', ib: 'G0/0' }, { id: 'c', a: 'r1', b: 'r2', label: '10.0.0.0/30', ia: 'S0/0/0' }, { id: 'b', a: 'r1', b: 'pc2', label: '192.168.3.0/24', ia: 'G0/1', vside: 'r', ifd: 44, lpos: { h: 'l' } }] };
    let sel = 'G0/0';
    const chips = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    const sg = seg(Object.keys(IFS).map(k => [k, k]), sel, v => { sel = v; upd(); }, 'interface');
    chips.append(sg); host.append(chips);
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) }; });
    const out = el('div', { class: 'ifout' }); host.append(out);
    fa.after = upd; fa.draw();
    fa.svg.addEventListener('click', e => { const g = e.target.closest('.tag'); if (!g) return; const txt = g.textContent.trim(); if (IFS[txt]) { sel = txt; $$('button', sg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === sel))); upd(); } });
    function upd() {
      const f = IFS[sel];
      $$('.lk', fa.svg).forEach(l => { const on = l.dataset.link === f.link; $('.ln', l).classList.toggle('on', on); });
      $$('.tag', fa.svg).forEach(g => g.classList.toggle('on', g.textContent.trim() === sel || g.dataset.tag === f.link));
      out.innerHTML = `<div class="ifrow"><span class="lb">ตั้ง IP ให้ขา ${T('iface', sel)}</span><span class="mono c-teal-t">ip address ${f.ip} /${f.p}</span></div>` +
        `<div class="ifrow"><span class="lb">IP นี้อยู่ใน${T('network', 'วง')}</span><span class="mono c-blue-t">${f.net}</span></div>` +
        `<div class="ifrow"><span class="lb">router จึงเพิ่มสองบรรทัด</span><span class="mono lines"><span><b>C</b> ${f.net} is directly connected, ${f.full}</span><span><b>L</b> ${f.ip}/32 is directly connected, ${f.full}</span></span></div>`;
    }
  })();
  Hop.mcq($('#q-router'), {
    q: 'R1 มี static route ไป 192.168.2.0/24 แล้ว แต่ PC1 ยัง ping Server ไม่ผ่าน ส่วน R2 ยังไม่ได้ตั้งเส้นทางอะไรเพิ่มเลย สาเหตุที่น่าจะเป็นที่สุดคืออะไร',
    opts: ['R2 ไม่มีเส้นทางกลับไปวง 192.168.1.0/24 คำตอบจาก Server จึงไปไม่ถึง PC1', 'R1 ยังไม่มีเส้นทางไปวง 10.0.0.0/30', 'static route ส่งได้ทางเดียว ต้องเปลี่ยนไปใช้ RIP', 'Server กับ R2 อยู่คนละวงกัน'], a: 0,
    whyWrong: { 1: '10.0.0.0/30 ต่ออยู่กับ S0/0/0 ของ R1 จึงขึ้นเป็นบรรทัด C เองอยู่แล้ว', 2: 'static route ใช้ได้ทุกแพ็กเก็ตที่ไปวงนั้น ปัญหาคือขากลับไม่มีบรรทัดในตารางของ R2', 3: 'Server 192.168.2.20 อยู่วง 192.168.2.0/24 เดียวกับขา G0/0 ของ R2' },
    why: 'ping ต้องไปและกลับ ขาไปใช้ตารางของ R1 ขากลับใช้ตารางของ R2 ตามหลักข้อ 3 รู้ทางไปไม่ได้แปลว่ารู้ทางกลับ R2 ต้องมีเส้นทางไป 192.168.1.0/24 ด้วย',
  });

  /* ---------- 2. decision flow ---------- */
  (() => {
    const host = $('#fig-flow');
    const DEST = { srv: { ip: '192.168.2.20', name: 'Server' }, pc2: { ip: '192.168.3.30', name: 'PC2' }, ext: { ip: '8.8.8.8', name: 'อินเทอร์เน็ต' } };
    let dest = 'srv', dflt = false;
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 14px' });
    ctr.append(seg([['srv', 'ไป Server 192.168.2.20'], ['pc2', 'ไป PC2 192.168.3.30'], ['ext', 'ไป 8.8.8.8']], dest, v => { dest = v; build(); }, 'ปลายทาง'),
      seg([['0', 'ไม่มี default route'], ['1', 'มี default route']], '0', v => { dflt = v === '1'; build(); }, 'default route'));
    host.append(ctr);
    const stage = el('div', { class: 'fstage' });
    stage.innerHTML = `<div class="band l3"><span>Layer 3 <i>แพ็กเก็ต</i></span></div><div class="band l2"><span>Layer 2 <i>เฟรม</i></span></div><div class="band l1"><span>Layer 1 <i>บิต</i></span></div>
      <div class="lane in"></div><div class="lane out"></div>
      <button class="side in" data-k="iface">เข้า G0/0</button><button class="side out" data-k="exitif"></button>
      <button class="lookup" data-k="lpm"><b>หาใน routing table</b><span></span></button>
      <div class="trash" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg><span>ทิ้ง</span></div>
      <div class="obj"></div>`;
    host.append(stage);
    const tw = el('div', { class: 'tw' }); host.append(tw);
    const scH = el('div'); host.append(scH);
    const say = el('p', { class: 'say' }); host.append(say);
    const obj = $('.obj', stage), outSide = $('.side.out', stage), look = $('.lookup span', stage), trash = $('.trash', stage);

    function build() {
      const d = DEST[dest];
      const rows = [...TABLES.r1, ...(dflt ? [{ code: 'S*', net: '0.0.0.0/0', via: '10.0.0.2', ifc: 'S0/0/0' }] : [])];
      const res = rows.map(r => { const [n, p] = r.net.split('/'); return RT.inNet(d.ip, n, +p) ? +p : -1; });
      let win = -1; res.forEach((p, i) => { if (p >= 0 && (win < 0 || p > res[win])) win = i; });
      const W = win >= 0 ? rows[win] : null;
      const kind = !W ? 'drop' : W.via ? (W.code === 'S*' ? 'dflt' : 'remote') : 'conn';
      tw.replaceChildren(el('div', { class: 'tcap', html: `${T('rtable', 'Routing table')} ของ R1 เทียบกับ ${T('destip')} <b class="mono" style="color:var(--c-blue)">${d.ip}</b>` }), rtab(rows, { extra: 'ตรง' }));
      const trs = $$('tbody tr', tw);
      trs.forEach((tr, i) => { $('.mx', tr).innerHTML = res[i] >= 0 ? `<b class="c-blue-t">/${res[i]}</b>` : '<span class="mut">ไม่</span>'; });
      outSide.textContent = kind === 'drop' ? 'ไม่มีขาออก' : 'ออก ' + W.ifc;
      look.textContent = d.ip;
      const nexthopTxt = kind === 'conn' ? `${d.name} (${d.ip})` : 'R2 (10.0.0.2)';
      const stops = [
        { label: '<span class="k">L1</span> บิตเข้ามาทาง G0/0', say: `แพ็กเก็ตจาก PC1 มาถึง R1 เป็นสัญญาณบิตบนสาย (${T('layers', 'Layer 1')}) ทางขา G0/0` },
        { label: '<span class="k">L2</span> ประกอบเป็นเฟรม', say: `R1 รวมบิตเป็น${T('frame', 'เฟรม')} ตรวจว่าเฟรมนี้ส่งมาถึงตัวเอง ข้างในคือ IP packet ที่ห่อด้วย header และ trailer ของ Layer 2` },
        { label: '<span class="k">L3</span> แกะเฟรม อ่าน IP ปลายทาง', say: `${T('encap', 'แกะ')} header และ trailer ของ Layer 2 ทิ้ง เหลือ${T('packet', 'แพ็กเก็ต')} แล้วอ่าน ${T('destip')} <b style="color:var(--c-blue)">${d.ip}</b> ค่านี้ค่าเดียวที่ใช้ตัดสินใจ` },
        { label: '<span class="k">ตาราง</span> หา entry ที่ตรงยาวที่สุด', say: win < 0 ? `เทียบทุกบรรทัดแล้ว ${d.ip} ไม่ตกอยู่ในวงไหนเลย${dflt ? '' : ' และไม่มี default route'}` : `เทียบทุกบรรทัด ${res.filter(x => x >= 0).length > 1 ? `ตรง ${res.filter(x => x >= 0).length} บรรทัด เลือกบรรทัดที่ prefix ยาวที่สุด (${T('lpm')}) คือ` : 'ตรงบรรทัดเดียวคือ'} <b>${W.code} ${W.net}</b>` },
      ];
      if (kind === 'drop') stops.push({ label: '<span class="k">ผล</span> ไม่ตรงเลย ทิ้งแพ็กเก็ต', say: `ไม่มี entry ไหนตรงและไม่มี ${T('defroute')} R1 จึง${T('drop', 'ทิ้งแพ็กเก็ต')} ลองเปิด default route แล้วดูใหม่` });
      else stops.push(
        { label: kind === 'conn' ? '<span class="k">ผล</span> วงที่ต่อตรง ส่งถึงเครื่องเลย' : `<span class="k">ผล</span> ส่งให้ next hop ${W.via}`, say: kind === 'conn' ? `บรรทัดนี้เป็น ${T('connected', 'C')} แปลว่า ${d.name} อยู่ในวงที่ต่อกับขา ${W.ifc} ของ R1 เอง ส่งถึงเครื่องปลายทางได้โดยตรง` : kind === 'dflt' ? `ไม่มีบรรทัดเฉพาะของ ${d.ip} จึงใช้ ${T('defroute')} ส่งให้ ${T('nexthop')} <b style="color:var(--c-violet)">${W.via}</b>` : `บรรทัดนี้บอกว่าวง ${W.net} อยู่ไกลออกไป ต้องส่งให้ ${T('nexthop')} <b style="color:var(--c-violet)">${W.via}</b> คือ R2 รับต่อ` },
        { label: '<span class="k">L2</span> ห่อเฟรมใหม่สำหรับขาออก', say: `ห่อแพ็กเก็ตเดิมด้วย header และ trailer ใหม่ของลิงก์ขาออก ส่งถึง ${nexthopTxt} IP ปลายทางในแพ็กเก็ตยังเป็น ${d.ip} เหมือนเดิม` },
        { label: `<span class="k">L1</span> ส่งเป็นบิตออก ${W.ifc}`, say: `แปลงเป็นบิตส่งออก ${T('exitif')} <b style="color:var(--c-teal)">${W.ifc}</b> ไปหา ${nexthopTxt} ${kind === 'conn' ? 'จบที่ปลายทาง' : 'R2 จะทำขั้นตอนเดียวกันนี้ซ้ำด้วยตารางของตัวเอง'}` });
      const n = stops.length;
      scH.innerHTML = '';
      const frameHtml = (fresh) => `<span class="fh${fresh ? ' fresh' : ''}">${fresh ? 'H2 ใหม่' : 'H2'}</span><span class="fp">IP</span><span class="fh${fresh ? ' fresh' : ''}">T2</span>`;
      const pktHtml = `<span class="fp big"><small>ปลายทาง</small>${d.ip}</span>`;
      const bitsHtml = '<span class="fb">0110 1011 0010</span>';
      let lastMode = '';
      if (sc) sc.stop();
      sc = Hop.scrub(scH, {
        stops, speed: 1500,
        onFrame(t) {
          const r = stage.getBoundingClientRect(), Wd = r.width, H = r.height;
          const X = { in: Wd * .2, mid: Wd * .5, out: Wd * .8 }, Y = { 3: H * .22, 2: H * .52, 1: H * .82 };
          let x, y, mode, op = 1;
          const L = (a, b, k) => lerp(a, b, easeIO(clamp(k, 0, 1)));
          if (t <= 1) { x = X.in; y = L(Y[1], Y[2], t); mode = t < .5 ? 'bits' : 'frame'; }
          else if (t <= 2) { x = X.in; y = L(Y[2], Y[3], t - 1); mode = t < 1.5 ? 'frame' : 'pkt'; }
          else if (t <= 3) { x = L(X.in, X.mid, t - 2); y = Y[3]; mode = 'pkt'; }
          else if (kind === 'drop') { x = X.mid; y = L(Y[3], Y[1], t - 3); mode = 'pkt'; op = 1 - clamp((t - 3.5) * 2, 0, 1); }
          else if (t <= 4) { x = L(X.mid, X.out, t - 3); y = Y[3]; mode = 'pkt'; }
          else if (t <= 5) { x = X.out; y = L(Y[3], Y[2], t - 4); mode = t < 4.5 ? 'pkt' : 'nframe'; }
          else { x = X.out; y = L(Y[2], Y[1], t - 5); mode = t < 5.5 ? 'nframe' : 'nbits'; }
          if (mode !== lastMode) { lastMode = mode; obj.className = 'obj ' + mode; obj.innerHTML = mode === 'bits' || mode === 'nbits' ? bitsHtml : mode === 'frame' ? frameHtml(false) : mode === 'nframe' ? frameHtml(true) : pktHtml; }
          obj.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`; obj.style.opacity = op;
          trash.classList.toggle('on', kind === 'drop' && t > 3);
          stage.classList.toggle('looking', t > 2.4 && t < 3.6);
          stage.classList.toggle('outon', kind !== 'drop' && t > 3.5);
          // table rows light up one by one while the packet is at the lookup
          const k = clamp((t - 2.2) / .8, 0, 1) * trs.length;
          trs.forEach((tr, i) => { tr.classList.toggle('shown', i < k); tr.classList.toggle('win', i === win && t >= 3); });
          const s = Math.min(n - 1, Math.floor(t + .5));
          if (say._s !== s + dest + dflt) { say._s = s + dest + dflt; say.innerHTML = stops[s].say; }
        },
      });
    }
    let sc = null;
    build();
    addEventListener('resize', () => { if (sc) sc.set(sc.t); });
  })();
  Hop.mcq($('#q-flow'), {
    q: 'ตัวอย่างในสไลด์: ปลายทาง 172.16.0.10 และ routing table มี 172.16.0.0/12, 172.16.0.0/18, 172.16.0.0/26 และ 203.100.20.0/24 router ใช้บรรทัดไหน',
    opts: ['172.16.0.0/26', '172.16.0.0/12', '203.100.20.0/24', 'ทิ้งแพ็กเก็ต เพราะตรงหลายบรรทัดจนเลือกไม่ได้'], a: 0,
    whyWrong: { 1: '/12 ตรงจริง แต่ตรงแค่ 12 บิตแรก เป็นบรรทัดที่กว้างที่สุดจึงเจาะจงน้อยที่สุด', 2: '203.100.20.0/24 ไม่ตรงเลย เลข octet แรกก็ต่างกันแล้ว', 3: 'ตรงหลายบรรทัดเป็นเรื่องปกติ router มีกฎเลือกอยู่แล้ว คือเอาบรรทัดที่ยาวที่สุด' },
    why: '/12, /18 และ /26 ตรงทั้งสามบรรทัด (172.16.0.0/26 คือ 172.16.0.0 ถึง 172.16.0.63 ซึ่งมี .10 อยู่) longest prefix match เลือก /26 เพราะตรงกันยาวที่สุดถึง 26 บิต',
  });

  /* ---------- 3. route entry anatomy ---------- */
  (() => {
    const host = $('#fig-entry');
    const F = (t, f, c) => ({ t, f, c });
    const EX = {
      O: { fields: [F('O', 'code'), F('10.0.4.0/24', 'net', 'blue'), F('[', null), F('110', 'ad', 'amber'), F('/', null), F('50', 'metric', 'green'), F(']', null), F('via 10.0.3.2,', 'nh', 'violet'), F('00:24:22,', 'age'), F('Serial0/1/1', 'if', 'teal')], src: 'OSPF', ad: 110, m: '50 คือ cost รวมของ OSPF ที่คิดจาก bandwidth', nh: '10.0.3.2' },
      D: { fields: [F('D', 'code'), F('192.168.1.0/24', 'net', 'blue'), F('[', null), F('90', 'ad', 'amber'), F('/', null), F('3012096', 'metric', 'green'), F(']', null), F('via 192.168.10.10,', 'nh', 'violet'), F('00:12:32,', 'age'), F('Serial0/0/1', 'if', 'teal')], src: 'EIGRP', ad: 90, m: '3,012,096 คือ metric ของ EIGRP (คิดจาก bandwidth กับ delay) และเป็น Feasible Distance ของเส้นทางนี้', nh: '192.168.10.10' },
      R: { fields: [F('R', 'code'), F('150.20.100.32/27', 'net', 'blue'), F('[', null), F('120', 'ad', 'amber'), F('/', null), F('2', 'metric', 'green'), F(']', null), F('via 150.20.100.106,', 'nh', 'violet'), F('00:00:12,', 'age'), F('Serial0/0/0', 'if', 'teal')], src: 'RIP', ad: 120, m: '2 คือ hop count: จาก Router_A ต้องผ่าน Router_B และ Router_C จึงถึง LAN C', nh: '150.20.100.106' },
      S: { fields: [F('S', 'code'), F('172.16.1.0/24', 'net', 'blue'), F('[', null), F('1', 'ad', 'amber'), F('/', null), F('0', 'metric', 'green'), F(']', null), F('via 172.16.2.2,', 'nh', 'violet'), F('GigabitEthernet0/0/1', 'if', 'teal')], src: 'Static', ad: 1, m: 'static ไม่มี metric จึงแสดงเป็น 0', nh: '172.16.2.2' },
      C: { fields: [F('C', 'code'), F('172.16.2.0/24', 'net', 'blue'), F('is directly connected,', 'dc'), F('GigabitEthernet0/0/1', 'if', 'teal')], src: 'Connected', ad: 0 },
      L: { fields: [F('L', 'code'), F('172.16.2.1/32', 'net', 'blue'), F('is directly connected,', 'dc'), F('GigabitEthernet0/0/1', 'if', 'teal')], src: 'Local', ad: 0 },
    };
    const SRCK = { O: 'ospf', D: 'eigrp', R: 'rip', S: 'static', C: 'connected', L: 'local' };
    let ex = 'O', fsel = 'code';
    const chips = el('div', { class: 'presets left' });
    Object.keys(EX).forEach(k => chips.append(el('button', { class: 'chip', text: k + ' ' + EX[k].src, onclick: () => { ex = k; if (!EX[k].fields.some(f => f.f === fsel)) fsel = 'code'; upd(); } })));
    const line = el('div', { class: 'rline' });
    const say = el('p', { class: 'say' });
    host.append(chips, line, say);
    line.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { fsel = b.dataset.f; upd(); } });
    function explain(f) {
      const E = EX[ex];
      switch (f) {
        case 'code': return `<b>${ex}</b> คือ ${T('code')} บอกว่าเส้นทางนี้ได้มาจาก ${T(SRCK[ex], E.src)}${ex === 'D' ? ' (EIGRP ใช้ตัว D ไม่ใช่ E)' : ''}${ex === 'L' ? ' คือ IP ของขา router เองแบบ /32' : ''}`;
        case 'net': return `${T('network', 'วงปลายทาง')} ที่บรรทัดนี้พาไป <b style="color:var(--c-blue)">${E.fields[1].t}</b> แพ็กเก็ตที่ IP ปลายทางตกในวงนี้จะใช้บรรทัดนี้`;
        case 'ad': return `${T('ad')} ของ ${E.src} = <b style="color:var(--c-amber)">${E.ad}</b> เป็นเลขตัวแรกในวงเล็บ ใช้ตอนหลายแหล่งบอกทางไปวงเดียวกัน`;
        case 'metric': return `${T('metric')}: ${E.m} เป็นเลขตัวหลังในวงเล็บ`;
        case 'nh': return `${T('nexthop')} <b style="color:var(--c-violet)">${E.nh}</b> คือ IP ของ router ตัวถัดไปที่จะรับแพ็กเก็ตต่อ ต้องอยู่วงเดียวกับขาออก`;
        case 'age': return `${T('age')} ได้ยินเส้นทางนี้มาแล้ว ${E.fields.find(x => x.f === 'age').t.replace(',', '')} (ชั่วโมง:นาที:วินาที) มีเฉพาะเส้นทางที่เรียนจากโปรโตคอล`;
        case 'if': return `${T('exitif')} <b style="color:var(--c-teal)">${E.fields.find(x => x.f === 'if').t}</b> ขาที่ใช้ส่งแพ็กเก็ตออก`;
        case 'dc': return `ไม่มีวงเล็บ ไม่มี next hop เพราะวงนี้ต่ออยู่กับขาของ router เอง (${T('connected', 'AD 0')}) ส่งถึงเครื่องปลายทางได้เลย`;
      }
      return '';
    }
    function upd() {
      $$('.chip', chips).forEach(c => c.setAttribute('aria-pressed', String(c.textContent.startsWith(ex + ' '))));
      line.innerHTML = EX[ex].fields.map(f => f.f ? `<button class="rf${f.c ? ' c-' + f.c : ''}${f.f === fsel ? ' sel' : ''}" data-f="${f.f}">${esc(f.t)}</button>` : `<span class="rf plain">${esc(f.t)}</span>`).join('');
      say.innerHTML = explain(fsel);
    }
    upd();
  })();
  Hop.mcq($('#q-entry'), {
    q: 'จากบรรทัด D 192.168.1.0/24 [90/3012096] via 192.168.10.10, 00:12:32, Serial0/0/1 เลข 3012096 คืออะไร',
    opts: ['metric ของเส้นทาง (ระยะตามแบบของ EIGRP)', 'Administrative Distance', 'เวลาที่เรียนรู้เส้นทางนี้มา', 'จำนวน hop ถึงปลายทาง'], a: 0,
    whyWrong: { 1: 'AD คือเลขตัวแรกในวงเล็บ ที่นี่คือ 90 ของ EIGRP', 2: 'เวลาคือ 00:12:32 ที่อยู่หลัง next hop', 3: 'hop count เป็น metric ของ RIP ส่วน D คือ EIGRP ใช้ bandwidth กับ delay' },
    why: 'รูปแบบคือ [AD/metric] เลขหลัง / จึงเป็น metric ของ EIGRP = 3,012,096',
  });

  /* ---------- 4. static vs dynamic on the lab 6 topology ---------- */
  (() => {
    const host = $('#fig-static');
    const spec = { bp: 0, H: { h: 290 },
      nodes: [
        { id: 'A', type: 'router', k: 'router', label: 'A', h: [.1, 120], side: { h: 't' } }, { id: 'B', type: 'router', k: 'router', label: 'B', h: [.5, 120], side: { h: 't' } }, { id: 'C', type: 'router', k: 'router', label: 'C', h: [.9, 120], side: { h: 't' } },
        { id: 'la', type: 'pc', label: 'LAN A', h: [.1, 240] }, { id: 'lb', type: 'pc', label: 'LAN B', h: [.5, 240] }, { id: 'lc', type: 'pc', label: 'LAN C', h: [.9, 240] }],
      links: [
        { id: 'ab', a: 'A', b: 'B', label: '.104/30', ia: '.105', ib: '.106', iaPos: 'a', ibPos: 'a', lpos: { h: 'b' }, ifd: 27, cut: true },
        { id: 'bc', a: 'B', b: 'C', label: '.100/30', ia: '.101', ib: '.102', iaPos: 'a', ibPos: 'a', lpos: { h: 'b' }, ifd: 27 },
        { id: 'ac', a: 'A', b: 'C', label: 'ลิงก์ A–C', bend: [0, -175], lcls: 'nl mutl' },
        { id: 'pa', a: 'A', b: 'la', label: '.64/27' }, { id: 'pb', a: 'B', b: 'lb', label: '.128/27' }, { id: 'pc', a: 'C', b: 'lc', label: '.32/27', lpos: { h: 'l' } }] };
    let mode = 'static', dst = 'lb', cut = false;
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    const cutBtn = el('button', { class: 'btn small', onclick: () => { cut = !cut; upd(); } });
    ctr.append(seg([['static', 'Static'], ['rip', 'Dynamic (RIP)']], mode, v => { mode = v; upd(); }), seg([['lb', 'ไป LAN B'], ['lc', 'ไป LAN C']], dst, v => { dst = v; upd(); }), cutBtn);
    host.append(ctr);
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); fa.L = L; return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) + `<g class="xmark" opacity="0"><path d="M-9 -9L9 9M9 -9L-9 9"/></g>` + RT.envelope('sp', 'var(--c-blue)') }; });
    const card = el('div', { class: 'cli' });
    const say = el('p', { class: 'say' });
    host.append(card, say);
    let path = [], stopAt = null;
    fa.after = () => { upd(); };
    fa.svg.addEventListener('click', e => { if (e.target.closest('[data-cut]')) { cut = !cut; upd(); } });
    card.addEventListener('click', e => { const b = e.target.closest('[data-hl]'); if (!b) return; $$('[data-hl]', card).forEach(x => x.classList.toggle('sel', x === b)); hl(b.dataset.hl); });
    function hl(what) {
      $$('.tag', fa.svg).forEach(g => g.classList.remove('on'));
      const want = { net: dst === 'lb' ? 'pb' : 'pc', mask: dst === 'lb' ? 'pb' : 'pc' }[what];
      if (want) $$('.tag', fa.svg).forEach(g => { if (g.dataset.tag === want) g.classList.add('on'); });
      if (what === 'nh') $$('.tag', fa.svg).forEach(g => { if (g.textContent.trim() === '.106') g.classList.add('on'); });
      const net = dst === 'lb' ? '150.20.100.128' : '150.20.100.32';
      say.innerHTML = what === 'net' ? `<b style="color:var(--c-blue)">${net}</b> คือ network address ของ ${dst === 'lb' ? 'LAN B (150.20.100.128/27)' : 'LAN C (150.20.100.32/27)'} วงปลายทางที่อยากไป` :
        what === 'mask' ? '<b style="color:var(--c-blue)">255.255.255.224</b> คือ /27 เขียนเป็น subnet mask (27 บิตแรกเป็น 1) คำสั่ง ip route ของ IPv4 ใช้ mask ไม่ใช้ /27' :
        what === 'nh' ? `<b style="color:var(--c-violet)">150.20.100.106</b> คือ ${T('nexthop')} = IP ขา S0/0/0 ของ Router_B ปลายอีกด้านของสายที่ต่อกับ Router_A (วง 150.20.100.104/30)` : '';
    }
    function upd() {
      cutBtn.innerHTML = cut ? `${icon('replay')} ต่อสาย A–B คืน` : `${icon('x')} ตัดลิงก์ A–B`;
      const ab = $('[data-link="ab"] .ln', fa.svg), ac = $('[data-link="ac"] .ln', fa.svg);
      if (!ab) return;
      ab.classList.toggle('cut', cut);
      ac.classList.toggle('faint', mode === 'static');
      const net = dst === 'lb' ? '150.20.100.128' : '150.20.100.32';
      if (mode === 'static') {
        card.innerHTML = `<div class="ln2"><span class="pr">Router_A(config)#</span> ip route <button class="c-blue" data-hl="net">${net}</button> <button class="c-blue" data-hl="mask">255.255.255.224</button> <button class="c-violet" data-hl="nh">150.20.100.106</button></div>`;
        if (cut) { path = ['la', 'A', 'B']; stopAt = .5; }
        else { path = dst === 'lb' ? ['la', 'A', 'B', 'lb'] : ['la', 'A', 'B', 'C', 'lc']; stopAt = null; }
        say.innerHTML = cut ? `สายขาดแล้ว แต่ static route บน Router_A ยังชี้ไปที่ 150.20.100.106 เหมือนเดิม แพ็กเก็ตไปต่อไม่ได้และถูกทิ้ง ทั้งที่ยังมีทางอ้อมผ่าน C ผู้ดูแลต้องเข้าไปเพิ่มเส้นทางใหม่เอง` :
          `แตะแต่ละส่วนของคำสั่งเพื่อดูว่ามาจากไหน ทุกวงในแล็บขึ้นต้นด้วย 150.20.100 ${dst === 'lc' ? 'ไป LAN C ก็ส่งให้ Router_B เหมือนกัน และ Router_B ต้องมี static route ไป LAN C ของตัวเองด้วย' : ''}`;
      } else {
        card.innerHTML = `<div class="ln2"><span class="pr">Router_A(config)#</span> router rip</div><div class="ln2"><span class="pr">Router_A(config-router)#</span> version 2</div><div class="ln2"><span class="pr">Router_A(config-router)#</span> network 150.20.0.0</div>`;
        if (dst === 'lb') path = cut ? ['la', 'A', 'C', 'B', 'lb'] : ['la', 'A', 'B', 'lb'];
        else path = ['la', 'A', 'C', 'lc'];
        stopAt = null;
        say.innerHTML = dst === 'lb' ? (cut ? `RIP บน Router_C บอกว่าไป LAN B ได้ใน 1 hop Router_A จึงเรียนรู้ทางใหม่เป็น 2 hop ผ่าน C เองโดยไม่ต้องมีคนแก้ (ใช้เวลาหลายรอบ update)` : `RIP ให้ router บอกกันเองว่าแต่ละวงอยู่ไกลกี่ hop Router_A ไป LAN B ตรงผ่าน B ได้ใน 1 hop จึงเลือกทางนี้`) :
          `มีลิงก์ A–C แล้ว LAN C อยู่ห่าง 1 hop ผ่าน C ส่วนทาง A → B → C เป็น 2 hop RIP จึงเลือกผ่าน C ${cut ? 'สาย A–B ขาดก็ไม่กระทบเส้นนี้' : ''}`;
      }
      ac.classList.toggle('on', mode === 'rip' && path.includes('C') && path.indexOf('C') === path.indexOf('A') + 1);
    }
    fa.draw();
    loop(host, s => {
      if (!fa.L || !path.length) return;
      const P = fa.L.P, pk = $('#sp', fa.svg), xm = $('.xmark', fa.svg);
      const pts = [];
      path.forEach((id, i) => {
        const prevId = path[i - 1];
        if (prevId && ((prevId === 'A' && id === 'C') || (prevId === 'C' && id === 'A'))) {
          const a = P[prevId], c = P[id], mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2 - 175;
          for (let k = 1; k <= 12; k++) { const u = k / 12; pts.push({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * c.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * c.y }); }
        } else pts.push({ x: P[id].x, y: P[id].y });
      });
      const cyc = 3.4, ph = (s % cyc) / cyc;
      if (stopAt != null) {
        const f = clamp(ph / .7, 0, 1), full = pathPts(P, ['la', 'A']).concat([{ x: lerp(P.A.x, P.B.x, stopAt), y: P.A.y }]);
        RT.place(pk, RT.along(full, easeIO(f)), ph > .9 ? 0 : 1);
        RT.place(xm, { x: lerp(P.A.x, P.B.x, stopAt), y: P.A.y }, f >= 1 ? 1 : 0);
      } else { RT.place(pk, RT.along(pts, easeIO(clamp(ph / .8, 0, 1))), ph > .9 ? 0 : 1); RT.place(xm, { x: 0, y: 0 }, 0); }
    });
  })();
  Hop.mcq($('#q-static'), {
    q: 'สาขาเล็กมี router ตัวเดียวและมีทางออกไปสำนักงานใหญ่ทางเดียว ควรตั้งเส้นทางแบบไหน',
    opts: ['static route หรือ default route ชี้ไปทางออกนั้น', 'OSPF เพราะเร็วที่สุด', 'RIP เพราะตั้งง่ายที่สุด', 'ไม่ต้องตั้งอะไร router หาเองได้'], a: 0,
    whyWrong: { 1: 'มีทางออกทางเดียว ไม่มีอะไรให้เลือก การรัน dynamic protocol เปลือง CPU, memory และ bandwidth โดยไม่ได้อะไร', 2: 'ตั้งง่ายแต่ยังต้องส่ง update ทุก 30 วินาทีโดยไม่จำเป็น เครือข่ายแบบนี้คือ stub network ที่สไลด์บอกให้ใช้ static', 3: 'router รู้เองแค่วงที่ต่อตรง (C) วงที่อยู่ไกลต้องมาจาก static หรือ dynamic protocol' },
    why: 'แบบนี้คือ stub network สไลด์บอกว่าใช้ static route หรือ default route เช่น ip route 0.0.0.0 0.0.0.0 &lt;next hop&gt;',
  });

  /* ---------- 5. IGP vs EGP ---------- */
  (() => {
    const host = $('#fig-igp');
    const spec = { bp: 560, H: { h: 270, v: 500 },
      nodes: [
        { id: 'x1', type: 'router', k: 'router', h: [.1, 75], v: [.2, 80] }, { id: 'x2', type: 'router', k: 'router', h: [.1, 205], v: [.8, 80] }, { id: 'xb', type: 'router', k: 'router', h: [.37, 140], v: [.5, 185] },
        { id: 'yb', type: 'router', k: 'router', h: [.63, 140], v: [.5, 320] }, { id: 'y1', type: 'router', k: 'router', h: [.9, 75], v: [.2, 425] }, { id: 'y2', type: 'router', k: 'router', h: [.9, 205], v: [.8, 425] }],
      links: [['x1', 'x2'], ['x1', 'xb'], ['x2', 'xb'], ['y1', 'y2'], ['y1', 'yb'], ['y2', 'yb'], ['xb', 'yb']].map(([a, b]) => ({ id: a + b, a, b })) };
    const PROT = { S: ['Static', 'static'], R: ['RIP', 'rip'], E: ['EIGRP', 'eigrp'], O: ['OSPF', 'ospf'], B: ['BGP', 'bgp'] };
    let p = 'R';
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg(Object.entries(PROT).map(([k, v]) => [k, v[0]]), p, v => { p = v; upd(); }, 'โปรโตคอล'));
    host.append(ctr);
    const fa = RT.fit(host, W => {
      const L = RT.layout(spec, W); fa.L = L;
      const box = (x, y, w, h, t, k) => `<g class="hot" data-k="${k}"><rect class="asbox" x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/><text class="aslab" x="${x + 16}" y="${y + 24}">${t}</text></g>`;
      const bx = L.o === 'h' ? box(8, 12, W * .46 - 8, 246, 'AS 100 มหาวิทยาลัย', 'as') + box(W * .54, 12, W * .46 - 8, 246, 'AS 200 ISP', 'as') : box(4, 12, W - 8, 225, 'AS 100 มหาวิทยาลัย', 'as') + box(4, 263, W - 8, 225, 'AS 200 ISP', 'as');
      return { h: L.H, html: bx + RT.links(spec, L) + RT.nodes(spec, L) + [0, 1, 2, 3, 4, 5].map(i => RT.envelope('ig' + i, 'var(--c-green)', 'sm')).join('') };
    });
    const say = el('p', { class: 'say' }); host.append(say);
    let act = [];
    fa.after = upd; fa.draw();
    function upd() {
      const inner = ['x1x2', 'x1xb', 'x2xb', 'y1y2', 'y1yb', 'y2yb'];
      act = p === 'B' ? ['xbyb'] : p === 'S' ? ['x1xb'] : inner;
      $$('.lk', fa.svg).forEach(l => $('.ln', l).classList.toggle('on', act.includes(l.dataset.link)));
      const n = PROT[p];
      say.innerHTML = p === 'B' ? `${T('bgp')} ทำงานบนลิงก์ระหว่างสอง AS จึงเป็น ${T('egp')} ตัวเดียวในสไลด์ และไม่อยู่ในขอบเขตข้อสอบ` :
        p === 'S' ? `${T('static')} ไม่ใช่โปรโตคอลที่ router คุยกัน ผู้ดูแลพิมพ์ตั้งในองค์กรของตัวเอง จึงนับรวมกับกลุ่มภายใน` :
        `${T(n[1], n[0])} ทำงานบนลิงก์ภายใน AS ของตัวเองเท่านั้น จึงเป็น ${T('igp')} แต่ละ AS เลือกใช้ IGP ของตัวเองได้ ส่วนลิงก์ข้าม AS ต้องใช้ EGP`;
    }
    loop(host, s => {
      if (!fa.L) return;
      const P = fa.L.P;
      for (let i = 0; i < 6; i++) {
        const g = $('#ig' + i, fa.svg); if (!g) continue;
        const id = act[i % act.length], l = spec.links.find(x => x.id === id);
        if (!l || i >= act.length) { RT.place(g, { x: 0, y: 0 }, 0); continue; }
        const f = ((s * .55 + i * .37) % 1), back = Math.floor(s * .55 + i * .37) % 2;
        const a = P[back ? l.b : l.a], b = P[back ? l.a : l.b];
        RT.place(g, { x: lerp(a.x, b.x, easeIO(f)), y: lerp(a.y, b.y, easeIO(f)) }, f > .9 || f < .08 ? 0 : 1);
      }
    });
  })();

  /* ---------- 6. distance vector vs link state ---------- */
  (() => {
    const host = $('#fig-dvls');
    const NET = { R1: '10.1.0.0', R4: '10.4.0.0' };
    const COST = { 'R1R2': 1, 'R1R3': 1, 'R2R4': 1, 'R3R4': 10 };
    const spec = { bp: 0, H: { h: 300 },
      nodes: [
        { id: 'R1', type: 'router', k: 'router', label: 'R1', h: [.13, 130], side: { h: 't' } }, { id: 'R2', type: 'router', k: 'router', label: 'R2', h: [.5, 52], side: { h: 'r' } },
        { id: 'R3', type: 'router', k: 'router', label: 'R3', h: [.5, 215], side: { h: 'r' } }, { id: 'R4', type: 'router', k: 'router', label: 'R4', h: [.87, 130], side: { h: 't' } },
        { id: 'n1', type: 'cloud', label: '10.1.0.0', h: [.13, 250], k: 'network' }, { id: 'n4', type: 'cloud', label: '10.4.0.0', h: [.87, 250], k: 'network' }],
      links: [['R1', 'R2'], ['R1', 'R3'], ['R2', 'R4'], ['R3', 'R4'], ['R1', 'n1'], ['R4', 'n4']].map(([a, b]) => ({ id: a + b, a, b })) };
    const nbrs = r => spec.links.filter(l => l.a.startsWith('R') && l.b.startsWith('R') && (l.a === r || l.b === r)).map(l => l.a === r ? l.b : l.a);
    let mode = 'dv', me = 'R1';
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg([['dv', 'Distance vector (RIP)'], ['ls', 'Link state (OSPF)']], mode, v => { mode = v; upd(); }, 'โหมด'));
    host.append(ctr);
    const fa = RT.fit(host, W => {
      const L = RT.layout(spec, W); fa.L = L;
      let s = RT.links(spec, L);
      // cost labels for link state
      spec.links.forEach(l => { if (!COST[l.id]) return; const a = L.P[l.a], b = L.P[l.b]; s += `<text class="cost" data-c="${l.id}" x="${(a.x + b.x) / 2 + (b.y > a.y ? 12 : -12) * (l.id === 'R1R3' || l.id === 'R2R4' ? -1 : 1)}" y="${(a.y + b.y) / 2 + 4}" text-anchor="middle">cost ${COST[l.id]}</text>`; });
      s += RT.nodes(spec, L);
      spec.nodes.forEach(n => { if (n.type === 'router') s += `<text class="qm" data-q="${n.id}" x="${L.P[n.id].x}" y="${L.P[n.id].y + 6}" text-anchor="middle">?</text>`; });
      for (let i = 0; i < 8; i++) s += RT.envelope('dv' + i, 'var(--c-green)', 'sm');
      return { h: L.H, html: s };
    });
    const info = el('div', { class: 'know' }); host.append(info);
    const say = el('p', { class: 'say' }); host.append(say);
    fa.svg.addEventListener('click', e => { const n = e.target.closest('.nd'); if (n && n.dataset.id.startsWith('R')) { me = n.dataset.id; upd(); } });
    fa.after = upd; fa.draw();
    // hop distances via BFS on routers
    const routers = ['R1', 'R2', 'R3', 'R4'].map(id => ({ id, ifs: [...spec.links.filter(l => l.a === id || l.b === id).map(l => ({ n: 'to ' + (l.a === id ? l.b : l.a), net: l.id }))] }));
    function dijk(src) {
      const D = { [src]: 0 }, prev = {}, Q = new Set(['R1', 'R2', 'R3', 'R4']);
      while (Q.size) { let u = null; Q.forEach(x => { if (D[x] != null && (u == null || D[x] < D[u])) u = x; }); if (u == null) break; Q.delete(u);
        Object.entries(COST).forEach(([id, c]) => { const [a, b] = [id.slice(0, 2), id.slice(2)]; const v = a === u ? b : b === u ? a : null; if (v && Q.has(v) && (D[v] == null || D[u] + c < D[v])) { D[v] = D[u] + c; prev[v] = u; } }); }
      return { D, prev };
    }
    function upd() {
      if (!fa.L) return;
      const nb = nbrs(me);
      const known = new Set([me, ...nb]);
      const { D, prev } = dijk(me);
      const tree = new Set(Object.entries(prev).map(([v, u]) => [u, v].sort().join('')));
      $$('.nd', fa.svg).forEach(n => { const id = n.dataset.id; n.classList.toggle('on', id === me); n.classList.toggle('fog', mode === 'dv' && id.startsWith('R') && !known.has(id)); if (id.startsWith('n')) n.classList.toggle('fog', mode === 'dv' && !known.has(id === 'n1' ? 'R1' : 'R4')); });
      $$('.qm', fa.svg).forEach(q => q.style.opacity = mode === 'dv' && !known.has(q.dataset.q) ? 1 : 0);
      $$('.lk', fa.svg).forEach(l => { const id = l.dataset.link, ln = $('.ln', l); const touches = id.includes(me); ln.classList.toggle('fog', mode === 'dv' && !touches); ln.classList.toggle('on', mode === 'ls' && tree.has(id)); });
      $$('.cost', fa.svg).forEach(c => c.style.opacity = mode === 'ls' ? 1 : 0);
      // what `me` knows
      const hops = {}; const bfs = { [me]: 0 }, first = {}; const q = [me];
      while (q.length) { const u = q.shift(); nbrs(u).forEach(v => { if (bfs[v] == null) { bfs[v] = bfs[u] + 1; first[v] = u === me ? v : first[u]; q.push(v); } }); }
      if (mode === 'dv') {
        const rows = Object.entries(NET).map(([r, net]) => r === me ? `<tr><td class="c-blue-t mono">${net}</td><td class="c-green-t">0 hop</td><td class="mut">ต่อตรง</td></tr>` : `<tr><td class="c-blue-t mono">${net}</td><td class="c-green-t">${bfs[r]} hop</td><td>ทาง ${nbrs(me).filter(v => bfs[v] === 1 && bfsFrom(v)[r] === bfs[r] - 1).join(' หรือ ')}</td></tr>`).join('');
        info.innerHTML = `<div class="tcap">สิ่งที่ ${me} รู้ (มีแค่ระยะกับทิศ)</div><table class="rtab sm"><thead><tr><th>ปลายทาง</th><th>distance</th><th>vector</th></tr></thead><tbody>${rows}</tbody></table>`;
        say.innerHTML = `${me} ได้สำเนาตารางจากเพื่อนบ้าน ${nb.join(' กับ ')} เท่านั้น มันเห็นแค่ตัวเลขที่เพื่อนบ้านบอกแล้วบวกเพิ่ม router ที่อยู่ไกลกว่านั้นเป็นเครื่องหมายคำถาม นี่คือ ${T('dv')}: รู้ว่าไกลเท่าไร (distance) และส่งไปทางไหน (vector) แต่ไม่รู้ว่าระหว่างทางเป็นยังไง`;
      } else {
        const lsdb = Object.entries(COST).map(([id, c]) => `<span>${id.slice(0, 2)}–${id.slice(2)} <b>${c}</b></span>`).join('');
        const pathTo = r => { const p = [r]; while (prev[p[0]]) p.unshift(prev[p[0]]); return p.join(' → '); };
        const far = me === 'R4' ? 'R1' : 'R4';
        info.innerHTML = `<div class="tcap">LSDB ของ ${me} (ทุกตัวมีชุดเดียวกัน)</div><div class="lsdb">${lsdb}</div><div class="tcap" style="margin-top:10px">${me} คำนวณ SPF เอง</div><div class="mono spf">ไป ${NET[far]}: ${pathTo(far)} cost รวม ${D[far]}</div>`;
        say.innerHTML = `ทุก router กระจายสถานะลิงก์ของตัวเองไปทั่วทั้งเครือข่าย ทำให้ ${me} มีแผนที่ครบทุกเส้นพร้อม cost แล้วใช้ SPF (Dijkstra) หาทางที่ดีที่สุดเอง เส้นหนาคือต้นไม้ทางที่สั้นที่สุดจาก ${me} หลังจากนี้ส่ง update เฉพาะตอนที่ลิงก์เปลี่ยน`;
      }
    }
    function bfsFrom(src) { const d = { [src]: 0 }, q = [src]; while (q.length) { const u = q.shift(); nbrs(u).forEach(v => { if (d[v] == null) { d[v] = d[u] + 1; q.push(v); } }); } return d; }
    loop(host, s => {
      if (!fa.L) return;
      const P = fa.L.P;
      const lanes = mode === 'dv' ? nbrs(me).map(n => [n, me]) : Object.keys(COST).flatMap(id => [[id.slice(0, 2), id.slice(2)], [id.slice(2), id.slice(0, 2)]]);
      for (let i = 0; i < 8; i++) {
        const g = $('#dv' + i, fa.svg); if (!g) continue;
        if (i >= lanes.length) { RT.place(g, { x: 0, y: 0 }, 0); continue; }
        const [a, b] = lanes[i], cyc = mode === 'dv' ? 2.6 : 3.2, f = clamp(((s + (mode === 'dv' ? 0 : i * .12)) % cyc) / (cyc * .7), 0, 1);
        RT.place(g, { x: lerp(P[a].x, P[b].x, easeIO(f)), y: lerp(P[a].y, P[b].y, easeIO(f)) }, f >= 1 || f <= 0 ? 0 : 1);
      }
    });
  })();
  Hop.mcq($('#q-dvls'), {
    q: 'router ตัวหนึ่งรู้ว่าวง 10.4.0.0 อยู่ห่าง 2 hop ถ้าส่งไปทาง R2 แต่ไม่รู้ว่าหลัง R2 มี router กี่ตัวต่อกันยังไง นี่คือพฤติกรรมของโปรโตคอลแบบไหน',
    opts: ['Distance vector เช่น RIP', 'Link state เช่น OSPF', 'Exterior gateway protocol เช่น BGP', 'Static route'], a: 0,
    whyWrong: { 1: 'link state มีแผนที่ทั้งเครือข่าย จึงรู้ว่าหลัง R2 มีอะไรบ้าง', 2: 'BGP เป็นเรื่องระหว่าง AS ไม่เกี่ยวกับการรู้หรือไม่รู้แผนที่ในองค์กร', 3: 'static ไม่มีการเรียนรู้จากเพื่อนบ้าน และไม่มี hop count' },
    why: 'รู้แค่ระยะ (2 hop) กับทิศ (ทาง R2) จากที่เพื่อนบ้านบอกต่อกันมา คือ distance vector',
  });
  Hop.mcq($('#q-dvls'), {
    q: 'อาจารย์บอกว่า EIGRP เป็นแบบผสม ข้อไหนอธิบายได้ถูกที่สุด',
    opts: ['ทำงานแบบ distance vector แต่เก็บ topology table ไว้มีทางสำรองแบบที่คล้าย link state', 'เป็น link state ที่ใช้ hop count', 'เป็น exterior protocol ที่ใช้ภายใน AS', 'ใช้ทั้ง RIP และ OSPF พร้อมกัน'], a: 0,
    whyWrong: { 1: 'EIGRP ไม่ใช้ hop count แต่ใช้ bandwidth กับ delay และไม่ได้มีแผนที่ทั้งเครือข่ายแบบ link state', 2: 'EIGRP เป็น interior (IGP)', 3: 'EIGRP เป็นโปรโตคอลแยกของ Cisco ไม่ได้รัน RIP หรือ OSPF' },
    why: 'สไลด์จัด EIGRP เป็น distance vector ส่วนที่คล้าย link state คือมี topology table เก็บเส้นทางที่เพื่อนบ้านทุกตัวบอก',
  });

  /* ---------- 7. metric per protocol ---------- */
  const MET = {
    R: { name: 'RIP', k: 'hopcount', win: 'B', line: 'R 192.168.9.0/24 [120/1] via 10.0.12.2, 00:00:08, Serial0/0/0',
      rows: { B: ['ผ่าน B ตัวเดียว', '1 hop'], C: ['ผ่าน C แล้ว B', '2 hop'] }, why: 'RIP นับแค่จำนวน router ที่ผ่าน 1 hop น้อยกว่า 2 hop จึงส่งตรงไป B ทั้งที่สายเส้นนั้นช้ากว่ามาก' },
    O: { name: 'OSPF', k: 'ospfcost', win: 'C', line: 'O 192.168.9.0/24 [110/3] via 10.0.13.2, 00:05:41, GigabitEthernet0/1',
      rows: { B: ['S0/0/0 64 kb/s: 100,000,000 ÷ 64,000 = 1562, บวกขา LAN ของ B (1 Gb/s) = 1', '1563'], C: ['A→C 1 Gb/s = 1, C→B 1 Gb/s = 1, ขา LAN ของ B = 1', '3'] }, why: 'cost รวมผ่าน C = 3 น้อยกว่า 1563 OSPF จึงอ้อมผ่าน C ซึ่งผ่าน router มากกว่าแต่ลิงก์เร็วกว่า' },
    E: { name: 'EIGRP', k: 'eigrpmetric', win: 'C', line: 'D 192.168.9.0/24 [90/3328] via 10.0.13.2, 00:05:40, GigabitEthernet0/1',
      rows: { B: ['bandwidth 10,000,000 ÷ 64 = 156,250; delay (20,000 + 10) ÷ 10 = 2,001; (156,250 + 2,001) × 256', '40,512,256'], C: ['bandwidth 10,000,000 ÷ 1,000,000 = 10; delay (10 + 10 + 10) ÷ 10 = 3; (10 + 3) × 256', '3,328'] }, why: 'ทางผ่าน C มีลิงก์ช้าสุดเป็น 1 Gb/s ส่วนทางตรงมีคอขวด 64 kb/s metric ต่างกันมาก EIGRP จึงเลือกผ่าน C' },
  };
  (() => {
    const host = $('#fig-metric');
    const spec = { bp: 0, H: { h: 285 },
      nodes: [
        { id: 'A', type: 'router', k: 'router', label: 'A', h: [.1, 95], side: { h: 't' } }, { id: 'B', type: 'router', k: 'router', label: 'B', h: [.7, 95], side: { h: 't' } },
        { id: 'C', type: 'router', k: 'router', label: 'C', h: [.4, 225], side: { h: 'b' } }, { id: 'X', type: 'cloud', k: 'network', label: 'วง X', h: [.92, 95], side: { h: 't' } }],
      links: [
        { id: 'ab', a: 'A', b: 'B', label: '64 kb/s', k: 'bandwidth', lcls: 'nl bl', ia: 'S0/0/0', iaPos: 'a' },
        { id: 'ac', a: 'A', b: 'C', label: '1 Gb/s', k: 'bandwidth', lcls: 'nl bl', lpos: { h: 'l' }, ia: 'G0/1' },
        { id: 'cb', a: 'C', b: 'B', label: '1 Gb/s', k: 'bandwidth', lcls: 'nl bl', lpos: { h: 'r' } },
        { id: 'bx', a: 'B', b: 'X' }] };
    let p = 'R';
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg([['R', 'RIP'], ['O', 'OSPF'], ['E', 'EIGRP']], p, v => { p = v; upd(); }, 'โปรโตคอล'));
    host.append(ctr);
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); fa.L = L; return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) + RT.envelope('mt', 'var(--c-green)') }; });
    const calc = el('div', { class: 'calc' }), rl = el('div', { class: 'rline sm' }), say = el('p', { class: 'say' });
    host.append(calc, rl, say);
    fa.after = upd; fa.draw();
    function upd() {
      const m = MET[p];
      $$('.lk', fa.svg).forEach(l => { const id = l.dataset.link; $('.ln', l).classList.toggle('on', (m.win === 'B' ? ['ab', 'bx'] : ['ac', 'cb', 'bx']).includes(id)); });
      calc.innerHTML = ['B', 'C'].map(w => `<div class="crow${w === m.win ? ' win' : ''}"><div class="cp">${w === 'B' ? 'ตรงไป B' : 'อ้อมผ่าน C'}</div><div class="cf">${m.rows[w][0]}</div><button class="cv" data-k="${m.k}">${m.rows[w][1]}</button></div>`).join('');
      rl.innerHTML = m.line.split(' ').map((w, i) => `<span class="rf plain${i === 0 ? '' : ''}">${esc(w)}</span>`).join('');
      say.innerHTML = `${T(m.k, m.name === 'RIP' ? 'Hop count' : m.name === 'OSPF' ? 'Cost' : 'Metric')} ของ ${m.name}: ${m.why}`;
    }
    loop(host, s => {
      if (!fa.L) return;
      const P = fa.L.P, ids = MET[p].win === 'B' ? ['A', 'B', 'X'] : ['A', 'C', 'B', 'X'];
      const cyc = MET[p].win === 'B' ? 2.4 : 2.4, ph = (s % cyc) / cyc;
      RT.place($('#mt', fa.svg), RT.along(pathPts(P, ids), easeIO(clamp(ph / .85, 0, 1))), ph > .9 ? 0 : 1);
    });
  })();
  Hop.eq($('#eq-metric'), [['ospfcost', 'cost'], ' = 100,000,000 ÷ ', ['bandwidth', 'bandwidth']], { sym: { ospfcost: 'cost', bandwidth: 'bw' } });
  Hop.eq($('#eq-metric'), [['eigrpmetric', 'metric'], ' = (10⁷ ÷ ', ['bandwidth', 'bw ช้าสุด'], ' + ', ['delay', 'Σdelay'], ' ÷ 10) × 256'], { sym: { eigrpmetric: 'metric', bandwidth: 'bw', delay: 'Σdelay' } });
  Hop.mcq($('#q-metric'), {
    q: 'จากรูปข้างบน ถ้าลิงก์ A–C กับ C–B ช้าลงเหลือ 64 kb/s เท่ากับสาย A–B RIP จะเปลี่ยนทางไหม',
    opts: ['ไม่เปลี่ยน ยังส่งตรงไป B เพราะ hop count ไม่ได้ขึ้นกับความเร็ว', 'เปลี่ยนไปผ่าน C', 'แบ่งส่งทั้งสองทาง', 'ส่งไม่ได้ เพราะทุกเส้นช้าเท่ากัน'], a: 0,
    whyWrong: { 1: 'RIP ไม่เคยดู bandwidth ทางผ่าน C ยังเป็น 2 hop', 2: 'แบ่งส่งเกิดเมื่อ metric เท่ากัน แต่ 1 hop กับ 2 hop ไม่เท่ากัน', 3: 'ความเร็วไม่เกี่ยวกับการไปถึงหรือไม่ถึง' },
    why: 'RIP ใช้ hop count อย่างเดียว ตรงไป B = 1 hop ผ่าน C = 2 hop ความเร็วลิงก์จะเปลี่ยนยังไงคำตอบก็เหมือนเดิม',
  });

  /* ---------- 8. administrative distance ---------- */
  (() => {
    const host = $('#fig-ad');
    const SRC = [
      { k: 'S', name: 'Static', key: 'static', ad: 1, m: 0, line: 'S 192.168.9.0/24 [1/0] via 10.0.12.2', note: 'ผู้ดูแลพิมพ์ ip route ชี้ไป B' },
      { k: 'D', name: 'EIGRP', key: 'eigrp', ad: 90, m: 3328, line: 'D 192.168.9.0/24 [90/3328] via 10.0.13.2, GigabitEthernet0/1', note: 'metric 3,328 ผ่าน C' },
      { k: 'O', name: 'OSPF', key: 'ospf', ad: 110, m: 3, line: 'O 192.168.9.0/24 [110/3] via 10.0.13.2, GigabitEthernet0/1', note: 'cost 3 ผ่าน C' },
      { k: 'R', name: 'RIP', key: 'rip', ad: 120, m: 1, line: 'R 192.168.9.0/24 [120/1] via 10.0.12.2, Serial0/0/0', note: 'hop 1 ตรงไป B' }];
    const on = { S: true, D: true, O: true, R: true };
    const tog = el('div', { class: 'presets left' });
    SRC.forEach(s => tog.append(el('button', { class: 'chip tg', 'data-s': s.k, html: `${s.name}`, onclick: () => { on[s.k] = !on[s.k]; upd(); } })));
    const lad = el('div', { class: 'adl' });
    lad.innerHTML = `<div class="rail"></div>` + [['Connected', 0, 'connected'], ...SRC.map(s => [s.name, s.ad, s.key, s.k])].map(([n, a, key, k], i) => `<button class="mk${k ? '' : ' conn'}" data-m="${k || 'C'}" data-k="${key}" style="left:${10 + i * 20}%"><i></i><b>${a}</b><span>${n}</span></button>`).join('');
    const list = el('div', { class: 'cands' });
    const inst = el('div', { class: 'inst' });
    const say = el('p', { class: 'say' });
    host.append(tog, lad, list, inst, say);
    SRC.forEach(s => list.append(el('div', { class: 'cand', 'data-s': s.k, html: `<span class="cad" style="color:var(--c-amber)">AD ${s.ad}</span><span class="cn">${T(s.key, s.name)}</span><span class="cm">${s.note}</span>` })));
    function upd() {
      $$('.tg', tog).forEach(b => b.setAttribute('aria-pressed', String(!!on[b.dataset.s])));
      const act = SRC.filter(s => on[s.k]);
      const win = act.length ? act[0] : null; // SRC is already sorted by AD
      // FLIP reorder: winner first, then active by AD, then inactive
      const order = [...act, ...SRC.filter(s => !on[s.k])];
      const first = new Map($$('.cand', list).map(c => [c, c.getBoundingClientRect().top]));
      order.forEach(s => list.append($(`.cand[data-s="${s.k}"]`, list)));
      $$('.cand', list).forEach(c => {
        const s = SRC.find(x => x.k === c.dataset.s);
        c.classList.toggle('off', !on[s.k]); c.classList.toggle('win', win === s);
        const dy = first.get(c) - c.getBoundingClientRect().top;
        if (dy) c.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.23,1,.32,1)' });
      });
      $$('.mk', lad).forEach(m => { const k = m.dataset.m; m.classList.toggle('act', k !== 'C' && !!on[k]); m.classList.toggle('win', !!win && k === win.k); });
      inst.innerHTML = win ? `<div class="tcap">บรรทัดที่เข้า routing table</div><div class="mono il2">${esc(win.line)}</div>` : `<div class="tcap">routing table</div><div class="mono il2 mut">ไม่มีบรรทัดไป 192.168.9.0/24</div>`;
      say.innerHTML = !win ? `ไม่มีแหล่งไหนบอกทางเลย ถ้าไม่มี default route แพ็กเก็ตไป 192.168.9.0/24 จะ${T('drop', 'ถูกทิ้ง')}` :
        act.length === 1 ? `มีแหล่งเดียวคือ ${win.name} ไม่มีอะไรให้เทียบ ${win.name} จึงเข้าตาราง` :
        `${act.map(s => `${s.name} ${s.ad}`).join(', ')} ค่าน้อยสุดคือ <b style="color:var(--c-amber)">${win.name} (${win.ad})</b> จึงได้เข้าตาราง ` + (win.k === 'S' ? 'ถึงทางนี้ใช้สายช้า 64 kb/s ก็ตาม router ไม่เอา metric มาเทียบข้ามแหล่ง' : act.some(s => s.k === 'R') ? `ถึง RIP จะมี metric แค่ 1 ก็แพ้ เพราะ 1 hop กับ ${win.m.toLocaleString()} ของ ${win.name} เป็นคนละหน่วย เอามาเทียบกันไม่ได้` : 'ตัวที่แพ้ยังรันอยู่ ถ้าตัวที่ชนะหายไป ตัวถัดไปจะขึ้นมาแทน');
    }
    upd();
  })();
  Hop.eq($('#eq-order'), [['lpm', 'prefix ยาวสุด'], ' → ', ['ad', 'AD น้อยสุด'], ' → ', ['metric', 'metric น้อยสุด']], { sym: { lpm: '1', ad: '2', metric: '3' } });
  Hop.mcq($('#q-ad'), {
    q: 'ถ้าบน router ตั้งทั้ง static route และ RIP ไว้ไปเครือข่ายเดียวกัน แพ็กเก็ตจะไปตามเส้นทางไหน และใช้ค่าอะไรตัดสิน',
    opts: ['ไปตาม static route เพราะ AD ของ static คือ 1 น้อยกว่า RIP ที่เป็น 120', 'ไปตาม RIP เพราะ hop count น้อยกว่า', 'ไปตาม RIP เพราะ dynamic อัปเดตเส้นทางล่าสุดเสมอ', 'แบ่งส่งทั้งสองทางเท่าๆ กัน'], a: 0,
    whyWrong: { 1: 'hop count เป็น metric ของ RIP ใช้เทียบกับเส้นทาง RIP ด้วยกันเท่านั้น static ไม่มี metric ให้เทียบ', 2: 'ความใหม่ของข้อมูลไม่ใช่เกณฑ์ router เทียบความน่าเชื่อของแหล่ง (AD)', 3: 'แบ่งส่งเกิดกับเส้นทางจากโปรโตคอลเดียวกันที่ metric เท่ากัน ไม่ใช่ข้ามแหล่ง' },
    why: 'prefix เดียวกัน จึงเทียบ Administrative Distance: static 1 &lt; RIP 120 static ชนะเพราะผู้ดูแลกำหนดไว้ตายตัว เชื่อได้มากที่สุดรองจาก connected',
  });
  Hop.mcq($('#q-ad'), {
    q: 'ถ้าไม่มี static แต่ router รัน RIP และ EIGRP พร้อมกัน และทั้งคู่บอกทางไปเครือข่ายเดียวกัน router จะใช้เส้นทางจากโปรโตคอลไหน',
    opts: ['EIGRP เพราะ AD 90 น้อยกว่า RIP 120', 'RIP เพราะค่าของ RIP น้อยกว่า', 'EIGRP เพราะ metric ใหญ่กว่าแปลว่าละเอียดกว่า', 'แล้วแต่ว่าตัวไหนส่ง update มาก่อน'], a: 0,
    whyWrong: { 1: 'ค่าที่ดูเหมือนน้อยของ RIP คือ hop count เช่น 2 ซึ่งเป็น metric คนละหน่วยกับ metric ของ EIGRP (เช่น 3,012,096) เอามาเทียบกันไม่ได้ ค่าที่ใช้เทียบข้ามโปรโตคอลคือ AD และ AD ของ RIP คือ 120 มากกว่า 90', 2: 'metric ไม่ได้ถูกเอามาเทียบข้ามโปรโตคอลเลย', 3: 'ลำดับการมาถึงไม่มีผล AD ตัดสิน' },
    why: 'ต่างโปรโตคอลแต่ prefix เดียวกัน เทียบ AD: EIGRP 90 &lt; RIP 120 จึงใช้ EIGRP บรรทัดในตารางจะขึ้นต้นด้วย D [90/...]',
  });
  Hop.mcq($('#q-ad'), {
    q: 'R1 มี static route 10.0.0.0/8 ชี้ไป A และเรียนรู้ 10.1.0.0/16 จาก RIP ชี้ไป B แพ็กเก็ตไป 10.1.5.9 จะไปทางไหน',
    opts: ['ไป B เพราะ /16 ยาวกว่า /8', 'ไป A เพราะ static มี AD น้อยกว่า', 'ไป A เพราะ /8 ครอบคลุมกว่า', 'ทิ้ง เพราะสองบรรทัดขัดกัน'], a: 0,
    whyWrong: { 1: 'AD ใช้เทียบเฉพาะเส้นทางไปวงเดียวกันขนาดเดียวกัน /8 กับ /16 เป็นคนละวง ทั้งสองบรรทัดอยู่ในตารางพร้อมกัน แล้ว longest prefix match เลือกตอนส่ง', 2: 'ครอบคลุมกว่าแปลว่าเจาะจงน้อยกว่า router เลือกตัวที่เจาะจงที่สุด', 3: 'ตรงหลายบรรทัดเป็นเรื่องปกติ ไม่ได้ขัดกัน' },
    why: '10.1.5.9 ตรงทั้ง /8 และ /16 longest prefix match เลือก /16 จึงไป B ถ้าปลายทางเป็น 10.2.0.1 จะตรงแค่ /8 และไป A',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    const S = { S: { name: 'Static', ad: 1, code: 'S' }, D: { name: 'EIGRP', ad: 90, code: 'D' }, O: { name: 'OSPF', ad: 110, code: 'O' }, R: { name: 'RIP', ad: 120, code: 'R' } };
    const MET = { S: () => 0, D: () => Hop.pick([3328, 281856, 2170112, 3012096, 40512256]), O: () => Hop.pick([2, 3, 30, 65, 648, 1563]), R: () => Hop.rnd(1, 6) };
    const UNIT = { S: 'ไม่มี metric', D: 'metric ของ EIGRP', O: 'cost ของ OSPF', R: 'hop count' };
    const HOPS = [['10.0.12.2', 'Serial0/0/0'], ['10.0.13.2', 'GigabitEthernet0/1'], ['10.0.14.2', 'Serial0/0/1']];
    const line = c => c.code === 'S*' ? `S* 0.0.0.0/0 [1/0] via ${c.nh}` : `${c.code} ${c.net} [${c.ad}/${c.m}] via ${c.nh}${c.code === 'S' ? '' : ', ' + c.ifc}`;
    function make() {
      const type = Hop.pick(['ad', 'ad', 'metric', 'lpm', 'none']);
      const hops = Hop.shuffle(HOPS);
      const N = Hop.rnd(2, 99);
      let cands = [], dest, ans, work = [];
      if (type === 'ad') {
        const ks = Hop.shuffle(['S', 'D', 'O', 'R']).slice(0, Hop.rnd(2, 3));
        dest = `192.168.${N}.${Hop.rnd(2, 250)}`;
        cands = ks.map((k, i) => ({ k, code: S[k].code, net: `192.168.${N}.0/24`, ad: S[k].ad, m: MET[k](), nh: hops[i][0], ifc: hops[i][1] }));
        ans = cands.reduce((a, c, i) => c.ad < cands[a].ad ? i : a, 0);
        const w = cands[ans];
        work = [{ note: true, t: `ปลายทาง ${dest} ตรงกับทุกบรรทัด และทุกบรรทัดเป็นวงเดียวกัน 192.168.${N}.0/24 (prefix เท่ากัน)` },
          { t: `ต่างแหล่งกัน จึงเทียบ Administrative Distance: ${cands.map(c => `${S[c.k].name} = ${c.ad}`).join(', ')}` },
          { t: `AD น้อยที่สุดคือ ${S[w.k].name} (${w.ad}) → ใช้เส้นทางนี้ ส่งให้ next hop ${w.nh}` },
          { note: true, t: `metric (${cands.map(c => `${c.m} = ${UNIT[c.k]}`).join(', ')}) ไม่เอามาเทียบข้ามโปรโตคอล เพราะเป็นคนละหน่วย` },
          { t: `บรรทัดที่เข้าตาราง: ${line(w)}` }];
      } else if (type === 'metric') {
        const k = Hop.pick(['R', 'O', 'D']);
        let m1 = MET[k](), m2 = MET[k](); while (m2 === m1) m2 = MET[k]();
        dest = `172.16.${N}.${Hop.rnd(2, 250)}`;
        cands = [m1, m2].map((m, i) => ({ k, code: S[k].code, net: `172.16.${N}.0/24`, ad: S[k].ad, m, nh: hops[i][0], ifc: hops[i][1] }));
        ans = m1 < m2 ? 0 : 1;
        const w = cands[ans];
        work = [{ note: true, t: `ทั้งสองบรรทัดไปวง 172.16.${N}.0/24 เหมือนกัน และมาจาก ${S[k].name} ทั้งคู่ (AD ${S[k].ad} เท่ากัน)` },
          { t: `AD เท่ากัน จึงเทียบ metric ของ ${S[k].name} (${UNIT[k]}): ${cands.map(c => `via ${c.nh} = ${c.m.toLocaleString()}`).join(' กับ ')}` },
          { t: `metric น้อยกว่าคือ ${w.m.toLocaleString()} → ส่งให้ ${w.nh} ออก ${w.ifc}` },
          { t: `บรรทัดที่เข้าตาราง: ${line(w)}` }];
      } else if (type === 'lpm') {
        const inside = Math.random() < .6, sub = Hop.rnd(1, 9);
        const dyn = Hop.pick(['R', 'O', 'D']);
        dest = inside ? `10.${sub}.${Hop.rnd(0, 255)}.${Hop.rnd(1, 254)}` : `10.${sub + Hop.rnd(10, 40)}.${Hop.rnd(0, 255)}.${Hop.rnd(1, 254)}`;
        cands = [{ k: 'S', code: 'S', net: '10.0.0.0/8', ad: 1, m: 0, nh: hops[0][0], ifc: hops[0][1] }, { k: dyn, code: S[dyn].code, net: `10.${sub}.0.0/16`, ad: S[dyn].ad, m: MET[dyn](), nh: hops[1][0], ifc: hops[1][1] }];
        ans = inside ? 1 : 0;
        const w = cands[ans];
        work = [{ note: true, t: `ปลายทาง ${dest}` },
          { t: `10.0.0.0/8 ตรง (8 บิตแรกคือ 10) ; 10.${sub}.0.0/16 ${inside ? 'ตรง (16 บิตแรกคือ 10.' + sub + ')' : 'ไม่ตรง (16 บิตแรกเป็น ' + dest.split('.').slice(0, 2).join('.') + ')'}` },
          { t: inside ? 'ตรงสองบรรทัด ใช้ longest prefix match → /16 ยาวกว่า /8 → ใช้บรรทัด /16' : 'ตรงบรรทัดเดียวคือ /8 → ใช้ static route' },
          { note: true, t: inside ? 'ไม่ต้องดู AD เพราะสองบรรทัดเป็นวงคนละขนาด AD ใช้เฉพาะ prefix เดียวกัน' : 'ไม่ต้องเทียบอะไรต่อ เพราะเหลือบรรทัดเดียว' },
          { t: `ส่งให้ ${w.nh} ออก ${w.ifc}` }];
      } else {
        const hasD = Math.random() < .5;
        dest = `203.${Hop.rnd(100, 200)}.${Hop.rnd(0, 255)}.${Hop.rnd(1, 254)}`;
        cands = [{ k: 'R', code: 'R', net: `192.168.${N}.0/24`, ad: 120, m: Hop.rnd(1, 4), nh: hops[0][0], ifc: hops[0][1] }, { k: 'O', code: 'O', net: `172.16.${N}.0/24`, ad: 110, m: MET.O(), nh: hops[1][0], ifc: hops[1][1] }];
        if (hasD) cands.push({ k: 'S', code: 'S*', net: '0.0.0.0/0', ad: 1, m: 0, nh: hops[2][0], ifc: hops[2][1] });
        ans = hasD ? 2 : 3;
        work = [{ note: true, t: `ปลายทาง ${dest}` },
          { t: `192.168.${N}.0/24 ไม่ตรง, 172.16.${N}.0/24 ไม่ตรง` },
          { t: hasD ? `ตรงแค่ default route 0.0.0.0/0 (ตรงทุก IP ยาว 0 บิต) → ส่งให้ ${hops[2][0]}` : 'ไม่มีบรรทัดไหนตรงเลย และไม่มี default route' },
          { t: hasD ? 'default route ถูกใช้เพราะไม่มีบรรทัดอื่นตรง' : '→ router ทิ้งแพ็กเก็ต' }];
      }
      return { type, dest, cands, ans, work };
    }
    function render() {
      const q = make();
      host.innerHTML = '';
      host.append(el('h3', { text: 'โจทย์' }),
        el('p', { class: 'prompt', html: `Router ได้รับแพ็กเก็ตที่มี IP ปลายทาง <b class="mono">${q.dest}</b> และใน routing table / ฐานข้อมูลของโปรโตคอลมีเส้นทางต่อไปนี้ แพ็กเก็ตจะถูกส่งไปทางไหน เพราะอะไร` }),
        el('div', { class: 'cands drillc' }, q.cands.map((c, i) => el('div', { class: 'cand', html: `<span class="cad">${'ABCD'[i]}</span><span class="mono">${esc(line(c))}</span>` }))));
      const mc = el('div'); host.append(mc);
      const opts = q.cands.map((c, i) => `ใช้บรรทัด ${'ABCD'[i]} ส่งให้ ${c.nh}`);
      if (q.type === 'none') opts.push('ทิ้งแพ็กเก็ต');
      Hop.mcq(mc, { q: 'แพ็กเก็ตไปทางไหน', opts, a: q.ans, why: q.work.filter(w => !w.note).map(w => w.t).slice(0, 2).join(' ') });
      const wk = el('div');
      host.append(el('div', { class: 'bar2' }, el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => Hop.work(wk, q.work) }), el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render })), wk);
    }
    render();
  })();
})();
