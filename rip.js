// Chapter 3: RIP
(() => {
  const { $, $$, el, esc, clamp, lerp, easeIO, icon } = Hop;
  Hop.page(3);
  const T = (k, l) => Hop.t(k, l);
  const seg = (opts, cur, onPick, label) => {
    const g = el('div', { class: 'seg', role: 'group', 'aria-label': label || '' });
    opts.forEach(([v, txt]) => g.append(el('button', { 'aria-pressed': String(v === cur), 'data-v': v, html: txt, onclick: () => { $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); onPick(v); } })));
    return g;
  };
  function loop(host, fn) {
    let raf = 0, on = false, t0 = 0;
    const tick = now => { if (!on) return; fn((now - t0) / 1000); raf = requestAnimationFrame(tick); };
    new IntersectionObserver(es => { const v = es[0].isIntersecting; if (v && !on) { on = true; t0 = performance.now(); raf = requestAnimationFrame(tick); } else if (!v) { on = false; cancelAnimationFrame(raf); } }, { threshold: .05 }).observe(host);
  }
  const rglyph = () => `<svg viewBox="-26 -26 52 52" aria-hidden="true">${Hop.dev('router', 0, 0)}</svg>`;

  /* the slide's chain: 10.1.0.0 Fa0/0 [R1] S0/0/0 10.2.0.0 S0/0/0 [R2] S0/0/1 10.3.0.0 S0/0/1 [R3] Fa0/0 10.4.0.0 */
  const CH = { routers: [{ id: 'R1', a: 'Fa0/0', b: 'S0/0/0' }, { id: 'R2', a: 'S0/0/0', b: 'S0/0/1' }, { id: 'R3', a: 'S0/0/1', b: 'Fa0/0' }], nets: ['10.1.0.0', '10.2.0.0', '10.3.0.0', '10.4.0.0'] };
  const SIMR = CH.routers.map((r, i) => ({ id: r.id, ifs: [{ n: r.a, net: CH.nets[i] }, { n: r.b, net: CH.nets[i + 1] }] }));
  const ROUNDS = RT.ripSim(SIMR);
  const FINAL = ROUNDS[ROUNDS.length - 1].T;

  /* chain component: html, horizontal on wide screens, vertical on phones */
  function chain(host, { onNet } = {}) {
    const rc = el('div', { class: 'rc' });
    host.append(rc);
    const api = { rc, o: '', onBuild: null };
    function build() {
      const o = host.clientWidth < 640 ? 'v' : 'h';
      if (o === api.o) return;
      api.o = o; rc.className = 'rc ' + o;
      let h = '';
      CH.nets.forEach((n, i) => {
        h += `<div class="cell net${i === 0 ? ' first' : ''}${i === CH.nets.length - 1 ? ' last' : ''}"><div class="wire"></div><button class="pill" data-net="${n}">${n}</button></div>`;
        const r = CH.routers[i];
        if (r) h += `<div class="cell rt" data-r="${r.id}"><div class="wire"></div><div class="dev"><button class="nm" data-k="router">${r.id}</button><button class="g" data-k="router" aria-label="${r.id}">${rglyph()}</button><button class="ifa" data-k="iface">${r.a}</button><button class="ifb" data-k="iface">${r.b}</button><div class="hopb"></div></div><div class="tbl"><div class="nmv">${r.id}</div><div class="inbox"></div><div class="tb"></div></div></div>`;
      });
      rc.innerHTML = h;
      if (api.onBuild) api.onBuild();
    }
    api.tables = (TT, { fresh = null, hit = null } = {}) => {
      CH.routers.forEach(r => {
        const t = TT[r.id] || {}, box = $(`[data-r="${r.id}"] .tb`, rc);
        box.innerHTML = `<table class="ript"><thead><tr><th>Network</th><th>Interface</th><th>Hop</th></tr></thead><tbody>${Object.entries(t).map(([net, e]) => `<tr class="${fresh && e.isNew ? 'new' : ''}${hit === net ? ' hit' : ''}"><td class="n"><button data-k="network">${net}</button></td><td class="i"><button data-k="exitif">${e.ifc}</button></td><td class="h"><button data-k="hopcount">${e.hop}</button></td></tr>`).join('')}</tbody></table>`;
      });
    };
    api.inbox = (rid, html) => { $(`[data-r="${rid}"] .inbox`, rc).innerHTML = html || ''; };
    api.hop = (rid, v) => { const b = $(`[data-r="${rid}"] .hopb`, rc); if (v == null) b.classList.remove('on'); else { b.textContent = v; b.classList.add('on'); } };
    api.pill = net => $$('.pill', rc).forEach(p => p.classList.toggle('on', p.dataset.net === net));
    api.center = rid => { const g = $(`[data-r="${rid}"] .g`, rc), a = rc.getBoundingClientRect(), b = g.getBoundingClientRect(); return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height / 2 }; };
    rc.addEventListener('click', e => { const p = e.target.closest('.pill'); if (p && onNet) onNet(p.dataset.net); });
    new ResizeObserver(() => build()).observe(host);
    build();
    return api;
  }

  /* ---------- map hero: converged tables, tap a network to count hops ---------- */
  (() => {
    const host = $('#map');
    let sel = null;
    const say = el('p', { class: 'say' });
    const ch = chain(host, { onNet: n => { sel = n; upd(); } });
    host.append(say);
    ch.onBuild = upd;
    function upd() {
      ch.tables(FINAL, { hit: sel });
      ch.pill(sel);
      CH.routers.forEach(r => ch.hop(r.id, sel ? FINAL[r.id][sel].hop : null));
      if (!sel) { say.innerHTML = `ตารางของสไลด์หลัง ${T('convergence', 'converge')} แล้ว แตะชื่อวงที่อยู่บนสาย เพื่อดูว่าแต่ละ router นับวงนั้นห่างกี่ ${T('hopcount', 'hop')} และส่งออกขาไหน`; return; }
      const owners = CH.routers.filter(r => FINAL[r.id][sel].hop === 0).map(r => r.id);
      say.innerHTML = `<b style="color:var(--c-blue)">${sel}</b> ต่ออยู่กับ ${owners.join(' และ ')} จึงเป็น 0 hop สำหรับ${owners.length > 1 ? 'ทั้งสองตัว' : 'ตัวนั้น'} ` + CH.routers.filter(r => FINAL[r.id][sel].hop > 0).map(r => { const e = FINAL[r.id][sel]; return `${r.id} = <b style="color:var(--c-green)">${e.hop}</b> ออก <b style="color:var(--c-teal)">${e.ifc}</b>`; }).join(', ');
    }
    upd();
  })();

  /* ---------- 1. long chain: 15 is the limit ---------- */
  function longChain(W, n, { hopOf, top = 34, label = '10.1.0.0', highlightLast = true, show = () => true }) {
    const per = Math.max(4, Math.min(9, Math.floor((W - 40) / 50) + 1));
    const step = (W - 72) / (per - 1);
    const P = [];
    for (let i = 0; i < n; i++) { const row = Math.floor(i / per), j = i % per; P.push({ x: 36 + (row % 2 ? per - 1 - j : j) * step, y: top + 52 + row * 76 }); }
    let s = `<g class="tag"><rect class="tagbg" x="${P[0].x - 36}" y="${top - 14}" width="72" height="24" rx="8"/><text class="nl" x="${P[0].x}" y="${top + 2}" text-anchor="middle">${label}</text></g><path class="ln" d="M${P[0].x} ${top + 12}L${P[0].x} ${P[0].y}"/>`;
    s += `<path class="ln" d="M${P.map(p => p.x + ' ' + p.y).join('L')}"/>`;
    P.forEach((p, i) => {
      const h = hopOf(i), last = highlightLast && i === n - 1, dead = h >= 16, vis = show(i);
      s += `<g class="lc${last ? ' last' : ''}${dead ? ' dead' : ''}${vis ? '' : ' unk'}"><circle cx="${p.x}" cy="${p.y}" r="16"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle">${vis ? h : ''}</text><text class="rn" x="${p.x}" y="${p.y + 31}" text-anchor="middle">R${i + 1}</text></g>`;
    });
    return { h: P[P.length - 1].y + 44, html: s, P };
  }
  (() => {
    const host = $('#fig-hop');
    let n = 6;
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 8px' });
    const sl = el('input', { type: 'range', class: 'slider', min: 2, max: 17, value: n, 'aria-label': 'จำนวน router' });
    const ro = el('span', { class: 'readout' });
    ctr.append(ro, sl); host.append(ctr);
    const fa = RT.fit(host, W => longChain(W, n, { hopOf: i => i }));
    const say = el('p', { class: 'say' }); host.append(say);
    sl.addEventListener('input', () => { n = +sl.value; upd(); });
    function upd() {
      sl.style.setProperty('--p', ((n - 2) / 15 * 100) + '%');
      ro.textContent = n + ' router';
      fa.draw();
      const h = n - 1;
      say.innerHTML = h < 16 ? `R${n} ต้องผ่าน router ${h} ตัว (R${n - 1} ถึง R1) จึงถึงวง 10.1.0.0 จึงเก็บเป็น <b style="color:var(--c-green)">${h} hop</b>${h === 15 ? ' ซึ่งเป็นค่าสูงสุดที่ RIP ยังใช้ได้' : ''}` : `R${n} นับได้ 16 hop ซึ่งเกินขีดจำกัด RIP ถือว่า <b style="color:var(--c-rose)">${T('unreach', '16 = ไปไม่ถึง')}</b> แพ็กเก็ตไปวง 10.1.0.0 จาก R${n} ไม่ได้เลย ทั้งที่สายยังต่ออยู่`;
    }
    upd();
  })();
  Hop.mcq($('#q-hop'), {
    q: 'จากรูปบนสุดของหน้า R1 นับวง 10.4.0.0 ห่างกี่ hop',
    opts: ['2', '3', '1', '4'], a: 0,
    whyWrong: { 1: 'ไม่นับตัว R1 เอง hop คือ router ที่ต้องผ่านต่อจากเรา คือ R2 กับ R3', 2: '1 hop คือวงที่ต่ออยู่กับเพื่อนบ้าน (R2) เช่น 10.3.0.0 แต่ 10.4.0.0 ต่ออยู่กับ R3 ที่อยู่ถัดไปอีกตัว', 3: 'นับ router ไม่ได้นับวง เส้นทางผ่าน 10.2.0.0, 10.3.0.0 ก็จริง แต่ hop คือจำนวน router' },
    why: '10.4.0.0 ต่ออยู่ที่ R3 จาก R1 ต้องผ่าน R2 และ R3 รวม 2 router จึงเป็น 2 hop ตรงกับตารางในสไลด์ (10.4.0.0 S0/0/0 2)',
  });

  /* ---------- 2. round by round (the slide's chain) ---------- */
  Hop.eq($('#eq-plus'), [['hopcount', 'hop ที่เก็บ'], ' = ', ['ripupdate', 'hop ที่เพื่อนบ้านบอก'], ' + 1'], { sym: { hopcount: 'hop', ripupdate: 'update' } });
  (() => {
    const host = $('#fig-build');
    const ch = chain(host);
    const env = [0, 1, 2, 3].map(() => { const d = el('div', { class: 'upd' }); return d; });
    const say = el('p', { class: 'say' });
    const scH = el('div');
    host.append(scH, say);
    const ACT = { new: '<span class="k">เก็บ (ใหม่)</span>', better: '<span class="k">เก็บ (ดีกว่า)</span>', keep: '', tie: '<span class="x">เท่ากัน</span>' };
    function inboxOf(k, rid) {
      const R = ROUNDS[k]; if (!R) return '';
      return R.msgs.filter(m => m.to === rid).map(m => `<div class="hd">จาก ${m.from} เข้าขา ${m.inIf}</div>` + m.entries.map(e => `<div>${e.net}  ${e.hop}+1 = ${e.cand}  ${e.act === 'keep' ? `<span class="x">มี ${e.had} แล้ว</span>` : ACT[e.act]}</div>`).join('')).join('');
    }
    const STOPS = [
      { label: '<span class="k">0</span> Cold start', say: `${T('coldstart')}: แต่ละ router ใส่แค่วงที่ต่อกับขาตัวเอง เป็น 0 hop R1 ยังไม่รู้เลยว่ามี 10.3.0.0 หรือ 10.4.0.0` },
      { label: '<span class="k">รอบ 1</span> ส่งตารางให้เพื่อนบ้าน', say: `ทุกตัวส่งตารางทั้งตารางออกทุกขาที่รัน RIP ช่องเหนือตารางคือสิ่งที่แต่ละตัวได้รับ: บวก 1 ทุกบรรทัด เพราะต้องผ่านเพื่อนบ้านตัวนั้นอีกหนึ่ง router` },
      { label: '<span class="k">รอบ 1</span> บวก 1 แล้วเก็บ', say: `R1 ได้ 10.3.0.0 = 0 + 1 = 1 จาก R2, R2 ได้ 10.1.0.0 และ 10.4.0.0 เป็น 1, R3 ได้ 10.2.0.0 เป็น 1 ส่วนวงที่มีอยู่แล้วเป็น 0 ไม่เปลี่ยน เพราะ 1 มากกว่า 0 ช่อง Interface คือขาที่ update เข้ามา` },
      { label: '<span class="k">รอบ 2</span> 30 วินาทีต่อมา ส่งอีกครั้ง', say: `30 วินาทีต่อมาทุกตัวส่งอีกรอบ คราวนี้ตารางของ R2 มี 10.4.0.0 = 1 แล้ว ตาม ${T('splith')} R2 ไม่บอก 10.1.0.0 กลับไปให้ R1 และไม่บอก 10.4.0.0 กลับไปให้ R3` },
      { label: '<span class="k">รอบ 2</span> บวก 1 แล้วเก็บ', say: `R1 ได้ 10.4.0.0 = 1 + 1 = <b style="color:var(--c-green)">2</b> ผ่าน S0/0/0 และ R3 ได้ 10.1.0.0 = 2 ผ่าน S0/0/1 ตอนนี้ทุกตารางมีครบ 4 วงแล้ว` },
      { label: '<span class="k">รอบ 3</span> ส่งอีกครั้ง', say: 'update รอบที่ 3 ไม่มีบรรทัดไหนดีกว่าของเดิม ทุกค่าที่ได้รับบวก 1 แล้วมากกว่าหรือเท่ากับที่มีอยู่' },
      { label: '<span class="k">จบ</span> ไม่มีอะไรใหม่ = converged', say: `ทุก router มีข้อมูลครบและถูกต้อง นี่คือ ${T('convergence')} ใช้ 2 รอบ update สำหรับสาย 3 router ตารางตรงกับรูป Achieving Convergence ในสไลด์ทุกช่อง RIP ยังส่ง update ทุก 30 วินาทีต่อไปเรื่อยๆ` },
    ];
    let lastS = -1;
    ch.onBuild = () => { env.forEach(d => ch.rc.append(d)); lastS = -1; if (sc) sc.set(sc.t); };
    env.forEach(d => ch.rc.append(d));
    const sc = Hop.scrub(scH, {
      stops: STOPS, speed: 1700,
      onFrame(t) {
        const s = Math.min(6, Math.floor(t + .5));
        if (s !== lastS) {
          lastS = s;
          const showRound = s === 0 ? 0 : s % 2 ? (s - 1) / 2 : s / 2;
          ch.tables(ROUNDS[Math.min(showRound, ROUNDS.length - 1)].T, { fresh: s % 2 === 0 && s > 0 });
          const ib = s === 0 ? 0 : Math.ceil(s / 2);
          CH.routers.forEach(r => ch.inbox(r.id, ib ? inboxOf(ib, r.id) : ''));
          say.innerHTML = STOPS[s].say;
        }
        // envelopes travel during [2k, 2k+1]
        const sg = Math.floor(t), f = t - sg, R = sg % 2 === 0 && sg < 6 ? ROUNDS[sg / 2 + 1] : null;
        env.forEach((d, i) => {
          const m = R && R.msgs[i];
          if (!m || f <= 0) { d.style.opacity = 0; return; }
          const a = ch.center(m.from), b = ch.center(m.to), k = easeIO(f), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, off = 9;
          const x = lerp(a.x, b.x, k) + (-dy / L) * off, y = lerp(a.y, b.y, k) + (dx / L) * off;
          d.style.transform = `translate(${x - 14}px, ${y - 10}px)`; d.style.opacity = f > .92 ? 0 : 1;
        });
      },
    });
  })();
  Hop.mcq($('#q-build'), {
    q: 'ในรอบที่ 1 R2 ได้รับ 10.2.0.0 hop 0 มาจาก R1 R2 จะทำอะไรกับข้อมูลนี้',
    opts: ['ไม่เปลี่ยน เพราะตารางของ R2 มี 10.2.0.0 เป็น 0 hop อยู่แล้ว ซึ่งน้อยกว่า 0 + 1 = 1', 'เปลี่ยนเป็น 1 hop ผ่าน S0/0/0 เพราะเป็นข้อมูลใหม่กว่า', 'เก็บไว้ทั้งสองบรรทัด', 'ส่งกลับไปบอก R1 ว่ามีอยู่แล้ว'], a: 0,
    whyWrong: { 1: 'RIP เก็บค่าที่น้อยกว่า ไม่ได้เก็บค่าที่มาทีหลัง 10.2.0.0 ต่อกับ R2 ตรงๆ อยู่แล้ว (0 hop)', 2: 'RIP เก็บบรรทัดเดียวต่อวง ยกเว้นกรณี hop เท่ากันพอดีจากคนละทาง', 3: 'RIP ไม่มีการตอบรับ update ส่งทั้งตารางรอบหน้าเหมือนเดิม' },
    why: 'ผู้รับบวก 1 ได้ 1 แล้วเทียบกับของเดิม 0 ค่าเดิมน้อยกว่าจึงไม่เปลี่ยน',
  });
  Hop.mcq($('#q-build'), {
    q: 'ทำไม R1 รู้จัก 10.4.0.0 ในรอบที่ 2 ไม่ใช่รอบที่ 1',
    opts: ['ตอนรอบที่ 1 R2 เองยังไม่รู้จัก 10.4.0.0 ต้องรอ R2 ได้ยินจาก R3 ก่อน แล้วค่อยบอกต่อในรอบถัดไป', 'เพราะ 10.4.0.0 อยู่ไกล update ใช้เวลาเดินทางนานกว่า', 'เพราะ R3 ส่ง update ช้ากว่าตัวอื่น', 'เพราะ split horizon ห้ามส่งในรอบแรก'], a: 0,
    whyWrong: { 1: 'update วิ่งระหว่างเพื่อนบ้านที่ต่อตรงเท่านั้น ไม่ได้วิ่งข้าม router ข้อมูลต้องถูกบอกต่อทีละตัว', 2: 'ทุกตัวส่งทุก 30 วินาทีเหมือนกัน', 3: 'split horizon ห้ามบอกเส้นทางย้อนกลับไปทางที่ได้มา ไม่เกี่ยวกับรอบ' },
    why: 'distance vector บอกต่อได้ทีละ hop ต่อหนึ่งรอบ 10.4.0.0 อยู่ห่าง R1 สองตัว จึงใช้ 2 รอบ',
  });

  /* ---------- 3. periodic updates and timers (R2's point of view) ---------- */
  (() => {
    const host = $('#fig-update');
    let silent = false;
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg([['0', 'ทุกตัวปกติ'], ['1', 'R3 หยุดส่งหลังวินาทีที่ 0']], '0', v => { silent = v === '1'; build(); }));
    host.append(ctr);
    const spec = { bp: 0, H: { h: 120 }, nodes: [{ id: 'R1', type: 'router', k: 'router', label: 'R1', h: [.13, 60], side: { h: 't' } }, { id: 'R2', type: 'router', k: 'router', label: 'R2', h: [.5, 60], side: { h: 't' } }, { id: 'R3', type: 'router', k: 'router', label: 'R3', h: [.87, 60], side: { h: 't' } }],
      links: [{ id: 'a', a: 'R1', b: 'R2', ia: 'S0/0/0', ib: 'S0/0/0', iaPos: 'a' }, { id: 'b', a: 'R2', b: 'R3', ia: 'S0/0/1', ib: 'S0/0/1', iaPos: 'a' }] };
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); fa.L = L; return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) + [0, 1, 2, 3].map(i => RT.envelope('u' + i, 'var(--c-green)')).join('') }; });
    fa.draw();
    const clock = el('div', { class: 'timer' });
    const tb = el('div', { class: 'tw' });
    const say = el('p', { class: 'say' });
    const scH = el('div');
    host.append(clock, tb, scH, say);
    let sc;
    function build() {
      scH.innerHTML = '';
      const stops = Array.from({ length: 9 }, (_, i) => ({ label: `<span class="k">${i * 30} s</span> ` + (silent ? (i === 0 ? 'R3 ส่งครั้งสุดท้าย' : i < 6 ? 'R3 เงียบ R2 ยังรอ' : i === 6 ? '180 s ไม่ได้ยิน: invalid' : i === 7 ? 'ยัง invalid' : '240 s: flush ลบทิ้ง') : (i === 0 ? 'ส่งทั้งตาราง' : 'ส่งทั้งตารางซ้ำ')) }));
      let lastK = '';
      if (sc) sc.stop();
      sc = Hop.scrub(scH, { stops, speed: 1300, onFrame(t) {
        const time = t * 30, P = fa.L && fa.L.P;
        if (P) {
          const sg = Math.floor(t), f = t - sg, k = easeIO(clamp(f / .45, 0, 1)), live = sg < 8 || f === 0;
          [['R1', 'R2'], ['R2', 'R1'], ['R2', 'R3'], ['R3', 'R2']].forEach(([a, b], i) => {
            const g = $('#u' + i, fa.svg), on = live && f > 0 && f < .5 && !(silent && a === 'R3' && sg > 0);
            RT.place(g, { x: lerp(P[a].x, P[b].x, k), y: lerp(P[a].y, P[b].y, k) + (a < b ? -9 : 9) }, on ? 1 : 0);
          });
        }
        const age1 = Math.round(time % 30 < 1e-6 && time > 0 ? 0 : time % 30), age4 = silent ? Math.round(time) : age1;
        const key = Math.round(time) + '' + silent;
        if (key === lastK) return; lastK = key;
        const inv = silent && age4 >= 180, gone = silent && age4 >= 240;
        clock.innerHTML = `${Math.round(time)} s <small>R2 ส่ง update ไปแล้ว ${Math.floor(t) + 1} รอบ รอบละ 4 บรรทัด ให้ทั้ง R1 และ R3</small>`;
        tb.innerHTML = `<table class="ript"><thead><tr><th>Network</th><th>Interface</th><th>Hop</th><th>ได้ยินล่าสุด</th></tr></thead><tbody>
          <tr><td class="n"><button data-k="network">10.2.0.0</button></td><td class="i"><button data-k="exitif">S0/0/0</button></td><td class="h"><button data-k="hopcount">0</button></td><td class="mut">ต่อตรง</td></tr>
          <tr><td class="n"><button data-k="network">10.3.0.0</button></td><td class="i"><button data-k="exitif">S0/0/1</button></td><td class="h"><button data-k="hopcount">0</button></td><td class="mut">ต่อตรง</td></tr>
          <tr><td class="n"><button data-k="network">10.1.0.0</button></td><td class="i"><button data-k="exitif">S0/0/0</button></td><td class="h"><button data-k="hopcount">1</button></td><td>${age1} s ก่อน</td></tr>
          <tr class="${gone ? 'gone' : inv ? 'inv' : ''}"><td class="n"><button data-k="network">10.4.0.0</button></td><td class="i"><button data-k="exitif">S0/0/1</button></td><td class="h"><button data-k="${inv ? 'unreach' : 'hopcount'}">${inv ? 16 : 1}</button></td><td class="${age4 >= 150 && silent ? 'c-rose-t' : ''}">${gone ? 'ลบแล้ว' : age4 + ' s ก่อน'}</td></tr></tbody></table>`;
        say.innerHTML = !silent ? `ทุก 30 วินาที R2 ส่งตาราง 4 บรรทัดทั้งตารางให้ R1 และ R3 และได้รับตารางของทั้งสองตัวกลับมา ตัวนับ "ได้ยินล่าสุด" จึงกลับเป็น 0 ทุกรอบ ทั้งที่ไม่มีอะไรเปลี่ยนเลยก็ยังส่ง นี่คือเหตุผลที่ RIP เปลือง bandwidth` :
          gone ? `ครบ 240 วินาทีที่ไม่ได้ยิน R2 ลบ 10.4.0.0 ออกจากตาราง (flush) กว่าจะรู้ว่าเส้นทางหายไปใช้เวลาถึง 4 นาที` :
          inv ? `ไม่ได้ยิน 10.4.0.0 ครบ 180 วินาที R2 ตั้งให้เป็น invalid คือ hop 16 (${T('unreach', 'ไปไม่ถึง')}) และบอกเพื่อนบ้านต่อ แต่ยังไม่ลบ` :
          `R3 เงียบไปตั้งแต่วินาทีที่ 0 R2 ไม่รู้ว่าเกิดอะไรขึ้น เส้นทางยังอยู่ในตารางเป็น 1 hop เหมือนเดิม และยังส่งแพ็กเก็ตไปหา R3 ต่อ (ตัวนับ ${age4} s) RIP จะรอถึง 180 วินาทีก่อน`;
      } });
    }
    build();
  })();

  /* ---------- 4. convergence time on a chain ---------- */
  Hop.eq($('#eq-conv'), [['convergence', 'เวลา converge'], ' ≈ (', ['nrouters', 'n'], ' − 1) × ', ['ripupdate', '30 s']], { sym: { convergence: 'เวลา', nrouters: 'n', ripupdate: '30 s' } });
  (() => {
    const host = $('#fig-conv');
    let n = 6, t = 0;
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 8px' });
    const sl = el('input', { type: 'range', class: 'slider', min: 3, max: 16, value: n, 'aria-label': 'จำนวน router' });
    const ro = el('span', { class: 'readout' });
    ctr.append(ro, sl); host.append(ctr);
    const fa = RT.fit(host, W => { const r = longChain(W, n, { hopOf: i => i, show: i => i <= Math.floor(t + 1e-6), highlightLast: false }); fa.P = r.P; return { h: r.h, html: r.html + RT.envelope('cv', 'var(--c-green)') }; });
    const scH = el('div'), say = el('p', { class: 'say' });
    host.append(scH, say);
    let lastK = -1, csc = null;
    function build() {
      sl.style.setProperty('--p', ((n - 3) / 13 * 100) + '%');
      ro.textContent = n + ' router';
      t = 0; lastK = -1; fa.draw();
      scH.innerHTML = '';
      if (csc) csc.stop();
      csc = Hop.scrub(scH, { stops: Array.from({ length: n }, (_, k) => ({ label: `<span class="k">${k * 30} s</span> ${k === 0 ? 'R1 รู้จักวงของตัวเอง' : k === n - 1 ? `R${n} รู้แล้ว converged` : `รอบ ${k}: R${k + 1} รู้จัก`}` })), speed: n > 10 ? 650 : 900,
        onFrame(tt) {
          t = tt;
          const k = Math.floor(tt + 1e-6);
          if (k !== lastK) { lastK = k; fa.draw(); say.innerHTML = k === 0 ? `ตอนเริ่ม มีแค่ R1 ที่รู้จัก 10.1.0.0 เพราะต่อตรง (0 hop) router ตัวอื่นยังไม่รู้ว่ามีวงนี้` : k < n - 1 ? `หลัง update ${k} รอบ (ประมาณ ${k * 30} วินาที) ข่าวเรื่อง 10.1.0.0 ไปถึงแค่ R${k + 1} router ที่อยู่ขวากว่านั้นยังไม่รู้ว่ามีวงนี้` : `ครบ ${n - 1} รอบ ประมาณ ${(n - 1) * 30} วินาที${(n - 1) * 30 >= 60 ? ` (${((n - 1) * 30 / 60).toFixed(1).replace('.0', '')} นาที)` : ''} R${n} จึงรู้จัก 10.1.0.0 เป็น ${n - 1} hop ทั้งเครือข่าย converge` ; }
          const P = fa.P, g = $('#cv', fa.svg);
          if (P && g) { const f = tt - k; if (k < n - 1 && f > 0) RT.place(g, { x: lerp(P[k].x, P[k + 1].x, easeIO(f)), y: lerp(P[k].y, P[k + 1].y, easeIO(f)) - 22 }, f > .95 ? 0 : 1); else RT.place(g, { x: 0, y: 0 }, 0); }
        } });
    }
    sl.addEventListener('input', () => { n = +sl.value; build(); });
    build();
  })();
  Hop.mcq($('#q-conv'), {
    q: 'เครือข่าย RIP เป็นสายตรงของ router 6 ตัว มีวงใหม่ต่อเข้าที่ router ตัวแรก router ตัวสุดท้ายจะรู้จักวงนี้หลัง update อย่างน้อยกี่รอบ',
    opts: ['5 รอบ (ประมาณ 150 วินาที)', '6 รอบ', '1 รอบ เพราะส่งทั้งตาราง', '30 รอบ'], a: 0,
    whyWrong: { 1: 'ตัวแรกรู้เองตั้งแต่ต้น ต้องบอกต่ออีก 5 ช่วงเท่านั้น', 2: 'ส่งทั้งตารางก็จริง แต่ส่งถึงเพื่อนบ้านที่ต่อตรงเท่านั้น', 3: '30 คือจำนวนวินาทีต่อรอบ ไม่ใช่จำนวนรอบ' },
    why: 'ข่าวไปได้หนึ่ง router ต่อรอบ จากตัวที่ 1 ถึงตัวที่ 6 ต้องผ่าน 5 ช่วง = 5 รอบ × 30 วินาที = 150 วินาที',
  });
  Hop.mcq($('#q-conv'), {
    q: 'กฎ split horizon ในสไลด์ ทำอะไร',
    opts: ['ไม่ส่งเส้นทางกลับออกไปทางขาที่ได้เส้นทางนั้นเข้ามา เพื่อกันลูป', 'แบ่งตารางเป็นสองครึ่งแล้วส่งสลับกัน', 'ส่ง update เฉพาะครึ่งหนึ่งของเพื่อนบ้าน', 'จำกัดไม่ให้เกิน 15 hop'], a: 0,
    whyWrong: { 1: 'ชื่อชวนให้คิดแบบนั้น แต่ horizon หมายถึงทิศที่ได้ข้อมูลมา', 3: 'การจำกัด 15 hop เป็นเรื่อง metric ไม่ใช่ split horizon' },
    why: 'R2 รู้ 10.1.0.0 จาก R1 ถ้าบอกกลับไปให้ R1 ว่า 10.1.0.0 อยู่ห่าง 2 ผ่าน R2 วันที่วงนั้นล่ม R1 อาจเชื่อและส่งวนไปมา split horizon จึงตัดข้อความนี้ทิ้ง',
  });

  /* ---------- 5. RIPv1 vs RIPv2 ---------- */
  $$('#t-ver td[data-n]').forEach(td => td.innerHTML = `${icon('x', 'icn n')} ไม่ได้`);
  $$('#t-ver td[data-y]').forEach(td => td.innerHTML = `${icon('check', 'icn y')} ได้`);
  (() => {
    const host = $('#fig-ver');
    let v = '1';
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg([['1', 'RIPv1'], ['2', 'RIPv2']], v, x => { v = x; upd(); }));
    host.append(ctr);
    const spec = { bp: 0, H: { h: 300 },
      nodes: [{ id: 'R2', type: 'router', k: 'router', label: 'R2 (ผู้ส่ง)', h: [.5, 45], side: { h: 'r' } }, { id: 'sw', type: 'switch', h: [.5, 145] },
        { id: 'pa', type: 'pc', label: 'PC', h: [.15, 250] }, { id: 'pb', type: 'pc', label: 'PC', h: [.5, 250] }, { id: 'R4', type: 'router', k: 'router', label: 'R4 (RIP)', h: [.85, 250] }],
      links: [['R2', 'sw'], ['sw', 'pa'], ['sw', 'pb'], ['sw', 'R4']].map(([a, b]) => ({ id: a + b, a, b })) };
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); fa.L = L; return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) + [0, 1, 2].map(i => RT.envelope('v' + i, 'var(--c-green)')).join('') }; });
    const card = el('div', { class: 'cli' }), say = el('p', { class: 'say' });
    host.append(card, say);
    fa.after = upd; fa.draw();
    function upd() {
      card.innerHTML = v === '1' ? `<div class="ln2"><span class="pr">ปลายทาง</span> 255.255.255.255 <span class="cm">broadcast</span></div><div class="ln2">150.20.100.128  hop 1 <span class="cm">ไม่มี mask</span></div><div class="ln2">150.20.100.32  hop 2 <span class="cm">ไม่มี mask</span></div>` :
        `<div class="ln2"><span class="pr">ปลายทาง</span> 224.0.0.9 <span class="cm">multicast</span></div><div class="ln2">150.20.100.128<b class="c-blue-t">/27</b>  hop 1</div><div class="ln2">150.20.100.32<b class="c-blue-t">/27</b>  hop 2</div><div class="ln2"><span class="cm">ใส่ authentication ได้</span></div>`;
      say.innerHTML = v === '1' ? `${T('ripv1')} ส่งแบบ ${T('bcast', 'broadcast')} ทุกเครื่องในวงต้องรับ PC ที่ไม่ได้รัน RIP ก็ต้องรับแล้วทิ้ง และในข้อความไม่มี subnet mask ผู้รับต้องเดา mask เอง ถ้าเครือข่ายใช้ VLSM อย่าง /27 กับ /30 ในแล็บ จะเดาผิดได้ (${T('classful')})` :
        `${T('ripv2')} ส่งแบบ ${T('mcast', 'multicast 224.0.0.9')} ถึงเฉพาะ router ที่รัน RIPv2 PC ไม่ต้องรับ และแนบ mask (/27) มากับทุกบรรทัด จึงใช้กับ VLSM และ CIDR ได้ (${T('classless')}) hop count และรอบ 30 วินาทีเหมือนเดิม`;
    }
    loop(host, s => {
      if (!fa.L) return;
      const P = fa.L.P, cyc = 2.6, ph = (s % cyc) / cyc;
      ['pa', 'pb', 'R4'].forEach((id, i) => {
        const g = $('#v' + i, fa.svg), go = v === '1' || id === 'R4';
        const pts = [P.R2, P.sw, P[id]];
        RT.place(g, RT.along(pts, easeIO(clamp(ph / .8, 0, 1))), go && ph < .88 ? 1 : (ph < .4 ? 1 : 0));
      });
    });
  })();
  Hop.mcq($('#q-ver'), {
    q: 'แล็บ 6 ใช้วงขนาด /27 และ /30 ปนกัน (VLSM) ควรตั้ง RIP รุ่นไหน เพราะอะไร',
    opts: ['RIPv2 เพราะส่ง subnet mask ไปกับ update จึงรองรับ VLSM', 'RIPv1 เพราะส่งแบบ broadcast ทุกเครื่องได้รับแน่นอน', 'รุ่นไหนก็ได้ เพราะ metric เหมือนกัน', 'RIPv2 เพราะนับ hop ได้มากกว่า 15'], a: 0,
    whyWrong: { 1: 'broadcast ไม่ได้ช่วยเรื่อง mask ข้อความของ RIPv1 ไม่มี mask จึงแยก /27 กับ /30 ไม่ได้', 2: 'metric เหมือนกันจริง แต่ความต่างอยู่ที่ mask ในข้อความ', 3: 'ทั้งสองรุ่นสูงสุด 15 hop เท่ากัน' },
    why: 'RIPv2 เป็น classless ส่ง mask มากับทุกบรรทัด VLSM จึงใช้ได้ คำสั่งคือ version 2 ใต้ router rip',
  });

  /* ---------- 6. config (lab 6, Router_A) ---------- */
  (() => {
    const host = $('#fig-config');
    const L = [
      { p: 'Router_A(config)#', c: 'router rip', s: `เปิด RIP บน Router_A prompt เปลี่ยนเป็น <code>Router_A(config-router)#</code> คำสั่งถัดไปทั้งหมดเป็นการตั้งค่า RIP` },
      { p: 'Router_A(config-router)#', c: 'version 2', s: `ใช้ ${T('ripv2')}: ส่ง mask ไปด้วยและส่งแบบ multicast 224.0.0.9 ถ้าไม่พิมพ์บรรทัดนี้ router ส่งแบบ RIPv1` },
      { p: 'Router_A(config-router)#', c: 'network 150.20.100.64', s: `ขา F0/0 (150.20.100.94) อยู่วง LAN A 150.20.100.64/27 คำสั่ง ${T('ripnet', 'network')} ทำให้ขานี้รัน RIP และวงนี้ถูกประกาศให้เพื่อนบ้าน IOS เก็บแบบ classful เป็น <code>network 150.20.0.0</code> เพราะ 150 อยู่ class B` },
      { p: 'Router_A(config-router)#', c: 'network 150.20.100.104', s: 'ขา S0/0/0 (150.20.100.105) ต่อกับ Router_B ในวง 150.20.100.104/30 ถึงจะพิมพ์ต่างกัน IOS ก็เก็บเป็น 150.20.0.0 เหมือนบรรทัดก่อน ทุกขาที่ขึ้นต้นด้วย 150.20 จึงรัน RIP ครบ' },
      { p: 'Router_A(config-router)#', c: 'no auto-summary', s: `${T('autosum')}: ให้ RIPv2 ส่งวงย่อยตามจริงพร้อม mask ไม่ยุบรวมเป็น 150.20.0.0/16 เวลาข้ามขอบ major network ในแล็บนี้ทุกวงอยู่ใน 150.20.0.0 จึงไม่ต่าง แต่ควรใส่เมื่อใช้ VLSM` },
      { p: 'Router_A#', c: 'show ip route', s: 'ดูผลหลัง converge (คิดจากสาย A–B–C ก่อนเพิ่มลิงก์ A–C) บรรทัด R คือเส้นทางที่เรียนจาก RIP แตะแต่ละบรรทัดด้านล่าง' },
    ];
    const OUT = [
      ['C', '150.20.100.64/27 is directly connected, FastEthernet0/0', 'LAN A ต่อกับขา F0/0 ของ Router_A เอง'],
      ['L', '150.20.100.94/32 is directly connected, FastEthernet0/0', 'IP ของขา F0/0 เอง'],
      ['C', '150.20.100.104/30 is directly connected, Serial0/0/0', 'วงของสาย A–B'],
      ['L', '150.20.100.105/32 is directly connected, Serial0/0/0', 'IP ของขา S0/0/0 เอง'],
      ['R', '150.20.100.128/27 [120/1] via 150.20.100.106, 00:00:12, Serial0/0/0', 'LAN B ต่ออยู่ที่ Router_B ผ่าน router 1 ตัว จึงเป็น [120/1] (AD 120, hop 1) next hop คือขา S0/0/0 ของ Router_B'],
      ['R', '150.20.100.100/30 [120/1] via 150.20.100.106, 00:00:12, Serial0/0/0', 'สาย B–C ต่อกับ Router_B จึงห่าง 1 hop'],
      ['R', '150.20.100.32/27 [120/2] via 150.20.100.106, 00:00:12, Serial0/0/0', 'LAN C ต่ออยู่ที่ Router_C ต้องผ่าน Router_B และ Router_C = 2 hop ถ้าเพิ่มลิงก์ A–C ตามการทดลองที่ 2 วงนี้จะเหลือ 1 hop ผ่านลิงก์ใหม่'],
    ];
    const cli = el('div', { class: 'cli' }), out = el('div', { class: 'cli out' }), say = el('p', { class: 'say' });
    cli.innerHTML = L.map((l, i) => `<div class="ln2"><span class="pr">${l.p}</span> <button data-i="${i}">${l.c}</button></div>`).join('');
    out.innerHTML = OUT.map((o, i) => `<div class="ln2"><button data-o="${i}" class="${o[0] === 'R' ? 'rln' : 'cln'}"><b>${o[0]}</b> ${o[1]}</button></div>`).join('');
    host.append(cli, out, say);
    const pick = (box, attr, i, txt) => { $$('button', host).forEach(b => b.classList.remove('sel')); $(`[${attr}="${i}"]`, box).classList.add('sel'); say.innerHTML = txt; };
    cli.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(cli, 'data-i', b.dataset.i, L[b.dataset.i].s); });
    out.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (b) pick(out, 'data-o', b.dataset.o, OUT[b.dataset.o][2]); });
    pick(cli, 'data-i', 0, L[0].s);
  })();

  /* ---------- 7. the slide's Router A, B, C figure ---------- */
  (() => {
    const host = $('#fig-abc');
    const spec = { bp: 0, H: { h: 290 },
      nodes: [{ id: 'A', type: 'router', k: 'router', label: 'Router A', h: [.12, 85], side: { h: 't' } }, { id: 'B', type: 'router', k: 'router', label: 'Router B', h: [.68, 85], side: { h: 't' } },
        { id: 'C', type: 'router', k: 'router', label: 'Router C', h: [.4, 225], side: { h: 'b' } }, { id: 'N', type: 'cloud', k: 'network', label: 'เครือข่าย B', h: [.9, 85], side: { h: 'b' } }],
      links: [{ id: 'ab', a: 'A', b: 'B', label: '56 Kbps', k: 'bandwidth', lcls: 'nl bl' }, { id: 'ac', a: 'A', b: 'C', label: '1.5', k: 'bandwidth', lcls: 'nl bl', lpos: { h: 'l' } }, { id: 'cb', a: 'C', b: 'B', label: '1.5', k: 'bandwidth', lcls: 'nl bl', lpos: { h: 'r' } }, { id: 'bn', a: 'B', b: 'N' }] };
    let from = 'A', pr = 'rip';
    const ctr = el('div', { class: 'ctrls', style: 'margin:0 0 6px' });
    ctr.append(seg([['A', 'ส่งจาก A'], ['C', 'ส่งจาก C']], from, v => { from = v; upd(); }), seg([['rip', 'RIP'], ['ospf', 'ถ้าเป็น OSPF']], pr, v => { pr = v; upd(); }));
    host.append(ctr);
    const fa = RT.fit(host, W => { const L = RT.layout(spec, W); fa.L = L; return { h: L.H, html: RT.links(spec, L) + RT.nodes(spec, L) + RT.envelope('ab', 'var(--c-green)') }; });
    const calc = el('div', { class: 'calc' }), say = el('p', { class: 'say' });
    host.append(calc, say);
    const PATHS = {
      A: [{ ids: ['A', 'B', 'N'], name: 'A → B', hop: 1, hopTxt: 'ผ่าน Router B ตัวเดียว', cost: 1785, costTxt: '56 Kbps: 100,000,000 ÷ 56,000 = 1785' },
          { ids: ['A', 'C', 'B', 'N'], name: 'A → C → B', hop: 2, hopTxt: 'ผ่าน Router C และ Router B', cost: 132, costTxt: '1.5 Mbps สองช่วง: 66 + 66' }],
      C: [{ ids: ['C', 'B', 'N'], name: 'C → B', hop: 1, hopTxt: 'ผ่าน Router B ตัวเดียว', cost: 66, costTxt: '1.5 Mbps: 100,000,000 ÷ 1,500,000 = 66' },
          { ids: ['C', 'A', 'B', 'N'], name: 'C → A → B', hop: 2, hopTxt: 'ผ่าน Router A และ Router B', cost: 1851, costTxt: '66 + 1785' }],
    };
    let win;
    fa.after = upd; fa.draw();
    function upd() {
      const ps = PATHS[from], v = p => pr === 'rip' ? p.hop : p.cost;
      win = v(ps[0]) <= v(ps[1]) ? ps[0] : ps[1];
      const edges = new Set(); win.ids.forEach((id, i) => { if (i) edges.add([win.ids[i - 1], id].sort().join('')); });
      $$('.lk', fa.svg).forEach(l => { const id = l.dataset.link, key = id.toUpperCase().split('').sort().join(''); $('.ln', l).classList.toggle('on', edges.has(key)); });
      $$('.nd', fa.svg).forEach(n => n.classList.toggle('on', n.dataset.id === from));
      calc.innerHTML = ps.map(p => `<div class="crow${p === win ? ' win' : ''}"><div class="cp">${p.name}</div><div class="cf">${pr === 'rip' ? p.hopTxt : p.costTxt}</div><button class="cv" data-k="${pr === 'rip' ? 'hopcount' : 'ospfcost'}">${pr === 'rip' ? p.hop + ' hop' : 'cost ' + p.cost}</button></div>`).join('');
      say.innerHTML = pr === 'rip' ? (from === 'A' ? `RIP เลือก <b>A → B</b> 1 hop ถึงสาย 56 Kbps จะช้ากว่าเส้นทางผ่าน C เพราะ ${T('hopcount')} ไม่ดูความเร็ว เขียนตอบว่า "ไปทาง Router B โดยตรง 1 hop เพราะ RIP ใช้ hop count เป็น metric เลือกเส้นทางที่ผ่าน router น้อยที่สุด"` : `จาก C ทางตรงไป B เป็น 1 hop ส่วนอ้อมผ่าน A เป็น 2 hop RIP จึงเลือก C → B`) :
        (from === 'A' ? `ถ้าตีความว่า 1.5 คือ 1.5 Mbps OSPF จะอ้อมผ่าน C เพราะ cost 132 น้อยกว่า 1785 นี่คือจุดที่ RIP ต่างจากโปรโตคอลที่ดู bandwidth ถ้าอ่านตามตัวอักษรว่า 1.5 Kbps ลิงก์นั้นช้ากว่า 56 Kbps OSPF ก็จะเลือกทางตรงเหมือน RIP` : 'จาก C ทางตรงไป B ทั้งสั้นกว่าและเร็วกว่า ทุกโปรโตคอลเลือกเหมือนกัน');
    }
    loop(host, s => { if (!fa.L || !win) return; const ph = (s % 2.6) / 2.6; RT.place($('#ab', fa.svg), RT.along(win.ids.map(id => fa.L.P[id]), easeIO(clamp(ph / .85, 0, 1))), ph > .9 ? 0 : 1); });
  })();
  Hop.mcq($('#q-abc'), {
    q: 'จากรูปของสไลด์ Router A จะส่งแพ็กเก็ตไปเครือข่าย B ทางไหน ถ้าใช้ RIP',
    opts: ['ส่งตรงไป Router B เพราะเป็น 1 hop น้อยกว่าทางผ่าน C ที่เป็น 2 hop', 'ผ่าน Router C เพราะลิงก์ 1.5 เร็วกว่า 56 Kbps', 'แบ่งส่งทั้งสองทาง', 'ผ่าน Router C เพราะมีสองลิงก์ช่วยกันส่ง'], a: 0,
    whyWrong: { 1: 'RIP ไม่ดูความเร็วลิงก์เลย ถ้าโจทย์ถาม OSPF หรือ EIGRP คำตอบนี้ถึงจะเป็นไปได้', 2: 'แบ่งส่งเกิดเมื่อ hop เท่ากัน แต่ 1 กับ 2 ไม่เท่ากัน', 3: 'จำนวนลิงก์ที่มากกว่าแปลว่า hop มากกว่า ยิ่งแย่สำหรับ RIP' },
    why: 'metric ของ RIP คือ hop count ทางตรงผ่าน router 1 ตัว ทางอ้อมผ่าน 2 ตัว RIP เลือกค่าที่น้อยกว่าเสมอ',
  });

  /* ---------- drill: random topology, fill one router's RIP table ---------- */
  (() => {
    const host = $('#drill');
    const TPL = [
      { H: 270, R: { R1: [.15, 70], R2: [.5, 70], R3: [.85, 70] }, links: [['R1', 'R2'], ['R2', 'R3']], lans: { R1: [.15, 200], R3: [.85, 200] } },
      { H: 270, R: { R1: [.15, 70], R2: [.5, 70], R3: [.85, 70] }, links: [['R1', 'R2'], ['R2', 'R3']], lans: { R1: [.15, 200], R2: [.5, 200], R3: [.85, 200] } },
      { H: 290, R: { R1: [.1, 80], R2: [.37, 80], R3: [.63, 80], R4: [.9, 80] }, links: [['R1', 'R2'], ['R2', 'R3'], ['R3', 'R4']], lans: { R1: [.1, 215], R4: [.9, 215] } },
      { H: 360, R: { R1: [.15, 80], R2: [.85, 80], R3: [.5, 215] }, links: [['R1', 'R2'], ['R1', 'R3'], ['R2', 'R3']], lans: { R1: [.15, 215], R2: [.85, 215], R3: [.5, 320] } },
      { H: 360, R: { R1: [.15, 80], R2: [.5, 80], R3: [.85, 80], R4: [.5, 215] }, links: [['R1', 'R2'], ['R2', 'R3'], ['R2', 'R4']], lans: { R1: [.15, 215], R3: [.85, 215], R4: [.5, 320] } },
    ];
    let cur;
    function make() {
      const tp = Hop.pick(TPL);
      const ids = Object.keys(tp.R);
      const nets = []; tp.links.forEach(l => nets.push({ kind: 'link', ends: l })); Object.keys(tp.lans).forEach(r => nets.push({ kind: 'lan', ends: [r] }));
      const nums = Hop.shuffle(Array.from({ length: nets.length }, (_, i) => i + 1)), base = Hop.pick([10, 10, 172]);
      nets.forEach((n, i) => n.name = base === 10 ? `10.${nums[i]}.0.0` : `172.16.${nums[i]}.0`);
      const ser = ['S0/0/0', 'S0/0/1', 'S0/1/0'];
      const routers = ids.map(id => { let k = 0; return { id, ifs: nets.filter(n => n.ends.includes(id)).sort((a, b) => (a.kind === 'lan') - (b.kind === 'lan')).map(n => ({ n: n.kind === 'lan' ? 'Fa0/0' : ser[k++], net: n.name })) }; });
      const me = Hop.pick(ids);
      return { tp, ids, nets, routers, me, ans: RT.ripAnswer(routers, me) };
    }
    function render() {
      cur = make();
      const { tp, nets, routers, me, ans } = cur;
      const R = routers.find(r => r.id === me);
      host.innerHTML = '';
      host.append(el('h3', { text: 'โจทย์' }), el('p', { class: 'prompt', html: `ทุก router รัน RIP และ converge แล้ว จงเขียน routing table ของ <b>${me}</b> ให้ครบทุกวง (Network, Interface, Hop) ขาของ ${me} มี ${R.ifs.map(f => `${f.n} (วง ${f.net})`).join(', ')}` }));
      const fig = el('div', { class: 'dfig' }); host.append(fig);
      const spec = { bp: 0, H: { h: tp.H }, nodes: [], links: [] };
      Object.entries(tp.R).forEach(([id, p]) => spec.nodes.push({ id, type: 'router', label: id, h: p, side: { h: p[1] > 150 ? 'r' : 't' } }));
      nets.forEach((n, i) => {
        if (n.kind === 'lan') { const r = n.ends[0], p = tp.lans[r]; spec.nodes.push({ id: 'L' + i, type: 'cloud', label: n.name, h: p, side: { h: 'b' }, k: 'network' }); spec.links.push({ id: 'x' + i, a: r, b: 'L' + i, ia: r === me ? 'Fa0/0' : null, ifd: 34 }); }
        else { const [a, b] = n.ends, fa = R.ifs.find(f => f.net === n.name); spec.links.push({ id: 'x' + i, a, b, label: n.name, ia: a === me ? fa.n : null, ib: b === me ? fa.n : null, ifd: 34 }); }
      });
      const fit = RT.fit(fig, W => { const L = RT.layout(spec, W); return { h: L.H + 30, html: RT.links(spec, L) + RT.nodes(spec, L) }; });
      fit.after = () => $$('.nd', fit.svg).forEach(n => n.classList.toggle('on', n.dataset.id === me));
      fit.draw();
      const form = el('div', { class: 'ripform' });
      form.append(el('div', { class: 'hd', html: '<span>Network</span><span>Hop</span><span>Interface</span>' }));
      const order = [...nets].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
      order.forEach(n => {
        const sel = el('select', { class: 'field', 'data-net': n.name, 'aria-label': 'interface ของ ' + n.name }, el('option', { value: '', text: 'เลือก' }), ...R.ifs.map(f => el('option', { value: f.n, text: f.n })));
        form.append(el('div', { class: 'rr' }, el('span', { class: 'nn', text: n.name }), el('input', { class: 'field', inputmode: 'numeric', 'data-net': n.name, 'aria-label': 'hop ของ ' + n.name, autocomplete: 'off' }), sel));
      });
      host.append(form);
      const score = el('span', { class: 'score' }), wk = el('div');
      host.append(el('div', { class: 'bar2' },
        el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: check }),
        el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => show(wk) }),
        el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render }), score), wk);
      function check() {
        let ok = 0, tot = 0;
        $$('.rr', form).forEach(row => {
          const [inp, sel] = [$('input', row), $('select', row)], a = ans[inp.dataset.net];
          const h = inp.value.trim() !== '' && +inp.value === a.hop, i = a.ifs.includes(sel.value);
          inp.classList.toggle('ok', h); inp.classList.toggle('no', !h); sel.classList.toggle('ok', i); sel.classList.toggle('no', !i);
          ok += h + i; tot += 2;
        });
        score.textContent = `ถูก ${ok}/${tot} ช่อง`;
      }
    }
    function show(wk) {
      const { nets, me, ans, routers } = cur;
      const lines = [{ note: true, t: `หลักคิด: วงที่ต่อกับ ${me} ตรงๆ = 0 hop ส่วนวงอื่นนับ router ที่ต้องผ่านต่อจาก ${me} จนถึง router ที่ต่อกับวงนั้น เลือกทางที่ผ่านน้อยที่สุด ขาออกคือขาแรกของทางนั้น` }];
      [...nets].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })).forEach(n => {
        const a = ans[n.name];
        if (a.hop === 0) lines.push({ t: `${n.name}   ${a.ifs[0]}   0   (ต่อกับขา ${a.ifs[0]} ของ ${me} เอง)` });
        else {
          const via = a.path.slice(1);
          lines.push({ t: `${n.name}   ${a.ifs.join(' หรือ ')}   ${a.hop}   (${n.name} ต่ออยู่ที่ ${n.ends.join(' และ ')}: ${me} → ${via.join(' → ')} ผ่าน ${via.length} router${a.ifs.length > 1 ? ' มีสองทางเท่ากัน RIP เก็บทั้งสองทาง' : ''})` });
        }
      });
      const rounds = RT.ripSim(routers).length - 2;
      lines.push({ note: true, t: `ตารางนี้ได้มาจาก update ทุก 30 วินาที แต่ละรอบบวก 1 แล้วเก็บค่าน้อยกว่า เครือข่ายนี้ converge หลัง ${rounds} รอบ (ประมาณ ${rounds * 30} วินาที)` });
      Hop.work(wk, lines, { stagger: 90 });
    }
    render();
  })();
})();
