// Mock exam: 10 randomized questions in the formats the teacher said will appear.
(() => {
  const { $, $$, el, esc, icon, rnd: R, pick, shuffle } = Hop;
  Hop.page(9);
  const paper = $('#paper'), qnav = $('#qnav'), scoreEl = $('#score');
  let QS = [];

  /* ---------- shared bits ---------- */
  function Q(title, href, chap) {
    const n = QS.length + 1;
    const sec = el('section', { class: 'q', id: 'q' + n });
    sec.append(el('div', { class: 'qh', html: `<span class="qn">${n}</span><span class="qt">${title}</span><span class="qs"><a href="${href}">บท ${esc(chap)}</a></span>` }));
    const body = el('div'), acts = el('div', { class: 'acts' }), res = el('span', { class: 'res' }), work = el('div', { class: 'work' });
    sec.append(body, acts, work);
    paper.append(sec);
    const pill = el('a', { href: '#q' + n, text: n });
    qnav.append(pill);
    const q = { n, sec, body, acts, res, work, pill, score: null };
    q.button = (label, ic, fn, primary) => { const b = el('button', { class: 'btn small' + (primary ? ' primary' : ''), html: (ic ? icon(ic) + ' ' : '') + label, onclick: fn }); acts.append(b); return b; };
    q.result = (ok, total) => {
      q.score = { ok, total };
      res.className = 'res ' + (ok === total ? 'ok' : ok ? 'part' : 'no');
      res.textContent = `ถูก ${ok}/${total}`;
      pill.className = ok === total ? 'ok' : ok ? 'part' : 'no';
      updateScore();
    };
    q.reveal = (lines) => { Hop.work(work, lines, { stagger: 60 }); pill.classList.add('seen'); };
    QS.push(q);
    return q;
  }
  function finishActs(q, check, reveal) {
    if (check) q.button('ตรวจคำตอบ', 'check', check, true);
    q.button('ดูเฉลย', 'eye', reveal);
    q.acts.append(q.res);
  }
  function updateScore() {
    const done = QS.filter(q => q.score);
    const full = done.filter(q => q.score.ok === q.score.total).length;
    scoreEl.textContent = done.length ? `ถูกเต็มข้อ ${full}/${done.length} ข้อที่ตรวจแล้ว` : '';
  }
  function choices(opts, { multi = false } = {}) {
    const box = el('div', { class: 'choices' });
    opts.forEach(o => box.append(el('button', { class: 'chip', 'aria-pressed': 'false', 'data-v': o.v, html: o.l, onclick: e => {
      const b = e.currentTarget, on = b.getAttribute('aria-pressed') === 'true';
      if (!multi) $$('.chip', box).forEach(x => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', String(!on)); $$('.chip', box).forEach(x => x.classList.remove('ok', 'no', 'miss'));
    } })));
    box.val = () => $$('.chip[aria-pressed="true"]', box).map(b => b.dataset.v);
    box.mark = (accepted, primary = accepted) => $$('.chip', box).forEach(b => {
      const v = b.dataset.v, sel = b.getAttribute('aria-pressed') === 'true';
      b.classList.remove('ok', 'no', 'miss');
      if (sel) b.classList.add(accepted.includes(v) ? 'ok' : 'no'); else if (primary.includes(v)) b.classList.add('miss');
    });
    return box;
  }
  function order(items) {
    const wrap = el('div', { class: 'order' }), ans = el('div', { class: 'ans' }), pool = el('div', { class: 'pool' });
    const renum = () => { $$('.it', ans).forEach((b, i) => b.firstChild.textContent = i + 1); $$('.it', pool).forEach(b => b.firstChild.textContent = ''); };
    shuffle(items.map((t, i) => ({ t, i }))).forEach(o => {
      const b = el('button', { class: 'it', html: `<span class="k"></span><span>${o.t}</span>` }); b._i = o.i;
      b.onclick = () => { (b.parentNode === pool ? ans : pool).append(b); $$('.it', wrap).forEach(x => x.classList.remove('ok', 'no')); renum(); };
      pool.append(b);
    });
    wrap.append(ans, pool);
    wrap.check = () => { let ok = 0; $$('.it', ans).forEach((b, i) => { const g = b._i === i; b.classList.add(g ? 'ok' : 'no'); if (g) ok++; }); return ok; };
    return wrap;
  }
  const field = (lab, ph = '') => { const inp = el('input', { class: 'field', placeholder: ph, inputmode: 'decimal', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }); return { box: el('div', {}, el('label', { text: lab }), inp), inp }; };
  const mark = (inp, good) => { inp.classList.toggle('ok', good); inp.classList.toggle('no', !good); return good ? 1 : 0; };
  const norm = s => s.replace(/\s+/g, '').toLowerCase();

  /* ---------- 1. VLSM ---------- */
  function binLine(n, p1, p2, from) {
    const s = IP.bits(n), oct = IP.toStr(n).split('.'); let out = '';
    for (let o = 0; o < 4; o++) {
      if (o < from) { out += `${oct[o]}.`; continue; }
      for (let j = 0; j < 8; j++) { const i = o * 8 + j; if (i === p2) out += '|'; out += `<span style="color:var(--c-${i < p1 ? 'blue' : i < p2 ? 'amber' : 'green'})">${s[i]}</span>`; }
      if (o < 3) out += '.';
    }
    return out;
  }
  function qVLSM() {
    const q = Q('VLSM', 'vlsm.html', '1 VLSM');
    const ORGS = [
      ['บริษัทแห่งหนึ่ง', ['ฝ่ายผลิต', 'ฝ่ายขาย', 'ฝ่ายบัญชี', 'ฝ่ายบุคคล', 'ฝ่ายไอที', 'ฝ่ายการตลาด']],
      ['โรงพยาบาลแห่งหนึ่ง', ['ตึกผู้ป่วยใน', 'ห้องฉุกเฉิน', 'ฝ่ายเภสัช', 'ฝ่ายการเงิน', 'ห้องแล็บ', 'ฝ่ายเวชระเบียน']],
      ['มหาวิทยาลัยแห่งหนึ่ง', ['คณะวิทยาศาสตร์', 'คณะวิศวะ', 'หอสมุด', 'สำนักทะเบียน', 'อาคารเรียนรวม', 'ฝ่ายอาคาร']],
    ];
    let g;
    for (let t = 0; t < 300 && !g; t++) {
      const big = Math.random() < .55, [org, names] = pick(ORGS);
      let base, P;
      if (big) { P = pick([20, 21, 22]); const st = 2 ** (24 - P); base = `172.${R(16, 31)}.${st * R(0, Math.floor(255 / st))}.0`; }
      else { P = 24; base = `${pick(['192.168', '203.150', '200.10'])}.${R(1, 250)}.0`; }
      const pool = big ? [[300, 500], [150, 250], [70, 120], [30, 60]] : [[70, 120], [30, 60], [15, 28], [7, 14]];
      const demands = shuffle(names).slice(0, R(3, 4)).map(nm => ({ name: nm, hosts: R(...pick(pool)) }));
      demands.push({ name: 'ลิงก์ระหว่าง Router', hosts: 2 });
      const r = IP.vlsm(base, P, demands), cap = 2 ** (32 - P);
      if (r.order.every(x => x.fits) && r.used > cap * .4) g = { base, P, org, demands, r };
    }
    const { base, P, org, demands, r } = g;
    q.body.append(el('p', { class: 'prompt', html: `${org}ได้รับ IP <b>${base}/${P}</b> ต้องแบ่งให้หน่วยงานต่อไปนี้ด้วยวิธี VLSM จงหาชื่อวง (network address พร้อม prefix), IP แรกและ IP สุดท้ายที่ใช้ได้ และ broadcast ของแต่ละหน่วยงาน แสดงวิธีคิดเป็นเลขฐานสอง` }),
      el('div', { class: 'given' }, demands.map(d => el('div', { class: 'g', html: `${esc(d.name)} <b>${d.hosts}</b> เครื่อง` }))));
    const cards = el('div', { class: 'dcards' }), inputs = [];
    demands.forEach((d, i) => {
      const fs = [['Network/prefix', 'net', 'เช่น 10.0.0.0/26'], ['IP แรกที่ใช้ได้', 'first'], ['IP สุดท้ายที่ใช้ได้', 'last'], ['Broadcast', 'bcast']].map(([l, k, ph]) => { const f = field(l, ph); inputs.push({ inp: f.inp, i, k }); return f.box; });
      cards.append(el('div', { class: 'dcard', style: 'background:var(--surface)' }, el('div', { class: 'h', html: `<b>${esc(d.name)}</b><span>${d.hosts} เครื่อง</span>` }), el('div', { class: 'grid' }, fs)));
    });
    q.body.append(cards);
    finishActs(q, () => {
      let ok = 0;
      inputs.forEach(({ inp, i, k }) => {
        const o = r.order.find(x => x.i === i), v = inp.value.replace(/\s+/g, '');
        let good;
        if (k === 'net') { const [ip, pp] = v.split('/'); good = ip === IP.toStr(o.net) && (+pp === o.p || pp === IP.maskStr(o.p)); }
        else good = v === IP.toStr(k === 'first' ? o.first : k === 'last' ? o.last : o.bcast);
        ok += mark(inp, good);
      });
      q.result(ok, inputs.length);
    }, () => {
      const c = IP.cls(IP.toInt(base)), from = Math.floor(P / 8), L = [];
      L.push({ note: true, t: `${base}/${P}: octet แรก ${base.split('.')[0]} → class ${c.c} (default /${c.prefix})` + (P > c.prefix ? ` โจทย์ให้ /${P} → ยืมไปแล้ว ${P - c.prefix} บิต` : '') + ` เริ่มคิดเลขฐานสองที่ octet ที่ ${from + 1}` });
      L.push({ note: true, t: 'เรียงจากมากไปน้อย: ' + r.order.map(o => `${o.name} ${o.hosts}`).join(', ') });
      r.order.forEach(o => {
        L.push({ html: `<b>${esc(o.name)} ${o.hosts} เครื่อง</b>: 2^${o.h - 1} − 2 = ${2 ** (o.h - 1) - 2} ไม่พอ, 2^${o.h} − 2 = ${2 ** o.h - 2} ≥ ${o.hosts} → n = ${o.h} → prefix = 32 − ${o.h} = /${o.p}` });
        L.push({ html: `${binLine(o.net, P, o.p, from)}   → ${IP.toStr(o.net)}/${o.p}` });
        L.push({ t: `ใช้ได้ ${IP.toStr(o.first)} – ${IP.toStr(o.last)}   Broadcast ${IP.toStr(o.bcast)}   วงถัดไปเริ่ม ${IP.toStr(o.bcast + 1)}` });
      });
      q.reveal(L);
    });
  }

  /* ---------- 2. Which route is used (AD / metric) ---------- */
  function qAD() {
    const q = Q('ถ้ามีหลายเส้นทาง packet ใช้เส้นไหน', 'routing.html', '2 Routing');
    const SRC = [{ v: 'S', l: 'Static route', ad: 1 }, { v: 'D', l: 'EIGRP', ad: 90 }, { v: 'O', l: 'OSPF', ad: 110 }, { v: 'R', l: 'RIP', ad: 120 }];
    const net = `172.${R(16, 31)}.0.0/16`;
    const metricCase = Math.random() < .3;
    let prompt, opts, ans, why, decide;
    if (!metricCase) {
      const set = shuffle(SRC).slice(0, R(2, 3));
      const win = set.reduce((a, b) => a.ad < b.ad ? a : b);
      prompt = `Router R1 มีเส้นทางไป <b>${net}</b> จาก ${set.map(s => s.l).join(', ')} (prefix ยาวเท่ากันทุกเส้น) packet ที่จะไปวงนี้จะใช้เส้นทางจากแหล่งไหน และใช้ค่าอะไรตัดสิน`;
      opts = [...set.map(s => ({ v: s.v, l: s.l })), { v: 'LB', l: 'ใช้ทุกเส้นสลับกัน (load balance)' }];
      ans = win.v; decide = 'AD';
      why = [`ทุกเส้นไปวงเดียวกันด้วย prefix เท่ากัน จึงดูที่ AD (Administrative Distance) ก่อน ยิ่งน้อยยิ่งน่าเชื่อถือ`, set.map(s => `${s.l} AD = ${s.ad}`).join(', '), `${win.l} มี AD น้อยที่สุด (${win.ad}) จึงถูกใส่ใน routing table และ packet ใช้เส้นนี้` + (win.v === 'S' ? ' (static ถูกกำหนดตายตัวโดยผู้ดูแล จึงเชื่อถือสูงสุดรองจาก connected)' : '')];
    } else {
      const a = R(2, 4), b = a + R(1, 3);
      const ra = pick(['R2', 'R3']), rb = ra === 'R2' ? 'R3' : 'R2';
      prompt = `Router R1 รัน RIP อย่างเดียว ได้รับเส้นทางไป <b>${net}</b> มาสองทาง: ผ่าน ${ra} ระยะ ${a} hop และผ่าน ${rb} ระยะ ${b} hop packet จะไปทางไหน และใช้ค่าอะไรตัดสิน`;
      opts = [{ v: ra, l: 'ผ่าน ' + ra }, { v: rb, l: 'ผ่าน ' + rb }, { v: 'LB', l: 'ใช้ทั้งสองทางสลับกัน (load balance)' }];
      ans = ra; decide = 'metric';
      why = ['ทั้งสองเส้นมาจาก RIP เหมือนกัน AD เท่ากัน (120) จึงตัดสินด้วย metric ของ RIP คือ hop count', `ผ่าน ${ra} = ${a} hop น้อยกว่า ผ่าน ${rb} = ${b} hop → ใช้ทางผ่าน ${ra}`];
    }
    const c1 = choices(opts), c2 = choices([{ v: 'AD', l: 'AD (Administrative Distance)' }, { v: 'metric', l: 'Metric ของ protocol' }, { v: 'bw', l: 'Bandwidth ของ interface' }, { v: 'order', l: 'ลำดับที่ตั้งค่าก่อนหลัง' }]);
    q.body.append(el('p', { class: 'prompt', html: prompt }), el('div', { class: 'sub', text: 'ใช้เส้นทางจาก' }), c1, el('div', { class: 'sub', text: 'ค่าที่ใช้ตัดสิน' }), c2);
    finishActs(q, () => { c1.mark([ans]); c2.mark([decide]); q.result((c1.val()[0] === ans) + (c2.val()[0] === decide), 2); },
      () => q.reveal([...why.map(t => ({ t })), { note: true, t: 'ลำดับที่ router ใช้เลือก: prefix ยาวที่สุดก่อน (longest match) → ถ้าเท่ากันดู AD → ถ้ามาจาก protocol เดียวกันดู metric' }]));
  }

  /* ---------- 3. Decision flow ---------- */
  function qFlow() {
    const q = Q('Decision flow ของ router', 'routing.html', '2 Routing');
    const steps = ['รับสัญญาณที่ interface เข้ามาเป็น bits (Layer 1)', 'ประกอบ bits เป็น frame แล้วตรวจ frame (Layer 2)', 'แกะ frame ออก (de-encapsulate) อ่าน IP ปลายทางใน packet (Layer 3)', 'เอา IP ปลายทางไปเทียบกับ routing table หาเส้นที่ตรงที่สุด (longest prefix match)', 'ได้ next hop และ exit interface (ถ้าไม่ตรงเลย ใช้ default route หรือทิ้ง packet)', 'ห่อ packet ด้วย frame ใหม่ของขาออก แล้วส่งออกไปเป็น bits'];
    const o = order(steps);
    q.body.append(el('p', { class: 'prompt', text: 'packet เดินทางมาถึง router จงเรียงสิ่งที่ router ทำ ตั้งแต่รับเข้ามาจนส่งออกไป' }), o);
    finishActs(q, () => q.result(o.check(), steps.length), () => q.reveal(steps.map((t, i) => ({ t: `${i + 1}. ${t}` }))));
  }

  /* ---------- 4. Protocol type / metric / AD ---------- */
  function qMetric() {
    const q = Q('ประเภท, metric และ AD ของแต่ละ protocol', 'routing.html', '2 Routing');
    const KEY = { RIP: ['dv', 'hop', '120'], EIGRP: ['hy', 'bwd', '90'], OSPF: ['ls', 'cost', '110'] };
    const sel = (opts, ph) => el('select', { class: 'field', 'aria-label': ph }, el('option', { value: '', text: ph }), ...opts.map(([v, t]) => el('option', { value: v, text: t })));
    const T = [['dv', 'Distance vector'], ['ls', 'Link state'], ['hy', 'Hybrid (advanced DV)']], M = [['hop', 'Hop count'], ['bwd', 'Bandwidth + delay'], ['cost', 'Cost (อิง bandwidth)']], A = [['90', '90'], ['110', '110'], ['120', '120']];
    const rows = {};
    q.body.append(el('p', { class: 'prompt', text: 'ทั้งสามตัวเป็น IGP (interior) จงบอกประเภทการทำงาน, metric ที่ใช้คำนวณเส้นทาง และค่า AD ของแต่ละตัว' }));
    shuffle(Object.keys(KEY)).forEach(p => { const s = [sel(T, 'ประเภท'), sel(M, 'Metric'), sel(A, 'AD')]; rows[p] = s; q.body.append(el('div', { class: 'mrow' }, el('b', { text: p }), ...s)); });
    finishActs(q, () => { let ok = 0; Object.entries(rows).forEach(([p, s]) => s.forEach((x, i) => ok += mark(x, x.value === KEY[p][i]))); q.result(ok, 9); },
      () => q.reveal([{ t: 'RIP: distance vector, metric = hop count (สูงสุด 15, 16 = ไปไม่ถึง), AD 120' }, { t: 'EIGRP: hybrid (advanced distance vector ที่เก็บ topology table ด้วย), metric = bandwidth + delay (composite), AD 90' }, { t: 'OSPF: link state, metric = cost = reference bandwidth / bandwidth ของ interface, AD 110' }, { note: true, t: 'Static route AD 1, connected AD 0 ไม่มี metric ที่ต้องคำนวณ' }]));
  }

  /* ---------- 5. RIP hops ---------- */
  function qRIP() {
    const q = Q('RIP: นับ hop และเลือกทาง', 'rip.html', '3 RIP');
    const TPL = [
      { n: { R1: [50, 120], R2: [140, 40], R3: [250, 40], R4: [310, 140] }, l: [['R1', 'R4', '56 kbps'], ['R1', 'R2', '1 Gbps'], ['R2', 'R3', '1 Gbps'], ['R3', 'R4', '1 Gbps']], s: 'R1', d: 'R4' },
      { n: { R1: [45, 130], R2: [140, 130], R3: [230, 50], R4: [315, 130], R5: [230, 210] }, l: [['R1', 'R2', '100 Mbps'], ['R2', 'R3', '100 Mbps'], ['R3', 'R4', '100 Mbps'], ['R2', 'R5', '1 Gbps'], ['R5', 'R4', '1 Gbps']] },
      { n: { R1: [60, 60], R2: [180, 30], R3: [300, 80], R4: [250, 210], R5: [90, 190] }, l: [['R1', 'R2', '1 Gbps'], ['R2', 'R3', '1 Gbps'], ['R3', 'R4', '100 Mbps'], ['R4', 'R5', '1 Gbps'], ['R5', 'R1', '56 kbps']] },
    ];
    const T = pick(TPL), names = Object.keys(T.n);
    const adj = {}; names.forEach(k => adj[k] = []); T.l.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
    const bfs = s => { const d = { [s]: 0 }, qq = [s]; while (qq.length) { const u = qq.shift(); adj[u].forEach(v => { if (d[v] == null) { d[v] = d[u] + 1; qq.push(v); } }); } return d; };
    let s = T.s, d = T.d;
    if (!s) { do { s = pick(names); d = pick(names); } while (s === d || bfs(s)[d] < 2); }
    const idx = k => +k.slice(1), dist = bfs(d), hops = dist[s];
    const nh = adj[s].filter(v => dist[v] === hops - 1);
    const lan = `10.${idx(d)}.0.0/16`;
    const W = 360, H = 250;
    let svg = `<svg viewBox="0 0 ${W} ${H}">`;
    T.l.forEach(([a, b, sp]) => { const [x1, y1] = T.n[a], [x2, y2] = T.n[b]; svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--line-2)" stroke-width="3"/><text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--mono)">${sp}</text>`; });
    names.forEach(k => { const [x, y] = T.n[k]; svg += Hop.dev('router', x, y, { s: .75, c: k === s ? 'var(--accent)' : k === d ? 'var(--c-amber)' : 'var(--ink)', label: k, lc: k === s ? 'var(--accent)' : 'var(--ink)' }); });
    const [dx, dy] = T.n[d]; svg += `<text x="${dx}" y="${dy - 24}" text-anchor="middle" font-size="12.5" font-weight="600" fill="var(--c-amber)" font-family="var(--mono)">LAN ${lan.split('/')[0]}</text>`;
    svg += '</svg>';
    const f = field('จำนวน hop', 'เช่น 2'); f.inp.setAttribute('inputmode', 'numeric');
    const c = choices(adj[s].map(v => ({ v, l: 'ส่งไป ' + v })));
    q.body.append(el('p', { class: 'prompt', html: `ทุก router รัน RIP และ converge แล้ว ใน routing table ของ <b>${s}</b> วง <b>${lan}</b> (LAN ของ ${d}) มีค่า hop เท่าไร และ ${s} จะส่ง packet ไปวงนี้ผ่าน router ตัวไหน ตัวเลขบนลิงก์คือความเร็ว` }),
      el('div', { class: 'fig topo', html: svg }), el('div', { class: 'fgrid', style: 'margin-top:14px' }, f.box), el('div', { class: 'sub', text: 'next hop' }), c);
    finishActs(q, () => { c.mark(nh); q.result(mark(f.inp, +f.inp.value === hops) + (nh.includes(c.val()[0]) ? 1 : 0), 2); }, () => {
      const path = [s]; let u = s; while (u !== d) { u = adj[u].find(v => dist[v] === dist[u] - 1); path.push(u); }
      const L = [{ t: `${d} ต่อกับ ${lan} โดยตรง จึงมีวงนี้ใน table เป็น 0 hop` }];
      for (let i = path.length - 2; i >= 0; i--) L.push({ t: `${path[i + 1]} ส่ง routing table ทั้งหมดให้ ${path[i]} ทุก 30 วินาที → ${path[i]} บวก 1 ได้ ${dist[path[i]]} hop เก็บไว้ next hop = ${path[i + 1]}` });
      L.push({ html: `<b>ตอบ ${hops} hop ส่งผ่าน ${nh.join(' หรือ ')}</b> (เส้นทาง ${path.join(' → ')})` });
      const slow = T.l.find(([a, b, sp]) => sp === '56 kbps' && path.includes(a) && path.includes(b) && Math.abs(path.indexOf(a) - path.indexOf(b)) === 1);
      L.push({ note: true, t: 'RIP ใช้ hop count อย่างเดียว ไม่ดูความเร็วลิงก์' + (slow ? ' จึงยอมวิ่งผ่านลิงก์ 56 kbps เพราะ hop น้อยกว่า ถ้าเป็น OSPF หรือ EIGRP จะเลือกทางที่ลิงก์เร็วกว่า' : '') + ' ถ้าเกิน 15 hop (16) ถือว่าไปไม่ถึง' });
      q.reveal(L);
    });
  }

  /* ---------- 6. EIGRP ---------- */
  function qEIGRP() {
    const q = Q('EIGRP: successor, feasible successor, FD', 'eigrp.html', '4 EIGRP');
    let P;
    for (let t = 0; t < 500; t++) {
      const k = R(3, 5);
      P = Array.from({ length: k }, (_, i) => ({ r: 'R' + (i + 2), ip: `10.0.${i + 1}.2`, ifc: ['G0/0', 'G0/1', 'S0/0/0', 'S0/0/1', 'G0/2'][i], c: R(5, 40), rd: R(5, 45) }));
      P.forEach(p => p.fd = p.c + p.rd);
      const min = Math.min(...P.map(p => p.fd));
      if (P.filter(p => p.fd === min).length !== 1) continue;
      if (Math.random() < .4) { const o = P.find(p => p.fd !== min && p.rd < min); if (o) { const add = min - o.rd; o.rd = min; o.fd += add; } }
      const fs = P.filter(p => p.fd !== min && p.rd < min), non = P.filter(p => p.fd !== min && p.rd >= min);
      if (fs.length && non.length && Math.min(...P.filter(p => p.fd !== min).map(p => p.fd)) > min) break;
    }
    const min = Math.min(...P.map(p => p.fd)), succ = P.find(p => p.fd === min), FS = P.filter(p => p !== succ && p.rd < min);
    const W = 360, H = 84 * P.length + 30, mid = H / 2, nx = 185;
    let svg = `<svg viewBox="0 0 ${W} ${H}">`;
    P.forEach((p, i) => { const y = 52 + i * 84; p.y = y;
      svg += `<line x1="40" y1="${mid}" x2="${nx}" y2="${y}" stroke="var(--c-teal)" stroke-width="2.5" opacity=".7"/><line x1="${nx}" y1="${y}" x2="325" y2="${mid}" stroke="var(--c-amber)" stroke-width="2.5" opacity=".7"/>`;
      const lx = (40 + nx) / 2, ly = (mid + y) / 2, rx = (nx + 325) / 2;
      svg += `<rect x="${lx - 17}" y="${ly - 12}" width="34" height="22" rx="7" fill="var(--bg)" stroke="var(--c-teal)"/><text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--c-teal)" font-family="var(--mono)">${p.c}</text>`;
      svg += `<rect x="${rx - 17}" y="${ly - 12}" width="34" height="22" rx="7" fill="var(--bg)" stroke="var(--c-amber)"/><text x="${rx}" y="${ly + 4}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--c-amber)" font-family="var(--mono)">${p.rd}</text>`;
      svg += Hop.dev('router', nx, y, { s: .7 }) + `<text x="${nx}" y="${y - 21}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">${p.r}</text><text x="${nx}" y="${y + 31}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--mono)">${p.ip}</text>`;
    });
    svg += Hop.dev('router', 40, mid, { s: .75, c: 'var(--accent)' }) + `<text x="40" y="${mid + 34}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--accent)">R1</text>` + Hop.dev('cloud', 325, mid, { s: .8 }) + `<text x="325" y="${mid + 30}" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)">X</text></svg>`;
    q.body.append(el('p', { class: 'prompt', html: `R1 ต้องส่ง packet ไปวง X (172.30.0.0/16) ได้ ${P.length} ทาง ตัวเลข<span style="color:var(--c-teal);font-weight:600">สีฟ้า</span>คือ cost จาก R1 ถึงเพื่อนบ้าน ตัวเลข<span style="color:var(--c-amber);font-weight:600">สีส้ม</span>คือ RD ที่เพื่อนบ้านรายงานมา จงหา FD ของทุกทาง, successor, FD ของเส้นทางไป X และ feasible successor (ตอบเป็น router หรือ IP ของ next hop ก็ได้)` }), el('div', { class: 'fig topo', html: svg }));
    const fds = P.map(p => { const f = field('FD ผ่าน ' + p.r); f.inp.setAttribute('inputmode', 'numeric'); return f; });
    const cs = choices(P.map(p => ({ v: p.r, l: p.r }))), cf = choices([...P.map(p => ({ v: p.r, l: p.r })), { v: 'none', l: 'ไม่มี' }], { multi: true });
    const fFD = field('FD ของเส้นทางไป X'); fFD.inp.setAttribute('inputmode', 'numeric');
    q.body.append(el('div', { class: 'sub', text: 'FD ของแต่ละทาง' }), el('div', { class: 'fgrid' }, fds.map(f => f.box)), el('div', { class: 'sub', text: 'Successor' }), cs, el('div', { class: 'fgrid', style: 'margin-top:12px' }, fFD.box), el('div', { class: 'sub', text: 'Feasible successor (เลือกได้หลายตัว)' }), cf);
    finishActs(q, () => {
      let ok = 0; fds.forEach((f, i) => ok += mark(f.inp, +f.inp.value === P[i].fd));
      cs.mark([succ.r]); ok += cs.val()[0] === succ.r ? 1 : 0;
      ok += mark(fFD.inp, +fFD.inp.value === min);
      const fsKeys = FS.length ? FS.map(p => p.r) : ['none']; cf.mark(fsKeys);
      const v = cf.val(); ok += (v.length === fsKeys.length && v.every(x => fsKeys.includes(x))) ? 1 : 0;
      q.result(ok, P.length + 3);
    }, () => {
      const L = P.map(p => ({ t: `ผ่าน ${p.r}: FD = cost + RD = ${p.c} + ${p.rd} = ${p.fd}` }));
      L.push({ html: `<b>Successor = ${succ.r}</b> (FD น้อยสุด = ${min}) next hop ${succ.ip} ออก ${succ.ifc}` });
      L.push({ note: true, t: `เงื่อนไข feasible: RD ของทางสำรอง < FD ของ successor (${min})` });
      P.filter(p => p !== succ).forEach(p => L.push({ t: `${p.r}: RD ${p.rd} ${p.rd < min ? '<' : p.rd === min ? '= (เท่ากันไม่ผ่าน)' : '>'} ${min} → ${p.rd < min ? 'เป็น FS' : 'ไม่เป็น FS'}` }));
      L.push({ html: `<b>ตอบ</b> Successor ${succ.r} (${succ.ip}), FD = ${min}, Feasible successor: ${FS.length ? FS.map(p => `${p.r} (${p.ip})`).join(', ') : 'ไม่มี'}` });
      q.reveal(L);
    });
  }

  /* ---------- 7. OSPF ---------- */
  function qOSPF() {
    const q = Q('OSPF: ขั้นตอนการทำงานและความต่าง', 'ospf.html', '5 OSPF');
    const steps = ['ส่ง Hello packet หาเพื่อนบ้าน สร้าง neighbor table', 'แลกเปลี่ยน LSA (สถานะและ cost ของลิงก์ที่ต่อตรง)', 'สร้าง topology table หรือ link-state database (LSDB)', 'รัน SPF algorithm (Dijkstra) ได้ SPF tree', 'ใส่เส้นทางที่ดีที่สุดลงใน routing table'];
    const o = order(steps);
    q.body.append(el('p', { class: 'prompt', text: 'ก) เรียงขั้นตอนการทำงานของ OSPF ตั้งแต่เปิดเครื่องจนได้ routing table   ข) บอกข้อดีของ OSPF และความต่างจาก RIP อย่างน้อย 3 ข้อ (เขียนในกระดาษแล้วเปิดเฉลยเทียบ)' }), o);
    finishActs(q, () => q.result(o.check(), steps.length), () => q.reveal([
      ...steps.map((t, i) => ({ t: `${i + 1}. ${t}` })),
      { html: '<b>ข้อดีและความต่างจาก RIP</b>' },
      { t: 'OSPF เป็น link state: ทุก router มีแผนที่ (LSDB) ชุดเดียวกัน แล้วคำนวณเส้นทางเอง ส่วน RIP เป็น distance vector รู้แค่สิ่งที่เพื่อนบ้านบอก' },
      { t: 'metric ของ OSPF คือ cost ที่อิง bandwidth เลือกทางที่เร็วจริง ส่วน RIP นับแค่ hop' },
      { t: 'OSPF ส่ง LSA เฉพาะเมื่อมีการเปลี่ยนแปลง ไม่ได้ส่งทั้งตารางทุก 30 วินาทีแบบ RIP จึง converge เร็วกว่าและกินแบนด์วิดท์น้อยกว่า' },
      { t: 'OSPF ขยายได้ใหญ่ด้วยการแบ่ง area (area 0 เป็น backbone) และไม่จำกัด 15 hop แบบ RIP, รองรับ VLSM/CIDR และ authentication' },
      { note: true, t: 'ข้อเสียที่ควรรู้: ใช้ CPU และ memory มากกว่า และตั้งค่าซับซ้อนกว่า' },
    ]));
  }

  /* ---------- 8. ACL ---------- */
  function qACL() {
    const q = Q('เขียนคำสั่ง ACL', 'acl.html', '7 Firewall & ACL');
    const a = R(10, 60), s = a + R(1, 40), pc = R(11, 99), srv = R(2, 20);
    const A = `192.168.${a}`, S = `192.168.${s}`, PC = `${A}.${pc}`, SV = `${S}.${srv}`;
    const ip = x => x.replace(/\./g, '\\.');
    const hostRe = x => `(?:host ${ip(x)}|${ip(x)} 0\\.0\\.0\\.0)`;
    const ifRe = x => `int(?:erface)? *(?:g|gi|gig|gigabitethernet) *${x.replace('/', '\\/')}\\b`;
    const serRe = `int(?:erface)? *(?:s|se|serial) *0\\/0\\/0\\b`;
    const V = [
      { req: `ห้ามเครื่อง <b>${PC}</b> telnet ไปที่ server <b>${SV}</b> แต่ traffic อื่นทั้งหมดให้ผ่านได้`,
        model: [`access-list 101 deny tcp host ${PC} host ${SV} eq 23`, 'access-list 101 permit ip any any', 'interface g0/0', 'ip access-group 101 in'],
        why: 'ต้องแยก protocol (tcp) และ port (23) จึงต้องใช้ extended ACL (100–199) และ extended ให้วางใกล้ต้นทาง คือขา G0/0 ฝั่ง LAN A ทิศ in',
        keys: [['ใช้ extended ACL (เลข 100–199)', /access-list (1\d\d|2\d{3}) /], ['deny tcp จาก host PC ไป host server', new RegExp(`access-list (\\d+) deny tcp ${hostRe(PC)} ${hostRe(SV)} eq (23|telnet)`)], ['บรรทัด permit ท้ายสุดให้ traffic อื่นผ่าน', /access-list \d+ permit (ip )?any any/], ['เข้า interface G0/0 (ใกล้ต้นทาง)', new RegExp(ifRe('0/0'))], ['ip access-group … in', /ip access-group \d+ in\b/]] },
      { req: `ให้เฉพาะเครื่องในวง <b>${A}.0/24</b> เปิดเว็บ (HTTP) ที่ server <b>${SV}</b> ได้ นอกนั้นห้ามทุกอย่างเข้าวง server`,
        model: [`access-list 110 permit tcp ${A}.0 0.0.0.255 host ${SV} eq 80`, 'interface g0/1', 'ip access-group 110 out'],
        why: 'เลือกทั้งต้นทาง ปลายทาง และ port 80 จึงใช้ extended ไม่ต้องมี permit ท้าย เพราะ implicit deny จะบล็อกที่เหลือให้เอง วางที่ขา G0/1 ทิศ out เพื่อกรองทุกอย่างที่จะเข้าวง server',
        keys: [['ใช้ extended ACL (เลข 100–199)', /access-list (1\d\d|2\d{3}) /], ['permit tcp วง LAN A (wildcard 0.0.0.255) ไป host server eq 80', new RegExp(`access-list \\d+ permit tcp ${ip(A)}\\.0 0\\.0\\.0\\.255 ${hostRe(SV)} eq (80|www)`)], ['ไม่มี permit any ท้าย (ให้ implicit deny ทำงาน)', { not: /permit (ip )?any any/ }], ['เข้า interface G0/1 (ขาที่ไปวง server)', new RegExp(ifRe('0/1'))], ['ip access-group … out', /ip access-group \d+ out\b/]] },
      { req: `ห้ามเครื่องจาก Internet ping server <b>${SV}</b> แต่ traffic อื่นให้ผ่านได้`,
        model: [`access-list 120 deny icmp any host ${SV} echo`, 'access-list 120 permit ip any any', 'interface s0/0/0', 'ip access-group 120 in'],
        why: 'ping คือ ICMP echo ต้องระบุ protocol จึงใช้ extended วางใกล้ต้นทางที่สุดที่เราคุมได้ คือขา S0/0/0 ที่ต่อ Internet ทิศ in',
        keys: [['ใช้ extended ACL (เลข 100–199)', /access-list (1\d\d|2\d{3}) /], ['deny icmp any ไป host server', new RegExp(`access-list \\d+ deny icmp any ${hostRe(SV)}( echo)?`)], ['บรรทัด permit ท้ายสุด', /access-list \d+ permit (ip )?any any/], ['เข้า interface S0/0/0', new RegExp(serRe)], ['ip access-group … in', /ip access-group \d+ in\b/]] },
      { req: `ใช้ <b>standard ACL</b> ห้ามเครื่อง <b>${PC}</b> เข้าวง server (${S}.0/24) เครื่องอื่นเข้าได้ตามปกติ`,
        model: [`access-list 10 deny host ${PC}`, 'access-list 10 permit any', 'interface g0/1', 'ip access-group 10 out'],
        why: 'standard ACL ดูได้แค่ IP ต้นทาง ถ้าวางใกล้ต้นทาง PC จะไปที่ไหนไม่ได้เลย จึงต้องวางใกล้ปลายทาง คือขา G0/1 ทิศ out',
        keys: [['ใช้ standard ACL (เลข 1–99)', /access-list ([1-9]|[1-9]\d) /], ['deny host PC', new RegExp(`access-list \\d+ deny ${hostRe(PC)}`)], ['permit any ท้ายสุด', /access-list \d+ permit any/], ['เข้า interface G0/1 (ใกล้ปลายทาง)', new RegExp(ifRe('0/1'))], ['ip access-group … out', /ip access-group \d+ out\b/]] },
    ];
    const v = pick(V);
    const svg = `<svg viewBox="0 0 360 200">
      <line x1="60" y1="150" x2="180" y2="100" stroke="var(--line-2)" stroke-width="3"/><line x1="180" y1="100" x2="300" y2="150" stroke="var(--line-2)" stroke-width="3"/><line x1="180" y1="100" x2="180" y2="40" stroke="var(--line-2)" stroke-width="3" stroke-dasharray="5 5"/>
      ${Hop.dev('pc', 60, 150, { s: .8, label: 'PC', sub: PC })}${Hop.dev('router', 180, 100, { s: .75, c: 'var(--accent)' })}${Hop.dev('server', 300, 150, { s: .75, label: 'Server', sub: SV })}${Hop.dev('cloud', 180, 30, { s: .7 })}
      <text x="120" y="112" text-anchor="middle" font-size="12" fill="var(--c-teal)" font-family="var(--mono)">G0/0</text><text x="242" y="112" text-anchor="middle" font-size="12" fill="var(--c-teal)" font-family="var(--mono)">G0/1</text><text x="190" y="68" font-size="12" fill="var(--c-teal)" font-family="var(--mono)">S0/0/0</text><text x="150" y="104" text-anchor="end" font-size="13" font-weight="600" fill="var(--accent)">R1</text>
    </svg>`;
    q.body.append(el('p', { class: 'prompt', html: `Router R1: ขา G0/0 ต่อวง LAN A <b>${A}.0/24</b>, ขา G0/1 ต่อวง server <b>${S}.0/24</b>, ขา S0/0/0 ต่อ Internet<br>${v.req} จงเขียนคำสั่ง ACL ทั้งหมด รวมถึงการนำไปใช้ที่ interface` }), el('div', { class: 'fig topo', html: svg }));
    const ta = el('textarea', { class: 'field', placeholder: 'access-list ...\ninterface ...\nip access-group ...', spellcheck: 'false', autocapitalize: 'off' });
    const cl = el('div', { class: 'checklist' });
    q.body.append(ta, cl);
    finishActs(q, () => {
      const txt = ta.value.toLowerCase().replace(/^[\w-]+\(config[^)]*\)#\s*/gm, '').replace(/[ \t]+/g, ' ');
      let ok = 0; cl.innerHTML = '';
      v.keys.forEach(([lab, re]) => { const g = re.not ? !re.not.test(txt) : re.test(txt); if (g) ok++; cl.append(el('div', { html: `<span class="${g ? 'y' : 'n'}">${g ? '✓' : '✕'}</span><span>${lab}</span>` })); });
      q.result(ok, v.keys.length);
    }, () => q.reveal([...v.model.map(t => ({ t })), { note: true, t: v.why }, { note: true, t: 'ACL ตรวจจากบนลงล่าง เจอบรรทัดแรกที่ตรงก็หยุด และท้ายสุดมี deny any ที่มองไม่เห็นเสมอ (implicit deny)' }]));
  }

  /* ---------- 9. Attack picture ---------- */
  function qAttack() {
    const q = Q('ดูรูปแล้วบอกว่าเป็น attack แบบไหน', 'threats.html', '6 ภัยคุกคาม');
    const dot = (path, color, dur, begin = 0, r = 6) => `<circle r="${r}" fill="${color}"><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/></circle>`;
    const base = `${Hop.dev('user', 45, 160, { s: .8, label: 'Bob' })}${Hop.dev('user', 315, 160, { s: .8, label: 'Alice' })}${Hop.dev('cloud', 180, 160, { s: 1.4 })}`;
    const darth = `${Hop.dev('attacker', 180, 40, { s: .8, label: 'Darth', lc: 'var(--c-rose)' })}`;
    const A = {
      sniff: { svg: `<path d="M70 160H290" stroke="var(--line-2)" stroke-width="3" fill="none"/><path d="M180 150V70" stroke="var(--c-rose)" stroke-width="2.5" stroke-dasharray="5 5" fill="none"/>${base}${darth}${dot('M70 160H290', 'var(--accent)', 2.4)}${dot('M180 160V70', 'var(--c-rose)', 2.4, 1.2, 5)}`,
        name: 'sniff', pa: 'passive', cia: ['C'], ok: ['C'],
        model: ['Snooping / Sniffing (การดักฟัง eavesdropping) เป็นการโจมตีแบบ Passive', 'ข้อมูลจาก Bob ยังไปถึง Alice ครบเหมือนเดิม แต่ Darth แอบคัดลอกข้อมูลที่วิ่งผ่านเครือข่ายไปอ่าน', 'กระทบ Confidentiality เพราะคนที่ไม่ได้รับอนุญาตได้อ่านข้อมูล ส่วนข้อมูลไม่ถูกแก้ (I ไม่เสีย) และยังใช้งานได้ปกติ (A ไม่เสีย)', 'ป้องกันด้วยการเข้ารหัส เช่น HTTPS/SSL-TLS, SSH, IPSec, VPN'] },
      mod: { svg: `<path d="M70 160H170Q180 160 180 80" stroke="var(--line-2)" stroke-width="3" fill="none"/><path d="M190 80Q190 160 200 160H290" stroke="var(--c-rose)" stroke-width="3" fill="none"/>${base}${darth}${dot('M70 160H170Q180 160 180 80', 'var(--accent)', 1.6)}${dot('M190 80Q190 160 200 160H290', 'var(--c-rose)', 1.6, .8)}`,
        name: 'mod', pa: 'active', cia: ['I'], ok: ['I', 'C'],
        model: ['Modification / Man-in-the-Middle เป็นการโจมตีแบบ Active', 'ข้อมูลจาก Bob ไม่ได้ไปถึง Alice ตรงๆ แต่ไปหยุดที่ Darth ก่อน Darth อ่านและแก้ไขข้อมูล แล้วส่งต่อให้ Alice ซึ่งเข้าใจว่ามาจาก Bob', 'กระทบ Integrity เพราะข้อมูลที่ Alice ได้รับไม่ตรงกับที่ Bob ส่ง (และกระทบ Confidentiality ด้วยเพราะ Darth อ่านได้)', 'ป้องกันด้วย hashing / digital signature และ TLS หรือ IPSec ที่มีการยืนยันตัวตน'] },
      spoof: { svg: `<path d="M180 70Q180 160 200 160H290" stroke="var(--c-rose)" stroke-width="3" fill="none"/>${base}${darth}<text x="250" y="140" text-anchor="middle" font-size="12" fill="var(--c-rose)">อ้างว่าเป็น Bob</text>${dot('M180 70Q180 160 200 160H290', 'var(--c-rose)', 2)}${dot('M290 165H200Q186 165 186 70', 'var(--c-amber)', 2, 1, 5)}`,
        name: 'spoof', pa: 'active', cia: ['C'], ok: ['C', 'I'],
        model: ['Spoofing (การปลอมตัว) เป็นการโจมตีแบบ Active', 'Darth ปลอมตัวเป็นอีกฝ่าย (เช่นทำหน้าเว็บธนาคารปลอม) หลอกให้ Alice เชื่อว่าคุยกับของจริง แล้วกรอก username/PIN ส่งกลับไปให้ Darth', 'กระทบ Confidentiality เพราะรหัสผ่านและข้อมูลส่วนตัวรั่วไปถึงผู้โจมตี และความถูกต้องของตัวตน (authenticity) เสีย', 'ป้องกันด้วยการตรวจ URL และใบรับรอง (HTTPS + CA) และการยืนยันตัวตน'] },
      dos: { svg: `${Hop.dev('attacker', 40, 110, { s: .8, label: 'Hacker', lc: 'var(--c-rose)' })}${[30, 80, 140, 190].map((y, i) => `<path d="M60 110L135 ${y}" stroke="var(--c-rose)" stroke-width="2" stroke-dasharray="5 5" fill="none"/><path d="M165 ${y}L295 110" stroke="var(--c-rose)" stroke-width="2.5" fill="none"/>${Hop.dev('pc', 150, y, { s: .7 })}${dot(`M165 ${y}L295 110`, 'var(--c-rose)', .9, i * .2, 5)}${dot(`M165 ${y}L295 110`, 'var(--c-rose)', .9, i * .2 + .45, 5)}`).join('')}${Hop.dev('server', 315, 110, { s: .85, label: 'Server' })}`,
        name: 'dos', pa: 'active', cia: ['A'], ok: ['A'],
        model: ['DoS / DDoS (Distributed Denial of Service) เป็นการโจมตีแบบ Active', 'Hacker สั่งเครื่องจำนวนมากส่งคำขอไปที่ Server พร้อมกัน จน Server ใช้ทรัพยากรเต็ม ผู้ใช้จริงเข้าใช้บริการไม่ได้', 'กระทบ Availability เพราะบริการใช้งานไม่ได้ ข้อมูลไม่ได้ถูกอ่านหรือแก้ (C และ I ไม่เสีย)', 'ป้องกันด้วย firewall/ACL บล็อกต้นทาง, จำกัดอัตรา (rate limit), stateful firewall และระบบสำรอง'] },
    };
    const k = pick(Object.keys(A)), a = A[k];
    const c1 = choices([{ v: 'sniff', l: 'Sniffing / Snooping' }, { v: 'mod', l: 'Modification (MITM)' }, { v: 'spoof', l: 'Spoofing' }, { v: 'dos', l: 'DoS / DDoS' }]);
    const c2 = choices([{ v: 'passive', l: 'Passive' }, { v: 'active', l: 'Active' }]);
    const c3 = choices([{ v: 'C', l: 'Confidentiality' }, { v: 'I', l: 'Integrity' }, { v: 'A', l: 'Availability' }], { multi: true });
    q.body.append(el('p', { class: 'prompt', text: 'จากรูป เป็นการโจมตีแบบใด เป็น passive หรือ active และกระทบ CIA ข้อไหน จากนั้นบรรยายภาพเป็นประโยคในกระดาษ' }),
      el('div', { class: 'fig topo', html: `<svg viewBox="0 0 360 230">${a.svg}</svg>` }), el('div', { class: 'sub', text: 'ชื่อการโจมตี' }), c1, el('div', { class: 'sub', text: 'ประเภท' }), c2, el('div', { class: 'sub', text: 'CIA ที่เสีย' }), c3);
    finishActs(q, () => {
      c1.mark([a.name]); c2.mark([a.pa]); c3.mark(a.ok, a.cia);
      const v = c3.val(), ciaOK = a.cia.every(x => v.includes(x)) && v.every(x => a.ok.includes(x));
      q.result((c1.val()[0] === a.name) + (c2.val()[0] === a.pa) + (ciaOK ? 1 : 0), 3);
    }, () => q.reveal(a.model.map(t => ({ t }))));
  }

  /* ---------- 10. Firewall + security protocol ---------- */
  function qSec() {
    const q = Q('Firewall และ security protocol', 'protocols.html', '8 Protocols');
    const FW = [
      ['ต้องการกรอง packet ด้วย IP ต้นทาง ปลายทาง และ port บน router ให้ทำงานเร็วและราคาถูก', 'pf'],
      ['ต้องการให้ packet จากข้างนอกเข้ามาได้เฉพาะที่เป็นการตอบกลับการเชื่อมต่อที่เครื่องข้างในเปิดไว้ก่อน', 'st'],
      ['ต้องการตรวจเนื้อหาใน HTTP เช่น บล็อกไฟล์มัลแวร์ที่แนบมากับหน้าเว็บ', 'ap'],
    ];
    const [sc, ans] = pick(FW);
    const c = choices([{ v: 'pf', l: 'Packet filtering' }, { v: 'st', l: 'Stateful inspection' }, { v: 'ap', l: 'Application proxy' }, { v: 'pe', l: 'Personal firewall' }]);
    const PR = {
      'HTTPS': ['Layer 7/6 (Application/Presentation)', 'HTTP + SSL/TLS เข้ารหัสข้อมูลเว็บ ใช้ port 443', 'ข้อดี: ผู้ใช้ไม่ต้องทำอะไรเพิ่ม ใบรับรอง (certificate) ช่วยยืนยันว่าเป็น server จริง ข้อมูลเป็นความลับและไม่ถูกแก้ระหว่างทาง', 'ข้อเสีย: ใช้ได้กับเว็บเท่านั้น ต้องมีใบรับรองจาก CA กันการโจมตีแบบ DoS หรือ phishing ที่หลอกให้เข้าเว็บปลอมไม่ได้'],
      'SSL/TLS': ['Layer 5/4 (Session/Transport)', 'ให้ authentication, confidentiality และ integrity กับแอปที่ใช้ TCP', 'ข้อดี: แอปที่ใช้ TCP ใช้ได้ทุกตัว หลัง handshake ใช้กุญแจแบบ symmetric จึงเร็ว', 'ข้อเสีย: ใช้กับ TCP เท่านั้น header ของ IP ยังมองเห็น มีภาระจาก handshake และการจัดการใบรับรอง'],
      'IPSec': ['Layer 3 (Network)', 'เข้ารหัสและยืนยันตัวตนระดับ IP packet มีโหมด transport และ tunnel', 'ข้อดี: ปกป้องข้อมูลทุกอย่างจากชั้นบนโดยแอปไม่ต้องรองรับเอง โหมด tunnel ซ่อนได้ทั้ง packet', 'ข้อเสีย: โหมด transport ยังเห็น IP header (ทำ traffic analysis ได้) ต้องตั้งค่าทั้งสองฝั่ง และมี overhead'],
      'VPN': ['Layer 3 (IPSec) หรือ Layer 2 (PPTP, L2F, L2TP)', 'สร้างอุโมงค์เข้ารหัสผ่าน Internet แบบ remote-access หรือ site-to-site', 'ข้อดี: ปลอดภัยและถูกกว่าเช่าสายส่วนตัว ทำให้สาขาหรือคนทำงานนอกสถานที่ใช้เครือข่ายเดียวกันได้', 'ข้อเสีย: มี overhead และต้องตั้งค่า ความเร็วขึ้นกับ Internet โปรโตคอล layer 2 บางตัวเข้ารหัสอ่อนหรือไม่เข้ารหัสเอง'],
    };
    const pk = pick(Object.keys(PR)), p = PR[pk];
    q.body.append(el('p', { class: 'prompt', html: `ก) ${sc} ควรเลือก firewall ประเภทใด` }), c,
      el('p', { class: 'prompt', html: `ข) <b>${pk}</b> ทำงานที่ชั้นใดของ OSI และมีข้อดีข้อเสียอย่างไร (เขียนในกระดาษแล้วเปิดเฉลยเทียบ)` }));
    const WHY = { pf: 'Packet filtering ดูแค่ header (IP, port) บน router จึงเร็วและถูก แต่ไม่จำการเชื่อมต่อ และถูกปลอม IP ได้', st: 'Stateful inspection จำสถานะการเชื่อมต่อใน state table จึงรู้ว่า packet ไหนเป็นการตอบกลับที่ข้างในขอไว้', ap: 'Application proxy ทำงานถึง Layer 7 เปิดดูเนื้อหาของ application ได้ จึงเห็นไฟล์อันตรายใน HTTP แต่ช้ากว่าแบบอื่น' };
    finishActs(q, () => { c.mark([ans]); q.result(c.val()[0] === ans ? 1 : 0, 1); }, () => q.reveal([{ html: `<b>ก)</b> ${WHY[ans]}` }, { html: `<b>ข) ${pk}</b> ทำงานที่ ${p[0]}` }, { t: p[1] }, { t: p[2] }, { t: p[3] }]));
  }

  function build() {
    QS = []; paper.innerHTML = ''; qnav.innerHTML = '';
    [qVLSM, qAD, qFlow, qMetric, qRIP, qEIGRP, qOSPF, qACL, qAttack, qSec].forEach(f => f());
    updateScore();
  }
  $('#regen').innerHTML = icon('shuffle') + ' สุ่มชุดใหม่';
  $('#regen').onclick = () => { build(); scrollTo({ top: 0, behavior: 'smooth' }); };
  build();
})();
