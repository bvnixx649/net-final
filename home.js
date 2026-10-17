// Home: the whole exam as one network. Zones map to chapters.
(() => {
  const { $, $$, el, esc, icon, dev } = Hop;
  Hop.page(0);
  const ZONES = {
    ip: { name: 'VLSM', cls: 'z-ip', ch: [1], say: 'แผนกแต่ละแผนกต้องได้วง IP ของตัวเอง ข้อนี้คือข้อคำนวณข้อเดียวของข้อสอบ' },
    rt: { name: 'Routing', cls: 'z-rt', ch: [2, 3, 4, 5], say: 'router หาทางส่ง packet ข้ามวง แต่ละ protocol เลือกทางด้วย metric ต่างกัน' },
    sec: { name: 'Security', cls: 'z-sec', ch: [6, 7], say: 'คนร้ายจากข้างนอกกับ firewall/ACL ที่กั้นไว้' },
    pr: { name: 'Protocols', cls: 'z-pr', ch: [8], say: 'การเข้ารหัสระหว่างทาง (HTTPS, VPN, IPSec) และ NAT' },
  };
  const FOCUS = {
    1: 'ให้ IP หนึ่งก้อนกับรายชื่อแผนก ตอบ network, prefix, ช่วง IP และ broadcast ของทุกแผนก แสดงวิธีคิดเป็นเลขฐานสอง',
    2: 'decision flow ของ packet, ถ้ามีหลาย protocol บน router เดียว packet ใช้เส้นไหน (ดู AD), metric ของแต่ละ protocol',
    3: 'อธิบายว่า RIP ทำงานยังไง นับ hop จากรูป บอกเส้นทางที่ดีที่สุด และการอัปเดต routing table',
    4: 'ข้อคำนวณจากรูป: หา successor, feasible successor และ FD จาก 3 เส้นทางขึ้นไป',
    5: 'ขั้นตอนการทำงาน ข้อดี และความต่างจาก RIP กับ EIGRP',
    6: 'ดูรูปแล้วบอกว่าเป็น attack แบบไหน และกระทบ C, I หรือ A อย่างไร',
    7: 'ประเภทของ firewall และเขียนคำสั่ง ACL เพื่อบล็อก traffic ตามรูป',
    8: 'ข้อดีข้อเสียของ security protocol แต่ละตัวใน OSI และ NAT',
  };
  const zoneOf = n => Object.keys(ZONES).find(k => ZONES[k].ch.includes(n));

  // two hand-placed layouts so labels stay readable on phones
  const L = {
    wide: { vb: [960, 460], hull: { ip: [16, 30, 230, 410], rt: [270, 50, 310, 370], sec: [612, 50, 332, 230], pr: [740, 300, 204, 140] },
      n: { pa1: [60, 88], pa2: [60, 150], sa: [170, 119], pb1: [60, 230], pb2: [60, 300], sb: [170, 265], pc1: [60, 380], sc: [170, 380],
           r1: [330, 230], r2: [500, 120], r3: [500, 340], fw: [670, 170], cl: [800, 170], at: [890, 90], sv: [880, 380] }, lab: 15 },
    narrow: { vb: [360, 640], hull: { ip: [8, 10, 344, 168], rt: [8, 192, 344, 210], sec: [8, 416, 210, 214], pr: [226, 416, 126, 214] },
      n: { pa1: [40, 62], pa2: [90, 62], sa: [65, 135], pb1: [155, 62], pb2: [205, 62], sb: [180, 135], pc1: [295, 62], sc: [295, 135],
           r1: [180, 250], r2: [85, 350], r3: [275, 350], fw: [112, 470], cl: [112, 560], at: [40, 560], sv: [290, 560] }, lab: 14 },
  };
  const world = $('#world');
  let lay = null, picked = null, raf = 0;

  function draw() {
    const k = world.clientWidth < 620 ? 'narrow' : 'wide';
    if (k === lay) return; lay = k;
    const { vb, hull, n, lab } = L[k];
    const link = (a, b) => `<line class="link" x1="${n[a][0]}" y1="${n[a][1]}" x2="${n[b][0]}" y2="${n[b][1]}"/>`;
    const links = [['pa1', 'sa'], ['pa2', 'sa'], ['pb1', 'sb'], ['pb2', 'sb'], ['pc1', 'sc'], ['sa', 'r1'], ['sb', 'r1'], ['sc', 'r1'], ['r1', 'r2'], ['r1', 'r3'], ['r2', 'r3'], ['r2', 'fw'], ['r3', 'fw'], ['fw', 'cl'], ['cl', 'at'], ['cl', 'sv']].map(([a, b]) => link(a, b)).join('');
    const zone = (z, inner) => { const [x, y, w, h] = hull[z]; return `<g class="zone ${ZONES[z].cls}" data-z="${z}" tabindex="0" role="button" aria-label="${ZONES[z].name}"><rect class="hull" x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/><text class="zl" x="${x + 16}" y="${y + 24}" style="font-size:${lab}px">${ZONES[z].name}</text>${inner}</g>`; };
    const D = (t, id, o = {}) => `<g class="dev">${dev(t, n[id][0], n[id][1], o)}</g>`;
    const lockAt = [(n.cl[0] + n.sv[0]) / 2, (n.cl[1] + n.sv[1]) / 2];
    const lock = `<g transform="translate(${lockAt[0]} ${lockAt[1]})" class="dev"><rect x="-11" y="-6" width="22" height="17" rx="4" fill="var(--c-teal)"/><path d="M-6 -6v-4a6 6 0 0 1 12 0v4" fill="none" stroke="var(--c-teal)" stroke-width="2.6"/></g>`;
    world.innerHTML = `<svg viewBox="0 0 ${vb[0]} ${vb[1]}" role="img" aria-label="แผนที่เครือข่ายของทั้งวิชา">
      ${links}
      ${zone('ip', D('pc', 'pa1', { s: .85 }) + D('pc', 'pa2', { s: .85 }) + D('switch', 'sa', { s: .9 }) + D('pc', 'pb1', { s: .85 }) + D('pc', 'pb2', { s: .85 }) + D('switch', 'sb', { s: .9 }) + D('pc', 'pc1', { s: .85 }) + D('switch', 'sc', { s: .9 }))}
      ${zone('rt', D('router', 'r1', { c: 'var(--c-blue)', label: 'R1' }) + D('router', 'r2', { c: 'var(--c-blue)', label: 'R2' }) + D('router', 'r3', { c: 'var(--c-blue)', label: 'R3' }))}
      ${zone('sec', D('firewall', 'fw') + D('cloud', 'cl') + D('attacker', 'at'))}
      ${zone('pr', D('server', 'sv', { c: 'var(--c-teal)' }) + lock)}
      <circle id="pkt" r="7" fill="var(--accent)"/><circle id="bad" r="6" fill="var(--c-rose)"/>
    </svg>`;
    $$('.zone', world).forEach(g => {
      g.addEventListener('click', e => { e.stopPropagation(); pick(g.dataset.z === picked ? null : g.dataset.z); });
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.z === picked ? null : g.dataset.z); } });
    });
    pick(picked, true);
    animate();
  }

  // a packet travels from a PC to the server; an attacker's packet dies at the firewall
  function animate() {
    cancelAnimationFrame(raf);
    const { n } = L[lay];
    const route = ['pa1', 'sa', 'r1', 'r2', 'fw', 'cl', 'sv'].map(k => n[k]);
    const bad = ['at', 'cl', 'fw'].map(k => n[k]);
    const seglen = pts => pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const along = (pts, lens, d) => { for (let i = 0; i < lens.length; i++) { if (d <= lens[i]) { const f = d / lens[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; } d -= lens[i]; } return pts[pts.length - 1]; };
    const L1 = seglen(route), T1 = L1.reduce((a, b) => a + b), L2 = seglen(bad), T2 = L2.reduce((a, b) => a + b);
    const pkt = $('#pkt', world), b = $('#bad', world);
    const t0 = performance.now();
    const tick = now => {
      const t = (now - t0) / 1000;
      const p1 = (t % 5) / 4; // 4 s trip, 1 s rest
      const q = p1 <= 1 ? along(route, L1, Hop.easeIO(Math.min(1, p1)) * T1) : route[route.length - 1];
      pkt.setAttribute('cx', q[0]); pkt.setAttribute('cy', q[1]); pkt.setAttribute('opacity', p1 <= 1 ? 1 : 0);
      const p2 = ((t + 2.2) % 5) / 2.4;
      const r = along(bad, L2, Hop.ease(Math.min(1, p2)) * T2);
      b.setAttribute('cx', r[0]); b.setAttribute('cy', r[1]); b.setAttribute('opacity', p2 < .85 ? 1 : p2 < 1.2 ? Math.max(0, 1 - (p2 - .85) / .35) : 0);
      b.setAttribute('r', p2 > .9 && p2 < 1.2 ? 6 + (p2 - .9) * 30 : 6);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // chapter list grouped by zone
  const chaps = $('#chaps');
  Object.entries(ZONES).forEach(([z, Z]) => {
    chaps.append(el('div', { class: 'grouphead', text: Z.name }));
    Z.ch.forEach(n => {
      const c = Hop.CHAPTERS.find(x => x.n === n);
      chaps.append(el('a', { class: 'ch ' + Z.cls, href: c.href, 'data-z': z, html: `<span class="n">${n}</span><span><div class="t">${esc(c.t)}</div><div class="s">${esc(FOCUS[n])}</div></span>${icon('chev')}` }));
    });
  });

  function pick(z, silent) {
    picked = z;
    world.classList.toggle('picked', !!z); chaps.classList.toggle('picked', !!z);
    $$('.zone', world).forEach(g => g.classList.toggle('on', g.dataset.z === z));
    $$('.ch', chaps).forEach(a => a.classList.toggle('on', a.dataset.z === z));
    $('#hint').textContent = z ? ZONES[z].say : 'แตะกลุ่มอุปกรณ์ในภาพ';
    if (z && !silent && innerWidth < 900) { const first = $(`.ch[data-z="${z}"]`, chaps); setTimeout(() => first.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120); }
  }
  world.addEventListener('click', () => pick(null));
  draw();
  addEventListener('resize', draw);
})();
