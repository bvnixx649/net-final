// Chapter 8: OSI layers vs security protocols (slide p.20), HTTPS, SSL handshake, VPN, IPSec modes, pros/cons, NAT.
(() => {
  const { $, $$, el, esc, clamp, lerp, ease, icon } = Hop;
  const { svgRoot, add, cloud, track, at, route, pill, lbl, ramp, mount } = SecKit;
  Hop.page(8);

  /* ---------- protocol facts (layer, protection, pros/cons). s: true = written on the slide ---------- */
  const P = {
    https: { n: 'HTTPS', k: 'https', ly: 'ชั้น 7–6 Application', pr: 'เข้ารหัสข้อมูลเว็บระหว่าง browser กับ web server, พิสูจน์ตัว server ด้วย certificate (C, I, Authentication)',
      pros: [['เข้ารหัสข้อมูลที่รับส่งระหว่าง web server กับ browser', 1], ['certificate ที่ CA รับรอง พิสูจน์ว่าเป็น server จริง กันเว็บปลอม', 0], ['ผู้ใช้ไม่ต้องตั้งค่าอะไร แค่เข้าเว็บที่เป็น https://', 0], ['ตรวจได้ว่าข้อมูลถูกแก้ระหว่างทาง', 0]],
      cons: [['web server ต้องติดตั้ง certificate ที่ CA รับรอง (ค่าใช้จ่าย, ต่ออายุ)', 1], ['ปกป้องเฉพาะ traffic เว็บ application อื่นไม่ได้ผลด้วย', 0], ['IP และ port ยังมองเห็น รู้ว่าเครื่องไหนคุยกับเว็บไหน', 0], ['ไม่ช่วยเรื่อง DoS หรือ malware บน server', 0]] },
    app: { n: 'SSH / PGP / S/MIME', k: 'ssh', ly: 'ชั้น 7–6 Application', pr: 'SSH: remote login แบบเข้ารหัส, PGP และ S/MIME: เข้ารหัสและเซ็นอีเมล',
      pros: [['ปกป้องถึงระดับตัวข้อความของ application นั้น (end-to-end)', 0], ['SSH ใช้แทน Telnet ที่ส่ง username และ password เป็นข้อความธรรมดา', 1]],
      cons: [['แต่ละ application ต้องรองรับเอง ปกป้อง app อื่นไม่ได้', 0], ['ต้องจัดการ key หรือ certificate ของผู้ใช้แต่ละคน', 0]] },
    ssl: { n: 'SSL / TLS', k: 'ssl', ly: 'ชั้น 5–4 (ระหว่าง Transport กับ Application)', pr: 'Authentication, Confidentiality, Integrity ระหว่าง client กับ server',
      pros: [['ให้ครบทั้ง Authentication, Confidentiality และ Integrity', 1], ['application ใดก็ได้ที่ใช้ TCP เรียกใช้ได้ เช่น HTTP, IMAP, POP3, FTP', 1], ['ข้อมูลจริงเข้ารหัสด้วย symmetric key จึงเร็ว', 1], ['ไม่ต้องมีอุปกรณ์เครือข่ายพิเศษ', 0]],
      cons: [['ใช้ได้เฉพาะ application ที่ใช้ TCP', 0], ['IP header และ TCP header ไม่ถูกเข้ารหัส', 0], ['server ต้องมี certificate และต้อง handshake ก่อนทุก session', 0], ['SSL รุ่นเก่ามีช่องโหว่ ต้องใช้ TLS', 0]] },
    ipt: { n: 'IPSec transport mode', k: 'transport', ly: 'ชั้น 3 Network', pr: 'C, I, Authentication ของข้อมูลชั้น Transport ระหว่างสอง host',
      pros: [['ปกป้องทุก application บนเครื่อง โดย application ไม่ต้องรู้ตัว', 0], ['packet เล็กกว่า tunnel mode เพราะไม่มี IP header ใหม่', 0]],
      cons: [['header ไม่ถูกเข้ารหัส วิเคราะห์การไหลของข้อมูลได้ว่าสองโหนดไหนคุยกัน', 1], ['ทั้งสอง host ต้องติดตั้งและตั้งค่า IPSec เอง', 1]] },
    ipn: { n: 'IPSec tunneling mode', k: 'tunnelmode', ly: 'ชั้น 3 Network', pr: 'C, I, Authentication ของ IP packet ทั้งก้อน ระหว่าง gateway กับ gateway',
      pros: [['host ไม่ต้องตั้งค่าอะไรเพิ่มก็ใช้ IPSec ได้', 1], ['ป้องกันการวิเคราะห์การไหลของข้อมูล', 1], ['เข้ารหัสทั้ง packet รวม IP header เดิม', 1]],
      cons: [['เพิ่ม IP header ใหม่และ IPSec header/trailer packet ใหญ่ขึ้น (overhead)', 0], ['ต้องมีและตั้งค่า gateway ทั้งสองฝั่ง', 0], ['ปกป้องแค่ช่วง gateway ถึง gateway ใน LAN ยังไม่เข้ารหัส', 0]] },
    vpn: { n: 'VPN', k: 'vpn', ly: 'ชั้น 3 (IPSec) หรือชั้น 2 (PPTP, L2F, L2TP)', pr: 'traffic ทั้งหมดระหว่างผู้ใช้หรือสาขากับเครือข่ายองค์กร ผ่าน Internet',
      pros: [['ข้อมูลที่สื่อสารถูกเข้ารหัส', 1], ['ผู้ใช้เห็นเหมือนต่อตรงจุดต่อจุดเข้าเครือข่ายภายใน', 1], ['เชื่อมสำนักงานใหญ่กับสาขาหรือคู่ค้าผ่าน Internet ได้อย่างปลอดภัย', 1], ['ถูกกว่าการเช่าสายส่วนตัว (leased line)', 0]],
      cons: [['การเข้ารหัสและห่อ packet ทำให้ช้าลง', 0], ['ต้องตั้ง VPN gateway หรือ client และจัดการ key', 0], ['ความเร็วและความพร้อมใช้ขึ้นกับคุณภาพ Internet', 0], ['ถ้าเครื่องที่ต่อเข้ามาติด malware ผู้โจมตีก็เข้าถึงเครือข่ายภายในได้', 0]] },
    l2: { n: 'PPTP / L2F / L2TP', k: 'l2tp', ly: 'ชั้น 2 Data Link', pr: 'ทำอุโมงค์ห่อ frame ชั้น 2 สำหรับ VPN',
      pros: [['ทำ remote access ได้ง่าย OS ส่วนใหญ่มีให้ในตัว', 0], ['ขนส่ง protocol ที่ไม่ใช่ IP ได้', 0]],
      cons: [['L2F และ L2TP ไม่เข้ารหัสในตัว ต้องใช้คู่กับ IPSec', 0], ['การเข้ารหัสของ PPTP ถือว่าอ่อนแล้ว', 0]] },
  };
  const LAYER = { https: 'app', ssh: 'app', pgp: 'app', smime: 'app', ssl: 'tl', tls: 'tl', ipsec: 'net', pptp: 'dl', l2f: 'dl', l2tp: 'dl' };

  /* ---------- packet anatomy (what each protocol encrypts) ---------- */
  const S = (t, c = '', f = 1) => [t, c, f];
  const BARS = {
    https: { bars: [['HTTP ผ่าน SSL/TLS', [S('IP header', '', 1.1), S('TCP :443', '', 1), S('ข้อมูล HTTP (เข้ารหัส)', 'enc', 2.6)]]], seen: 'คนกลางเห็น <b>IP ต้นทาง ปลายทาง และ port 443</b> รู้ว่าเครื่องไหนคุยกับเว็บไหน แต่อ่านเนื้อหาไม่ได้' },
    ssh: { bars: [['SSH', [S('IP header', '', 1.1), S('TCP :22', '', 1), S('คำสั่งและรหัสผ่าน (เข้ารหัส)', 'enc', 2.6)]]], seen: 'คนกลางเห็น <b>IP และ port 22</b> แต่อ่านคำสั่งและรหัสผ่านไม่ได้ ต่างจาก Telnet ที่อ่านได้หมด' },
    pgp: { bars: [['อีเมลที่เข้ารหัสด้วย PGP', [S('IP header', '', 1.1), S('TCP :25', '', 1), S('หัวอีเมล', '', 1), S('เนื้อความอีเมล (เข้ารหัส)', 'enc', 2)]]], seen: 'คนกลางเห็น <b>IP, port และหัวอีเมล (ผู้ส่ง ผู้รับ)</b> อ่านได้แค่เนื้อความไม่ได้ ข้อความยังเข้ารหัสอยู่แม้ถูกเก็บไว้ใน mail server' },
    smime: null, tls: null,
    ssl: { bars: [['application ใดก็ได้ที่ใช้ TCP', [S('IP header', '', 1.1), S('TCP header', '', 1), S('ข้อมูล app: HTTP, IMAP, POP3, FTP (เข้ารหัส)', 'enc', 2.6)]]], seen: 'SSL/TLS เข้ารหัสแค่ข้อมูลของ application คนกลางยังเห็น <b>IP header และ TCP header</b>' },
    ipsec: { bars: [['Transport mode', [S('IP header เดิม', '', 1.1), S('IPSec header', 'add', 1), S('TCP + ข้อมูล (เข้ารหัส)', 'enc', 2), S('trailer', 'add', .8)]], ['Tunneling mode', [S('IP header ใหม่', '', 1.1), S('IPSec header', 'add', 1), S('IP header เดิม + TCP + ข้อมูล (เข้ารหัส)', 'enc', 2.6), S('trailer', 'add', .8)]]], seen: 'ทุก application บนเครื่องถูกปกป้องพร้อมกัน transport mode ยังเห็น <b>IP header เดิม</b> ส่วน tunnel mode เห็นแค่ <b>IP ของ gateway</b>' },
    pptp: { bars: [['L2TP / L2F / PPTP', [S('IP header ใหม่', '', 1.1), S('tunnel header', 'add', 1), S('PPP frame: IP + TCP + ข้อมูล', 'wrapd', 2.6)]]], seen: 'ชั้น 2 แค่ห่อ frame ไว้ในอุโมงค์ L2F และ L2TP <b>ไม่เข้ารหัสในตัว</b> (จึงใช้ L2TP คู่กับ IPSec) ส่วน PPTP เข้ารหัสได้แต่ถือว่าอ่อน' },
  };
  BARS.smime = { ...BARS.pgp, bars: [['อีเมลที่เข้ารหัสด้วย S/MIME', BARS.pgp.bars[0][1]]] }; BARS.tls = BARS.ssl; BARS.l2f = BARS.pptp; BARS.l2tp = BARS.pptp;
  const bar = segs => el('div', { class: 'pbar' }, segs.map(([t, c, f]) => el('div', { class: 'sg ' + c, style: `flex:${f} 1 0`, text: t })));

  /* ---------- map hero: the p.20 table ---------- */
  (() => {
    const host = $('#map');
    const ch = (k, l, star) => `<button class="pchip${star ? ' star' : ''}" data-p="${k}" data-k="${k}">${l}</button>`;
    const tb = el('table', { class: 'osit' });
    tb.innerHTML = `<colgroup><col style="width:9%"><col style="width:23%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
      <thead><tr><th colspan="2">OSI Reference Model</th><th colspan="2">TCP/IP</th><th colspan="2">Security Protocol</th></tr></thead>
      <tbody>
      <tr data-l="app"><td class="n">7</td><td class="ly">Application</td><td class="tcp" colspan="2" rowspan="2">FTP, Telnet, HTTP, SMTP, SNMP, DNS, etc.</td><td class="sp" colspan="2" rowspan="2" data-l="app">${ch('https', 'HTTPS', 1)}${ch('ssh', 'SSH')}${ch('pgp', 'PGP')}${ch('smime', 'S/MIME')}</td></tr>
      <tr data-l="app"><td class="n">6</td><td class="ly">Presentation</td></tr>
      <tr data-l="tl"><td class="n">5</td><td class="ly">Session</td><td class="tcp" rowspan="2">TCP</td><td class="tcp" rowspan="2">UDP</td><td class="sp" rowspan="2" data-l="tl">${ch('ssl', 'SSL', 1)}</td><td class="sp" rowspan="2" data-l="tl">${ch('tls', 'TLS')}</td></tr>
      <tr data-l="tl"><td class="n">4</td><td class="ly">Transport</td></tr>
      <tr data-l="net"><td class="n">3</td><td class="ly">Network</td><td class="tcp">ICMP, IGMP<br>IP</td><td class="tcp">ARP, RARP</td><td class="sp" colspan="2" data-l="net">${ch('ipsec', 'IPSec', 1)}</td></tr>
      <tr data-l="dl"><td class="n">2</td><td class="ly">Data Link</td><td class="tcp" colspan="2" rowspan="2">Not Specified</td><td class="sp" colspan="2" data-l="dl">${ch('pptp', 'PPTP')}${ch('l2f', 'L2F')}${ch('l2tp', 'L2TP')}</td></tr>
      <tr data-l="ph"><td class="n">1</td><td class="ly">Physical</td><td class="empty" colspan="2"></td></tr>
      </tbody>`;
    host.append(tb);
    const pk = el('div', { class: 'pk' }); host.append(pk);
    host.append(el('div', { class: 'pk-legend', html: '<span><i style="background:var(--surface-2)"></i>คนกลางอ่านได้</span><span><i style="background:var(--c-green-s);box-shadow:inset 0 0 0 1.5px var(--c-green)"></i>เข้ารหัสแล้ว</span><span><i style="background:var(--c-teal-s)"></i>ส่วนที่ protocol เพิ่มเข้าไป</span>' }));
    const say = el('p', { class: 'say', html: 'ชื่อสีแดงคือตัวที่สไลด์เน้น (HTTPS, SSL, IPSec) แตะชื่อ protocol เพื่อดูว่ามันอยู่ชั้นไหน และเข้ารหัสส่วนไหนของ packet' });
    host.append(say);
    function pick(k) {
      $$('.pchip', tb).forEach(b => b.classList.toggle('on', b.dataset.p === k));
      const L = LAYER[k];
      $$('tr', tb).forEach(r => r.classList.toggle('on', r.dataset.l === L));
      $$('td.sp', tb).forEach(c => c.classList.toggle('on', c.dataset.l === L));
      const B = BARS[k];
      pk.replaceChildren(...B.bars.flatMap(([l, segs]) => [el('div', { class: 'pl', text: l }), bar(segs)]), el('div', { class: 'seenline', html: B.seen }));
    }
    tb.addEventListener('click', e => { const b = e.target.closest('.pchip'); if (b) pick(b.dataset.p); });
    pick('https');
  })();

  /* ---------- 1. HTTP vs HTTPS with a sniffer ---------- */
  Hop.eq($('#eq-https'), [['https', 'HTTPS'], ' = ', ['http', 'HTTP'], ' + ', ['ssl', 'SSL/TLS']], { sym: { https: 'HTTPS', http: 'HTTP', ssl: 'SSL/TLS' } });
  (() => {
    const host = $('#fig-https');
    let mode = 'http', p0 = 0, Sc;
    const seg = el('div', { class: 'seg', role: 'group' });
    [['http', 'HTTP (port 80)'], ['https', 'HTTPS (port 443)']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === mode), 'data-v': k, text: l, onclick: () => { mode = k; run(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg, el('button', { class: 'btn small ghost replay', html: `${icon('replay')} เล่นใหม่`, onclick: () => run() })));
    const stage = el('div', { class: 'stage' }); host.append(stage);
    const say = el('p', { class: 'say' }); host.append(say);
    const SAY = {
      http: 'HTTP ส่งเป็นข้อความธรรมดา คนที่ดักอยู่กลางทางอ่านรหัสผ่านได้ทันที <b style="color:var(--c-blue)">Confidentiality เสีย</b>',
      https: 'HTTPS เข้ารหัสด้วย SSL/TLS คนกลางยังดักได้ แต่เห็นแค่ข้อมูลที่อ่านไม่ออก และ <b style="color:var(--c-teal)">certificate</b> ทำให้ browser มั่นใจว่าคุยกับ server ตัวจริง',
    };
    function build(st, mob) {
      const g = mob ? { W: 360, H: 300, b: [40, 222], s: [320, 222], d: [180, 52], cl: [180, 226, 150, 60] } : { W: 760, H: 300, b: [90, 222], s: [670, 222], d: [380, 52], cl: [380, 226, 230, 74] };
      const svg = svgRoot(g.W, g.H), [bx, by] = g.b, [sx, sy] = g.s, [dx, dy] = g.d;
      const main = `M${bx + 27} ${by} L${sx - 27} ${sy}`, br = `M${g.cl[0]} ${by} L${dx} ${dy + 31}`;
      let h = cloud(...g.cl, 'Internet');
      h += `<path d="${main}" fill="none" stroke="var(--ink)" stroke-width="2.4" marker-end="${svg.mk('ink')}"/><path d="${br}" fill="none" stroke="var(--ink)" stroke-width="2.4" marker-end="${svg.mk('ink')}"/>`;
      h += Hop.dev('pc', bx, by, { label: 'Browser' }) + Hop.dev('server', sx, sy, { label: 'Web server' });
      h += Hop.dev('attacker', dx, dy) + lbl(dx + 30, dy + 5, 'Darth', { c: 'var(--c-rose)', anchor: 'start' });
      add(svg, h); st.replaceChildren(svg);
      return (Sc = { svg, g, main: track(svg, main), br: track(svg, br), p: pill(svg), c: pill(svg, { c: 'var(--c-rose)' }), bD: pill(svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' }), port: pill(svg, { bg: 'var(--surface)', fs: 12, h: 22 }), cert: pill(svg, { c: 'var(--c-teal)', bg: 'var(--c-teal-s)', fs: 12, h: 22 }) });
    }
    function frame(p) {
      if (!Sc) return;
      const s = mode === 'https', [dx, dy] = Sc.g.d, [sx, sy] = Sc.g.s;
      const txt = s ? '9f#Lq2!x7@' : 'pass=1234';
      Sc.p.text(txt, s ? 'var(--c-green)' : 'var(--ink)').at(...at(Sc.main, ease(ramp(p, 0, .75))), 1 - ramp(p, .85, .95));
      const k = ramp(p, .3, .6); if (k > 0) Sc.c.text(txt).at(...at(Sc.br, ease(k))); else Sc.c.hide();
      Sc.bD.text(s ? 'อ่านไม่ออก' : 'อ่านได้: pass=1234').at(dx - 34, dy, ramp(p, .6, .7));
      Sc.port.text(s ? 'port 443' : 'port 80').at(sx, sy - 44, 1);
      if (s) Sc.cert.text('certificate').at(sx, sy - 72, 1); else Sc.cert.hide();
    }
    function run() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
      say.innerHTML = SAY[mode]; p0 = performance.now();
      const tick = now => { const p = clamp((now - p0) / 2800, 0, 1); frame(p); if (p < 1 && run.cur === tick) requestAnimationFrame(tick); };
      run.cur = tick; requestAnimationFrame(tick);
    }
    mount(stage, build, () => frame(1));
    say.innerHTML = SAY[mode];
    Hop.onView(host, run);
  })();
  Hop.mcq($('#q-https'), {
    q: 'HTTPS ใช้ port อะไร และอยู่ชั้นไหนในตาราง OSI ของสไลด์',
    opts: ['443, ชั้น Application', '80, ชั้น Application', '443, ชั้น Transport', '22, ชั้น Network'], a: 0,
    whyWrong: { 1: '80 คือ port ของ HTTP ธรรมดา', 2: 'ชั้น 5–4 ในตารางคือ SSL/TLS ส่วน HTTPS อยู่ช่องบนสุดคู่กับ SSH, PGP, S/MIME', 3: '22 คือ SSH และชั้น Network คือ IPSec' },
    why: 'HTTPS = HTTP + SSL/TLS ใช้ port 443 ตารางในสไลด์วาง HTTPS ไว้ที่ชั้น 7–6 (Application/Presentation)',
  });

  /* ---------- 2. SSL handshake sequence ---------- */
  (() => {
    const host = $('#fig-tls');
    const stage = el('div', { class: 'stage' }); host.append(stage);
    let tv = 0;
    const STOPS = ['Client: Hello ขอเริ่ม SSL session', 'Server: Hello พร้อมส่ง certificate (มี public key)', 'Client ถาม CA ว่า certificate ใช้ได้ไหม', 'Client ส่ง session key ที่ล็อกด้วย public key ของ server', 'Server ถอดด้วย private key ได้ session key', 'ส่งข้อมูลเข้ารหัสด้วย session key ทั้งสองทาง'];
    function build(st, mob) {
      const W = mob ? 360 : 760, H = 450, cx = mob ? 46 : 130, sx = W - (mob ? 46 : 130), ys = [128, 188, 246, 306, 352, 408];
      const svg = svgRoot(W, H);
      let h = `<line x1="${cx}" y1="86" x2="${cx}" y2="${H - 12}" stroke="var(--line-2)" stroke-width="2" stroke-dasharray="3 5"/><line x1="${sx}" y1="86" x2="${sx}" y2="${H - 12}" stroke="var(--line-2)" stroke-width="2" stroke-dasharray="3 5"/>`;
      h += Hop.dev('pc', cx, 38, { label: 'Customer' }) + Hop.dev('server', sx, 38, { label: 'Server' });
      const ar = [[cx, sx, ys[0], 'Hello, ขอเริ่ม SSL session', 'ink'], [sx, cx, ys[1], 'Hello, นี่คือ certificate ของฉัน', 'teal'], null, [cx, sx, ys[3], 'session key ล็อกด้วย public key', 'green'], null, null];
      ar.forEach((a, i) => { if (!a) return; const [x1, x2, y, t, c] = a, d = x2 > x1 ? 1 : -1; h += `<g class="m m${i}"><path d="M${x1 + d * 4} ${y} L${x2 - d * 6} ${y}" stroke="var(--${c === 'ink' ? 'ink' : 'c-' + c})" stroke-width="2.4" fill="none" marker-end="${svg.mk(c)}"/>${lbl((x1 + x2) / 2, y - 12, t, { c: c === 'ink' ? '' : `var(--c-${c})`, cls: 'lb' })}</g>`; });
      const caX = mob ? cx + 104 : cx + 190;
      h += `<g class="m m2"><rect x="${caX - 22}" y="${ys[2] - 17}" width="44" height="34" rx="9" fill="var(--c-teal-s)" stroke="var(--c-teal)" stroke-width="2"/>${lbl(caX, ys[2] + 5, 'CA', { c: 'var(--c-teal)' })}<path d="M${cx + 6} ${ys[2]} L${caX - 26} ${ys[2]}" stroke="var(--c-teal)" stroke-width="2" stroke-dasharray="5 5" marker-end="${svg.mk('teal')}" marker-start="${svg.mk('teal')}"/>${lbl(caX + 30, ys[2] + 5, mob ? 'ใช้ได้ CA เซ็นรับรอง' : 'certificate ยังใช้ได้ และเซ็นโดย CA ที่เชื่อถือ', { c: 'var(--c-teal)', anchor: 'start', cls: 'lb s' })}</g>`;
      h += `<g class="m m4"><rect x="${sx - (mob ? 168 : 230)}" y="${ys[4] - 16}" width="${mob ? 154 : 214}" height="32" rx="9" fill="var(--c-rose-s)"/>${lbl(sx - (mob ? 91 : 123), ys[4] + 5, mob ? 'ถอดด้วย private key' : 'ถอด session key ด้วย private key', { c: 'var(--c-rose)', cls: 'lb s' })}</g>`;
      h += `<g class="m m5"><path d="M${cx + 8} ${ys[5]} L${sx - 8} ${ys[5]}" stroke="var(--c-green)" stroke-width="3" fill="none" marker-end="${svg.mk('green')}" marker-start="${svg.mk('green')}"/><rect x="${(cx + sx) / 2 - 78}" y="${ys[5] - 15}" width="156" height="30" rx="9" fill="var(--band)"/><rect x="${(cx + sx) / 2 - 78}" y="${ys[5] - 15}" width="156" height="30" rx="9" fill="var(--c-green-s)" stroke="var(--c-green)" stroke-width="2"/><text x="${(cx + sx) / 2}" y="${ys[5] + 5}" text-anchor="middle" font-size="14" class="mono" style="fill:var(--c-green);font-weight:600">01010010110</text></g>`;
      add(svg, h); st.replaceChildren(svg);
      const env = pill(svg, { fs: 12, h: 22 });
      return { svg, m: [0, 1, 2, 3, 4, 5].map(i => $('.m' + i, svg)), env, cx, sx, ys };
    }
    const reads = el('div', { class: 'reads' });
    const R = [['authn', 'Authentication', 'ขั้น 1–2: certificate พิสูจน์ตัว server', 1], ['conf', 'Confidentiality', 'ขั้น 3–5: ข้อมูลเข้ารหัสด้วย session key', 3], ['integ', 'Integrity', 'ขั้น 5: ตรวจได้ว่าข้อมูลถูกแก้หรือไม่', 5]];
    function frame(Sx, t) {
      Sx.m.forEach((g, i) => { if (g) g.style.opacity = i === 0 ? 1 : Math.max(.13, ramp(t, i - .55, i - .1)); });
      Sx.env.hide();
      if (t > .45 && t < 1) Sx.env.text('certificate', 'var(--c-teal)').at(lerp(Sx.sx, Sx.cx, ease(ramp(t, .45, 1))), Sx.ys[1] + 16);
      else if (t > 2.45 && t < 3) Sx.env.text('session key', 'var(--c-green)').at(lerp(Sx.cx, Sx.sx, ease(ramp(t, 2.45, 3))), Sx.ys[3] + 16);
      $$('.rd', reads).forEach((r, k) => r.style.opacity = t >= R[k][3] - .05 ? 1 : .3);
    }
    const m = mount(stage, build, Sx => frame(Sx, tv));
    Hop.scrub(host, { stops: STOPS.map(l => ({ label: l })), speed: 1500, onFrame: t => { tv = t; m.redraw(); } });
    R.forEach(([k, n, d]) => reads.append(el('button', { class: 'rd', 'data-k': k, style: `--tc:var(--c-${Hop.C[k].c})`, html: `<div class="v">${n}</div><div class="n">${d}</div>` })));
    host.append(reads);
    m.redraw();
  })();
  Hop.mcq($('#q-tls'), {
    q: 'ในขั้นที่ 3 ของ SSL ทำไม client ต้องเข้ารหัส session key ด้วย public key ของ server',
    opts: ['เพื่อให้มีแค่ server ที่ถอดได้ เพราะมีแต่ server ที่ถือ private key คู่กัน', 'เพื่อพิสูจน์ตัวตนของ client ให้ server รู้', 'เพราะ public key เร็วกว่า symmetric key', 'เพื่อให้ CA ตรวจ session key ได้'], a: 0,
    whyWrong: { 1: 'ขั้นนี้ไม่ได้พิสูจน์ตัว client สไลด์พูดถึงการพิสูจน์ตัวตนของ server (ขั้น 1–2)', 2: 'กลับกัน public key ช้ากว่า จึงใช้แค่ตอนส่ง key ส่วนข้อมูลจริงใช้ symmetric key', 3: 'CA เกี่ยวแค่ตอนตรวจ certificate ไม่ได้เห็น session key' },
    why: 'ของที่ล็อกด้วย public key ถอดได้ด้วย private key คู่กันเท่านั้น คนที่ดักได้ระหว่างทางจึงไม่ได้ session key สไลด์เขียนว่า "Server decrypts session key using its private key and establishes a secure session"',
  });

  /* ---------- 3. VPN ---------- */
  (() => {
    const host = $('#fig-vpn');
    let kind = 'ra';
    const seg = el('div', { class: 'seg', role: 'group' });
    [['ra', 'Remote-Access'], ['s2s', 'Site-to-Site']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === kind), 'data-v': k, text: l, onclick: () => { kind = k; show(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg));
    const box = el('div'); host.append(box);
    const STOPS = {
      ra: ['พนักงานที่บ้านเปิด VPN client แล้ว login', 'ข้อมูลถูกเข้ารหัส ห่อเข้าอุโมงค์', 'วิ่งผ่าน Internet คนกลางดักได้แต่อ่านไม่ออก', 'VPN gateway ของบริษัทถอดรหัส', 'ถึง server ภายใน เหมือนนั่งอยู่ในออฟฟิศ'],
      s2s: ['PC ในสาขาส่งข้อมูลธรรมดา', 'VPN gateway ของสาขาเข้ารหัสและห่อแทน', 'วิ่งในอุโมงค์ผ่าน Internet คนกลางอ่านไม่ออก', 'gateway ของสำนักงานใหญ่ถอดรหัส', 'ถึง server: PC ในสาขาไม่ต้องตั้งค่าอะไรเลย'],
    };
    function build(st, mob) {
      const W = mob ? 360 : 760, H = mob ? 270 : 270, y = mob ? 170 : 160, ra = kind === 'ra';
      const L = mob ? (ra ? { a: [34, y], t0: 60 } : { p1: [26, y - 52], p2: [26, y + 52], a: [86, y], t0: 110 }) : (ra ? { a: [80, y], t0: 108 } : { p1: [50, y - 60], p2: [50, y + 60], a: [150, y], t0: 176 });
      const gw = mob ? [282, y] : [600, y], sv = mob ? [336, y] : [690, y], t1 = gw[0] - 24, dar = mob ? [178, 40] : [380, 40], mid = (L.t0 + t1) / 2;
      const svg = svgRoot(W, H);
      let h = cloud(mid, y + 6, (t1 - L.t0) * .9, mob ? 60 : 74, '');
      h += `<rect x="${L.t0}" y="${y - 17}" width="${t1 - L.t0}" height="34" rx="17" fill="var(--band)"/><rect x="${L.t0}" y="${y - 17}" width="${t1 - L.t0}" height="34" rx="17" fill="var(--c-green-s)" stroke="var(--c-green)" stroke-width="2"/>`;
      h += lbl(mid, y + (mob ? 64 : 72), mob ? 'อุโมงค์ VPN บน Internet' : 'อุโมงค์ VPN (the secure vpn tunnel) บน Internet', { c: 'var(--c-green)', cls: 'lb s' });
      h += `<path d="M${mid} ${y - 18} L${dar[0]} ${dar[1] + 31}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="4 5" fill="none" marker-end="${svg.mk('ink')}"/>`;
      if (ra) h += Hop.dev('pc', ...L.a, { label: mob ? 'บ้าน' : 'พนักงานที่บ้าน', s: mob ? .85 : 1 });
      else { h += `<path d="M${L.p1[0]} ${L.p1[1]} L${L.a[0]} ${L.a[1]} L${L.p2[0]} ${L.p2[1]}" stroke="var(--line-2)" stroke-width="2" fill="none"/>`; h += Hop.dev('pc', ...L.p1, { s: .8 }) + Hop.dev('pc', ...L.p2, { s: .8 }) + Hop.dev('router', ...L.a, { label: mob ? 'GW' : 'VPN gateway', sub: mob ? '' : 'สาขา', s: mob ? .85 : 1 }); }
      h += `<line x1="${gw[0]}" y1="${y}" x2="${sv[0]}" y2="${y}" stroke="var(--line-2)" stroke-width="2"/>`;
      h += Hop.dev('router', ...gw, { label: mob ? 'GW' : 'VPN gateway', sub: mob ? '' : 'สำนักงานใหญ่', s: mob ? .85 : 1 }) + Hop.dev('server', ...sv, { label: 'Server', s: mob ? .85 : 1 });
      h += Hop.dev('attacker', ...dar) + lbl(dar[0] + 30, dar[1] + 5, 'คนกลาง', { c: 'var(--c-rose)', anchor: 'start' });
      add(svg, h); st.replaceChildren(svg);
      const br = track(svg, `M${mid} ${y - 18} L${dar[0]} ${dar[1] + 31}`);
      const start = ra ? L.a : L.p1;
      return { svg, ra, pts: ra ? [start, [L.t0, y], [mid, y]] : [start, L.a], mid: [mid, y], gw, sv, t0: [L.t0, y], t1: [t1, y], br, dar, p: pill(svg, { fs: 12.5 }), c: pill(svg, { c: 'var(--c-rose)', fs: 12.5 }), b: pill(svg, { c: 'var(--c-rose)', bg: 'var(--c-rose-s)', anchor: 'end' }) };
    }
    function frame(Sx, t) {
      const enc = ['x8#Qv!', 'var(--c-green)'], pl = ['ข้อมูล', 'var(--ink)'];
      let pos, tx;
      if (t <= 1) { pos = Sx.ra ? route([Sx.pts[0], Sx.t0], t) : route([Sx.pts[0], Sx.pts[1]], t); tx = t > (Sx.ra ? .5 : .9) ? enc : pl; }
      else if (t <= 2) { pos = route([Sx.ra ? Sx.t0 : [Sx.pts[1][0] + 24, Sx.mid[1]], Sx.mid], t - 1); tx = enc; }
      else if (t <= 3) { pos = route([Sx.mid, Sx.gw], t - 2); tx = t > 2.9 ? pl : enc; }
      else { pos = route([Sx.gw, Sx.sv], ramp(t, 3, 3.8)); tx = pl; }
      Sx.p.text(...tx).at(pos[0], pos[1] - (t > 3.8 ? 0 : 0), 1 - ramp(t, 3.85, 4));
      const k = ramp(t, 1.4, 2); if (k > 0 && k < 1) Sx.c.text(enc[0]).at(...at(Sx.br, k)); else Sx.c.hide();
      Sx.b.text('อ่านไม่ออก').at(Sx.dar[0] - 34, Sx.dar[1], ramp(t, 1.9, 2.1));
    }
    function show() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === kind)));
      box.innerHTML = '';
      const stage = el('div', { class: 'stage' }); box.append(stage);
      let tv = 0;
      const m = mount(stage, build, Sx => frame(Sx, tv));
      Hop.scrub(box, { stops: STOPS[kind].map(l => ({ label: l })), speed: 1400, onFrame: t => { tv = t; m.redraw(); } });
    }
    show();
  })();
  Hop.mcq($('#q-vpn'), {
    q: 'บริษัทต้องการเชื่อมเครือข่ายของสำนักงานใหญ่กับสาขาที่ต่างจังหวัดผ่าน Internet อย่างปลอดภัย ควรใช้ VPN แบบใด',
    opts: ['Site-to-Site VPN แบบ Intranet', 'Remote-Access VPN', 'Site-to-Site VPN แบบ Extranet', 'ไม่ต้องใช้ VPN ใช้ NAT ก็พอ'], a: 0,
    whyWrong: { 1: 'Remote-Access คือพนักงานทีละคนต่อเข้ามาจากเครื่องตัวเอง ไม่ใช่เครือข่ายต่อเครือข่าย', 2: 'Extranet ใช้เชื่อมกับองค์กรอื่นหรือคู่ค้า สาขาเป็นองค์กรเดียวกัน', 3: 'NAT แค่แปลงที่อยู่ ไม่ได้เข้ารหัสข้อมูล' },
    why: 'Site-to-Site เชื่อมสองเครือข่ายผ่าน VPN gateway และ Intranet VPN คือการเชื่อมเครือข่ายย่อยขององค์กรเดียวกัน',
  });

  /* ---------- 4. IPSec modes ---------- */
  (() => {
    const host = $('#fig-ipsec');
    let mode = 't';
    const seg = el('div', { class: 'seg', role: 'group' });
    [['t', 'Transport mode'], ['n', 'Tunneling mode']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === mode), 'data-v': k, text: l, onclick: () => { mode = k; show(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 16px' }, seg));
    const box = el('div'); host.append(box);
    // rows: [label, [[text, cls, colStart, colSpan, key]]]
    const D = {
      t: { cols: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,3fr) minmax(0,.9fr)', rows: [
        ['Transport Layer', [['Transport layer data', '', 3, 1]]],
        ['IPSec Layer', [['IPSec Header', 'add', 2, 1], ['Encrypted transport layer data', 'enc', 3, 1], ['IPSec Trailer', 'add', 4, 1]]],
        ['Network Layer', [['IP Header', '', 1, 1, 'hdr'], ['IP Payload (IPSec header + ข้อมูลที่เข้ารหัส + trailer)', 'enc', 2, 3]]]],
        stops: ['ข้อมูลจากชั้น Transport', 'IPSec เข้ารหัส แล้วใส่ header กับ trailer', 'ชั้น Network ใส่ IP header เดิมไว้ข้างหน้า ไม่เข้ารหัส', 'คนกลางอ่าน IP header ได้: รู้ว่าใครคุยกับใคร'],
        seen: 'คนกลางเห็น <b>IP header เดิม: host 10.1.1.5 → host 10.2.2.9</b> อ่านข้อมูลไม่ได้ แต่รู้ว่าสองเครื่องนี้คุยกันอยู่ นี่คือข้อเสียที่สไลด์เขียนไว้ (traffic analysis)' },
      n: { cols: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,2.4fr) minmax(0,.9fr)', rows: [
        ['Transport Layer', [['Transport layer data', '', 4, 1]]],
        ['Network Layer', [['IP Header เดิม', '', 3, 1], ['IP Payload', '', 4, 1]]],
        ['IPSec Layer', [['IPSec Header', 'add', 2, 1], ['Encrypted: IP packet เดิมทั้งก้อน', 'enc', 3, 2], ['IPSec Trailer', 'add', 5, 1]]],
        ['Network Layer', [['IP Header ใหม่', '', 1, 1, 'hdr'], ['IP Payload (ทุกอย่างที่เหลือ)', 'enc', 2, 4]]]],
        stops: ['ข้อมูลจากชั้น Transport', 'ชั้น Network ใส่ IP header เดิม (host ถึง host)', 'Gateway เข้ารหัสทั้ง packet แล้วใส่ IPSec header กับ trailer', 'ใส่ IP header ใหม่ของ gateway', 'คนกลางเห็นแค่ gateway คุยกับ gateway'],
        seen: 'คนกลางเห็นแค่ <b>IP header ใหม่: gateway 203.0.113.1 → gateway 198.51.100.1</b> ไม่รู้ว่าเครื่องไหนข้างในคุยกับเครื่องไหน สไลด์จึงบอกว่าโหมดนี้ช่วยป้องกันการวิเคราะห์การไหลของข้อมูล' },
    };
    function show() {
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === mode)));
      const d = D[mode];
      box.innerHTML = '';
      const rows = el('div', { class: 'irows' });
      const rEls = d.rows.map(([l, segs]) => {
        const g = el('div', { class: 'rg', style: `grid-template-columns:${d.cols}` }, segs.map(([t, c, s, n, k]) => el('div', { class: 'sg ' + c, 'data-h': k || '', style: `grid-column:${s} / span ${n}`, text: t })));
        const r = el('div', { class: 'irow' }, el('div', { class: 'rl', text: l }), g); rows.append(r); return r;
      });
      box.append(rows);
      const seen = el('div', { class: 'seenline', style: 'min-height:3.2em' }); box.append(seen);
      const n = d.stops.length;
      Hop.scrub(box, { stops: d.stops.map(l => ({ label: l })), speed: 1300, onFrame: t => {
        rEls.forEach((r, i) => { const k = i === 0 ? 1 : ramp(t, i - .6, i - .1); r.style.opacity = k; r.style.transform = `translateY(${(1 - k) * 8}px)`; });
        const last = ramp(t, n - 1.5, n - 1);
        $$('[data-h="hdr"]', box).forEach(h => h.classList.toggle('seen', last > .5));
        seen.innerHTML = last > .5 ? d.seen : '';
      } });
    }
    show();
    $('#tbl-ipsec').append(el('table', { class: 'stable', html: `<thead><tr><th></th><th>Transport mode</th><th>Tunneling mode</th></tr></thead><tbody>
      <tr><td>เข้ารหัส</td><td>ข้อมูลจากชั้น Transport</td><td>IP packet เดิมทั้งก้อน (header + payload)</td></tr>
      <tr><td>IP header เดิม</td><td>อยู่ข้างนอก มองเห็นได้</td><td>ถูกซ่อน ใส่ header ใหม่ของ gateway</td></tr>
      <tr><td>ใครทำ IPSec</td><td>host ทั้งสองฝั่ง (host-to-host)</td><td>gateway ทำแทนเป็น proxy</td></tr>
      <tr><td>ข้อดี</td><td>ปกป้องทุก app บนเครื่อง, overhead น้อยกว่า</td><td><u>host ไม่ต้องตั้งค่า</u>, <u>กัน traffic analysis</u></td></tr>
      <tr><td>ข้อเสีย</td><td><u>header ไม่เข้ารหัส วิเคราะห์การไหลของข้อมูลได้</u></td><td>packet ใหญ่ขึ้น, ต้องตั้ง gateway</td></tr></tbody>` }));
  })();
  Hop.mcq($('#q-ipsec'), {
    q: 'ข้อเสียของ IPSec transport mode ตามสไลด์คืออะไร',
    opts: ['ส่วน header ไม่ถูกเข้ารหัส ผู้บุกรุกวิเคราะห์ได้ว่าสองโหนดไหนกำลังรับส่งข้อมูลกัน', 'ข้อมูลชั้น Transport ไม่ถูกเข้ารหัส', 'host ต้องให้ gateway ทำแทนทุกครั้ง', 'ใช้ได้แค่กับเว็บ'], a: 0,
    whyWrong: { 1: 'transport mode เข้ารหัสข้อมูลชั้น Transport อยู่แล้ว สิ่งที่ไม่เข้ารหัสคือ IP header', 2: 'นั่นคือ tunnel mode และสไลด์นับเป็นข้อดี เพราะ host ไม่ต้องตั้งค่า', 3: 'IPSec อยู่ชั้น Network ปกป้องทุก application ข้อนี้คือลักษณะของ HTTPS' },
    why: 'transport mode ใส่ IP header เดิมไว้หลังเข้ารหัส header จึงอ่านได้ ต่างจาก tunnel mode ที่ซ่อน header เดิมไว้ข้างใน',
  });

  /* ---------- 5. pros / cons comparison ---------- */
  (() => {
    const host = $('#fig-pros');
    let sel = ['https', 'ipn'];
    const chips = el('div', { class: 'pchips' });
    Object.entries(P).forEach(([k, d]) => chips.append(el('button', { class: 'pchip', 'data-v': k, text: d.n, onclick: () => { if (sel.includes(k)) return; sel = [sel[1], k]; draw(); } })));
    const cmp = el('div', { class: 'cmp' });
    host.append(chips, cmp);
    function card(k) {
      const d = P[k];
      return el('div', { class: 'cc', html: `<h4>${d.n}</h4><div class="ly">${d.ly}</div><p class="pr">${d.pr}</p><h5 class="g">ข้อดี</h5><ul>${d.pros.map(([t, s]) => `<li class="${s ? 's' : ''}">${t}</li>`).join('')}</ul><h5 class="b">ข้อเสีย</h5><ul>${d.cons.map(([t, s]) => `<li class="${s ? 's' : ''}">${t}</li>`).join('')}</ul><p class="pr"><button class="btn small ghost" data-k="${d.k}" style="padding:0">${icon('chev')} เปิดคำอธิบาย ${d.n.split(' ')[0]}</button></p>` });
    }
    function draw() { $$('.pchip', chips).forEach(b => b.classList.toggle('on', sel.includes(b.dataset.v))); cmp.replaceChildren(...sel.map(card)); }
    draw();
  })();

  /* ---------- 6. NAT ---------- */
  (() => {
    const host = $('#fig-nat');
    const IN = ['192.168.0.1', '192.168.0.2', '192.168.0.3'];
    const STATIC = ['161.246.5.3', '161.246.5.6', '161.246.5.9'], POOL = ['161.246.5.35', '161.246.5.50', '161.246.5.23'];
    let type = 'pat', table = [], nextPort = 1000, Sc, anims = [];
    const seg = el('div', { class: 'seg', role: 'group' });
    [['static', 'Static NAT'], ['dyn', 'Dynamic NAT'], ['pat', 'PAT / NAPT']].forEach(([k, l]) => seg.append(el('button', { 'aria-pressed': String(k === type), 'data-v': k, text: l, onclick: () => { type = k; reset(); } })));
    host.append(el('div', { class: 'ctrls', style: 'margin:0 0 12px' }, seg));
    const stage = el('div', { class: 'stage' }); host.append(stage);
    const btns = el('div', { class: 'natbtns' }); host.append(btns);
    IN.forEach((ip, i) => btns.append(el('button', { class: 'btn small', text: 'ส่งจาก PC' + (i + 1), onclick: () => send(i) })));
    btns.append(el('button', { class: 'btn small ghost', html: `${icon('replay')} ล้างตาราง`, onclick: () => reset() }));
    const pool = el('div', { class: 'pool' }); host.append(pool);
    const tb = el('table', { class: 'ntable' }); host.append(tb);
    const say = el('p', { class: 'say' }); host.append(say);
    const SAY = {
      static: 'Static NAT จับคู่ไว้ล่วงหน้าแบบ 1 ต่อ 1 PC1 ออกไปเป็น 161.246.5.3 ทุกครั้ง ใช้ public IP เท่ากับจำนวนเครื่อง',
      dyn: 'Dynamic NAT สุ่มเลือก public IP ที่ว่างใน pool ให้ตอนเครื่องเริ่มติดต่อ ล้างตารางแล้วส่งใหม่ อาจได้คนละตัว ถ้าเครื่องที่ใช้พร้อมกันมากกว่า IP ใน pool เครื่องที่เกินออกไม่ได้',
      pat: 'PAT ใช้ public IP เดียว 161.246.6.22 ทุกเครื่อง แล้วแยกกันด้วย port ต้นทาง ตอน reply กลับมาที่ :1001 router เปิดตารางแล้วรู้ว่าต้องส่งให้ 192.168.0.2',
    };
    function outOf(i) { const r = table.find(x => x.i === i); return r ? r.out : null; }
    function assign(i) {
      let o = outOf(i); if (o) return o;
      if (type === 'static') o = STATIC[i];
      else if (type === 'dyn') { const free = POOL.filter(p => !table.some(r => r.out === p)); o = Hop.pick(free); }
      else o = '161.246.6.22:' + (nextPort++);
      table.push({ i, out: o, isNew: true }); return o;
    }
    function drawTable(hit) {
      const rows = type === 'static' ? IN.map((ip, i) => ({ i, out: STATIC[i] })) : table;
      tb.innerHTML = `<thead><tr><th>Inside (private)</th><th>Outside (${type === 'pat' ? 'public IP:port' : 'public'})</th></tr></thead>`;
      const b = el('tbody'); tb.append(b);
      if (!rows.length) b.append(el('tr', {}, el('td', { class: 'empty', colspan: 2, text: 'ยังว่าง ส่งจากเครื่องไหนก่อน router จะจดคู่ของเครื่องนั้น' })));
      rows.forEach(r => { const tr = el('tr', { class: (r.i === hit ? 'hit ' : '') + (r.isNew ? 'new' : '') }, el('td', { class: 'pv', text: IN[r.i] }), el('td', { class: 'pb', text: r.out })); r.isNew = false; b.append(tr); });
      pool.innerHTML = type === 'dyn' ? `<span>pool:</span>${POOL.map(p => `<span class="pi ${table.some(r => r.out === p) ? 'used' : ''}">${p}</span>`).join('')}` : type === 'static' ? '<span>ตารางนี้ตั้งไว้ล่วงหน้า ไม่เปลี่ยน</span>' : '<span>public IP เดียว:</span><span class="pi">161.246.6.22</span>';
    }
    function build(st, mob) {
      const g = mob ? { W: 360, H: 290, x: 30, ys: [60, 145, 230], r: [150, 145], c: [294, 145, 96, 80] } : { W: 760, H: 280, x: 70, ys: [55, 140, 225], r: [330, 140], c: [610, 140, 230, 110] };
      const svg = svgRoot(g.W, g.H);
      let h = cloud(g.c[0], g.c[1], g.c[2], g.c[3], '');
      h += lbl(g.c[0], g.c[1] + (mob ? 50 : 62), 'Internet', { cls: 'lb s' });
      g.ys.forEach((y, i) => { h += `<line x1="${g.x + 22}" y1="${y}" x2="${g.r[0] - 22}" y2="${g.r[1]}" stroke="var(--line-2)" stroke-width="2"/>`; h += `<line x1="${g.r[0] + 22}" y1="${g.r[1]}" x2="${g.c[0] - g.c[2] * .3}" y2="${y}" stroke="var(--line-2)" stroke-width="2"/>`; });
      g.ys.forEach((y, i) => h += Hop.dev('pc', g.x, y, { s: mob ? .8 : 1 }) + lbl(g.x, y + (mob ? 32 : 38), 'PC' + (i + 1), { cls: 'lb s' }));
      h += Hop.dev('router', g.r[0], g.r[1], { label: 'NAT router' });
      add(svg, h); st.replaceChildren(svg);
      return (Sc = { svg, g, pills: [] });
    }
    function send(i) {
      if (!Sc) return;
      const o = assign(i); drawTable(i);
      const p = pill(Sc.svg, { fs: 12, h: 22 });
      anims.push({ i, o, p, t0: performance.now() });
      if (anims.length === 1) requestAnimationFrame(tick);
    }
    function tick(now) {
      if (!Sc) return;
      const g = Sc.g;
      anims = anims.filter(a => {
        const t = (now - a.t0) / 1000, y = g.ys[a.i], A = [g.x + 26, y], R = [g.r[0], g.r[1]], C = [g.c[0] - g.c[2] * .26, y];
        if (t < 1) a.p.text(IN[a.i], 'var(--c-teal)').at(...route([A, R], ease(t)));
        else if (t < 2) a.p.text(a.o, 'var(--c-rose)').at(...route([R, C], ease(t - 1)));
        else if (t < 2.4) a.p.text('reply ถึง ' + a.o, 'var(--c-rose)').at(...C);
        else if (t < 3.4) a.p.text(t < 3.1 ? 'reply ถึง ' + a.o : 'reply ถึง ' + IN[a.i], t < 3.1 ? 'var(--c-rose)' : 'var(--c-teal)').at(...route([C, R], ease(Math.min(1, (t - 2.4) / .7))));
        else if (t < 4.3) a.p.text('reply ถึง ' + IN[a.i], 'var(--c-teal)').at(...route([R, A], ease(t - 3.4)));
        else { a.p.g.remove(); return false; }
        if (t > 3 && t < 3.1) drawTable(a.i);
        return true;
      });
      if (anims.length) requestAnimationFrame(tick);
    }
    function reset() {
      table = []; nextPort = 1000; anims.forEach(a => a.p.g.remove()); anims = [];
      $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === type)));
      say.innerHTML = SAY[type]; drawTable(-1);
    }
    mount(stage, (st, mob) => { anims.forEach(a => a.p.g.remove()); anims = []; return build(st, mob); }, () => {});
    reset();
  })();
  Hop.mcq($('#q-nat'), {
    q: 'องค์กรมี public IP แค่ตัวเดียว แต่มีเครื่อง 200 เครื่องที่ต้องออก Internet พร้อมกัน ต้องใช้ NAT แบบใด',
    opts: ['PAT / NAPT', 'Static NAT', 'Dynamic NAT', 'ใช้ไม่ได้ทุกแบบ'], a: 0,
    whyWrong: { 1: 'Static NAT ต้องมี public IP หนึ่งตัวต่อหนึ่งเครื่อง 200 เครื่องจึงต้องมี 200 ตัว', 2: 'Dynamic NAT ยังเป็น 1 ต่อ 1 ตอนใช้งาน pool ที่มี IP เดียวให้ออกได้ทีละเครื่อง', 3: 'PAT ทำได้ เพราะแยกแต่ละการเชื่อมต่อด้วยหมายเลข port' },
    why: 'PAT เปลี่ยนทุกเครื่องเป็น IP เดียวกันแล้วเพิ่มหมายเลข port ต้นทางที่ไม่ซ้ำ เช่น 161.246.6.22:1000, :1001, :1002 router ใช้ port แยกว่า reply เป็นของเครื่องไหน',
  });

  /* ---------- drill ---------- */
  (() => {
    const host = $('#drill');
    const LAYOPTS = ['ชั้น 7–6 Application / Presentation', 'ชั้น 5–4 Session / Transport', 'ชั้น 3 Network', 'ชั้น 2 Data Link'];
    const LQ = [['HTTPS', 0], ['SSH', 0], ['PGP', 0], ['S/MIME', 0], ['SSL', 1], ['TLS', 1], ['IPSec', 2], ['PPTP', 3], ['L2F', 3], ['L2TP', 3]];
    const SCOPTS = ['HTTPS', 'SSH', 'PGP / S/MIME', 'IPSec transport mode', 'Remote-Access VPN', 'Site-to-Site VPN แบบ Intranet', 'Site-to-Site VPN แบบ Extranet', 'Static NAT', 'Dynamic NAT', 'PAT / NAPT'];
    const SCN = [
      ['พนักงานขายต้องเข้าระบบ ERP ของบริษัทจากโรงแรมระหว่างเดินทาง โดยข้อมูลต้องไม่รั่วระหว่างทาง', 'Remote-Access VPN', 'พนักงานคนเดียวต่อจากเครื่องตัวเองเข้า VPN gateway ของบริษัท ข้อมูลถูกเข้ารหัสในอุโมงค์'],
      ['บริษัทมีสาขาที่เชียงใหม่ ต้องการให้ทุกเครื่องในสาขาเข้าถึง server ที่สำนักงานใหญ่ผ่าน Internet โดยไม่ต้องตั้งค่าที่เครื่องลูก', 'Site-to-Site VPN แบบ Intranet', 'gateway สองฝั่งเชื่อมกัน (มักใช้ IPSec tunnel mode) เครื่องลูกไม่ต้องตั้งค่า และเป็นองค์กรเดียวกันจึงเป็น Intranet'],
      ['บริษัทต้องการแลกเปลี่ยนข้อมูลสั่งซื้อกับบริษัทคู่ค้าผ่าน Internet อย่างปลอดภัย', 'Site-to-Site VPN แบบ Extranet', 'Extranet VPN เชื่อมระหว่างองค์กรหรือคู่ค้า ให้พนักงานแต่ละบริษัทแลกเปลี่ยนข้อมูลกันได้อย่างปลอดภัย'],
      ['ผู้ดูแลระบบต้องการเข้าไปตั้งค่า router จากระยะไกล โดยไม่ให้รหัสผ่านถูกดักอ่าน', 'SSH', 'Telnet ส่ง username, password และคำสั่งเป็นข้อความธรรมดา SSH เข้ารหัสทั้งหมด'],
      ['ร้านค้าออนไลน์ต้องการให้ลูกค้ากรอกบัตรเครดิตบนเว็บอย่างปลอดภัย และพิสูจน์ได้ว่าเว็บเป็นของจริง', 'HTTPS', 'HTTPS = HTTP + SSL/TLS เข้ารหัสข้อมูลระหว่าง browser กับ web server และ certificate จาก CA พิสูจน์ตัว server'],
      ['ต้องการเข้ารหัสและเซ็นชื่อดิจิทัลในอีเมลแต่ละฉบับ', 'PGP / S/MIME', 'PGP และ S/MIME อยู่ชั้น Application ปกป้องที่ตัวข้อความอีเมล'],
      ['server สองเครื่องต้องการเข้ารหัสทุก traffic ระหว่างกันโดยตรง ทั้งสองเครื่องติดตั้ง IPSec ได้ และยอมให้คนนอกรู้ว่าสองเครื่องนี้คุยกัน', 'IPSec transport mode', 'transport mode ใช้แบบ host-to-host ทั้งสองฝั่งใช้ IPSec เอง header ไม่ถูกเข้ารหัส'],
      ['องค์กรมี public IP แค่ตัวเดียว แต่มีเครื่อง 200 เครื่องที่ต้องออก Internet', 'PAT / NAPT', 'PAT ใช้ public IP เดียวแล้วแยกการเชื่อมต่อด้วยหมายเลข port ต้นทาง'],
      ['web server ภายในต้องให้คนข้างนอกเข้าถึงได้ที่ public IP เดิมตลอดเวลา', 'Static NAT', 'Static NAT จับคู่ private กับ public แบบ 1 ต่อ 1 ตายตัว คนข้างนอกจึงเข้าที่ IP เดิมได้เสมอ'],
      ['องค์กรมี public IP 20 ตัว เครื่องภายใน 50 เครื่องผลัดกันใช้ Internet และไม่จำเป็นต้องได้ IP เดิมทุกครั้ง', 'Dynamic NAT', 'Dynamic NAT สุ่มเลือก public IP จาก pool ให้ตอนเริ่มติดต่อ ใช้พร้อมกันได้ไม่เกิน 20 เครื่อง'],
    ];
    const kinds = ['layer', 'pros', 'scen', 'nat'];
    let lastKind = '';
    function opts2(list, correct, onDone) {
      const box = el('div', { class: 'opts2' }); let done = false;
      list.forEach(o => box.append(el('button', { class: 'opt', text: o, onclick: e => {
        if (done) return; done = true;
        $$('.opt', box).forEach(b => b.classList.add(b.textContent === correct ? 'right' : b === e.currentTarget ? 'wrong' : 'dim'));
        onDone(e.currentTarget.textContent === correct);
      } })));
      return box;
    }
    function render() {
      let kind; do kind = Hop.pick(kinds); while (kind === lastKind); lastKind = kind;
      host.innerHTML = ''; host.append(el('h3', { text: 'โจทย์' }));
      const work = el('div'), fb = el('div');
      const next = el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render });
      if (kind === 'layer') {
        const [n, a] = Hop.pick(LQ);
        host.append(el('p', { class: 'prompt', html: `จากตาราง OSI กับ security protocol ในสไลด์ <b>${n}</b> ทำงานอยู่ชั้นใด` }),
          opts2(LAYOPTS, LAYOPTS[a], ok => fb.replaceChildren(el('div', { class: 'fb ' + (ok ? 'good' : 'bad'), html: `<div class="h">${ok ? 'ถูกต้อง' : 'ยังไม่ใช่'}</div>${n} อยู่${LAYOPTS[a]} ในตาราง p.20 ช่อง Security Protocol แถวบนสุดมี HTTPS, SSH, PGP, S/MIME แถวชั้น 5–4 มี SSL กับ TLS ชั้น 3 มี IPSec และชั้น 2 มี PPTP, L2F, L2TP` }))), fb, el('div', { class: 'bar2' }, next));
      } else if (kind === 'pros') {
        const k = Hop.pick(Object.keys(P)), d = P[k];
        const ta = el('textarea', { class: 'field', rows: 5, placeholder: 'ชั้น: ...\nข้อดี: ...\nข้อเสีย: ...' });
        host.append(el('p', { class: 'prompt', html: `<b>${d.n}</b> ทำงานอยู่ชั้นใดของ OSI ป้องกันอะไร และมีข้อดีข้อเสียอย่างไร` }), ta,
          el('div', { class: 'bar2' }, el('button', { class: 'btn primary', html: `${icon('eye')} ดูคำตอบตัวอย่าง`, onclick: () => Hop.work(work, [
            { note: true, t: 'ที่ควรเขียนในกระดาษคำตอบ:' }, { t: `${d.n} ทำงานที่${d.ly}` }, { t: `ป้องกัน: ${d.pr}` },
            { html: '<b style="color:var(--good)">ข้อดี</b>' }, ...d.pros.map(([t]) => ({ t: '• ' + t })),
            { html: '<b style="color:var(--bad)">ข้อเสีย</b>' }, ...d.cons.map(([t]) => ({ t: '• ' + t })),
            { note: true, t: 'ข้อที่ขีดเส้นใต้ในตารางเทียบด้านบนมาจากสไลด์ตรงๆ ควรเขียนให้มีอย่างน้อยหนึ่งข้อ' }]) }), next), work);
      } else if (kind === 'scen') {
        const [q, a, why] = Hop.pick(SCN);
        const list = Hop.shuffle([a, ...Hop.shuffle(SCOPTS.filter(x => x !== a)).slice(0, 4)]);
        host.append(el('p', { class: 'prompt', text: 'สถานการณ์นี้ควรใช้ protocol หรือเทคนิคใด' }), el('div', { class: 'scen', text: q }),
          opts2(list, a, ok => fb.replaceChildren(el('div', { class: 'fb ' + (ok ? 'good' : 'bad'), html: `<div class="h">${ok ? 'ถูกต้อง' : 'ยังไม่ใช่ คำตอบคือ ' + esc(a)}</div>${esc(why)}` }))), fb, el('div', { class: 'bar2' }, next));
      } else {
        const t = Hop.pick(['pat', 'dyn', 'static']);
        const n = t === 'static' ? 3 : Hop.rnd(3, 4), hosts = Hop.shuffle(['192.168.1.10', '192.168.1.11', '192.168.1.12', '192.168.1.20', '192.168.1.25']).slice(0, n);
        const pub = `203.150.${Hop.rnd(10, 99)}.${Hop.rnd(2, 200)}`, port0 = Hop.pick([1000, 2000, 5000]);
        const base = pub.split('.').slice(0, 3).join('.'), last = +pub.split('.')[3];
        let rows, prompt;
        if (t === 'pat') { rows = hosts.map((h, i) => [h, `${pub}:${port0 + i}`]); prompt = `router ใช้ PAT (NAPT) ด้วย public IP <b class="mono">${pub}</b> แบบในสไลด์ คือกำหนด port ต้นทางเรียงตามลำดับการเชื่อมต่อ เริ่มที่ <b class="mono">${port0}</b> เครื่องต่อไปนี้เริ่มติดต่อออกไปตามลำดับ จงเติมตารางแปลงที่อยู่`; }
        else if (t === 'dyn') { const P2 = [0, 1, 2].map(i => `${base}.${last + i}`); rows = hosts.map((h, i) => [h, i < 3 ? P2[i] : 'ไม่ได้']); prompt = `router ใช้ Dynamic NAT มี pool <b class="mono">${P2.join(', ')}</b> สมมติว่า router แจก IP ที่ว่างตัวแรกใน pool ตามลำดับ เครื่องต่อไปนี้เริ่มติดต่อพร้อมกันตามลำดับ จงเติมตาราง ถ้าไม่มี IP ว่างให้ตอบ "ไม่ได้"`; }
        else { const M = hosts.map((h, i) => [h, `${base}.${last + i * 3}`]); const ask = Hop.rnd(0, 2); rows = M.map((r, i) => i === ask ? [r[0], r[1], 'rev'] : [...r, 'given']); prompt = `router ใช้ Static NAT ตามตารางด้านล่าง packet ตอบกลับจาก Internet ส่งมาถึง <b class="mono">${M[ask][1]}</b> router จะส่งต่อให้เครื่องใด เติมช่องที่ว่าง`; }
        const tbl = el('table', { class: 'stable natq', html: '<thead><tr><th>Inside (private)</th><th>Outside (public)</th></tr></thead>' });
        const body = el('tbody'); tbl.append(body);
        rows.forEach(([h, o, m]) => {
          const inp = (ans) => el('input', { class: 'field', 'data-a': ans, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: t === 'dyn' ? 'text' : 'decimal' });
          body.append(el('tr', {}, el('td', {}, m === 'rev' ? inp(h) : el('span', { class: 'mono', text: h })), el('td', {}, m === 'given' || m === 'rev' ? el('span', { class: 'mono', text: o }) : inp(o))));
        });
        const score = el('span', { class: 'score' });
        host.append(el('p', { class: 'prompt', html: prompt }), el('div', { class: 'tw2' }, tbl),
          el('div', { class: 'bar2' }, el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: () => { let ok = 0, all = 0; $$('input', tbl).forEach(i => { const g = i.value.replace(/\s+/g, '') === i.dataset.a.replace(/\s+/g, ''); i.classList.toggle('ok', g); i.classList.toggle('no', !g); all++; if (g) ok++; }); score.textContent = `ถูก ${ok}/${all} ช่อง`; } }),
            el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => Hop.work(work, t === 'pat'
              ? [{ note: true, t: 'PAT: ทุกเครื่องใช้ public IP เดียวกัน แยกด้วย port ต้นทาง' }, ...rows.map(([h, o]) => ({ t: `${h}  →  ${o}` })), { note: true, t: 'reply ที่กลับมาถึง IP:port ไหน router เปิดตารางแล้วส่งต่อให้เครื่องในแถวนั้น' }]
              : t === 'dyn' ? [{ note: true, t: 'Dynamic NAT: เครื่องละหนึ่ง public IP จาก pool ใช้พร้อมกันได้ไม่เกินจำนวน IP ใน pool' }, ...rows.map(([h, o]) => ({ t: `${h}  →  ${o}` })), ...(rows.length > 3 ? [{ note: true, t: 'เครื่องที่ 4 ออกไม่ได้เพราะ pool มีแค่ 3 IP ต้องรอจนมีเครื่องเลิกใช้' }] : [])]
              : [{ note: true, t: 'Static NAT จับคู่ 1 ต่อ 1 ตายตัว packet ขาเข้าถึง public IP ไหน ก็ส่งให้เครื่องที่จับคู่ไว้' }, ...rows.map(([h, o]) => ({ t: `${o}  →  ${h}` }))]) }),
            next, score), work);
      }
    }
    render();
  })();
})();
