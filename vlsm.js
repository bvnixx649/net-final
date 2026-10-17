// VLSM chapter figures + drill
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, icon } = Hop;
  Hop.page(1);
  const DCOL = n => `var(--d${(n % 6) + 1})`;
  const DSOFT = n => `var(--d${(n % 6) + 1}s)`;

  /* ---------- address bar ---------- */
  function ABar(host, { ticks = true, anim = false } = {}) {
    const wrap = el('div', { class: 'abar-wrap' });
    const bar = el('div', { class: 'abar' });
    const tk = el('div', { class: 'ticks' });
    wrap.append(bar); host.append(wrap); if (ticks) host.append(tk);
    if (anim) bar.style.setProperty('--anim', '1');
    const nodes = new Map();
    function render(segs, lo, hi, tickList) {
      const W = bar.clientWidth || 600, span = hi - lo, seen = new Set();
      for (const s of segs) {
        seen.add(s.id);
        let n = nodes.get(s.id);
        if (!n) {
          n = el('div', { class: 'seg' }, el('div', { class: 'a' }), el('div', { class: 'b' }));
          if (anim) { n.style.transition = 'left 420ms var(--ease-io), width 420ms var(--ease-io), background-color 260ms ease, opacity 260ms ease'; }
          bar.append(n); nodes.set(s.id, n);
        }
        n.onclick = s.onclick || null;
        n.style.cursor = s.onclick ? 'pointer' : '';
        const L = (s.a - lo) / span, R = (s.b - lo) / span, px = (R - L) * W;
        n.style.left = (L * 100) + '%'; n.style.width = ((R - L) * 100) + '%';
        n.className = 'seg ' + (s.cls || '') + (px < 30 ? ' tiny' : px < 84 ? ' small' : '');
        n.style.background = s.bg || ''; n.style.color = s.fg || '';
        n.style.opacity = s.op == null ? 1 : s.op;
        n.style.zIndex = s.z || '';
        n.children[0].textContent = s.label || ''; n.children[1].textContent = s.sub || '';
      }
      for (const [id, n] of nodes) if (!seen.has(id)) { n.remove(); nodes.delete(id); }
      if (ticks && tickList) {
        tk.innerHTML = ''; let lastX = -99;
        tickList.forEach((tk2, i) => {
          const x = (tk2.v - lo) / span; if (x < -0.001 || x > 1.001) return;
          const xp = x * W; if (xp - lastX < (tk2.min || 46) && i !== tickList.length - 1) return; lastX = xp;
          tk.append(el('span', { class: x < .04 ? 'l' : x > .96 ? 'r' : '', style: `left:${x * 100}%`, text: tk2.t }));
        });
      }
    }
    return { wrap, bar, tk, render };
  }

  // bit cells for a 32-bit value; roleFn(i) -> 'net'|'sub'|'host' plus extra classes
  function bitStrip(host, { button = false, labels = null } = {}) {
    const box = el('div', { class: 'bits' + (labels ? ' labeled' : '') });
    const cells = [];
    for (let o = 0; o < 4; o++) {
      const oc = el('div', { class: 'oct' });
      if (labels) oc.append(el('div', { class: 'octlab' }));
      for (let j = 0; j < 8; j++) { const c = el(button ? 'button' : 'div', { class: 'bit', 'data-i': o * 8 + j }); oc.append(c); cells.push(c); }
      box.append(oc);
    }
    host.append(box);
    return {
      box, cells,
      set(n, roleFn, octLabels) {
        const s = IP.bits(n);
        cells.forEach((c, i) => { c.textContent = s[i]; c.className = 'bit ' + roleFn(i) + (s[i] === '1' ? '' : ''); });
        if (octLabels) $$('.octlab', box).forEach((l, i) => l.textContent = octLabels[i]);
      }
    };
  }
  const readout = (k, v, n) => { const c = Hop.C[k] || {}; return el('button', { class: 'rd', 'data-k': k, style: `--tc: var(--c-${c.c || 'ink'})` }, el('div', { class: 'v', html: v }), el('div', { class: 'n', html: n || c.t })); };
  function setReads(box, list) { box.replaceChildren(...list.map(r => readout(...r))); }

  // course-style binary line: decimal for class octets, binary after, bars at p1 and p2. xs: show X for subnet bits
  function binLine(n, p1, p2, { xs = false, from = null } = {}) {
    const def = IP.cls(n).prefix || 24;
    const startOct = from != null ? from : Math.min(Math.floor(def / 8), Math.floor(p1 / 8));
    const s = IP.bits(n); let out = '';
    const oct = IP.toStr(n).split('.');
    for (let o = 0; o < 4; o++) {
      if (o < startOct) { out += `<span class="d">${oct[o]}.</span>`; continue; }
      for (let j = 0; j < 8; j++) {
        const i = o * 8 + j;
        if (i === p1 && p1 !== p2) out += '<span class="bar">|</span>';
        if (i === p2) out += '<span class="bar">|</span>';
        const cls = i < p1 ? 'n' : i < p2 ? 's' : 'h';
        out += `<span class="${cls}">${cls === 's' && xs ? 'X' : s[i]}</span>`;
      }
      if (o < 3) out += '<span class="d">.</span>';
    }
    return out;
  }

  /* ---------- map hero ---------- */
  (() => {
    const host = $('#map');
    const base = '192.168.10.0', P = 24;
    const depts = [{ name: 'ฝ่ายขาย', hosts: 50 }, { name: 'ฝ่ายบัญชี', hosts: 25 }, { name: 'ฝ่ายไอที', hosts: 12 }, { name: 'ลิงก์ R1–R2', hosts: 2 }];
    const r = IP.vlsm(base, P, depts);
    const S = r.start;
    let sel = 0, shown = 0;
    host.append(
      el('div', { class: 'lbl', text: 'โจทย์ให้' }),
      el('div', { class: 'tiles', style: 'justify-content:flex-start' },
        ...base.split('.').flatMap((o, i) => [el('button', { class: 'tl', 'data-k': 'ip', text: o }), i < 3 ? el('span', { class: 'dot', text: '.' }) : null]),
        el('button', { class: 'pre', 'data-k': 'prefix', text: '/24' })),
      el('div', { class: 'gap' }),
      el('div', { class: 'depts' }, depts.map((d, i) => el('button', { class: 'dept', 'aria-pressed': String(i === sel), onclick: () => pick(i), html: `<i style="background:${DCOL(i)}"></i>${esc(d.name)} <span>${d.hosts} เครื่อง</span>` }))),
      el('div', { class: 'gap' }),
      el('div', { class: 'lbl', text: 'แบ่งแล้วได้ (แตะแต่ละวงเพื่อดูข้างใน)' }));
    const ab = ABar(host, { anim: true });
    const zoom = el('svg', { class: 'zoomfx', viewBox: '0 0 100 34', preserveAspectRatio: 'none' }, el('polygon', { fill: 'var(--surface-2)', points: '0,0 0,0 100,34 0,34' }));
    host.append(zoom);
    const anat = el('div', { class: 'anat' });
    const ans = el('div', { class: 'ans' });
    host.append(anat, ans);
    const poly = zoom.firstChild;
    let polyFrom = [0, 0], polyTo = [0, 0];

    function draw() {
      const segs = [];
      r.order.forEach((o, k) => {
        const i = o.i;
        segs.push({ id: 'd' + i, a: o.net - S, b: o.bcast + 1 - S, cls: k < shown ? 'used' + (i === sel ? ' hit' : '') : 'free', bg: k < shown ? DCOL(i) : '', label: k < shown ? '/' + o.p : '', sub: k < shown ? '.' + (o.net & 255) : '', onclick: () => pick(i), z: i === sel ? 2 : 1 });
      });
      segs.push({ id: 'free', a: r.used, b: 256, cls: 'free', label: 'ว่าง', sub: '' });
      ab.render(segs, 0, 256, [0, 64, 96, 112, 116, 256].map(v => ({ v, t: '.' + v, min: 28 })));
      const o = r.order.find(x => x.i === sel);
      const to = [(o.net - S) / 256 * 100, (o.bcast + 1 - S) / 256 * 100];
      const t0 = performance.now(); polyFrom = polyTo; polyTo = to;
      const tick = now => { const k = ease(clamp((now - t0) / 360, 0, 1)); const a = lerp(polyFrom[0], to[0], k), b = lerp(polyFrom[1], to[1], k); poly.setAttribute('points', `${a},0 ${b},0 100,34 0,34`); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      anat.innerHTML = '';
      anat.append(
        el('button', { class: 'na', 'data-k': 'netaddr', html: `<div class="v">.${o.net & 255}</div><div class="n">Network</div>` }),
        el('button', { class: 'us', 'data-k': 'range', html: `<div class="v">.${o.first & 255} – .${o.last & 255}</div><div class="n">ใช้ได้ ${o.usable} ตัว (ต้องการ ${o.hosts})</div>` }),
        el('button', { class: 'bc', 'data-k': 'bcast', html: `<div class="v">.${o.bcast & 255}</div><div class="n">Broadcast</div>` }));
      ans.innerHTML = `<span>${esc(o.name)}</span><span>ชื่อวง <b>${IP.toStr(o.net)}/${o.p}</b></span><span>mask <b>${IP.maskStr(o.p)}</b></span>`;
    }
    function pick(i) { sel = i; $$('.dept', host).forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); if (shown < depts.length) shown = depts.length; draw(); }
    draw();
    Hop.onView(host, () => { let k = 0; const step = () => { shown = ++k; draw(); if (k < depts.length) setTimeout(step, 380); }; setTimeout(step, 250); });
  })();

  /* ---------- 1. octet toggle ---------- */
  (() => {
    const host = $('#fig-octet');
    const PV = [128, 64, 32, 16, 8, 4, 2, 1];
    let bits = [1, 1, 0, 0, 0, 0, 0, 0];
    const grid = el('div', { class: 'octet' });
    const pvs = PV.map(p => el('div', { class: 'pv', text: p }));
    const cells = PV.map((p, i) => el('button', { class: 'cell', 'aria-label': 'บิตค่า ' + p, onclick: () => { bits[i] ^= 1; upd(); } }));
    grid.append(...pvs, ...cells);
    const sum = el('div', { class: 'sumline' });
    const presets = el('div', { class: 'presets' });
    [192, 168, 10, 255, 0, 37].forEach(v => presets.append(el('button', { class: 'chip', text: v, onclick: () => setVal(v) })));
    host.append(grid, sum, presets);
    function upd() {
      cells.forEach((c, i) => { c.textContent = bits[i]; c.classList.toggle('on', !!bits[i]); pvs[i].classList.toggle('on', !!bits[i]); });
      const on = PV.filter((p, i) => bits[i]); const v = on.reduce((a, b) => a + b, 0);
      sum.innerHTML = on.length ? `${on.join(' + ')} = <b>${v}</b>` : `ไม่มีบิตไหนเป็น 1 = <b>0</b>`;
      $$('.chip', presets).forEach(c => c.setAttribute('aria-pressed', String(+c.textContent === v)));
    }
    function setVal(v) { const target = PV.map(p => (v & p) ? 1 : 0); target.forEach((b, i) => setTimeout(() => { bits[i] = b; upd(); }, i * 45)); }
    upd();
  })();

  /* ---------- 2. prefix slider on 32 bits ---------- */
  (() => {
    const host = $('#fig-prefix');
    const n = IP.toInt('192.168.1.37');
    let p = 26;
    const tiles = el('div', { class: 'tiles' });
    host.append(tiles, el('div', { style: 'height:16px' }));
    const strip = bitStrip(host, { button: true });
    const ctr = el('div', { class: 'ctrls' }, el('span', { class: 'readout', text: 'prefix' }));
    const sl = el('input', { type: 'range', class: 'slider', min: 8, max: 30, value: p, 'aria-label': 'prefix' });
    ctr.append(sl); host.append(ctr);
    const reads = el('div', { class: 'reads' }); host.append(reads);
    const say = el('p', { class: 'say' }); host.append(say);
    sl.addEventListener('input', () => { p = +sl.value; upd(); });
    strip.cells.forEach((c, i) => c.addEventListener('click', () => { p = clamp(i + 1, 8, 30); sl.value = p; upd(); }));
    function upd() {
      sl.style.setProperty('--p', ((p - 8) / 22 * 100) + '%');
      const oct = IP.toStr(n).split('.');
      tiles.replaceChildren(...oct.flatMap((o, i) => {
        const a = i * 8, b = a + 8, cls = p >= b ? 'net' : p <= a ? 'host' : 'mix';
        return [el('button', { class: 'tl ' + cls, 'data-k': cls === 'net' ? 'netpart' : cls === 'host' ? 'hostpart' : 'prefix', text: o }), i < 3 ? el('span', { class: 'dot', text: '.' }) : null];
      }).filter(Boolean), el('button', { class: 'pre', 'data-k': 'prefix', text: '/' + p }));
      strip.set(n, i => (i < p ? 'net' : 'host') + (i === p ? ' cut' : ''));
      const h = 32 - p;
      setReads(reads, [['prefix', '/' + p], ['mask', IP.maskStr(p)], ['hbits', h], ['block', `2<sup>${h}</sup> = ${2 ** h}`, 'IP ทั้งหมดในวง'], ['usable', (2 ** h - 2).toLocaleString()]]);
      say.innerHTML = `<b style="color:var(--c-blue)">${p} บิตแรก</b> บอกวง อีก <b style="color:var(--c-green)">${h} บิต</b> บอกเครื่อง วงนี้จึงมี IP ${(2 ** h).toLocaleString()} ตัว แจกให้เครื่องได้ ${(2 ** h - 2).toLocaleString()} ตัว`;
    }
    upd();
  })();
  Hop.eq($('#eq-usable'), [['usable', 'Usable'], ' = ', ['block', '2ʰ'], ' − 2'], { sym: { usable: 'Usable', block: '2ʰ' } });
  Hop.eq($('#eq-usable'), [['hbits', 'h'], ' = 32 − ', ['prefix', 'prefix']], { sym: { hbits: 'h', prefix: '/n' } });
  Hop.mcq($('#q-usable'), {
    q: 'วง /27 แจก IP ให้เครื่องได้กี่ตัว', opts: ['32', '30', '27', '5'], a: 1,
    whyWrong: { 0: '32 คือจำนวน IP ทั้งหมดในวง ยังไม่ได้ลบ network กับ broadcast', 2: '27 คือจำนวนบิตฝั่ง network', 3: '5 คือจำนวน host bit' },
    why: '/27 เหลือ host bit 32 − 27 = 5 ตัว ได้ 2<sup>5</sup> = 32 IP ลบ network address กับ broadcast ออก เหลือ 30',
  });

  /* ---------- 3. class + given prefix ---------- */
  (() => {
    const host = $('#fig-class');
    const EX = ['10.0.0.0/8', '10.5.64.0/18', '172.16.0.0/16', '172.16.0.0/20', '178.20.0.0/20', '172.19.67.0/24', '192.168.10.0/24', '192.168.10.64/26'];
    let cur = '172.16.0.0/20';
    const chips = el('div', { class: 'presets', style: 'justify-content:flex-start;margin:0 0 22px' });
    EX.forEach(x => chips.append(el('button', { class: 'chip', text: x, onclick: () => { cur = x; upd(); } })));
    host.append(chips);
    const strip = bitStrip(host, { labels: true });
    const bin = el('div', { class: 'binline' }); host.append(bin);
    const reads = el('div', { class: 'reads' }); host.append(reads);
    const say = el('p', { class: 'say' }); host.append(say);
    function upd() {
      const [ip, pp] = cur.split('/'); const n = IP.toInt(ip), p = +pp, c = IP.cls(n), d = c.prefix;
      $$('.chip', chips).forEach(b => b.setAttribute('aria-pressed', String(b.textContent === cur)));
      const oct = ip.split('.');
      strip.set(n, i => i < d ? 'net lock' : i < p ? 'sub lock' : 'host' + (i === p ? ' cut' : ''), oct.map((o, i) => o));
      bin.innerHTML = binLine(n, d, p, { from: Math.floor(d / 8) });
      const startOct = Math.floor(p / 8) + 1;
      setReads(reads, [['cls', 'Class ' + c.c, `octet แรก ${oct[0]} อยู่ช่วง ${c.from}–${c.to}`], ['defprefix', '/' + d], ['prefix', '/' + p, 'prefix ที่โจทย์ให้'], ['borrow', (p - d) + ' บิต', 'ถูกยืมไปแล้ว'], ['hostpart', 'บิตที่ ' + (p + 1), `เริ่มแบ่งได้ (octet ที่ ${startOct})`]]);
      say.innerHTML = `${ip} เป็น class ${c.c} มี default /${d} ` + (p > d ? `แต่โจทย์ให้ /${p} แปลว่าถูกยืมไปแล้ว <b style="color:var(--c-amber)">${p - d} บิต</b> ` : 'โจทย์ให้ prefix เท่ากับค่าเริ่มต้นพอดี ') + `บิตที่เราใช้แบ่งได้เริ่มที่ <b style="color:var(--c-green)">บิตที่ ${p + 1} ซึ่งอยู่ใน octet ที่ ${startOct}</b>`;
    }
    upd();
  })();
  Hop.mcq($('#q-class'), {
    q: 'โจทย์ให้ 172.16.0.0/20 บิตแรกที่เราใช้แบ่งวงได้อยู่ใน octet ไหน', opts: ['octet ที่ 4', 'octet ที่ 3', 'octet ที่ 2', 'แบ่งไม่ได้แล้ว เพราะเกิน /16'], a: 1,
    whyWrong: { 0: 'นี่คือจุดที่พลาดกันมากตอนกลางภาค ถ้า prefix ยังไม่ถึง /24 บิตว่างจะเริ่มใน octet ที่ 3', 3: 'prefix ยาวกว่า default ได้ แปลว่าถูกยืมไปแล้วบางส่วน ยังแบ่งต่อได้' },
    why: '172 อยู่ช่วง 128–191 จึงเป็น class B (/16) โจทย์ให้ /20 บิต 17–20 จึงถูกยืมไปแล้ว บิตว่างเริ่มที่บิต 21 ซึ่งอยู่ใน octet ที่ 3 (บิต 17–24)',
  });

  /* ---------- 4. borrowing (FLSM) ---------- */
  (() => {
    const host = $('#fig-borrow');
    const n = IP.toInt('192.168.10.0');
    let s = 2;
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'จำนวนบิตที่ยืม' });
    for (let k = 0; k <= 5; k++) seg.append(el('button', { 'aria-pressed': String(k === s), text: k === 0 ? 'ไม่ยืม' : 'ยืม ' + k, onclick: () => { s = k; upd(); } }));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 16px' }, seg));
    const bin = el('div', { class: 'binline', style: 'margin-top:0' }); host.append(bin);
    const ab = ABar(host, { anim: true });
    const reads = el('div', { class: 'reads' }); host.append(reads);
    function upd() {
      $$('button', seg).forEach((b, k) => b.setAttribute('aria-pressed', String(k === s)));
      bin.innerHTML = binLine(n, 24, 24 + s, { xs: true });
      const k = 2 ** s, sz = 256 / k, segs = [];
      for (let i = 0; i < k; i++) segs.push({ id: 'g' + i, a: i * sz, b: (i + 1) * sz, cls: 'used', bg: i % 2 ? 'var(--c-amber)' : 'color-mix(in srgb, var(--c-amber) 78%, var(--ink))', label: s ? i.toString(2).padStart(s, '0') : '/24', sub: '.' + i * sz });
      ab.render(segs, 0, 256, Array.from({ length: k + 1 }, (_, i) => ({ v: i * sz, t: '.' + (i === k ? 255 : i * sz), min: 30 })));
      const p = 24 + s, h = 8 - s;
      setReads(reads, [['subnet', k + ' วง', 'จำนวนวง = 2<sup>' + s + '</sup>'], ['prefix', '/' + p], ['mask', IP.maskStr(p)], ['block', 2 ** h, 'IP ต่อวง'], ['usable', 2 ** h - 2, 'ใช้ได้ต่อวง']]);
    }
    upd();
  })();

  /* ---------- 5. block finder ---------- */
  (() => {
    const host = $('#fig-block');
    let p = 26, v = 37;
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'prefix' });
    [25, 26, 27, 28, 29].forEach(k => seg.append(el('button', { 'aria-pressed': String(k === p), text: '/' + k, onclick: () => { p = k; upd(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 6px' }, seg, el('span', { class: 'readout', html: 'ลากหมุด หรือแตะบนแถบ' })));
    const ab = ABar(host);
    const marker = el('div', { class: 'marker' }, el('div', { class: 'knob' }));
    ab.wrap.append(marker);
    const bins = el('div', { style: 'margin-top:12px' }); host.append(bins);
    const reads = el('div', { class: 'reads' }); host.append(reads);
    const fromX = x => { const r = ab.bar.getBoundingClientRect(); return clamp(Math.floor((x - r.left) / r.width * 256), 0, 255); };
    let drag = false;
    ab.wrap.addEventListener('pointerdown', e => { drag = true; ab.wrap.setPointerCapture(e.pointerId); v = fromX(e.clientX); upd(); });
    ab.wrap.addEventListener('pointermove', e => { if (drag) { v = fromX(e.clientX); upd(); } });
    ab.wrap.addEventListener('pointerup', () => drag = false); ab.wrap.addEventListener('pointercancel', () => drag = false);
    ab.wrap.style.touchAction = 'none';
    function upd() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.textContent === '/' + p)));
      const sz = 2 ** (32 - p), k = 256 / sz, segs = [];
      const hit = Math.floor(v / sz);
      for (let i = 0; i < k; i++) segs.push({ id: 'b' + i, a: i * sz, b: (i + 1) * sz, cls: i === hit ? 'used hit' : 'free', bg: i === hit ? 'var(--c-green)' : (i % 2 ? 'var(--surface)' : 'var(--surface-2)'), label: i === hit ? '.' + i * sz + '–.' + ((i + 1) * sz - 1) : '', sub: '' });
      ab.render(segs, 0, 256, Array.from({ length: k + 1 }, (_, i) => ({ v: i * sz, t: '.' + (i === k ? 256 : i * sz), min: 30 })).map(x => x.t === '.256' ? { v: 256, t: '.255' } : x));
      marker.style.left = ((v + .5) / 256 * 100) + '%';
      marker.firstChild.textContent = v;
      const net = hit * sz, bc = net + sz - 1, sbits = p - 24, h = 32 - p;
      const ob = x => { const s = x.toString(2).padStart(8, '0'); return `<span class="s">${s.slice(0, sbits)}</span><span class="bar">|</span><span class="h">${s.slice(sbits)}</span>`; };
      bins.innerHTML = [['IP', v], ['Network (host = 0 หมด)', net], ['Broadcast (host = 1 หมด)', bc]].map(([l, x]) => `<div class="binline" style="margin:4px 0;text-align:left;display:flex;gap:14px;flex-wrap:wrap;align-items:baseline"><span style="font:500 13px var(--font);color:var(--muted);min-width:11em">${l}</span><span><span class="d">192.168.1.</span>${ob(x)} <span class="d">= .${x}</span></span></div>`).join('');
      setReads(reads, [['netaddr', '192.168.1.' + net], ['range', `.${net + 1} – .${bc - 1}`], ['bcast', '192.168.1.' + bc], ['block', sz, `block size (2<sup>${h}</sup>)`]]);
    }
    upd();
    addEventListener('resize', upd);
  })();
  Hop.mcq($('#q-block'), {
    q: '192.168.1.130/26 อยู่ในวงไหน และ broadcast ของวงนั้นคืออะไร',
    opts: ['Network .128, Broadcast .191', 'Network .64, Broadcast .127', 'Network .128, Broadcast .255', 'Network .130, Broadcast .191'], a: 0,
    whyWrong: { 2: '.255 คือ broadcast ของวง /24 ทั้งก้อน ไม่ใช่ของวง /26', 3: 'network address ต้องมีบิต host เป็น 0 หมด .130 ยังมีบิต host เป็น 1 อยู่' },
    why: '/26 เหลือ host 6 บิต ขนาดวง 2<sup>6</sup> = 64 วงจึงเริ่มที่ 0, 64, 128, 192 เลข 130 อยู่ในช่วง 128–191 → network .128 broadcast .191 (ในฐานสอง 130 = 10|000010 ตั้ง host เป็น 0 ได้ 10|000000 = 128 ตั้งเป็น 1 ได้ 10|111111 = 191)',
  });

  /* ---------- 6. VLSM replay of sheet 3.2 ---------- */
  Hop.eq($('#eq-n'), [['block', '2ⁿ'], ' − 2 ≥ ', ['need', 'N']], { sym: { block: '2ⁿ', need: 'N' } });
  Hop.eq($('#eq-n'), [['prefix', 'prefix'], ' = 32 − ', ['nsym', 'n']], { sym: { prefix: '/n', nsym: 'n' } });
  (() => {
    const host = $('#fig-vlsm');
    const S = IP.toInt('172.16.0.0');
    const A = (s) => IP.toInt(s) - S;
    const GROUPS = [
      { hosts: 500, count: 2, d: 0 }, { hosts: 200, count: 3, d: 1 }, { hosts: 100, count: 2, d: 2 }, { hosts: 50, count: 4, d: 3 }, { hosts: 2, count: 4, d: 4 }];
    // segment helpers: [offset, prefix, state, dept]
    const sub = (off, p, n2) => Array.from({ length: n2 }, (_, i) => [off + i * 2 ** (32 - p), p]);
    const F = [];
    const S0 = [[0, 20, 'free']];
    const s23 = sub(0, 23, 8).map(([o, p], i) => [o, p, i < 2 ? 'used' : 'free', i < 2 ? 0 : null, i.toString(2).padStart(3, '0')]);
    const s24 = [...s23.slice(0, 2), ...sub(A('172.16.4.0'), 24, 4).map(([o, p], i) => [o, p, i < 3 ? 'used' : 'free', i < 3 ? 1 : null, i % 2 + '']), ...s23.slice(4)];
    const s25 = [...s24.filter(x => x[0] !== A('172.16.7.0')), ...sub(A('172.16.7.0'), 25, 2).map(([o, p], i) => [o, p, 'used', 2, i + ''])];
    const s26 = [...s25.filter(x => x[0] !== A('172.16.8.0')), ...sub(A('172.16.8.0'), 26, 8).map(([o, p], i) => [o, p, i < 4 ? 'used' : 'free', i < 4 ? 3 : null, i.toString(2).padStart(3, '0')])];
    const s30 = [...s26.filter(x => x[0] !== A('172.16.9.0')), ...sub(A('172.16.9.0'), 30, 16).map(([o, p], i) => [o, p, i < 4 ? 'used' : 'free', i < 4 ? 4 : null, i.toString(2).padStart(4, '0')])];
    const b = (s, p1, p2, xs = true) => binLine(IP.toInt(s), p1, p2, { xs, from: 2 });
    const fr = (segs, view, bin, say, rows) => F.push({ segs, view, bin, say, rows });
    fr(S0, [0, 4096], b('172.16.0.0', 16, 20, false), '172.16 เป็น class B (default /16) แต่โจทย์ให้ /20 จึงถูกยืมไปแล้ว <b style="color:var(--c-amber)">4 บิต</b> บิตที่ใช้แบ่งได้เริ่มที่บิต 21 ใน octet ที่ 3 ก้อนนี้มี IP ทั้งหมด 2<sup>12</sup> = 4,096 ตัว เรียงแผนกจากมากไปน้อย: 500, 200, 100, 50, 2', 0);
    fr(s23, [0, 4096], b('172.16.0.0', 20, 23), '<b>500 hosts</b>: 2<sup>9</sup> − 2 = 510 ≥ 500 → n = 9 → prefix = 32 − 9 = <b>/23</b> ระหว่าง /20 กับ /23 มี 3 บิต (XXX) แบ่งได้ 2<sup>3</sup> = 8 วง วง 000 กับ 001 ให้แผนก 500 hosts', 2);
    fr(s24, [0, 2560], b('172.16.4.0', 23, 24), '<b>200 hosts</b>: 2<sup>8</sup> − 2 = 254 ≥ 200 → n = 8 → <b>/24</b> เอาวงว่าง 010 (172.16.4.0/23) มาแบ่ง 1 บิต ได้ 172.16.4.0 กับ 172.16.5.0 ยังขาดอีกวง จึงแบ่ง 011 (172.16.6.0/23) ต่อ ได้ 172.16.6.0 ส่วน 172.16.7.0/24 เหลือว่างไว้ใช้ต่อ', 5);
    fr(s25, [1024, 2560], b('172.16.7.0', 24, 25), '<b>100 hosts</b>: 2<sup>7</sup> − 2 = 126 ≥ 100 → n = 7 → <b>/25</b> แบ่ง 172.16.7.0/24 ที่เหลือจากขั้นก่อนออกเป็นสองวง ได้ 172.16.7.0/25 กับ 172.16.7.128/25 พอดี 2 วง', 7);
    fr(s26, [2048, 2560], b('172.16.8.0', 23, 26), '<b>50 hosts</b>: 2<sup>6</sup> − 2 = 62 ≥ 50 → n = 6 → <b>/26</b> เอาวงว่าง 100 (172.16.8.0/23) มาแบ่ง จาก /23 ไป /26 ยืม 3 บิต ได้ 8 วง ใช้ 4 วงแรก 172.16.8.0, .64, .128, .192', 11);
    fr(s30, [2304, 2336], b('172.16.9.0', 26, 30), '<b>2 hosts</b> (ลิงก์ระหว่าง router): 2<sup>2</sup> − 2 = 2 ≥ 2 → n = 2 → <b>/30</b> เอาวงว่าง 172.16.9.0/26 มาแบ่ง ยืม 4 บิตได้ 16 วงย่อยขนาด 4 ใช้ 4 วงแรก 172.16.9.0, .4, .8, .12', 15);
    fr(s30, [0, 4096], '<span class="d">ใช้ไป 172.16.0.0 – 172.16.9.15 ที่เหลือว่างตั้งแต่ 172.16.9.16</span>', 'ครบทุกแผนกและไม่มีวงไหนทับกัน วงถัดไปเริ่มที่ broadcast + 1 ของวงก่อนเสมอ เหลือ IP ว่าง 1,776 ตัวไว้ใช้ในอนาคต', 15);

    const ab = ABar(host);
    const bin = el('div', { class: 'binline' }); host.append(bin);
    const say = el('p', { class: 'say' }); host.append(say);
    // result table (all 15 subnets)
    const all = IP.vlsm('172.16.0.0', 20, GROUPS.flatMap(g => Array.from({ length: g.count }, () => ({ hosts: g.hosts, d: g.d })))).order;
    const tw = el('div', { class: 'tw' }); const tb = el('table', { class: 'rtable' });
    tb.innerHTML = '<thead><tr><th>Hosts</th><th>Network/prefix</th><th>ช่วงที่ใช้ได้</th><th>Broadcast</th></tr></thead>';
    const tbody = el('tbody'); tb.append(tbody); tw.append(tb);
    all.forEach(o => tbody.append(el('tr', { html: `<td><span class="sw" style="background:${DCOL(o.d)}"></span>${o.hosts}</td><td>${IP.toStr(o.net)}/${o.p}</td><td>${IP.toStr(o.first)} – ${IP.toStr(o.last)}</td><td>${IP.toStr(o.bcast)}</td>` })));
    const segsOf = f => F[f].segs.map(([o, p, st, d, lab]) => {
      const size = 2 ** (32 - p), used = st === 'used';
      return { id: o + '/' + p, a: o, b: o + size, cls: used ? 'used' : 'free', bg: used ? DCOL(d) : '', label: used ? (GROUPS[d].hosts + '') : (lab || (p === 20 ? '172.16.0.0/20' : '')), sub: p === 20 ? '4,096 IP' : IP.toStr(S + o).split('.').slice(2).join('.') + '/' + p };
    });
    const sc = Hop.scrub(host, {
      stops: [{ label: '<span class="k">172.16.0.0/20</span> ก้อนที่ได้มา' }, { label: '<span class="k">/23</span> 500 hosts ×2' }, { label: '<span class="k">/24</span> 200 hosts ×3' }, { label: '<span class="k">/25</span> 100 hosts ×2' }, { label: '<span class="k">/26</span> 50 hosts ×4' }, { label: '<span class="k">/30</span> 2 hosts ×4' }, { label: 'สรุปทั้งก้อน' }],
      speed: 1500,
      onFrame(t) {
        const i = Math.min(F.length - 1, Math.floor(t)), f = t - i, j = Math.min(F.length - 1, i + 1);
        const A0 = F[i].view, A1 = F[j].view;
        const s0 = A0[1] - A0[0], s1 = A1[1] - A1[0];
        const sp = Math.exp(lerp(Math.log(s0), Math.log(s1), f)), c = lerp((A0[0] + A0[1]) / 2, (A1[0] + A1[1]) / 2, f);
        const lo = c - sp / 2, hi = c + sp / 2;
        const a = segsOf(i), bb = f > 0 ? segsOf(j) : [];
        const ids = new Set(a.map(x => x.id)), idsB = new Set(bb.map(x => x.id));
        const out = a.map(x => idsB.size && !idsB.has(x.id) ? { ...x, op: 1 } : x);
        bb.forEach(x => { if (!ids.has(x.id)) out.push({ ...x, op: f, z: 2 }); else { const k = out.findIndex(y => y.id === x.id); if (x.cls !== out[k].cls && f > .5) out[k] = x; } });
        ab.render(out, lo, hi, [{ v: lo, t: IP.toStr(S + Math.round(lo)) }, { v: hi, t: IP.toStr(S + Math.round(hi) - 1) }]);
        const k = Math.round(t);
        if (bin._k !== k) {
          bin._k = k; bin.innerHTML = F[k].bin; say.innerHTML = F[k].say;
          [...tbody.children].forEach((tr, r) => { tr.className = r < F[k].rows ? (r >= (F[k - 1] ? F[k - 1].rows : 0) && k < 6 ? 'now' : '') : 'pending'; });
        }
      },
    });
    host.append(tw);
  })();
  Hop.mcq($('#q-vlsm'), {
    q: 'แผนกหนึ่งต้องการ 60 เครื่อง ควรได้วง prefix เท่าไร', opts: ['/26', '/27', '/25', '/24'], a: 0,
    whyWrong: { 1: '/27 แจกได้แค่ 2<sup>5</sup> − 2 = 30 เครื่อง ไม่พอ', 2: '/25 ได้ 126 เครื่อง พอแต่ใหญ่เกินจำเป็น VLSM ต้องเลือกวงเล็กที่สุดที่ยังพอ', 3: '/24 ได้ 254 เครื่อง ใหญ่เกินไปมาก' },
    why: 'ไล่ n: 2<sup>5</sup> − 2 = 30 ไม่พอ, 2<sup>6</sup> − 2 = 62 พอ → n = 6 → prefix = 32 − 6 = /26',
  });
  Hop.mcq($('#q-vlsm'), {
    q: 'ทำไม VLSM ต้องเริ่มแบ่งจากแผนกที่ต้องการเครื่องมากที่สุด',
    opts: ['วงใหญ่ต้องเริ่มที่ผลคูณของขนาดตัวเอง ถ้าวางวงเล็กไว้ก่อน วงใหญ่จะต้องเลื่อนออกไปและเหลือช่องว่างใช้ไม่ได้', 'เพราะแผนกใหญ่สำคัญกว่าแผนกเล็ก', 'เพราะ router อ่าน routing table จากวงใหญ่ไปเล็ก', 'ไม่จำเป็น เริ่มจากแผนกไหนก็ได้คำตอบเหมือนกัน'], a: 0,
    whyWrong: { 3: 'ถ้าเริ่มจากวงเล็ก เช่น /30 ที่ .0 แล้ววาง /26 ต่อ /26 ต้องกระโดดไปเริ่มที่ .64 ทำให้ .4–.63 ว่างเปล่าและได้คำตอบต่างจากเฉลย' },
    why: 'วงขนาด 64 เริ่มได้แค่ที่ .0, .64, .128, .192 เท่านั้น วางวงใหญ่ก่อน ทุกวงจะต่อกันพอดีโดยไม่มีช่องว่าง',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    const ORGS = [
      { org: 'บริษัทแห่งหนึ่ง', depts: ['ฝ่ายผลิต', 'ฝ่ายขาย', 'ฝ่ายบัญชี', 'ฝ่ายบุคคล', 'ฝ่ายไอที', 'ฝ่ายการตลาด'] },
      { org: 'โรงพยาบาลแห่งหนึ่ง', depts: ['ตึกผู้ป่วยใน', 'ห้องฉุกเฉิน', 'ฝ่ายเภสัช', 'ฝ่ายการเงิน', 'ห้องแล็บ', 'ฝ่ายเวชระเบียน'] },
      { org: 'มหาวิทยาลัยแห่งหนึ่ง', depts: ['คณะวิทยาศาสตร์', 'คณะวิศวะ', 'หอสมุด', 'สำนักทะเบียน', 'อาคารเรียนรวม', 'ฝ่ายอาคาร'] },
      { org: 'ธนาคารสาขาหนึ่ง', depts: ['ฝ่ายสินเชื่อ', 'เคาน์เตอร์บริการ', 'ฝ่ายบัญชี', 'ห้อง ATM', 'ฝ่ายความเสี่ยง', 'ฝ่ายไอที'] },
    ];
    const R = Hop.rnd;
    function make() {
      for (let tries = 0; tries < 200; tries++) {
        const big = Math.random() < .5;
        const o = Hop.pick(ORGS);
        let base, P;
        if (big) { P = Hop.pick([20, 21, 22]); const step = 2 ** (24 - P); base = `172.${R(16, 31)}.${step * R(0, Math.floor(255 / step))}.0`; }
        else { P = 24; base = `${Hop.pick(['192.168', '203.150', '200.10'])}.${R(1, 250)}.0`; }
        const k = R(3, 5), names = Hop.shuffle(o.depts).slice(0, k);
        const cap = 2 ** (32 - P);
        const pool = big ? [[300, 500], [150, 250], [70, 120], [30, 60], [10, 28]] : [[70, 120], [30, 60], [15, 28], [7, 14], [3, 6]];
        const demands = names.map((nm, i) => ({ name: nm, hosts: R(...Hop.pick(pool)) }));
        if (Math.random() < .6) demands.push({ name: 'ลิงก์ Router–Router', hosts: 2 });
        const r = IP.vlsm(base, P, demands);
        if (r.order.every(x => x.fits) && r.used <= cap && r.used > cap * .45) return { base, P, org: o.org, demands, r };
      }
      return make();
    }
    let cur;
    function render() {
      cur = make();
      const { base, P, org, demands, r } = cur;
      host.innerHTML = '';
      host.append(el('h3', { text: 'โจทย์' }),
        el('p', { class: 'prompt', html: `${org}ได้รับ IP <b class="mono">${base}/${P}</b> ต้องแบ่งให้หน่วยงานต่อไปนี้ด้วยวิธี VLSM จงหา network address พร้อม prefix, IP แรกและ IP สุดท้ายที่ใช้ได้ และ broadcast ของแต่ละหน่วยงาน` }),
        el('div', { class: 'given' }, demands.map(d => el('div', { class: 'g', html: `${esc(d.name)} <b>${d.hosts}</b> เครื่อง` }))));
      const cards = el('div', { class: 'dcards' });
      demands.forEach((d, i) => {
        const f = (lab, key, ph) => el('div', {}, el('label', { text: lab }), el('input', { class: 'field', 'data-i': i, 'data-f': key, placeholder: ph, inputmode: 'decimal', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }));
        cards.append(el('div', { class: 'dcard' }, el('div', { class: 'h', html: `<b>${esc(d.name)}</b><span>${d.hosts} เครื่อง</span>` }),
          el('div', { class: 'grid' }, f('Network/prefix', 'net', 'เช่น 10.0.0.0/26'), f('IP แรกที่ใช้ได้', 'first', ''), f('IP สุดท้ายที่ใช้ได้', 'last', ''), f('Broadcast', 'bcast', ''))));
      });
      const score = el('span', { class: 'score' });
      const work = el('div');
      host.append(cards, el('div', { class: 'bar2' },
        el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: check }),
        el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => show(work) }),
        el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render }), score), work);
      function check() {
        let ok = 0, tot = 0;
        $$('.field', cards).forEach(inp => {
          const o = r.order.find(x => x.i === +inp.dataset.i), v = inp.value.replace(/\s+/g, '');
          if (!v) { inp.classList.remove('ok', 'no'); tot++; return; }
          let good;
          if (inp.dataset.f === 'net') { const [ip, pp] = v.split('/'); good = ip === IP.toStr(o.net) && (+pp === o.p || pp === IP.maskStr(o.p)); }
          else good = v === IP.toStr(inp.dataset.f === 'first' ? o.first : inp.dataset.f === 'last' ? o.last : o.bcast);
          inp.classList.toggle('ok', good); inp.classList.toggle('no', !good); tot++; if (good) ok++;
        });
        score.textContent = `ถูก ${ok}/${tot} ช่อง`;
      }
    }
    function show(work) {
      const { base, P, r } = cur;
      const n0 = IP.toInt(base), c = IP.cls(n0);
      const lines = [];
      lines.push({ note: true, t: `${base}/${P}: octet แรก ${base.split('.')[0]} อยู่ช่วง ${c.from}–${c.to} → class ${c.c} (default /${c.prefix})` + (P > c.prefix ? ` โจทย์ให้ /${P} → ยืมไปแล้ว ${P - c.prefix} บิต` : '') + ` บิตที่ใช้แบ่งได้เริ่มที่บิต ${P + 1} (octet ที่ ${Math.floor(P / 8) + 1})` });
      lines.push({ note: true, t: 'เรียงจากมากไปน้อย: ' + r.order.map(o => `${o.name} ${o.hosts}`).join(', ') });
      let prevNext = r.start;
      r.order.forEach(o => {
        const tries = []; for (let n = 2; n <= o.h; n++) tries.push(`2^${n} − 2 = ${2 ** n - 2}`);
        lines.push({ html: `<b>${esc(o.name)} ${o.hosts} เครื่อง</b>` });
        lines.push({ t: `${tries.slice(-2).join(', ')} ≥ ${o.hosts} → n = ${o.h} → prefix = 32 − ${o.h} = /${o.p} (mask ${IP.maskStr(o.p)})` });
        lines.push({ html: `<span class="binline" style="display:inline;font-size:inherit">${binLine(o.net, P, o.p, { from: Math.floor(P / 8) })}</span>   (เริ่มที่ ${IP.toStr(prevNext)})` });
        lines.push({ t: `Network ${IP.toStr(o.net)}/${o.p}   ใช้ได้ ${IP.toStr(o.first)} – ${IP.toStr(o.last)}   Broadcast ${IP.toStr(o.bcast)}` });
        prevNext = o.bcast + 1;
        lines.push({ note: true, t: `วงถัดไปเริ่มที่ ${IP.toStr(prevNext)}` });
      });
      Hop.work(work, lines, { stagger: 70 });
    }
    render();
  })();
})();
