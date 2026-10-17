// Chapter 6: threats + CIA. Scenes redraw the slide pictures (Bob / Alice / Darth, DDoS fan, malware LAN) and are driven by Hop.scrub.
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, icon } = Hop;
  Hop.page(6);
  const COL = { C: 'var(--c-blue)', I: 'var(--c-amber)', A: 'var(--c-violet)' };
  const CK = { C: 'conf', I: 'integ', A: 'avail' };
  const CNAME = { C: 'Confidentiality', I: 'Integrity', A: 'Availability' };
  const { svgRoot, add, cloud, track, at, route, pill, lbl, ramp, mount, star, gaugeSet } = SecKit;

  /* ---------- Bob / Alice / Darth scene (slides p.10–12) ---------- */
  function geoBAD(mob) {
    return mob ? { W: 360, H: 300, bob: [40, 222], ali: [320, 222], dar: [180, 52], cl: [180, 226, 150, 60] }
      : { W: 760, H: 300, bob: [90, 222], ali: [670, 222], dar: [380, 52], cl: [380, 226, 230, 74] };
  }
  function badScene(stage, mob, { arrows = [], right = 'alice', dimBob = false, dimDarth = false, flood = false } = {}) {
    const g = geoBAD(mob), [bx, by] = g.bob, [ax, ay] = g.ali, [dx, dy] = g.dar, [cx, cy, cw, ch] = g.cl;
    const svg = svgRoot(g.W, g.H);
    const bR = bx + 27, aL = ax - 27, dB = dy + 31, span = cx - bR;
    const D = {
      main: `M${bR} ${by} L${aL} ${ay}`,
      branch: `M${cx} ${by} L${cx} ${dB}`,
      toD: `M${bR} ${by} C${cx - span * .3} ${by}, ${cx - 14} ${by - 14}, ${cx - 12} ${dB}`,
      fromD: `M${cx + 12} ${dB} C${cx + 14} ${by - 14}, ${cx + span * .3} ${ay}, ${aL} ${ay}`,
      flood: `M${dx + 24} ${dy + 6} C${ax - 60} ${dy}, ${ax - 6} ${ay - 90}, ${ax - 4} ${ay - 30}`,
    };
    let h = cloud(cx, cy, cw, ch, 'Internet');
    arrows.forEach(k => h += `<path d="${D[k]}" fill="none" stroke="var(--ink)" stroke-width="2.4" marker-end="${svg.mk('ink')}"/>`);
    if (flood) h += `<path d="${D.flood}" fill="none" stroke="var(--c-rose)" stroke-width="2" stroke-dasharray="5 6" opacity=".55"/>`;
    h += `<g${dimBob ? ' class="dim"' : ''}>${Hop.dev('pc', bx, by, { label: 'Bob' })}</g>`;
    h += right === 'alice' ? Hop.dev('pc', ax, ay, { label: 'Alice' }) : Hop.dev('server', ax, ay, { label: 'ธนาคาร' });
    if (right !== 'alice') h += `<g class="gauge"><rect x="${ax + 24}" y="${ay - 20}" width="8" height="40" rx="3" fill="var(--surface-2)"/><rect class="gf" x="${ax + 24}" y="${ay + 20}" width="8" height="0" rx="3" fill="var(--c-violet)"/></g>`;
    h += `<g${dimDarth ? ' class="dim darth"' : ' class="darth"'}>${Hop.dev('attacker', dx, dy)}${lbl(dx + 30, dy + 5, 'Darth', { c: 'var(--c-rose)', anchor: 'start' })}</g>`;
    add(svg, h);
    stage.replaceChildren(svg);
    const P = {}; for (const k in D) P[k] = track(svg, D[k]);
    return { svg, P, g, mob, gauge: $('.gf', svg), darth: $('.darth', svg) };
  }

  /* ---------- DDoS scene (slide p.13) ---------- */
  function ddosScene(stage, mob) {
    const g = mob ? { W: 360, H: 372, hk: [34, 170], zx: 150, zy: [40, 105, 170, 235, 300], sv: [292, 140], us: [292, 312] }
      : { W: 760, H: 330, hk: [70, 160], zx: 330, zy: [40, 100, 160, 220, 280], sv: [610, 150], us: [700, 284] };
    const svg = svgRoot(g.W, g.H), [hx, hy] = g.hk, [sx, sy] = g.sv, [ux, uy] = g.us;
    let h = '';
    const cmd = [], fl = [];
    g.zy.forEach((zy, i) => {
      const c1 = `M${hx + 24} ${hy} L${g.zx - 24} ${zy}`, c2 = `M${g.zx + 24} ${zy} L${sx - 22} ${sy + (zy - sy) * .12}`;
      cmd.push(c1); fl.push(c2);
      h += `<path d="${c1}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 6" marker-end="${svg.mk('ink')}"/>`;
      h += `<path d="${c2}" fill="none" stroke="var(--c-rose)" stroke-width="2" stroke-dasharray="6 6" marker-end="${svg.mk('rose')}"/>`;
      if (!mob) { const a = Math.atan2(sy - zy, sx - g.zx) * 180 / Math.PI; h += `<text transform="translate(${g.zx + 40} ${zy + (sy - zy) * .06 - 7}) rotate(${a.toFixed(1)})" font-size="12" class="mono" style="fill:var(--c-rose)">200.30.30.${i + 1}</text>`; }
    });
    const uD = mob ? `M${ux} ${uy - 26} L${sx} ${sy + 52}` : `M${ux - 14} ${uy - 26} L${sx + 22} ${sy + 30}`;
    h += `<path d="${uD}" fill="none" stroke="var(--muted)" stroke-width="2" marker-end="${svg.mk('muted')}"/>`;
    h += `<polygon class="burst" points="${star(sx, sy, 44, 26, 9)}" fill="var(--c-rose-s)" stroke="var(--c-rose)" stroke-width="2" opacity="0"/>`;
    h += Hop.dev('attacker', hx, hy, { label: 'Hacker', lc: 'var(--c-rose)' });
    g.zy.forEach(zy => h += `<g class="z"><g class="z0">${Hop.dev('pc', g.zx, zy, { s: .82 })}</g><g class="z1" opacity="0">${Hop.dev('pc', g.zx, zy, { s: .82, c: 'var(--c-rose)' })}</g></g>`);
    h += Hop.dev('server', sx, sy, { label: 'Server' });
    h += `<rect x="${sx + 24}" y="${sy - 20}" width="8" height="40" rx="3" fill="var(--surface-2)"/><rect class="gf" x="${sx + 24}" y="${sy + 20}" width="8" height="0" rx="3" fill="var(--c-violet)"/>`;
    h += Hop.dev('user', ux, uy, { label: 'ผู้ใช้จริง' });
    add(svg, h); stage.replaceChildren(svg);
    const S = { svg, g, mob, cmd: cmd.map(d => track(svg, d)), fl: fl.map(d => track(svg, d)), up: track(svg, uD), z: $$('.z1', svg), burst: $('.burst', svg), gauge: $('.gf', svg) };
    S.cp = g.zy.map(() => pill(svg, { fs: 12, h: 22 }).text('คำสั่ง'));
    S.dots = Array.from({ length: 20 }, () => { const c = el('circle', { r: 4.5, fill: 'var(--c-rose)', opacity: 0 }); svg.append(c); return c; });
    S.req = pill(svg, { c: 'var(--muted)' }).text('request');
    return S;
  }

  /* ---------- the four slide pictures ---------- */
  const ATK = {
    sniff: {
      name: 'Snooping / Sniffing', pa: 'Passive', req: ['C'], opt: [],
      stops: ['Bob ส่งรหัส PIN ออกไป', 'ข้อมูลวิ่งเข้าเครือข่าย', 'มีสำเนาแยกขึ้นไปที่ Darth', 'Alice ได้ข้อมูลครบ Darth ก็อ่านได้'],
      build: (st, mob) => { const S = badScene(st, mob, { arrows: ['main', 'branch'] }); S.p = pill(S.svg).text('PIN 1234'); S.c = pill(S.svg, { c: 'var(--c-rose)' }).text('PIN 1234'); S.bD = pill(S.svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' }).text('อ่านได้: PIN 1234'); S.bA = pill(S.svg, { bg: 'var(--surface)' }).text('ได้รับ: PIN 1234'); return S; },
      frame(S, t) {
        const fm = t < 1 ? t * .5 : t < 2 ? .5 + (t - 1) * .25 : .75 + Math.min(1, t - 2) * .25;
        S.p.at(...at(S.P.main, fm));
        if (t <= 1) S.c.hide(); else S.c.at(...at(S.P.branch, t - 1));
        const [dx, dy] = S.g.dar, [ax, ay] = S.g.ali;
        S.bD.at(dx - 34, dy, ramp(t, 2, 2.3)); S.bA.at(ax, ay - 64, ramp(t, 2.7, 3));
      },
      read: 'ลูกศรจาก Bob ผ่านเครือข่ายไปจบที่ Alice ตามปกติ และมีลูกศรเส้นที่สองแยกจากกลางทางขึ้นไปจบที่ Darth แปลว่า Darth ได้สำเนาข้อมูลไปอ่าน ส่วนของเดิมยังถึง Alice ครบ',
      ans: 'เป็นการโจมตีแบบ Snooping / Sniffing (การดักฟัง, Eavesdropping) ซึ่งเป็นแบบ Passive คือ Darth แอบดักอ่านข้อมูลที่ Bob ส่งให้ Alice ระหว่างทางโดยไม่ได้แก้ไขข้อมูล ทำให้ Confidentiality เสีย เพราะผู้ที่ไม่ได้รับอนุญาตได้เห็นข้อมูล ส่วน Integrity และ Availability ไม่เสีย เพราะ Alice ยังได้รับข้อมูลครบและถูกต้อง',
      def: 'เข้ารหัสข้อมูลก่อนส่ง เช่น HTTPS (SSL/TLS), IPSec, VPN แม้ Darth จะดักได้ก็อ่านไม่ออก',
    },
    modify: {
      name: 'Modification (Man-in-the-Middle)', pa: 'Active', req: ['I'], opt: ['C'],
      stops: ['Bob ส่งคำสั่ง "โอน 500"', 'ลูกศรของ Bob ไปจบที่ Darth', 'Darth อ่านแล้วแก้เป็น "โอน 50000"', 'Darth ส่งต่อไปให้ Alice', 'Alice เชื่อว่ามาจาก Bob'],
      build: (st, mob) => { const S = badScene(st, mob, { arrows: ['toD', 'fromD'] }); S.p = pill(S.svg).text('โอน 500'); S.bD = pill(S.svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' }).text('อ่าน แล้วแก้'); S.bA = pill(S.svg, { bg: 'var(--surface)', c: 'var(--c-amber)' }).text('จาก Bob: โอน 50000'); return S; },
      frame(S, t) {
        const ch = t > 1.55;
        S.p.text(ch ? 'โอน 50000' : 'โอน 500', ch ? 'var(--c-amber)' : 'var(--ink)');
        if (t <= 1) S.p.at(...at(S.P.toD, t)); else if (t <= 2) S.p.at(...at(S.P.toD, 1)); else S.p.at(...at(S.P.fromD, t - 2));
        const [dx, dy] = S.g.dar, [ax, ay] = S.g.ali;
        S.bD.at(dx - 34, dy, ramp(t, 1, 1.25) * (1 - ramp(t, 2.4, 2.7)));
        S.bA.at(ax, ay - 64, ramp(t, 3.3, 3.7));
      },
      read: 'ลูกศรของ Bob ไม่ไปถึง Alice แต่ไปจบที่ Darth แล้วมีลูกศรเส้นใหม่เริ่มจาก Darth ไปหา Alice แปลว่าข้อมูลทุกชิ้นต้องผ่านมือ Darth ก่อน',
      ans: 'เป็นการโจมตีแบบ Modification หรือ Man-in-the-Middle ซึ่งเป็นแบบ Active คือ Darth แทรกตัวอยู่ระหว่าง Bob กับ Alice ดักข้อมูลไว้ อ่านและแก้ไขแล้วจึงส่งต่อให้ Alice ซึ่งเข้าใจว่าได้มาจาก Bob ทำให้ Integrity เสีย เพราะข้อมูลที่ Alice ได้ไม่ตรงกับที่ Bob ส่ง และ Confidentiality เสียด้วย เพราะ Darth อ่านข้อมูลได้',
      def: 'ใช้ hash หรือ digital signature ตรวจว่าข้อมูลถูกแก้หรือไม่ และใช้ SSL/TLS หรือ IPSec ที่พิสูจน์ตัวตนด้วย certificate',
    },
    spoof: {
      name: 'Spoofing (ปลอมตัว / เว็บปลอม)', pa: 'Active', req: ['C'], opt: ['I'],
      stops: ['Darth ทำหน้าเว็บธนาคารปลอม', 'ส่งหน้าเว็บปลอมไปให้ Alice', 'Alice เห็นว่าเหมือนของจริง จึงกรอก PIN', 'PIN ถูกส่งไปถึง Darth'],
      build: (st, mob) => { const S = badScene(st, mob, { arrows: ['fromD'], dimBob: true }); S.p = pill(S.svg, { c: 'var(--c-rose)' }).text('หน้า Login ธนาคาร'); S.bD = pill(S.svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' }).text('ปลอมเป็นธนาคาร'); S.bA = pill(S.svg, { bg: 'var(--surface)', c: 'var(--c-rose)' }).text('URL ไม่ถูกต้อง'); return S; },
      frame(S, t) {
        const back = t > 1.8;
        S.p.text(back ? 'PIN 1234' : 'หน้า Login ธนาคาร', back ? 'var(--ink)' : 'var(--c-rose)');
        if (t <= 1) S.p.at(...at(S.P.fromD, 0), ramp(t, 0, .3)); else if (t <= 2) S.p.at(...at(S.P.fromD, Math.min(1, (t - 1) / .75))); else S.p.at(...at(S.P.fromD, 1 - (t - 2)));
        const [dx, dy] = S.g.dar, [ax, ay] = S.g.ali;
        S.bD.at(dx - 34, dy, ramp(t, .1, .5));
        S.bA.at(ax, ay - 64, ramp(t, 1.7, 2) * (1 - ramp(t, 2.6, 2.9) * .0));
      },
      read: 'มีลูกศรเส้นเดียวจาก Darth ผ่านเครือข่ายไปหา Alice ส่วน Bob ไม่มีลูกศรเลย แปลว่า Darth ติดต่อ Alice เองโดยแอบอ้างเป็นคนอื่น ในสไลด์มีรูปหน้าเว็บ K-Cyber Banking ปลอมที่จุดสังเกตคือ URL ไม่ถูกต้อง',
      ans: 'เป็นการโจมตีแบบ Spoofing ซึ่งเป็นแบบ Active คือ Darth ปลอมตัวเป็นปลายทางที่ Alice ตั้งใจติดต่อ เช่น สร้างหน้าเว็บธนาคารปลอม Alice เชื่อว่าเป็นของจริงจึงกรอกรหัส PIN ข้อมูลจึงตกไปอยู่กับ Darth ทำให้ Confidentiality เสีย และตัวตนที่ Alice เห็นก็เป็นของปลอม (ความถูกต้องของแหล่งที่มาเสีย)',
      def: 'ตรวจ URL และ certificate ของ HTTPS ที่ออกโดย CA ที่เชื่อถือได้ และใช้การพิสูจน์ตัวตน (Authentication)',
    },
    ddos: {
      name: 'DDoS (Distributed Denial of Service)', pa: 'Active', req: ['A'], opt: [],
      stops: ['Hacker ส่งคำสั่งแบบ broadcast', 'เครื่อง 5 เครื่องที่ถูกยึดได้รับคำสั่ง', 'ทุกเครื่องยิง request ใส่ Server พร้อมกัน', 'Server ใช้ resource จนเต็ม', 'ผู้ใช้จริงขอใช้บริการ แต่ไม่ได้รับคำตอบ'],
      build: (st, mob) => ddosScene(st, mob),
      frame(S, t) {
        S.cp.forEach((p, i) => t < 1.05 ? p.at(...at(S.cmd[i], t), ramp(t, 0, .15) * (1 - ramp(t, .9, 1.05))) : p.hide());
        S.z.forEach(z => z.setAttribute('opacity', ramp(t, .85, 1.1)));
        const on = ramp(t, 1.15, 1.5) * (1 - ramp(t, 3.9, 4) * 0);
        S.dots.forEach((d, k) => { const i = k % 5, ph = ((t * 1.3 + Math.floor(k / 5) / 4 + i * .17) % 1); const [x, y] = at(S.fl[i], ph); d.setAttribute('cx', x); d.setAttribute('cy', y); d.setAttribute('opacity', t < 1.15 ? 0 : on * (ph < .92 ? 1 : 0) * (k < 5 + ramp(t, 1.5, 2.6) * 15 ? 1 : 0)); });
        const f = ramp(t, 1.8, 3);
        gaugeSet(S.gauge, f); S.burst.setAttribute('opacity', ramp(t, 2.7, 3));
        if (t < 3) S.req.hide(); else { const fail = t > 3.55; S.req.text(fail ? 'ไม่ได้รับบริการ' : 'request', fail ? 'var(--c-violet)' : 'var(--muted)').at(...at(S.up, Math.min(.72, (t - 3) / .5 * .72))); }
      },
      read: 'Hacker ส่งคำสั่งไปที่เครื่องหลายเครื่อง แล้วทุกเครื่องส่งลูกศรไปรวมกันที่ Server เครื่องเดียว Server แตก (ใต้รูปเขียนว่า Distributed Denial of Service)',
      ans: 'เป็นการโจมตีแบบ DDoS (Distributed Denial of Service) ซึ่งเป็นแบบ Active คือ Hacker สั่งเครื่องจำนวนมากที่ยึดไว้ (zombie) ให้ส่ง request หรือเปิดการเชื่อมต่อไปที่ Server พร้อมกัน จน Server ใช้ resource หมดหรือถึงขีดจำกัด ทำให้ Availability เสีย เพราะผู้ใช้ที่ได้รับอนุญาตเข้าใช้บริการไม่ได้ โดยข้อมูลไม่ได้ถูกอ่านหรือแก้ไข',
      def: 'ใช้ firewall / ACL บล็อกต้นทางและ port ที่ไม่ใช้, จำกัดจำนวนการเชื่อมต่อ, เพิ่มความจุและระบบสำรอง (Reliability) และให้ ISP ช่วยกรอง',
    },
  };

  // picture viewer: stage + scrub. returns scrub api
  function picture(box, kind) {
    box.innerHTML = '';
    const A = ATK[kind];
    const stage = el('div', { class: 'stage' }); box.append(stage);
    let tv = 0;
    const m = mount(stage, A.build, S => A.frame(S, tv));
    return Hop.scrub(box, { stops: A.stops.map(l => ({ label: l })), speed: 1500, onFrame: t => { tv = t; m.redraw(); } });
  }

  const ciaTags = (req, opt = []) => ['C', 'I', 'A'].filter(k => req.includes(k) || opt.includes(k)).map(k => `<span class="tag c" style="background:${COL[k]}">${k} ${CNAME[k]}${opt.includes(k) ? ' (ด้วย)' : ''}</span>`).join('');
  function modelCard(d) {
    return el('div', { class: 'model', html: `<div class="nm">${esc(d.name)}</div><div class="tags"><span class="tag">${d.pa}</span>${ciaTags(d.req, d.opt)}</div>${d.read ? `<p><span class="h">อ่านรูป</span>${esc(d.read)}</p>` : ''}<p class="ans">${esc(d.ans)}</p><p><span class="h">ป้องกัน</span>${esc(d.def)}</p>` });
  }
  // answer picker: names (single), passive/active, CIA chips (multi)
  function picker(host, names) {
    const box = el('div', { class: 'pick' });
    const st = { name: null, pa: null, cia: new Set() };
    const nb = el('div', { class: 'opts2' }, names.map(([k, n]) => el('button', { class: 'opt', 'data-v': k, 'aria-pressed': 'false', text: n, onclick: e => { st.name = k; $$('.opt', nb).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
    const pa = el('div', { class: 'seg', role: 'group' }, ['Passive', 'Active'].map(v => el('button', { 'aria-pressed': 'false', 'data-v': v, text: v, onclick: e => { st.pa = v; $$('button', pa).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
    const cp = el('div', { class: 'ciapick' }, ['C', 'I', 'A'].map(k => el('button', { 'aria-pressed': 'false', 'data-v': k, style: `--tc:${COL[k]};--tcs:var(--c-${k === 'C' ? 'blue' : k === 'I' ? 'amber' : 'violet'}-s)`, html: `<b>${k}</b>${CNAME[k]}`, onclick: e => { const b = e.currentTarget; st.cia.has(k) ? st.cia.delete(k) : st.cia.add(k); b.setAttribute('aria-pressed', String(st.cia.has(k))); } })));
    box.append(el('div', { class: 'lbl2', text: 'เป็นการโจมตีแบบไหน' }), nb, el('div', { class: 'lbl2', text: 'Passive หรือ Active' }), pa, el('div', { class: 'lbl2', text: 'ทำให้ข้อไหนของ CIA เสีย (เลือกได้หลายข้อ)' }), cp);
    host.append(box);
    return {
      st,
      mark(d, accept = []) {
        const okName = st.name === d.key || accept.includes(st.name);
        $$('.opt', nb).forEach(b => { b.classList.remove('right', 'wrong', 'dim'); const v = b.dataset.v; if (v === d.key) b.classList.add('right'); else if (v === st.name) b.classList.add('wrong'); else b.classList.add('dim'); });
        $$('button', pa).forEach(b => { b.classList.remove('right', 'wrong'); if (b.dataset.v === d.pa) b.classList.add('right'); else if (b.dataset.v === st.pa) b.classList.add('wrong'); });
        const allow = new Set([...d.req, ...(d.opt || [])]);
        const okCia = d.req.every(k => st.cia.has(k)) && [...st.cia].every(k => allow.has(k));
        $$('button', cp).forEach(b => { b.classList.remove('right', 'wrong'); const k = b.dataset.v; if (d.req.includes(k) || (d.opt || []).includes(k) && st.cia.has(k)) b.classList.add('right'); else if (st.cia.has(k)) b.classList.add('wrong'); });
        return { okName, okPa: st.pa === d.pa, okCia };
      },
      reset() { st.name = st.pa = null; st.cia.clear(); $$('button', box).forEach(b => { b.setAttribute('aria-pressed', 'false'); b.classList.remove('right', 'wrong', 'dim'); }); },
    };
  }
  const NAMES4 = [['sniff', 'Snooping / Sniffing'], ['modify', 'Modification (Man-in-the-Middle)'], ['spoof', 'Spoofing'], ['ddos', 'DoS / DDoS']];

  /* ---------- map hero ---------- */
  (() => {
    const host = $('#map');
    const stage = el('div', { class: 'stage' });
    const btns = el('div', { class: 'ciabtns' });
    const say = el('p', { class: 'say' });
    host.append(stage, btns, say);
    const SAY = {
      conf: '<b style="color:var(--c-blue)">C</b> ข้อมูลที่วิ่งจากผู้ใช้ไปหา Server ต้องอ่านได้เฉพาะคนที่มีสิทธิ์ ถ้ามีคนแอบอ่านระหว่างทาง ความลับเสีย',
      integ: '<b style="color:var(--c-amber)">I</b> สิ่งที่ Server ได้รับต้องตรงกับที่ผู้ใช้ส่งทุกตัวอักษร ถ้ามีคนแก้ระหว่างทาง ความถูกต้องเสีย',
      avail: '<b style="color:var(--c-violet)">A</b> Server ต้องตอบผู้ใช้ที่มีสิทธิ์ได้ทุกครั้งที่เรียกใช้ ถ้า Server ล่มหรือถูกถล่ม ความพร้อมใช้งานเสีย',
      attacker: '<b style="color:var(--c-rose)">ผู้โจมตี</b> คนที่ลงมือ เช่น Cracker, Script kiddie หรือพนักงานในองค์กรเอง',
      threat: '<b style="color:var(--c-rose)">ภัยคุกคาม</b> สิ่งที่ "อาจ" มาทำความเสียหาย ยังไม่เกิดขึ้น',
      vuln: '<b style="color:var(--c-teal)">ช่องโหว่</b> ช่องทางที่เจาะเข้าระบบได้ เช่น Server ที่ยังไม่ update patch',
      attack: '<b style="color:var(--c-rose)">การโจมตี</b> เมื่อภัยคุกคามใช้ช่องโหว่ได้จริง ความเสียหายเกิดขึ้นแล้ว',
    };
    const ROLE = { conf: ['pkt', 'net', 'user'], integ: ['pkt', 'server'], avail: ['server', 'user'], attacker: ['attacker'], threat: ['attacker', 'threat'], vuln: ['vuln', 'server'], attack: ['threat', 'attack', 'vuln'] };
    let focusK = null, S;
    [['C', 'conf', 'ความลับ'], ['I', 'integ', 'ความถูกต้อง'], ['A', 'avail', 'ความพร้อมใช้งาน']].forEach(([L, k, th]) =>
      btns.append(el('button', { class: 'ciab', 'data-k': k, style: `--tc:${COL[L]}`, html: `<b>${L}</b><span>${CNAME[L]}</span><i>${th}</i>`, onclick: () => setFocus(k) })));
    function setFocus(k) {
      focusK = k;
      if (k) say.innerHTML = SAY[k] || '';
      $$('.ciab', btns).forEach(b => b.classList.toggle('on', b.dataset.k === k));
      if (!S) return;
      S.svg.classList.toggle('focus', !!k);
      $$('[data-r]', S.svg).forEach(n => n.classList.toggle('on', !!k && ROLE[k].includes(n.dataset.r)));
    }
    function build(st, mob) {
      const g = mob ? { W: 360, H: 296, us: [34, 206], cl: [180, 210, 150, 62], sv: [320, 200], at: [118, 48] }
        : { W: 760, H: 296, us: [80, 200], cl: [370, 204, 230, 74], sv: [660, 196], at: [370, 50] };
      const svg = svgRoot(g.W, g.H), [ux, uy] = g.us, [sx, sy] = g.sv, [ax, ay] = g.at;
      const tD = `M${ax + 24} ${ay + 4} C${sx - (mob ? 80 : 150)} ${ay}, ${sx - 26} ${ay + 40}, ${sx - 14} ${sy - 32}`;
      let h = cloud(...g.cl, 'เครือข่าย');
      h += `<path data-r="net" d="M${ux + 27} ${uy} L${sx - 25} ${sy}" stroke="var(--ink-2)" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round" fill="none"/>`;
      h += `<g class="hot" data-k="threat" data-r="threat" tabindex="0" role="button" aria-label="ภัยคุกคาม"><path d="${tD}" fill="none" stroke="transparent" stroke-width="24"/><path d="${tD}" fill="none" stroke="var(--c-rose)" stroke-width="2.4" stroke-dasharray="7 6" marker-end="${svg.mk('rose')}"/><text class="lb tl" style="fill:var(--c-rose)">ภัยคุกคาม</text></g>`;
      h += `<g data-r="user">${Hop.dev('pc', ux, uy, { label: 'ผู้ใช้' })}</g>`;
      h += `<g data-r="server">${Hop.dev('server', sx, sy, { label: 'Server' })}</g>`;
      h += `<g class="hot" data-k="vuln" data-r="vuln" tabindex="0" role="button" aria-label="ช่องโหว่"><rect class="hit" x="${sx - 46}" y="${sy + 42}" width="92" height="26"/><path d="M${sx - 12} ${sy - 16} l7 6 -5 5 8 6 -4 5" fill="none" stroke="var(--c-teal)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>${lbl(sx, sy + 58, 'มีช่องโหว่', { c: 'var(--c-teal)' })}</g>`;
      h += `<g class="hot" data-k="attack" data-r="attack" tabindex="0" role="button" aria-label="การโจมตี"><polygon points="${star(sx - 14, sy - 32, 13, 6, 7)}" fill="var(--c-rose)"/><text class="lb al" style="fill:var(--c-rose)">Attack</text></g>`;
      h += `<g class="hot" data-k="attacker" data-r="attacker" tabindex="0" role="button" aria-label="ผู้โจมตี"><circle class="hit" cx="${ax}" cy="${ay}" r="30"/>${Hop.dev('attacker', ax, ay)}${lbl(ax - 30, ay + 5, 'ผู้โจมตี', { c: 'var(--c-rose)', anchor: 'end' })}</g>`;
      add(svg, h); st.replaceChildren(svg);
      const tp = track(svg, tD);
      const [lx, ly] = at(tp, mob ? .42 : .4); const tl = $('.tl', svg); tl.setAttribute('x', lx); tl.setAttribute('y', ly - 12); tl.setAttribute('text-anchor', 'middle');
      const al = $('.al', svg); al.setAttribute('x', sx - 34); al.setAttribute('y', sy - 28); al.setAttribute('text-anchor', 'end');
      const main = track(svg, `M${ux + 27} ${uy} L${sx - 25} ${sy}`);
      const p = el('g', { 'data-r': 'pkt', class: 'pkt' }); svg.append(p);
      const pp = pill(svg).text('ข้อมูล'); p.append(pp.g);
      return { svg, main, pp, p };
    }
    let t0 = performance.now();
    const m = mount(stage, (st, mob) => (S = build(st, mob)), () => setFocus(focusK));
    const loop = now => {
      if (S && S.main.isConnected) { const f = ((now - t0) / 3200) % 1; const [x, y] = at(S.main, ease(f)); S.pp.at(x, y - 0, f < .08 ? f / .08 : f > .9 ? (1 - f) / .1 : 1); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    say.innerHTML = 'แตะแต่ละส่วนของภาพเพื่อดูความหมาย ทุกคำที่ต้องใช้ตอบในบทนี้อยู่ในภาพนี้';
    host.addEventListener('click', e => { const h = e.target.closest('[data-k]'); if (h && SAY[h.dataset.k]) setFocus(h.dataset.k); });
  })();

  /* ---------- 1. CIA: break one at a time ---------- */
  (() => {
    const host = $('#fig-cia');
    let mode = 'C', p0 = performance.now(), S;
    const seg = el('div', { class: 'seg', role: 'group' });
    [['ok', 'ปกติ'], ['C', 'C เสีย'], ['I', 'I เสีย'], ['A', 'A เสีย']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === mode), 'data-v': k, text: l, onclick: () => { mode = k; run(); } })));
    const rep = el('button', { class: 'btn small ghost replay', html: `${icon('replay')} เล่นใหม่`, onclick: () => run() });
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg, rep));
    const stage = el('div', { class: 'stage' }); host.append(stage);
    const status = el('div', { class: 'status' }); host.append(status);
    const say = el('p', { class: 'say' }); host.append(say);
    const SAY = {
      ok: 'ข้อมูลถึงธนาคารครบ ไม่มีใครเห็น ไม่มีใครแก้ และระบบตอบทันที ทั้ง C, I และ A ยังดีอยู่',
      C: '<b style="color:var(--c-blue)">Confidentiality เสีย</b> เพราะ Darth ได้อ่านคำสั่งโอนเงินทั้งที่ไม่มีสิทธิ์ แม้ธนาคารจะได้รับข้อมูลครบและถูกต้อง (I และ A ไม่เสีย)',
      I: '<b style="color:var(--c-amber)">Integrity เสีย</b> เพราะธนาคารได้รับคำสั่งโอน 50000 บาท ไม่ตรงกับ 500 บาทที่ Bob ส่ง ข้อมูลถูกแก้โดยคนที่ไม่มีสิทธิ์',
      A: '<b style="color:var(--c-violet)">Availability เสีย</b> เพราะ server ของธนาคารถูกส่ง request ท่วมจนรับไม่ไหว Bob มีสิทธิ์ใช้บริการแต่ใช้ไม่ได้ ข้อมูลไม่ได้รั่วหรือถูกแก้',
    };
    function build(st, mob) {
      const s = badScene(st, mob, { right: 'bank', flood: true });
      s.p = pill(s.svg); s.c = pill(s.svg, { c: 'var(--c-rose)' }).text('โอน 500');
      s.bD = pill(s.svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' });
      s.bB = pill(s.svg, { bg: 'var(--surface)' });
      s.dots = Array.from({ length: 8 }, () => { const c = el('circle', { r: 4.5, fill: 'var(--c-rose)', opacity: 0 }); s.svg.append(c); return c; });
      s.fl = s.svg.querySelector('path[stroke-dasharray="5 6"]');
      return (S = s);
    }
    function frame(p) {
      if (!S) return;
      const [dx, dy] = S.g.dar, [ax, ay] = S.g.ali;
      S.darth.classList.toggle('dim', mode === 'ok');
      S.fl.style.opacity = mode === 'A' ? 1 : 0;
      S.c.hide(); S.bD.hide(); S.bB.hide();
      S.dots.forEach(d => d.setAttribute('opacity', 0)); gaugeSet(S.gauge, 0);
      S.p.text('โอน 500', 'var(--ink)');
      if (mode === 'ok' || mode === 'C') {
        const f = ramp(p, 0, .7); S.p.at(...at(S.P.main, ease(f)), 1 - ramp(p, .8, .9));
        if (mode === 'C') { const k = ramp(p, .32, .62); if (k > 0) S.c.at(...at(S.P.branch, ease(k))); S.bD.text('เห็น: โอน 500').at(dx - 34, dy, ramp(p, .62, .7)); }
        S.bB.text('ได้รับ: โอน 500', 'var(--ink)').at(ax, ay - 66, ramp(p, .72, .8));
      } else if (mode === 'I') {
        const ch = p > .45;
        S.p.text(ch ? 'โอน 50000' : 'โอน 500', ch ? 'var(--c-amber)' : 'var(--ink)');
        if (p < .35) S.p.at(...at(S.P.toD, ease(p / .35))); else if (p < .55) S.p.at(...at(S.P.toD, 1)); else S.p.at(...at(S.P.fromD, ease(ramp(p, .55, .85))), 1 - ramp(p, .9, 1));
        S.bD.text('แก้เป็น 50000').at(dx - 34, dy, ramp(p, .36, .42) * (1 - ramp(p, .6, .66)));
        S.bB.text('ได้รับ: โอน 50000', 'var(--c-amber)').at(ax, ay - 66, ramp(p, .86, .92));
      } else if (mode === 'A') {
        S.dots.forEach((d, k) => { const ph = (p * 4 + k / 8) % 1; const [x, y] = at(S.P.flood, ph); d.setAttribute('cx', x); d.setAttribute('cy', y); d.setAttribute('opacity', ph < .9 && p < .97 ? ramp(p, 0, .1) : 0); });
        gaugeSet(S.gauge, ramp(p, .05, .45));
        const f = ramp(p, .35, .8); S.p.at(...at(S.P.main, ease(f) * .86), 1 - ramp(p, .9, 1) * .5);
        if (p > .8) S.p.text('ไม่มีคำตอบ', 'var(--c-violet)');
        S.bB.text('รับไม่ไหว', 'var(--c-violet)').at(ax, ay - 66, ramp(p, .45, .52));
      }
    }
    function run() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
      say.innerHTML = SAY[mode];
      status.replaceChildren(...['C', 'I', 'A'].map(k => el('div', { class: 'st' + (k === mode ? ' bad' : ''), style: `--tc:${COL[k]};--tcs:var(--c-${k === 'C' ? 'blue' : k === 'I' ? 'amber' : 'violet'}-s)`, html: `<b>${k}</b><span>${CNAME[k]}<br>${k === mode ? 'เสีย' : 'ปกติ'}</span>` })));
      p0 = performance.now();
      const tick = now => { const p = clamp((now - p0) / 3600, 0, 1); frame(p); if (p < 1 && run.cur === tick) requestAnimationFrame(tick); };
      run.cur = tick; requestAnimationFrame(tick);
    }
    mount(stage, build, () => frame(1));
    Hop.onView(host, run);
    say.innerHTML = SAY[mode];
    run.cur = null;
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
    status.replaceChildren(...['C', 'I', 'A'].map(k => el('div', { class: 'st' + (k === mode ? ' bad' : ''), style: `--tc:${COL[k]};--tcs:var(--c-${k === 'C' ? 'blue' : k === 'I' ? 'amber' : 'violet'}-s)`, html: `<b>${k}</b><span>${CNAME[k]}<br>${k === mode ? 'เสีย' : 'ปกติ'}</span>` })));
  })();
  Hop.mcq($('#q-cia'), {
    q: 'มีคนเข้าไปเปลี่ยนเกรดของนักศึกษาในระบบทะเบียนทั้งที่ไม่มีสิทธิ์ CIA ข้อไหนเสียชัดที่สุด',
    opts: ['Confidentiality', 'Integrity', 'Availability', 'ไม่มีข้อไหนเสีย เพราะระบบยังใช้งานได้'], a: 1,
    whyWrong: { 0: 'Confidentiality คือเรื่องการแอบอ่าน ในข้อนี้ประเด็นหลักคือข้อมูลถูกเปลี่ยน', 2: 'ระบบยังเปิดใช้งานได้ตามปกติ Availability จึงไม่เสีย', 3: 'ระบบใช้ได้ (A ดี) ไม่ได้แปลว่าปลอดภัย ข้อมูลที่ถูกแก้คือ Integrity เสีย' },
    why: 'Integrity คือการป้องกันไม่ให้ข้อมูลถูกเปลี่ยนแปลงโดยไม่ได้รับอนุญาต เกรดที่ถูกแก้ไม่ตรงกับข้อมูลจริงแล้ว',
  });
  Hop.mcq($('#q-cia'), {
    q: 'เว็บลงทะเบียนเรียนล่มช่วงเปิดระบบ นักศึกษาเข้าไม่ได้ทั้งวัน แต่ไม่มีข้อมูลรั่วหรือถูกแก้ ข้อไหนเสีย',
    opts: ['Availability', 'Confidentiality', 'Integrity', 'ทั้งสามข้อ'], a: 0,
    whyWrong: { 1: 'ไม่มีใครได้อ่านข้อมูลที่ไม่ควรเห็น', 2: 'ข้อมูลไม่ได้ถูกเปลี่ยน', 3: 'โจทย์บอกชัดว่าไม่มีข้อมูลรั่วหรือถูกแก้ ตอบเกินจะเสียคะแนน' },
    why: 'Availability คือผู้มีสิทธิ์ต้องใช้งานได้เมื่อต้องการ นักศึกษามีสิทธิ์แต่ใช้ไม่ได้',
  });

  /* ---------- 2. risk ---------- */
  Hop.eq($('#eq-risk'), [['risk', 'Risk'], ' = ', ['vuln', 'ช่องโหว่'], ' + ', ['threat', 'ภัยคุกคาม']], { sym: { risk: 'Risk', vuln: 'Vulnerability', threat: 'Threat' } });
  (() => {
    const host = $('#fig-risk');
    let V = true, T = true, p0 = 0;
    const mk = (lab, opts, get, set) => { const s = el('div', { class: 'seg', role: 'group' }); opts.forEach(([v, l]) => s.append(el('button', { 'aria-pressed': String(get() === v), text: l, onclick: () => { set(v); $$('button', s).forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === get()))); run(); } }))); return el('div', {}, el('span', { class: 'cl', text: lab }), s); };
    host.append(el('div', { class: 'ctrl-row' },
      mk('ช่องโหว่ (Vulnerability)', [[true, 'ยังไม่ patch'], [false, 'patch แล้ว']], () => V, v => V = v),
      mk('ภัยคุกคาม (Threat)', [[true, 'มี cracker'], [false, 'ไม่มี']], () => T, v => T = v)));
    const stage = el('div', { class: 'stage' }); host.append(stage);
    const ver = el('div', { class: 'verdict' }); host.append(ver);
    let S;
    function build(st, mob) {
      const g = mob ? { W: 360, H: 170, a: [44, 80], s: [306, 80] } : { W: 760, H: 170, a: [120, 80], s: [620, 80] };
      const svg = svgRoot(g.W, g.H), [ax, ay] = g.a, [sx, sy] = g.s;
      let h = `<line x1="${ax + 30}" y1="${ay}" x2="${sx - 30}" y2="${sy}" stroke="var(--line-2)" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>`;
      h += `<g class="att">${Hop.dev('attacker', ax, ay, { label: 'Cracker', lc: 'var(--c-rose)' })}</g>`;
      h += Hop.dev('server', sx, sy, { label: 'Server' });
      h += `<g class="crack"><path d="M${sx - 12} ${sy - 16} l7 6 -5 5 8 6 -4 5" fill="none" stroke="var(--c-teal)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>${lbl(sx, sy + 56, 'ยังไม่ patch', { c: 'var(--c-teal)', cls: 'lb s' })}</g>`;
      h += `<g class="shield" opacity="0">${lbl(sx, sy + 56, 'patch แล้ว', { c: 'var(--c-green)', cls: 'lb s' })}<path d="M${sx - 32} ${sy - 26} v52" stroke="var(--c-green)" stroke-width="4" stroke-linecap="round"/></g>`;
      h += `<polygon class="burst" points="${star(sx, sy, 32, 20, 9)}" fill="var(--c-rose-s)" stroke="var(--c-rose)" stroke-width="2" opacity="0"/>`;
      add(svg, h); st.replaceChildren(svg);
      // burst behind server: move to front-of-line but behind glyph
      const b = $('.burst', svg); svg.insertBefore(b, svg.children[2]);
      const p = pill(svg, { c: 'var(--c-rose)' }).text('exploit');
      return (S = { svg, g, p, att: $('.att', svg), crack: $('.crack', svg), shield: $('.shield', svg), burst: b });
    }
    function frame(p) {
      if (!S) return;
      const [ax, ay] = S.g.a, [sx] = S.g.s;
      S.att.style.opacity = T ? 1 : .18; S.crack.style.opacity = V ? 1 : 0; S.shield.setAttribute('opacity', V ? 0 : 1);
      if (!T) { S.p.hide(); S.burst.setAttribute('opacity', 0); return; }
      const end = V ? sx - 10 : sx - 46;
      const f = ease(ramp(p, 0, .6)), back = V ? 0 : ramp(p, .6, .9);
      S.p.at(lerp(ax + 34, end, f) - back * 60, ay, 1 - (V ? ramp(p, .75, 1) : back));
      S.burst.setAttribute('opacity', V ? ramp(p, .55, .7) : 0);
    }
    function run() {
      const lv = V && T ? ['hi', 'สูง', 'มีทั้งช่องโหว่และภัยคุกคาม cracker ใช้ช่องโหว่ที่ยังไม่ patch เข้าไปได้ ความเสี่ยงกลายเป็น Attack แล้ว'] : V ? ['mid', 'แฝงอยู่', 'มีช่องโหว่แต่ยังไม่มีใครมาใช้ ยังไม่เสียหาย แต่ถ้าภัยคุกคามมาเมื่อไรก็โดนทันที'] : T ? ['lo', 'ต่ำ', 'มีภัยคุกคาม แต่ระบบ patch แล้วไม่มีช่องให้เข้า การโจมตีจึงไม่สำเร็จ'] : ['lo', 'ไม่มี', 'ไม่มีทั้งช่องโหว่และภัยคุกคาม ไม่มีความเสี่ยงจากเหตุการณ์นี้'];
      ver.innerHTML = `<span class="lv ${lv[0]}">ความเสี่ยง ${lv[1]}</span><span>${lv[2]}</span>`;
      p0 = performance.now();
      const tick = now => { const p = clamp((now - p0) / 1800, 0, 1); frame(p); if (p < 1 && run.cur === tick) requestAnimationFrame(tick); };
      run.cur = tick; requestAnimationFrame(tick);
    }
    mount(stage, build, () => frame(1));
    Hop.onView(host, run);
    run.cur = null; run();
  })();
  (() => {
    const host = $('#fig-parts');
    const box = el('div', { class: 'tparts' });
    [['target', 'Target', 'เป้าหมาย: C, I หรือ A', 'ข้อมูลลูกค้าในระบบ ความลับ (<b style="color:var(--c-blue)">C</b>) จะเสีย'],
      ['agent', 'Agent', 'Access, Knowledge, Motivation', 'พนักงานเก่า: Access บัญชีเดิมยังใช้ได้, Knowledge รู้ระบบดี, Motivation ไม่พอใจบริษัท'],
      ['event', 'Event', 'เหตุการณ์ที่เกิดขึ้น', 'ใช้บัญชีเกินสิทธิ์ ดึงข้อมูลลูกค้าออกไป']]
      .forEach(([k, n, d, x]) => box.append(el('button', { class: 'tp', 'data-k': k, html: `<div class="k">${n}</div><div class="d">${d}</div><div class="x">${x}</div>` })));
    host.append(box);
  })();
  (() => {
    const host = $('#fig-types');
    const T = [
      ['ความผิดพลาดจากบุคคล', 'Human Error / Failure', 'อุบัติเหตุ', 'IA'], ['ภัยต่อทรัพย์สินทางปัญญา', 'Compromise to Intellectual Property', 'การละเมิดลิขสิทธิ์', 'C'],
      ['การจารกรรม / การรุกล้ำ', 'Espionage / Trespass', 'เข้าถึงหรือรวบรวมข้อมูลโดยไม่ได้รับอนุญาต', 'C'], ['การกรรโชกสารสนเทศ', 'Information Extortion', 'Blackmail, เผยแพร่ข้อมูลลับ', 'C'],
      ['การทำลาย / ทำให้เสียหาย', 'Sabotage / Vandalism', 'ทำลายระบบหรือสารสนเทศ', 'IA'], ['การลักขโมย', 'Theft', 'ขโมยอุปกรณ์คอมพิวเตอร์หรือสารสนเทศ', 'CA'],
      ['ซอฟต์แวร์โจมตี', 'Attacking Software', 'ไวรัส, เวิร์ม, โค้ดมาโคร, DoS', 'IA'], ['ภัยธรรมชาติ', 'Force of Nature', 'น้ำท่วม, ไฟไหม้, แผ่นดินไหว, ไฟดับ', 'A'],
      ['คุณภาพบริการเบี่ยงเบน', 'Deviation in Quality of Service', 'ISP, WAN service provider มีปัญหา', 'A'], ['ความผิดพลาดของฮาร์ดแวร์', 'Technical Hardware Failure', 'อุปกรณ์ทำงานผิดพลาด', 'A'],
      ['ความผิดพลาดของซอฟต์แวร์', 'Technical Software Failure', 'Bugs, ปัญหาของ code, infinite loop', 'IA'], ['ความล้าสมัยของเทคโนโลยี', 'Technology Obsolescence', 'เทคโนโลยีที่ใช้อยู่ล้าสมัย', 'A'],
    ];
    let f = 'all';
    const seg = el('div', { class: 'seg', role: 'group' });
    [['all', 'ทั้งหมด'], ['C', 'C'], ['I', 'I'], ['A', 'A']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === f), 'data-v': k, text: l, onclick: () => { f = k; upd(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 4px' }, seg));
    const tw = el('div', { class: 'tw2' }), tb = el('table', { class: 'stable' });
    tb.innerHTML = '<thead><tr><th>ประเภท</th><th>ตัวอย่างในสไลด์</th><th>กระทบ</th></tr></thead>';
    const body = el('tbody'); tb.append(body); tw.append(tb); host.append(tw);
    T.forEach(([th, en, ex, c]) => body.append(el('tr', { 'data-c': c, html: `<td>${th}<span class="en2">${en}</span></td><td>${ex}</td><td><div class="ciarow">${['C', 'I', 'A'].map(k => `<span class="cia-dot sm ${c.includes(k) ? 'on' : ''}" style="--tc:${COL[k]}">${k}</span>`).join('')}</div></td>` })));
    function upd() { $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === f))); $$('tr', body).forEach(r => r.classList.toggle('off', f !== 'all' && !r.dataset.c.includes(f))); }
    upd();
  })();
  Hop.mcq($('#q-risk'), {
    q: 'พนักงานคนหนึ่งลาออกไปแล้ว แต่บัญชีผู้ใช้ของเขายังเข้าระบบได้เหมือนเดิม สิ่งนี้คืออะไร',
    opts: ['Vulnerability (ช่องโหว่)', 'Threat (ภัยคุกคาม)', 'Attack (การโจมตี)', 'Risk ที่หมดไปแล้ว เพราะเขาไม่ได้ทำงานแล้ว'], a: 0,
    whyWrong: { 1: 'ภัยคุกคามคือคนหรือสิ่งที่อาจมาใช้ช่องนี้ เช่น ตัวพนักงานเก่าเอง ส่วนบัญชีที่ยังไม่ปิดคือช่องทางให้เข้า', 2: 'ยังไม่มีใครใช้บัญชีนี้ทำความเสียหาย จึงยังไม่ใช่การโจมตี', 3: 'ความเสี่ยงยังอยู่ เพราะช่องโหว่ยังเปิดและพนักงานเก่าก็ยังเป็นภัยคุกคามได้' },
    why: 'สไลด์ยกตัวอย่างนี้ตรงๆ ในหัวข้อช่องโหว่: User Account Management Process ไม่มีประสิทธิภาพ คนย้ายหรือลาออกแต่สิทธิ์ยังเหมือนเดิม',
  });

  /* ---------- 3. attack picture viewer ---------- */
  (() => {
    const host = $('#fig-attack');
    const order = Hop.shuffle(Object.keys(ATK));
    const solved = new Set();
    let cur = order[0];
    const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'เลือกรูป' });
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg));
    const pic = el('div'); host.append(pic);
    const pk = el('div'); host.append(pk);
    const res = el('div'); host.append(res);
    function tabs() { seg.replaceChildren(...order.map((k, i) => el('button', { 'aria-pressed': String(k === cur), text: solved.has(k) ? ATK[k].name.split(' (')[0] : 'รูป ' + (i + 1), onclick: () => { cur = k; show(); } }))); }
    function show() {
      tabs();
      const sc = picture(pic, cur);
      pk.innerHTML = ''; res.innerHTML = '';
      const P = picker(pk, NAMES4);
      const btn = el('button', { class: 'btn primary', style: 'margin-top:16px', html: `${icon('check')} ตรวจคำตอบ`, onclick: () => {
        const d = { ...ATK[cur], key: cur };
        const r = P.mark(d);
        const n = [r.okName, r.okPa, r.okCia].filter(Boolean).length;
        res.replaceChildren(el('div', { class: 'fb ' + (n === 3 ? 'good' : 'bad'), html: `<div class="h">${n === 3 ? 'ถูกครบทั้งสามส่วน' : `ถูก ${n} จาก 3 ส่วน`}</div>${!r.okName ? 'ดูหัวลูกศรอีกครั้ง: ลูกศรแต่ละเส้นจบที่ใคร ' : ''}${r.okName && !r.okCia ? 'ชื่อถูกแล้ว ทวนว่าการโจมตีนี้ทำให้ข้อมูลรั่ว ถูกแก้ หรือใช้งานไม่ได้ ' : ''}` }), modelCard(d));
        if (r.okName) { solved.add(cur); tabs(); }
      } });
      pk.append(btn);
      return sc;
    }
    show();
  })();
  Hop.mcq($('#q-attack'), {
    q: 'การโจมตีข้อไหนเป็นแบบ Passive',
    opts: ['Snooping / Sniffing', 'Modification', 'Spoofing', 'Denial of Service'], a: 0,
    whyWrong: { 1: 'Modification แก้ข้อมูลระหว่างทาง มีการเปลี่ยนแปลงข้อมูลจึงเป็น Active', 2: 'Spoofing สร้างข้อมูลหรือหน้าเว็บปลอมขึ้นมาเอง เป็น Active', 3: 'DoS ส่ง request ท่วม server เป็นการขัดขวางระบบ เป็น Active' },
    why: 'สไลด์ Snooping เขียนไว้ว่า "การโจมตีแบบ Passive (เป็นการกระทำที่ไม่มีการเปลี่ยนแปลงหรือแก้ไขข้อมูล)" ผู้โจมตีแค่ดักอ่าน',
  });

  /* ---------- 4. other attacks + defence table ---------- */
  (() => {
    const L = [['delay', 'ทำให้ข้อมูลหรือบริการไปถึงช้า เช่น กัก packet ไว้ก่อนปล่อย', 'A'], ['malware', 'โปรแกรมมุ่งร้าย ดูส่วน Malware ด้านล่าง', 'CIA'],
      ['social', 'หลอกคนให้บอกข้อมูล เช่น โทรอ้างเป็นฝ่าย IT', 'C'], ['phish', 'อีเมลหรือลิงก์ปลอม พาไปเว็บปลอมให้กรอกรหัส', 'C'],
      ['crypt', 'ถอดรหัสข้อมูลที่เข้ารหัสไว้โดยไม่มี key', 'C'], ['pwguess', 'เดารหัสผ่านไปเรื่อยๆ จนเข้าระบบได้', 'C'],
      ['birthday', 'หาข้อมูลปลอมที่ค่า hash ชนกับของจริง', 'I'], ['mitm', 'แทรกกลาง หรือแย่งเซสชัน TCP ที่เชื่อมกันอยู่', 'CI'], ['zeroday', 'ใช้ช่องโหว่ที่ผู้ผลิตยังไม่มี patch', 'CIA']];
    $('#list-more').append(el('div', { class: 'alist' }, L.map(([k, s, c]) => el('button', { class: 'ai', 'data-k': k, html: `<span class="t" style="color:${Hop.C[k].c === 'ink' ? 'var(--ink)' : 'var(--c-' + Hop.C[k].c + ')'}">${Hop.C[k].t}</span><span class="s">${s}</span><div class="ciarow">${['C', 'I', 'A'].map(x => `<span class="cia-dot sm ${c.includes(x) ? 'on' : ''}" style="--tc:${COL[x]}">${x}</span>`).join('')}</div>` }))));
    const cia = s => s.split('').map(x => `<b style="color:${COL[x]}">${x}</b>`).join(' ');
    const R = [['Sniffing', 'C', 'เข้ารหัส: HTTPS, SSL/TLS, IPSec, VPN', 'ไม่ได้ packet ที่ถูกดักคือ packet ที่ได้รับอนุญาตอยู่แล้ว'],
      ['Modification / MITM', 'IC', 'hash, digital signature, TLS หรือ IPSec', 'ไม่ได้โดยตรง'],
      ['Spoofing', 'C', 'ตรวจ URL และ certificate, authentication', 'Packet filtering ถูกปลอม IP ได้ (ข้อเสียในสไลด์) แบบ stateful และ proxy ตรวจได้ดีกว่า'],
      ['DoS / DDoS', 'A', 'จำกัดการเชื่อมต่อ, เพิ่มความจุ, ให้ ISP ช่วยกรอง', 'ช่วยบางส่วน: ACL บล็อกต้นทางที่รู้, stateful จำกัดการเชื่อมต่อที่ค้าง'],
      ['Worm', 'A', 'patch OS, anti-virus', 'ช่วย: ปิด port ที่ worm ใช้แพร่'],
      ['Trojan / Backdoor', 'C', 'anti-virus, โหลดจากแหล่งที่เชื่อถือ, ตรวจโค้ด', 'Personal firewall บล็อกการเชื่อมต่อออกที่ผิดปกติ']];
    $('#tbl-defend').append(el('table', { class: 'stable wide-t', html: `<thead><tr><th>การโจมตี</th><th>เสีย</th><th>ป้องกันหลัก</th><th>Firewall ช่วยไหม</th></tr></thead><tbody>${R.map(r => `<tr><td>${r[0]}</td><td>${cia(r[1])}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody>` }));
  })();

  /* ---------- 5. attackers ---------- */
  (() => {
    const host = $('#fig-who');
    const W = [['แฮคเกอร์', 'Hacker', 'สูง', 'เพื่อปรับปรุงระบบรักษาความปลอดภัย'], ['แครกเกอร์', 'Cracker', 'สูง', 'เพื่อขโมยข้อมูลสำคัญหรือทำลายระบบ'], ['สคริปคิดดี้', 'Script kiddie', 'ต่ำ', 'เพื่อให้ได้การยอมรับ'],
      ['สายลับ', 'Spy', 'สูง', 'เพื่อให้ได้เงิน'], ['พนักงาน', 'Employee', 'หลากหลาย', 'หลากหลาย'], ['ผู้ก่อการร้าย', 'Terrorist', 'สูง', 'เพื่ออุดมการณ์ทางการเมือง']];
    let test = false;
    const seg = el('div', { class: 'seg', role: 'group' });
    [[false, 'ดูทั้งหมด'], [true, 'ปิดแรงจูงใจไว้ ทายเอง']].forEach(([v, l]) => seg.append(el('button', { 'aria-pressed': String(v === test), text: l, onclick: () => { test = v; draw(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 4px' }, seg));
    const tw = el('div', { class: 'tw2' }); host.append(tw);
    function draw() {
      $$('button', seg).forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === test)));
      const t = el('table', { class: 'stable', html: '<thead><tr><th>ผู้โจมตี</th><th>ความชำนาญ</th><th>แรงจูงใจ</th></tr></thead>' });
      const b = el('tbody'); t.append(b);
      W.forEach(([th, en, lv, mo]) => {
        const tr = el('tr', { html: `<td>${th}<span class="en2">${en}</span></td><td><span class="lvl ${lv === 'สูง' ? 'hi' : lv === 'ต่ำ' ? 'lo' : ''}">${lv}</span></td>` });
        const td = el('td'); tr.append(td);
        if (test) td.append(el('button', { class: 'btn small', text: 'แตะเพื่อดู', onclick: e => { td.textContent = mo; } })); else td.textContent = mo;
        b.append(tr);
      });
      tw.replaceChildren(t);
    }
    draw();
  })();
  Hop.mcq($('#q-who'), {
    q: 'Hacker กับ Cracker ต่างกันที่อะไร',
    opts: ['แรงจูงใจ: Hacker ทำเพื่อปรับปรุงระบบความปลอดภัย Cracker ทำเพื่อขโมยข้อมูลหรือทำลาย', 'ความชำนาญ: Hacker สูง Cracker ต่ำ', 'Hacker เป็นคนในองค์กร Cracker เป็นคนนอก', 'ไม่ต่างกัน เป็นชื่อเรียกคนเดียวกัน'], a: 0,
    whyWrong: { 1: 'ตามตารางในสไลด์ทั้งคู่ชำนาญ "สูง" เท่ากัน ผู้ที่ชำนาญต่ำคือ Script kiddie', 2: 'สไลด์ไม่ได้แบ่งตามคนในหรือคนนอก คนในองค์กรคือแถว "พนักงาน"' },
    why: 'สไลด์แบ่งผู้โจมตีด้วยสองแกน ความชำนาญกับแรงจูงใจ Hacker กับ Cracker ชำนาญสูงเท่ากัน ต่างกันแค่แรงจูงใจ',
  });

  /* ---------- 6. malware in a 6-PC LAN ---------- */
  (() => {
    const host = $('#fig-mal');
    const MC = { virus: 'var(--c-amber)', worm: 'var(--c-violet)', trojan: 'var(--c-blue)', backdoor: 'var(--c-rose)' };
    const MAL = {
      virus: ['ไฟล์เกมใน PC1 มีไวรัสฝังอยู่', 'ผู้ใช้เปิดไฟล์ ไวรัสจึงเริ่มทำงาน', 'สำเนาตัวเองไปติดไฟล์อื่น แก้และทำลายข้อมูล', 'ไฟล์ถูกส่งต่อไปที่ PC2 แต่ยังไม่มีใครเปิด', 'ผู้ใช้ PC2 เปิดไฟล์ จึงติดต่อ'],
      worm: ['Worm เข้ามาทางช่องโหว่ของ PC1', 'copy ตัวเองไปเครื่องอื่นเอง ไม่ต้องมีใครเปิด', 'แพร่ไปทุกเครื่องที่มีช่องโหว่', 'ใช้ CPU และ bandwidth จนหมด ระบบช้าจนใช้งานไม่ได้'],
      trojan: ['PC1 โหลดเกมฟรีที่ดูเหมือนโปรแกรมดี', 'ผู้ใช้ติดตั้งเอง โค้ดที่ซ่อนอยู่เริ่มทำงาน', 'แอบส่งข้อมูลลับออกไปให้ผู้โจมตี', 'ไม่แพร่ไปเครื่องอื่นเอง'],
      backdoor: ['ผู้โจมตีพยายามเข้า PC1', 'ทางปกติต้อง login เข้าไม่ได้', 'แต่มีทางลับที่ผู้ออกแบบทิ้งไว้', 'เข้าทางลับโดยไม่ผ่านการตรวจสอบ', 'ควบคุมเครื่องได้: อ่าน แก้ หรือลบ'],
    };
    let kind = 'virus';
    const seg = el('div', { class: 'seg', role: 'group' });
    [['virus', 'Virus'], ['worm', 'Worm'], ['trojan', 'Trojan horse'], ['backdoor', 'Backdoor']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === kind), 'data-v': k, text: l, onclick: () => { kind = k; show(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg));
    const box = el('div'); host.append(box);
    const tbl = $('#tbl-mal');
    const ROWS = [['virus', 'ไม่ใช่ ต้องฝังกับไฟล์ (host)', 'ได้ แต่ต้องรอคนเปิด host', 'เมื่อ host ถูกเปิด', 'ทำให้ช้า แก้หรือทำลายข้อมูล', 'IA'],
      ['worm', 'ใช่', 'ได้เอง ผ่านเครือข่าย', 'เข้ามาทางช่องโหว่ได้เลย', 'กิน resource จนหมด ปกติไม่ทำลายข้อมูล', 'A'],
      ['trojan', 'ซ่อนในโปรแกรมอื่น', 'ไม่ได้', 'ผู้ใช้เปิดโปรแกรมเอง', 'ขโมยข้อมูล เปิดทางให้ผู้บุกรุก', 'C'],
      ['backdoor', 'เป็นทางลับในระบบ', 'ไม่ได้', 'ผู้โจมตีใช้เมื่อไรก็ได้', 'ข้ามการตรวจสอบ ทำได้ทุกอย่าง', 'CIA']];
    const t = el('table', { class: 'stable wide-t', html: `<thead><tr><th>ชนิด</th><th>โปรแกรมอิสระ?</th><th>แพร่ตัวเอง?</th><th>ทำงานเมื่อ</th><th>ทำอะไร</th><th>เสีย</th></tr></thead><tbody>${ROWS.map(r => `<tr data-v="${r[0]}"><td>${Hop.t(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5].split('').map(x => `<b style="color:${COL[x]}">${x}</b>`).join(' ')}</td></tr>`).join('')}</tbody>` });
    tbl.append(t);
    function build(st, mob) {
      const g = mob ? { W: 360, H: 352, sw: [180, 190], att: [328, 190], pcs: [[60, 92], [180, 92], [300, 92], [60, 262], [180, 262], [300, 262]] }
        : { W: 760, H: 262, sw: [380, 62], att: [706, 62], pcs: [0, 1, 2, 3, 4, 5].map(i => [95 + i * 114, 186]) };
      const svg = svgRoot(g.W, g.H), [wx, wy] = g.sw, [ax, ay] = g.att, c = MC[kind];
      let h = '';
      g.pcs.forEach(([x, y]) => h += `<line x1="${wx}" y1="${wy}" x2="${x}" y2="${y}" stroke="var(--line-2)" stroke-width="2"/>`);
      h += `<line x1="${wx + 24}" y1="${wy}" x2="${ax - 24}" y2="${ay}" stroke="var(--c-rose)" stroke-width="2" stroke-dasharray="6 6" opacity=".6"/>`;
      const hp = kind === 'backdoor' ? (mob ? `M${ax} ${ay - 24} C${ax + 24} 10, 40 0, ${g.pcs[0][0] - 10} ${g.pcs[0][1] - 26}` : `M${ax} ${ay - 22} C${ax - 40} 0, 140 0, ${g.pcs[0][0] - 10} ${g.pcs[0][1] - 26}`) : null;
      if (hp) h += `<path class="hp" d="${hp}" fill="none" stroke="var(--c-rose)" stroke-width="2.4" stroke-dasharray="7 6" marker-end="${svg.mk('rose')}" opacity="0"/>`;
      g.pcs.forEach(([x, y], i) => {
        h += `<g class="pcg"><circle class="inf" cx="${x}" cy="${y - 2}" r="30" fill="${c}" opacity="0"/><circle class="safe" cx="${x}" cy="${y - 2}" r="30" fill="none" stroke="var(--c-green)" stroke-width="2.4" opacity="0"/>${Hop.dev('pc', x, y, { label: 'PC' + (i + 1) })}
          <g class="files" opacity="0"><path d="M${x + 16} ${y - 34}h10l5 5v13h-15z" fill="var(--bg)" stroke="${c}" stroke-width="2"/><circle cx="${x + 23.5}" cy="${y - 23}" r="2.6" fill="${c}"/></g>
          <g class="more" opacity="0"><path d="M${x - 31} ${y - 34}h10l5 5v13h-15z" fill="var(--bg)" stroke="${c}" stroke-width="2"/><path d="M${x - 33} ${y - 12}h10l5 5v13h-15z" fill="var(--bg)" stroke="${c}" stroke-width="2"/></g>
          <rect x="${x - 28}" y="${y + 47}" width="56" height="7" rx="3.5" fill="var(--surface-2)"/><rect class="cpu" x="${x - 28}" y="${y + 47}" width="0" height="7" rx="3.5" fill="${c}"/></g>`;
      });
      if (kind === 'backdoor') { const [x, y] = g.pcs[0], gx = lerp(wx, x, mob ? .5 : .72), gy = lerp(wy, y, mob ? .5 : .72); h += `<g class="gate"><rect x="${gx - 26}" y="${gy - 13}" width="52" height="26" rx="7" fill="var(--bg)" stroke="var(--c-green)" stroke-width="2"/>${lbl(gx, gy + 5, 'login', { c: 'var(--c-green)', cls: 'lb s' })}</g>`; }
      h += Hop.dev('switch', wx, wy) + Hop.dev('attacker', ax, ay, { label: 'ผู้โจมตี', lc: 'var(--c-rose)' });
      add(svg, h); st.replaceChildren(svg);
      const S = { svg, g, pcs: $$('.pcg', svg), sp: Array.from({ length: 5 }, () => pill(svg, { c, fs: 12, h: 22 })), bub: pill(svg, { c, bg: 'var(--surface)' }) };
      if (hp) { S.hp = $('.hp', svg); S.hpT = track(svg, hp); S.hpL = S.hpT.getTotalLength(); S.hp.style.strokeDasharray = `${S.hpL}`; }
      S.gate = kind === 'backdoor' ? g.pcs[0].map((v, i) => lerp(g.sw[i], v, mob ? .5 : .72)) : null;
      return S;
    }
    function frame(S, t) {
      const g = S.g, P = i => g.pcs[i], sw = g.sw, att = g.att;
      const inf = [0, 0, 0, 0, 0, 0], files = [0, 0, 0, 0, 0, 0], more = [0, 0, 0, 0, 0, 0], cpu = [0, 0, 0, 0, 0, 0], safe = [0, 0, 0, 0, 0, 0];
      S.sp.forEach(s => s.hide()); S.bub.hide();
      if (kind === 'virus') {
        files[0] = 1; inf[0] = ramp(t, .6, 1); more[0] = ramp(t, 1.3, 1.8); cpu[0] = ramp(t, 1, 2) * .55;
        if (t > 2 && t < 3.02) S.sp[0].text('game.exe').at(...route([P(0), sw, P(1)], ramp(t, 2, 3)));
        files[1] = ramp(t, 2.9, 3); inf[1] = ramp(t, 3.5, 3.9); cpu[1] = ramp(t, 3.6, 4) * .4;
        if (t > 1.6 && t < 2.3) S.bub.text('แก้และทำลายไฟล์').at(P(0)[0], P(0)[1] - 58, ramp(t, 1.6, 1.8));
      } else if (kind === 'worm') {
        if (t < 1) S.sp[0].text('worm').at(...route([att, sw, P(0)], t), ramp(t, 0, .1));
        inf[0] = ramp(t, .85, 1);
        [[1, 1, 1.5], [2, 1, 1.5]].forEach(([j, a, b], n) => { if (t > a && t < b) S.sp[n].text('worm').at(...route([P(0), sw, P(j)], ramp(t, a, b))); inf[j] = ramp(t, b - .08, b); });
        [[3, 1.5, 2], [4, 1.5, 2], [5, 1.5, 2]].forEach(([j, a, b], n) => { if (t > a && t < b) S.sp[n + 2].text('worm').at(...route([P(n % 2 ? 2 : 1), sw, P(j)], ramp(t, a, b))); inf[j] = ramp(t, b - .08, b); });
        for (let i = 0; i < 6; i++) cpu[i] = inf[i] * (.2 + .8 * ramp(t, 2, 3));
        if (t > 2.6) S.bub.text('ทุกเครื่อง CPU 100%').at(sw[0], S.g.W < 400 ? 338 : sw[1] + 40, ramp(t, 2.6, 2.9));
      } else if (kind === 'trojan') {
        if (t < 1) S.sp[0].text('เกมฟรี').at(...route([att, sw, P(0)], t), ramp(t, 0, .1));
        files[0] = ramp(t, .9, 1); inf[0] = ramp(t, 1.3, 1.8);
        if (t > 1.8) for (let k = 0; k < 2; k++) { const ph = ((t - 1.8) * .9 + k * .5) % 1; if (t > 1.8 + k * .5) S.sp[1 + k].text('ไฟล์ลับ').at(...route([P(0), sw, att], ph)); }
        for (let i = 1; i < 6; i++) safe[i] = ramp(t, 2.6, 3);
      } else {
        const gt = S.gate;
        if (t < 1.4) { const back = ramp(t, 1, 1.4); const [x, y] = route([att, sw, gt], Math.min(1, t)); S.sp[0].text(t > .95 ? 'ไม่มีรหัส' : 'ขอเข้า', t > .95 ? 'var(--c-green)' : 'var(--c-rose)').at(x, y - (t > .95 ? 26 : 0), 1 - back); }
        if (S.hp) { const k = ramp(t, 1.4, 2); S.hp.style.opacity = k > 0 ? 1 : 0; S.hp.style.strokeDashoffset = S.hpL * (1 - k); S.hp.style.strokeDasharray = k >= 1 ? '7 6' : `${S.hpL}`; }
        if (t > 2 && t < 3.05) S.sp[1].text('backdoor', 'var(--c-rose)').at(...at(S.hpT, ramp(t, 2, 3)));
        inf[0] = ramp(t, 2.9, 3.2);
        if (t > 3.1) S.bub.text('อ่าน แก้ ลบได้หมด', 'var(--c-rose)').at(P(0)[0] + (S.g.W < 400 ? 40 : 30), P(0)[1] - 58, ramp(t, 3.1, 3.5));
      }
      S.pcs.forEach((pg, i) => { $('.inf', pg).setAttribute('opacity', inf[i] * .28); $('.files', pg).setAttribute('opacity', files[i]); $('.more', pg).setAttribute('opacity', more[i]); $('.cpu', pg).setAttribute('width', 56 * cpu[i]); $('.safe', pg).setAttribute('opacity', safe[i]); });
    }
    function show() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === kind)));
      $$('tr[data-v]', tbl).forEach(r => r.classList.toggle('off', r.dataset.v !== kind));
      box.innerHTML = '';
      const stage = el('div', { class: 'stage' }); box.append(stage);
      let tv = 0;
      const m = mount(stage, build, S => frame(S, tv));
      Hop.scrub(box, { stops: MAL[kind].map(l => ({ label: l })), speed: 1500, onFrame: t => { tv = t; m.redraw(); } });
    }
    show();
  })();
  Hop.mcq($('#q-mal'), {
    q: 'โปรแกรมหนึ่ง copy ตัวเองจากเครื่องหนึ่งไปทั่วทั้งแล็บผ่านเครือข่ายเอง โดยไม่มีใครเปิดไฟล์ จนทุกเครื่องช้า นี่คืออะไร และกระทบ CIA ข้อไหน',
    opts: ['Worm, Availability', 'Virus, Integrity', 'Trojan horse, Confidentiality', 'Backdoor, ทั้งสามข้อ'], a: 0,
    whyWrong: { 1: 'Virus ไม่ใช่โปรแกรมอิสระ ต้องรอให้คนเปิดไฟล์ host ก่อนจึงทำงาน แต่โจทย์บอกว่าไม่มีใครเปิดไฟล์', 2: 'Trojan แพร่พันธุ์ตัวเองไม่ได้', 3: 'Backdoor เป็นทางลับเข้าระบบ ไม่ได้แพร่ไปเครื่องอื่น' },
    why: 'Worm เป็นโปรแกรมอิสระที่แพร่ตัวเองผ่านช่องโหว่ในเครือข่าย ปกติไม่ทำลายข้อมูลแต่ใช้ resource จนหมด ผู้ใช้จึงใช้งานไม่ได้ = Availability เสีย',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    const ALL = [['sniff', 'Snooping / Sniffing'], ['modify', 'Modification / Man-in-the-Middle'], ['spoof', 'Spoofing'], ['ddos', 'DoS / DDoS'], ['delay', 'Delay'], ['phish', 'Phishing'], ['social', 'Social Engineering'], ['pwguess', 'Password Guessing'], ['virus', 'Virus'], ['worm', 'Worm'], ['trojan', 'Trojan horse'], ['backdoor', 'Backdoor'], ['zeroday', 'Zero-day Attack']];
    const SC = [
      { key: 'sniff', pa: 'Passive', req: ['C'], txt: 'นักศึกษาคนหนึ่งเปิดโปรแกรม packet sniffer ใน Wi-Fi หอพัก แล้วเห็นรหัสผ่านที่เพื่อนพิมพ์ลงในเว็บที่ใช้ HTTP ธรรมดา', ans: 'เป็นการโจมตีแบบ Snooping / Sniffing ซึ่งเป็นแบบ Passive ผู้โจมตีดักอ่านข้อมูลที่วิ่งในเครือข่ายโดยไม่แก้ไข รหัสผ่านรั่วไปถึงคนที่ไม่มีสิทธิ์ Confidentiality จึงเสีย ส่วนเพื่อนยังเข้าเว็บได้ตามปกติและข้อมูลไม่ถูกเปลี่ยน Integrity กับ Availability จึงไม่เสีย', def: 'ใช้ HTTPS (SSL/TLS) เข้ารหัสข้อมูล' },
      { key: 'ddos', pa: 'Active', req: ['A'], txt: 'ช่วงเปิดลงทะเบียน เว็บมหาวิทยาลัยถูกคอมพิวเตอร์หลายพันเครื่องทั่วโลกส่ง request เข้ามาพร้อมกัน จนนักศึกษาเข้าเว็บไม่ได้', ans: 'เป็นการโจมตีแบบ DDoS ซึ่งเป็นแบบ Active เครื่องจำนวนมากเปิดการเชื่อมต่อกับ server พร้อมกันจน server ใช้ resource หมด ผู้ใช้ที่มีสิทธิ์จึงใช้บริการไม่ได้ Availability เสีย ข้อมูลไม่ได้ถูกอ่านหรือแก้', def: 'จำกัดการเชื่อมต่อ, firewall บล็อกต้นทาง, เพิ่มความจุ, ให้ ISP ช่วยกรอง' },
      { key: 'modify', pa: 'Active', req: ['I'], opt: ['C'], txt: 'ผู้โจมตีแทรกตัวอยู่ระหว่างลูกค้ากับร้านค้าออนไลน์ แล้วเปลี่ยนเลขบัญชีที่ให้โอนเงินในข้อความก่อนส่งต่อให้ลูกค้า', ans: 'เป็นการโจมตีแบบ Modification / Man-in-the-Middle ซึ่งเป็นแบบ Active ผู้โจมตีดักข้อความ อ่านและแก้ไขก่อนส่งต่อ ลูกค้าได้ข้อมูลที่ไม่ตรงกับที่ร้านส่ง Integrity จึงเสีย และ Confidentiality เสียด้วยเพราะผู้โจมตีอ่านข้อความได้', def: 'hash / digital signature, ใช้ TLS ที่มี certificate' },
      { key: 'phish', accept: ['spoof', 'social'], pa: 'Active', req: ['C'], txt: 'ได้อีเมลอ้างว่ามาจากฝ่าย IT ของมหาวิทยาลัย ให้กดลิงก์ไปยืนยันรหัสผ่าน หน้าเว็บเหมือนของจริงทุกอย่าง แต่ URL ไม่ใช่โดเมนของมหาวิทยาลัย', ans: 'เป็นการโจมตีแบบ Phishing (ใช้ Spoofing ปลอมเป็นเว็บจริง ร่วมกับการหลอกคน) ซึ่งเป็นแบบ Active ผู้ใช้เชื่อว่าเป็นเว็บจริงจึงกรอกรหัสผ่าน รหัสผ่านตกไปอยู่กับผู้โจมตี Confidentiality จึงเสีย', def: 'ตรวจ URL และ certificate ของ HTTPS, อบรมผู้ใช้' },
      { key: 'social', accept: ['phish'], pa: 'Active', req: ['C'], txt: 'มีคนโทรมาบอกว่าเป็นพนักงานธนาคาร ขอรหัส OTP เพื่อ "ยกเลิกรายการที่ผิดปกติ" ในบัญชี', ans: 'เป็นการโจมตีแบบ Social Engineering ซึ่งเป็นแบบ Active ผู้โจมตีไม่ได้เจาะระบบ แต่หลอกคนให้บอกข้อมูลลับเอง รหัส OTP รั่วไปถึงคนที่ไม่มีสิทธิ์ Confidentiality จึงเสีย', def: 'อบรมพนักงานและผู้ใช้, นโยบายไม่บอกรหัสทางโทรศัพท์' },
      { key: 'worm', pa: 'Active', req: ['A'], txt: 'โปรแกรมหนึ่ง copy ตัวเองจากเครื่องในแล็บไปเครื่องอื่นผ่านช่องโหว่ของ Windows ที่ยังไม่ patch โดยไม่มีใครเปิดไฟล์ จนทุกเครื่องช้าและ network เต็ม', ans: 'เป็น Worm ซึ่งเป็นโปรแกรมอิสระที่แพร่ตัวเองผ่านเครือข่าย (Active) ปกติไม่ทำลายข้อมูลแต่ใช้ CPU และ bandwidth จนหมด ผู้ใช้จึงใช้งานไม่ได้ Availability เสีย', def: 'patch OS, firewall ปิด port ที่ worm ใช้, anti-virus' },
      { key: 'virus', pa: 'Active', req: ['I'], opt: ['A'], txt: 'ไฟล์ Word ที่เพื่อนส่งมามีมาโครแฝงอยู่ พอเปิดไฟล์ ไฟล์เอกสารอื่นในเครื่องถูกแก้และเสียหาย', ans: 'เป็น Virus (Macro virus) ซึ่งไม่ใช่โปรแกรมอิสระ ต้องฝังกับไฟล์ host และทำงานเมื่อไฟล์ถูกเปิด (Active) มันสำเนาตัวเองไปติดไฟล์อื่นและแก้หรือทำลายข้อมูล Integrity จึงเสีย ถ้าเครื่องช้าหรือหยุดทำงาน Availability ก็เสียด้วย', def: 'anti-virus ที่ update, ไม่เปิดไฟล์และมาโครจากแหล่งที่ไม่รู้จัก' },
      { key: 'trojan', pa: 'Active', req: ['C'], txt: 'โหลดเกมฟรีจากเว็บที่ไม่น่าเชื่อถือ เล่นได้ปกติ แต่เบื้องหลังมันแอบส่งไฟล์ในเครื่องออกไปให้คนอื่น และไม่แพร่ไปเครื่องอื่น', ans: 'เป็น Trojan horse คือโค้ดร้ายที่ซ่อนในโปรแกรมที่ดูมีประโยชน์ ผู้ใช้เปิดเองโดยไม่รู้ตัว และแพร่ตัวเองไม่ได้ (Active) มันส่งข้อมูลลับออกไปให้ผู้บุกรุก Confidentiality จึงเสีย', def: 'โหลดจากแหล่งที่เชื่อถือ, anti-virus, personal firewall บล็อกการเชื่อมต่อออก' },
      { key: 'pwguess', pa: 'Active', req: ['C'], opt: ['I', 'A'], txt: 'ผู้โจมตีใช้โปรแกรมลองรหัสผ่านจากคำในพจนานุกรมทีละคำกับบัญชี admin จนเข้าระบบได้', ans: 'เป็นการโจมตีแบบ Password Guessing ซึ่งเป็นแบบ Active ผู้โจมตีได้สิทธิ์ admin ที่ไม่ใช่ของตัวเอง เข้าถึงข้อมูลที่ไม่มีสิทธิ์ Confidentiality จึงเสีย และเมื่อเข้าได้แล้วก็แก้ข้อมูลหรือปิดระบบได้ (I, A)', def: 'รหัสผ่านยาวและซับซ้อน, ล็อกบัญชีเมื่อใส่ผิดหลายครั้ง' },
      { key: 'delay', pa: 'Active', req: ['A'], txt: 'ผู้โจมตีกัก packet คำสั่งซื้อขายหุ้นไว้ แล้วค่อยปล่อยทีหลัง คำสั่งไปถึงช้าเกินเวลาที่ใช้ได้ แต่เนื้อหาไม่ถูกแก้', ans: 'เป็นการโจมตีแบบ Delay ซึ่งเป็นแบบ Active ข้อมูลไม่ได้ถูกอ่านหรือแก้ แต่ไปถึงช้าจนใช้ประโยชน์ไม่ได้ในเวลาที่ต้องการ Availability จึงเสีย', def: 'ใช้เส้นทางและอุปกรณ์ที่เชื่อถือได้, ตรวจเวลาของข้อมูล' },
      { key: 'backdoor', pa: 'Active', req: ['C'], opt: ['I', 'A'], txt: 'ผู้พัฒนาระบบแอบเขียนบัญชีพิเศษที่ login ได้โดยไม่ผ่านการตรวจสอบรหัส ไว้ใช้ภายหลัง', ans: 'เป็น Backdoor คือทางลับที่ผู้ออกแบบสร้างไว้เพื่อข้ามระบบความปลอดภัย (Active เมื่อถูกใช้) ผู้ที่รู้ทางนี้เข้าระบบได้โดยไม่ต้องพิสูจน์ตัวตน จึงอ่านข้อมูลได้ (C เสีย) และแก้หรือปิดระบบได้ด้วย (I, A)', def: 'ตรวจโค้ด (code review), ลบบัญชีพิเศษ, patch' },
      { key: 'zeroday', pa: 'Active', req: ['C'], opt: ['I', 'A'], txt: 'ผู้โจมตีใช้ช่องโหว่ใหม่ใน browser ที่บริษัทผู้ผลิตยังไม่รู้และยังไม่มี patch ฝังโปรแกรมขโมยข้อมูลลงเครื่องผู้ใช้', ans: 'เป็น Zero-day Attack ซึ่งเป็นแบบ Active ใช้ช่องโหว่ที่ยังไม่มี patch ในกรณีนี้ขโมยข้อมูล Confidentiality จึงเสีย (zero-day กระทบข้อไหนขึ้นกับว่าผู้โจมตีทำอะไรต่อ)', def: 'ป้องกันหลายชั้น (firewall หลายแบบ, IDS), patch ทันทีที่ออก' },
    ];
    const POOL = [...Object.keys(ATK).map(k => ({ pic: k })), ...SC];
    let last = -1;
    function render() {
      let i; do i = Math.floor(Math.random() * POOL.length); while (i === last); last = i;
      const item = POOL[i];
      const d = item.pic ? { ...ATK[item.pic], key: item.pic } : { ...item, name: ALL.find(a => a[0] === item.key)[1], opt: item.opt || [] };
      host.innerHTML = '';
      host.append(el('h3', { text: 'โจทย์' }), el('p', { class: 'prompt', text: item.pic ? 'จากรูป จงบอกว่าเป็นการโจมตีแบบใด เป็นแบบ Passive หรือ Active และกระทบ CIA ข้อใด พร้อมอธิบาย' : 'จากสถานการณ์ จงบอกว่าเป็นการโจมตีแบบใด เป็นแบบ Passive หรือ Active และกระทบ CIA ข้อใด พร้อมอธิบาย' }));
      if (item.pic) { const pb = el('div', { class: 'stage-wrap' }); host.append(pb); picture(pb, item.pic); }
      else host.append(el('div', { class: 'scen', text: item.txt }));
      const names = Hop.shuffle([ALL.find(a => a[0] === d.key), ...Hop.shuffle(ALL.filter(a => a[0] !== d.key)).slice(0, 5)]);
      const pk = el('div'); host.append(pk);
      const P = picker(pk, names);
      const ta = el('textarea', { class: 'field', rows: 4, placeholder: 'ลองเขียนคำอธิบายเอง เช่น เป็นการโจมตีแบบ... ทำให้ ... เสีย เพราะ...' });
      pk.append(el('div', { class: 'lbl2', style: 'margin-top:16px', text: 'คำอธิบายของคุณ (ไม่ตรวจ ใช้เทียบกับคำตอบตัวอย่าง)' }), ta);
      const score = el('span', { class: 'score' }), work = el('div');
      host.append(el('div', { class: 'bar2' },
        el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: () => { const r = P.mark(d, item.accept || []); score.textContent = `ถูก ${[r.okName, r.okPa, r.okCia].filter(Boolean).length}/3 ส่วน`; } }),
        el('button', { class: 'btn', html: `${icon('eye')} ดูคำตอบตัวอย่าง`, onclick: () => Hop.work(work, [
          { note: true, t: 'ที่ควรเขียนในกระดาษคำตอบ:' },
          { t: `ชื่อการโจมตี: ${d.name}` }, { t: `ประเภท: ${d.pa}` },
          { t: `CIA ที่เสีย: ${d.req.map(k => CNAME[k]).join(', ')}${d.opt && d.opt.length ? ` (และ ${d.opt.map(k => CNAME[k]).join(', ')})` : ''}` },
          ...(d.read ? [{ note: true, t: 'อ่านรูป: ' + d.read }] : []),
          { t: d.ans }, { note: true, t: 'ป้องกัน: ' + d.def }]) }),
        el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render }), score), work);
    }
    render();
  })();
})();
