// Firewall & ACL chapter: topology figures, ACL engine (parse + simulate), builder, drill.
(() => {
  const { $, $$, el, esc, clamp, lerp, easeIO, icon } = Hop;
  Hop.page(7);
  const I2 = IP.toInt, S2 = IP.toStr;
  const ALL = 0xFFFFFFFF;
  const wcInt = p => (~IP.maskInt(p)) >>> 0;
  const wcStr = p => S2(wcInt(p));

  /* =====================================================================
     ACL engine: parse IOS-style commands, evaluate packets
     ===================================================================== */
  const PORTN = { www: 80, http: 80, telnet: 23, ftp: 21, 'ftp-data': 20, domain: 53, smtp: 25, pop3: 110, ssh: 22, https: 443, snmp: 161, tftp: 69, bootps: 67, bootpc: 68 };
  const ICMPT = { echo: 8, 'echo-reply': 0 };
  const isIP = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s || '') && s.split('.').every(o => +o <= 255);
  const looksIf = s => /^(f|fa|fastethernet|g|gi|gig|gigabitethernet|s|se|ser|serial|e|eth|ethernet)\d/.test(s || '');
  const stdNum = n => (n >= 1 && n <= 99) || (n >= 1300 && n <= 1999);
  const extNum = n => (n >= 100 && n <= 199) || (n >= 2000 && n <= 2699);
  function normIf(s) {
    const m = /^(fastethernet|fa|f|gigabitethernet|gig|gi|g|serial|ser|se|s|ethernet|eth|e)([\d\/\.:]+)$/.exec(s);
    return m ? m[1][0] + m[2] : null;
  }
  const addrMatch = (m, ip) => (((m.a ^ ip) & ~m.w) >>> 0) === 0;
  function portOk(c, p) {
    if (!c) return true; if (p == null) return false;
    return c.op === 'eq' ? p === c.a : c.op === 'neq' ? p !== c.a : c.op === 'gt' ? p > c.a : c.op === 'lt' ? p < c.a : p >= c.a && p <= c.b;
  }
  function ruleMatch(r, f) {
    if (!addrMatch(r.src, f.s)) return false;
    if (r.std) return true;
    if (r.proto !== 'ip' && r.proto !== f.proto) return false;
    if (!addrMatch(r.dst, f.d)) return false;
    if (r.sp && !portOk(r.sp, f.sp)) return false;
    if (r.dp && !portOk(r.dp, f.dp)) return false;
    if (r.icmp != null && f.it !== r.icmp) return false;
    if (r.est) return false; // our test packets open new connections
    return true;
  }
  function evalAcl(rules, f) {
    for (let i = 0; i < rules.length; i++) if (ruleMatch(rules[i], f)) return { act: rules[i].act, i };
    return { act: 'deny', i: -1 };
  }
  const addrTxt = m => m.w === 0 ? 'host ' + S2(m.a) : m.w === ALL ? 'any' : S2(m.a) + ' ' + S2(m.w);
  function whyNot(r, f) {
    if (!addrMatch(r.src, f.s)) return `IP ต้นทาง ${S2(f.s)} ไม่อยู่ใน ${addrTxt(r.src)}`;
    if (r.std) return '';
    if (r.proto !== 'ip' && r.proto !== f.proto) return `packet เป็น ${f.proto.toUpperCase()} ไม่ใช่ ${r.proto.toUpperCase()}`;
    if (!addrMatch(r.dst, f.d)) return `IP ปลายทาง ${S2(f.d)} ไม่อยู่ใน ${addrTxt(r.dst)}`;
    if (r.dp && !portOk(r.dp, f.dp)) return f.dp == null ? 'ICMP ไม่มี port' : `port ${f.dp} ไม่ใช่ ${r.dp.a}`;
    if (r.icmp != null && f.it !== r.icmp) return 'ชนิด ICMP ไม่ตรง';
    return '';
  }

  // lenient parser. returns {rules:{num:[rule]}, apps:[{num, ifn, side, dir, ln}], errs:[{ln, msg}], warns:[{ln,msg}]}
  function parseCmds(text, T) {
    const out = { rules: {}, apps: [], errs: [], warns: [] };
    let cur = null;
    const E = (ln, msg) => out.errs.push({ ln, msg }), W = (ln, msg) => out.warns.push({ ln, msg });
    text.split(/\r?\n/).forEach((raw, li) => {
      const ln = li + 1;
      let s = raw.replace(/^\s*[\w\-]*(\([\w\-]+\))?#/, '').replace(/!.*$/, '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!s) return;
      const w = s.split(' ');
      if (w[0] === 'access-list') return parseAcl(w, ln, raw.trim());
      if (/^int(e(r(f(a(ce?)?)?)?)?)?$/.test(w[0])) {
        const name = normIf(w.slice(1).join(''));
        if (!name) return E(ln, `อ่านชื่อ interface ไม่ออก: <code>${esc(w.slice(1).join(' '))}</code>`);
        if (T) { const side = Object.keys(T.ifs).find(k => normIf(T.ifs[k]) === name); if (!side) { cur = 'bad'; return E(ln, `router ในรูปไม่มีขา <code>${esc(name)}</code> (มี ${Object.values(T.ifs).join(', ')})`); } cur = { ifn: name, side }; }
        else cur = { ifn: name, side: null };
        return;
      }
      if (w[0] === 'ip' && w[1] === 'access-group') {
        if (cur === 'bad') return;
        if (!cur) return E(ln, '<code>ip access-group</code> ต้องพิมพ์หลังจากเข้า <code>interface ...</code> แล้ว');
        const num = +w[2], dir = w[3];
        if (!w[2] || !/^\d+$/.test(w[2])) return E(ln, 'หลัง ip access-group ต้องเป็นเลข ACL');
        if (dir !== 'in' && dir !== 'out') return E(ln, 'ต้องบอกทิศ <code>in</code> หรือ <code>out</code> ต่อท้าย');
        out.apps.push({ num, ifn: cur.ifn, side: cur.side, dir, ln });
        return;
      }
      if (['exit', 'end', 'enable', 'en', 'conf', 'configure', 'no shutdown', 'no shut'].includes(s) || /^conf(igure)? t(erminal)?$/.test(s) || /^(do )?(show|wr|write|copy)/.test(s)) return;
      if (w[0] === 'line' || w[0] === 'access-class') return W(ln, 'โจทย์ข้อนี้เป็น traffic ที่วิ่ง<b>ผ่าน</b> router ต้องผูกที่ interface ด้วย ip access-group (line vty ใช้กับการ telnet เข้าตัว router)');
      E(ln, `ไม่รู้จักคำสั่ง <code>${esc(s)}</code>`);
    });
    return out;

    function parseAcl(w, ln, raw) {
      if (!/^\d+$/.test(w[1] || '')) return E(ln, 'หลัง access-list ต้องเป็นเลข ACL');
      const num = +w[1];
      const std = stdNum(num), ext = extNum(num);
      if (!std && !ext) return E(ln, `เลข ${num} ไม่อยู่ในช่วงของ standard (1–99, 1300–1999) หรือ extended (100–199, 2000–2699)`);
      const act = w[2];
      if (act === 'remark') return;
      if (act !== 'permit' && act !== 'deny') return E(ln, 'หลังเลข ACL ต้องเป็น <code>permit</code> หรือ <code>deny</code>');
      let i = 3;
      const addr = (role) => {
        const t = w[i];
        if (t === 'any') { i++; return { a: 0, w: ALL }; }
        if (t === 'host') { if (!isIP(w[i + 1])) { E(ln, `หลัง host ต้องเป็น IP`); return null; } i += 2; return { a: I2(w[i - 1]), w: 0 }; }
        if (isIP(t)) {
          i++;
          if (isIP(w[i])) {
            const wc = I2(w[i]); i++;
            if (wc !== 0 && wc !== ALL && [...Array(32).keys()].some(p => p > 0 && IP.maskInt(p) === wc)) W(ln, `<code>${S2(wc)}</code> หน้าตาเหมือน subnet mask: wildcard ต้องกลับด้าน (0 = ต้องตรง) เช่น /24 ใช้ 0.0.0.255`);
            return { a: (I2(t) & ~wc) >>> 0, w: wc };
          }
          if (std) return { a: I2(t), w: 0 };
          E(ln, `หลัง ${role} <code>${t}</code> ต้องมี wildcard (ถ้าเครื่องเดียวใช้ <code>host ${t}</code> หรือ <code>${t} 0.0.0.0</code>)`); return null;
        }
        if (looksIf(t)) { E(ln, `ช่อง${role}ต้องเป็น address ใส่ชื่อ interface <code>${esc(t)}</code> ไม่ได้ (แบบที่สไลด์ p.42 ตีกรอบแดงไว้)`); return null; }
        E(ln, t ? `ช่อง${role}อ่านไม่ออก: <code>${esc(t)}</code>` : `ขาด${role}`); return null;
      };
      const portCond = () => {
        const op = w[i];
        if (!['eq', 'neq', 'gt', 'lt', 'range'].includes(op)) return null;
        const pv = x => x == null ? NaN : /^\d+$/.test(x) ? +x : (PORTN[x] != null ? PORTN[x] : NaN);
        if (op === 'range') { const a = pv(w[i + 1]), b = pv(w[i + 2]); i += 3; if (isNaN(a) || isNaN(b)) { E(ln, 'range ต้องมีเลข port สองตัว'); return null; } return { op, a, b }; }
        const a = pv(w[i + 1]); i += 2;
        if (isNaN(a)) { E(ln, `หลัง ${op} ต้องเป็นเลข port`); return null; }
        return { op, a };
      };
      const r = { num, std, act, ln, raw };
      if (std) {
        if (['ip', 'tcp', 'udp', 'icmp'].includes(w[3])) return E(ln, `เลข ${num} เป็น standard ACL ซึ่งดูได้แค่ต้นทาง ถ้าต้องระบุ protocol ปลายทาง หรือ port ต้องใช้เลข 100–199`);
        r.src = addr('ต้นทาง'); if (!r.src) return;
        if (w[i] === 'any' && i === 4) { W(ln, `standard ACL มีที่อยู่ได้ตัวเดียว IOS จริงเขียน <code>${act} any</code> (ชีทแล็บเขียน any any)`); i++; }
        if (w[i] === 'log') i++;
        if (i < w.length) return E(ln, `เลข ${num} เป็น standard ACL ใส่ได้แค่ต้นทาง ส่วนเกิน <code>${esc(w.slice(i).join(' '))}</code> ต้องใช้ extended (100–199)`);
      } else {
        let proto = w[3];
        if (proto === 'any' || proto === 'host' || isIP(proto)) { W(ln, `extended ACL ต้องมี protocol หลัง ${act} IOS จริงเขียน <code>${act} ip ...</code>`); proto = 'ip'; }
        else { i++; const pm = { 6: 'tcp', 17: 'udp', 1: 'icmp' }; if (pm[proto]) proto = pm[proto]; }
        if (!['ip', 'tcp', 'udp', 'icmp'].includes(proto)) return E(ln, `protocol <code>${esc(proto || '')}</code> ไม่รู้จัก ใช้ ip, tcp, udp หรือ icmp`);
        r.proto = proto;
        r.src = addr('ต้นทาง'); if (!r.src) return;
        r.sp = portCond();
        if (i >= w.length) return E(ln, 'extended ACL ต้องมีปลายทางด้วย (ถ้าไปที่ไหนก็ได้ใส่ <code>any</code>)');
        r.dst = addr('ปลายทาง'); if (!r.dst) return;
        r.dp = portCond();
        if ((r.sp || r.dp) && (proto === 'ip' || proto === 'icmp')) return E(ln, proto === 'icmp' ? 'ICMP (ping) ไม่มี port ใช้ <code>echo</code> แทน eq' : '<code>ip</code> ไม่มี port ถ้าจะระบุ port ต้องใช้ tcp หรือ udp');
        if (r.sp && !r.dp) W(ln, `port ${r.sp.a} อยู่หลัง<b>ต้นทาง</b> จึงเป็น port ต้นทาง (เลขสุ่มของ client) ปกติต้องวาง eq หลังปลายทาง`);
        r.icmp = null;
        if (proto === 'icmp' && w[i] != null && (ICMPT[w[i]] != null || /^\d+$/.test(w[i]))) { r.icmp = ICMPT[w[i]] != null ? ICMPT[w[i]] : +w[i]; i++; }
        if (w[i] === 'established') { r.est = true; i++; }
        if (w[i] === 'log') i++;
        if (i < w.length) return E(ln, `ส่วนเกินท้ายบรรทัด: <code>${esc(w.slice(i).join(' '))}</code>`);
      }
      (out.rules[num] = out.rules[num] || []).push(r);
    }
  }

  /* =====================================================================
     topology model shared by every figure
     ===================================================================== */
  const T0 = {
    r: 'R1', ifs: { A: 'f0/1', B: 'f0/0', I: 's0/0' },
    nets: { A: { net: '172.16.3.0', p: 24 }, B: { net: '172.16.4.0', p: 24 } },
    h: { A1: { ip: '172.16.3.2', side: 'A' }, A2: { ip: '172.16.3.100', side: 'A' }, A3: { ip: '172.16.3.13', side: 'A' }, S: { ip: '172.16.4.13', side: 'B' }, B2: { ip: '172.16.4.20', side: 'B' }, atk: { ip: '200.30.30.3', side: 'I' }, I2: { ip: '161.246.5.3', side: 'I' } },
  };
  const SVC = {
    all: { n: 'ทุกบริการ', proto: 'ip' }, web: { n: 'เว็บ (HTTP)', proto: 'tcp', p: 80 }, https: { n: 'HTTPS', proto: 'tcp', p: 443 },
    telnet: { n: 'Telnet', proto: 'tcp', p: 23 }, ssh: { n: 'SSH', proto: 'tcp', p: 22 }, ftp: { n: 'FTP', proto: 'tcp', p: [21, 20] },
    dns: { n: 'DNS', proto: 'udp', p: 53 }, ping: { n: 'ping', proto: 'icmp' }, smtp: { n: 'SMTP', proto: 'tcp', p: 25 },
  };
  const TESTSV = [['web', 'tcp', 80], ['https', 'tcp', 443], ['telnet', 'tcp', 23], ['ssh', 'tcp', 22], ['ftp', 'tcp', 21], ['ftp', 'tcp', 20], ['dns', 'udp', 53], ['ping', 'icmp', null], ['smtp', 'tcp', 25]];
  const svcHit = (svc, f) => {
    if (svc === 'all') return true;
    const d = SVC[svc];
    if (d.proto === 'icmp') return f.proto === 'icmp' && f.it === 8;
    return f.proto === d.proto && (Array.isArray(d.p) ? d.p.includes(f.dp) : f.dp === d.p);
  };
  const netTxt = n => `${n.net}/${n.p}`;
  const inNet = (ip, n) => IP.netOf(I2(ip), n.p) === I2(n.net);
  function selKind(T, key) {
    if (T.h[key]) return { kind: 'host', ip: T.h[key].ip, side: T.h[key].side };
    if (key === 'lanA') return { kind: 'net', ...T.nets.A, side: 'A' };
    if (key === 'lanB') return { kind: 'net', ...T.nets.B, side: 'B' };
    if (key === 'sub') return { kind: 'net', ...T.sub, side: 'A' };
    if (key === 'I') return { kind: 'inet', side: 'I' };
    return { kind: 'any', side: null };
  }
  function inSel(T, key, hk) {
    if (key === 'any') return true;
    if (T.h[key]) return key === hk;
    const h = T.h[hk];
    if (key === 'lanA') return h.side === 'A'; if (key === 'lanB') return h.side === 'B'; if (key === 'I') return h.side === 'I';
    if (key === 'sub') return inNet(h.ip, T.sub);
    return false;
  }
  const selName = (T, key) => {
    if (T.h[key]) return (key === 'S' ? 'Server ' : T.h[key].side === 'I' ? 'เครื่องบน Internet ' : 'PC ') + T.h[key].ip;
    return { lanA: 'วง ' + netTxt(T.nets.A), lanB: 'วง ' + netTxt(T.nets.B), sub: T.sub ? 'วง ' + netTxt(T.sub) : '', I: 'Internet', any: 'ทุกเครื่อง' }[key];
  };
  const sideName = (T, s) => s === 'I' ? 'Internet' : 'LAN ' + netTxt(T.nets[s]);
  const hostName = (T, hk) => selName(T, hk);

  // every flow that crosses the router, for every test service
  function allFlows(T) {
    const keys = Object.keys(T.h), out = [];
    for (const a of keys) for (const b of keys) {
      if (T.h[a].side === T.h[b].side) continue;
      for (const [k, proto, dp] of TESTSV) out.push({ sk: a, dk: b, svc: k, s: I2(T.h[a].ip), d: I2(T.h[b].ip), proto, dp: proto === 'icmp' ? null : dp, sp: proto === 'icmp' ? null : 49152, it: proto === 'icmp' ? 8 : null, ss: T.h[a].side, ds: T.h[b].side });
    }
    return out;
  }
  const expectBlocked = (T, req, f) => {
    const s = inSel(T, req.src, f.sk), d = inSel(T, req.dst, f.dk), v = svcHit(req.svc, f);
    return req.act === 'block' ? (s && d && v) : (!s && d && v);
  };
  // run a parsed answer on one flow: in at the source side, out at the destination side
  function simulate(parsed, f) {
    for (const pt of [{ side: f.ss, dir: 'in' }, { side: f.ds, dir: 'out' }]) {
      for (const ap of parsed.apps) {
        if (ap.side !== pt.side || ap.dir !== pt.dir) continue;
        const rules = parsed.rules[ap.num];
        if (!rules) continue; // undefined ACL lets everything through
        const ev = evalAcl(rules, f);
        if (ev.act === 'deny') return { blocked: true, ap, i: ev.i, rule: rules[ev.i] };
      }
    }
    return { blocked: false };
  }

  /* =====================================================================
     model answer generator (builder + drill worked answer)
     tokens: {t, r: role, x: explanation html}
     ===================================================================== */
  const TK = (t, r, x, k) => ({ t, r, x, k });
  function genAnswer(T, req) {
    const S = selKind(T, req.src), D = selKind(T, req.dst), sv = SVC[req.svc];
    if (S.side && D.side && S.side === D.side) return { invalid: `${selName(T, req.src)} กับ ${selName(T, req.dst)} อยู่ฝั่งเดียวกันของ router packet ไม่ผ่าน router เลย ACL บน router จึงทำอะไรไม่ได้` };
    if (req.act === 'only' && (S.kind === 'inet' || S.kind === 'any')) return { invalid: 'อนุญาตเฉพาะต้นทาง ต้องเลือกต้นทางที่เขียนเป็น address ได้ (เครื่องหรือวงใน LAN)' };
    const std = req.svc === 'all' && (D.kind === 'net' || D.kind === 'inet') && (S.kind === 'host' || S.kind === 'net');
    const num = std ? 10 : 110;
    let side, dir, placeWhy;
    if (std) { side = D.side; dir = 'out'; placeWhy = `standard วางใกล้ปลายทาง: ขาออกที่ไปหา ${sideName(T, side)} ถ้าวางใกล้ต้นทาง ${selName(T, req.src)} จะไปที่อื่นไม่ได้ด้วย`; }
    else if (req.act === 'only') { side = D.side; dir = 'out'; placeWhy = `ต้องจับ<b>ทุกเครื่อง</b>ที่ไปหา ${selName(T, req.dst)} ไม่ว่ามาจากขาไหน จึงวางที่ขาออกสู่ ${sideName(T, side)} จุดเดียวที่ทุก packet ต้องผ่าน`; }
    else if (D.kind === 'inet') { side = 'I'; dir = 'out'; placeWhy = `ปลายทางเป็น Internet ซึ่งเขียนได้แค่ any จึงวางที่ขาออก ${T.ifs.I} ที่มีแต่ packet กำลังออก Internet ถ้าวางขาเข้าฝั่ง LAN คำว่า any จะกินถึง server ภายในด้วย`; }
    else if (S.kind === 'any') { side = D.side; dir = 'out'; placeWhy = `ต้นทางคือทุกเครื่อง ซึ่งมาได้จากหลายขา จึงวางที่ขาออกสู่ ${sideName(T, side)} จุดเดียวที่ทุก packet ไปหาปลายทางต้องผ่าน`; }
    else { side = S.side; dir = 'in'; placeWhy = `extended วางใกล้ต้นทาง: ขาเข้าจาก ${sideName(T, side)} packet ถูกทิ้งทันทีที่เข้า router ไม่ต้องวิ่งต่อ`; }
    const ifn = T.ifs[side];

    const typeWhy = std ? `<b>Standard</b> (เลข 1–99): โจทย์สนใจแค่ว่า "มาจากใคร" ไปทั้ง${D.kind === 'inet' ? ' Internet' : 'วงปลายทาง'} ไม่ได้ระบุบริการ ดูแค่ต้นทางก็พอ`
      : `<b>Extended</b> (เลข 100–199): ` + (req.svc !== 'all' ? `โจทย์ระบุบริการ ${sv.n} ต้องดู protocol${sv.p ? ' และ port' : ''}` : D.kind === 'host' ? 'ปลายทางเป็นเครื่องเดียว standard ระบุปลายทางไม่ได้' : S.kind === 'inet' ? 'ต้นทางเป็น Internet เขียนได้แค่ any จึงต้องระบุปลายทางให้แคบลง' : 'ต้องระบุปลายทาง');

    const addr = (K, key, role) => {
      const who = role === 'src' ? 'ต้นทาง' : 'ปลายทาง';
      if (K.kind === 'host') return [TK('host', role, `<b>host</b> = wildcard 0.0.0.0 ต้องตรงทุกบิต ได้เครื่องเดียว (เขียน <code>${K.ip} 0.0.0.0</code> ก็ได้)`), TK(K.ip, role, `IP ${who}: ${selName(T, key)}`)];
      if (K.kind === 'net') {
        const m = IP.maskStr(K.p), w = wcStr(K.p), n0 = I2(K.net);
        return [TK(K.net, role, `เลขวง${who}: ${selName(T, key)}`), TK(w, role, `wildcard = 255.255.255.255 − ${m} = <b>${w}</b> จับได้ ${S2(n0)} ถึง ${S2(IP.bcastOf(n0, K.p))}`)];
      }
      if (K.kind === 'inet') return [TK('any', role, role === 'src' ? `Internet ไม่มีเลขวงที่แน่นอน จึงใช้ any แต่ ACL นี้อยู่ขาเข้า ${T.ifs.I} ซึ่งมีแต่ packet ที่มาจาก Internet` : `ปลายทางเป็น Internet ใช้ any และวาง ACL ที่ขาออก ${T.ifs.I} ซึ่งมีแต่ packet ที่กำลังออก Internet`)];
      return [TK('any', role, '<b>any</b> = ทุก address (0.0.0.0 255.255.255.255)')];
    };
    const head = (act, x) => [TK('access-list', 'kw', 'คำสั่งสร้าง ACL พิมพ์ในโหมด (config)# ทุกบรรทัดของชุดเดียวกันใช้เลขเดียวกัน'), TK(String(num), 'num', std ? `${num} อยู่ในช่วง 1–99 router จึงรู้ว่าเป็น standard ACL (ดูแค่ IP ต้นทาง)` : `${num} อยู่ในช่วง 100–199 router จึงรู้ว่าเป็น extended ACL (ดูต้นทาง ปลายทาง protocol และ port)`), TK(act, act, x)];
    const svcLines = req.svc === 'all' ? [{ proto: 'ip' }] : req.svc === 'ftp' ? [{ proto: 'tcp', port: 21 }, { proto: 'tcp', port: 20 }] : req.svc === 'ping' ? [{ proto: 'icmp', echo: true }] : [{ proto: sv.proto, port: sv.p }];
    const protoTok = l => TK(l.proto, 'proto', l.proto === 'ip' ? '<b>ip</b> = ทุก protocol เพราะโจทย์ไม่ได้ระบุบริการ' : l.proto === 'icmp' ? 'ping ใช้ <b>ICMP</b> ซึ่งไม่มี port' : `${sv.n} วิ่งบน <b>${l.proto.toUpperCase()}</b>`);
    const tail = l => l.echo ? [TK('echo', 'port', '<b>echo</b> = ICMP echo request คือ packet ที่ ping ส่งออกไป')] : l.port ? [TK('eq', 'port', '<b>eq</b> = เท่ากับ วางหลังปลายทาง จึงหมายถึง port ปลายทาง'), TK(String(l.port), 'port', req.svc === 'ftp' ? `FTP ใช้สอง port: 21 ควบคุม และ 20 ส่งข้อมูล ต้องเขียนทั้งสองบรรทัด` : `port ${l.port} = ${sv.n}`)] : [];
    const lines = [];
    const L = (toks, mode = 'c') => lines.push({ toks, mode });
    if (std) {
      if (req.act === 'block') {
        L([...head('deny', `ทิ้ง packet ที่มาจาก ${selName(T, req.src)}`), ...addr(S, req.src, 'src')]);
        L([...head('permit', 'ปิดท้ายให้ต้นทางอื่นผ่าน ถ้าไม่มีบรรทัดนี้ implicit deny จะทิ้งทุก packet ที่ออกขานี้'), TK('any', 'src', '<b>any</b> = ทุกต้นทาง (standard มีที่อยู่ช่องเดียว จึงเขียน any ตัวเดียว)')]);
      } else {
        L([...head('permit', `ให้ packet จาก ${selName(T, req.src)} ผ่าน`), ...addr(S, req.src, 'src')]);
        L([...head('deny', 'ต้นทางอื่นทิ้งทั้งหมด บรรทัดนี้เขียนหรือไม่เขียนก็ได้ผลเท่ากัน เพราะ implicit deny ทำให้อยู่แล้ว (สไลด์ p.39 เขียนไว้ให้เห็น)'), TK('any', 'src', '<b>any</b> = ทุกต้นทาง')]);
      }
    } else {
      if (req.act === 'block') {
        svcLines.forEach(l => L([...head('deny', `ทิ้ง packet ที่ตรงเงื่อนไขในบรรทัดนี้`), protoTok(l), ...addr(S, req.src, 'src'), ...addr(D, req.dst, 'dst'), ...tail(l)]));
      } else {
        svcLines.forEach(l => L([...head('permit', `ให้ ${selName(T, req.src)} ผ่าน ต้องอยู่<b>ก่อน</b>บรรทัด deny เพราะ ACL ตรวจบนลงล่าง`), protoTok(l), ...addr(S, req.src, 'src'), ...addr(D, req.dst, 'dst'), ...tail(l)]));
        svcLines.forEach(l => L([...head('deny', 'เครื่องอื่นที่ใช้บริการเดียวกันไปปลายทางนี้ ถูกทิ้ง'), protoTok(l), TK('any', 'src', '<b>any</b> = ต้นทางอื่นทุกเครื่อง (เครื่องที่อนุญาตถูกจับไปแล้วในบรรทัดก่อน)'), ...addr(D, req.dst, 'dst'), ...tail(l)]));
      }
      L([...head('permit', 'ปิดท้ายให้ traffic อื่นผ่านตามปกติ ถ้าไม่มี implicit deny จะทิ้งทุกอย่างที่ไม่ตรงบรรทัดบน'), TK('ip', 'proto', '<b>ip</b> = ทุก protocol'), TK('any', 'src', 'ทุกต้นทาง'), TK('any', 'dst', 'ทุกปลายทาง')]);
    }
    L([TK('interface', 'kw', `เข้าไปตั้งค่าขาของ router (ย่อ <code>int</code> ได้)`), TK(ifn, 'ink', `${ifn} คือขาที่ต่อกับ ${sideName(T, side)}`)]);
    L([TK('ip access-group', 'kw', 'ผูก ACL เข้ากับขานี้ ไม่มีบรรทัดนี้ ACL ไม่มีผลอะไรเลย'), TK(String(num), 'num', 'เลขต้องตรงกับ access-list ด้านบน'), TK(dir, 'ink', (dir === 'in' ? `<b>in</b> = ตรวจ packet ที่กำลัง<b>เข้า</b> router ทาง ${ifn} ` : `<b>out</b> = ตรวจ packet ที่กำลัง<b>ออก</b>จาก router ทาง ${ifn} `) + '(มองจากตัว router)')], 'i');
    return { std, num, side, dir, ifn, lines, typeWhy, placeWhy };
  }
  const ansText = A => A.lines.map(l => l.toks.map(t => t.t).join(' ')).join('\n');

  /* =====================================================================
     rendering helpers
     ===================================================================== */
  const RC = { kw: 'kw', num: 'ink', ink: 'ink', permit: 'permit', deny: 'deny', proto: 'proto', src: 'src', dst: 'dst', port: 'port' };
  function codeBlock(lines, { onTok, T = T0, prompt = true } = {}) {
    const box = el('div', { class: 'code' });
    lines.forEach(Ln => {
      const row = el('div', { class: 'cl' });
      if (prompt) row.append(el('span', { class: 'pr', text: `${T.r}(config${Ln.mode === 'i' ? '-if' : ''})#` }));
      Ln.toks.forEach(tk => {
        const b = el('button', { class: `tk r-${RC[tk.r] || 'ink'}`, text: tk.t });
        if (tk.k) b.dataset.k = tk.k; else if (onTok) b.addEventListener('click', () => { $$('.tk.on', box).forEach(x => x.classList.remove('on')); b.classList.add('on'); onTok(tk); });
        row.append(b);
      });
      box.append(row);
    });
    return box;
  }
  const tokHtml = (lines, T) => lines.map(Ln => `<span class="pr" style="color:var(--muted);font-size:12.5px">${T.r}(config${Ln.mode === 'i' ? '-if' : ''})#</span> ` + Ln.toks.map(t => `<span class="tk r-${RC[t.r] || 'ink'}">${esc(t.t)}</span>`).join(' '));
  function pills(host, items, cur, onPick, cls = '') {
    const box = el('div', { class: 'pills ' + cls, role: 'group' });
    items.forEach(([v, label]) => box.append(el('button', { class: 'pill', 'aria-pressed': String(v === cur), 'data-v': v, html: label, onclick: () => { $$('.pill', box).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); onPick(v); } })));
    host.append(box);
    return { box, set(v) { $$('.pill', box).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); } };
  }

  /* =====================================================================
     topology SVG
     ===================================================================== */
  const POS = { I: [210, 44], atk: [338, 42], R: [210, 150], swA: [100, 206], swB: [318, 206], A1: [52, 266], A2: [158, 266], S: [318, 264], ifA: [181.5, 164.5], ifB: [238.5, 164.5], ifI: [210, 114] };
  const SEG = { A1: ['A1', 'swA', 'ifA', 'R'], A2: ['A2', 'swA', 'ifA', 'R'], swA: ['swA', 'ifA', 'R'], S: ['S', 'swB', 'ifB', 'R'], swB: ['swB', 'ifB', 'R'], atk: ['atk', 'I', 'ifI', 'R'], I: ['I', 'ifI', 'R'] };
  const NODE_SIDE = { A1: 'A', A2: 'A', swA: 'A', S: 'B', swB: 'B', atk: 'I', I: 'I' };
  function drawTopo(host, T, { pick = false, concepts = false, ifPick = null, onPick = null } = {}) {
    const P = POS;
    const dk = key => concepts && key ? ` data-k="${key}"` : '';
    const hot = (node, inner, r = 28) => pick ? `<g class="hot" data-node="${node}" tabindex="0" role="button" aria-label="${node}"><circle class="ring" cx="${P[node][0]}" cy="${P[node][1]}" r="${r}"/><circle cx="${P[node][0]}" cy="${P[node][1]}" r="${r}" fill="transparent"/>${inner}</g>` : inner;
    const ln = (a, b) => `<path class="lk" d="M${P[a][0]} ${P[a][1]}L${P[b][0]} ${P[b][1]}"/>`;
    const txt = (x, y, t, cls, anchor = 'middle', key) => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}"${dk(key)}${key && concepts ? ' style="cursor:pointer"' : ''}>${esc(t)}</text>`;
    let s = ln('R', 'swA') + ln('R', 'swB') + ln('swA', 'A1') + ln('swA', 'A2') + ln('swB', 'S')
      + `<path class="lk dash" d="M232 44L312 42"/><path class="lk" d="M210 128L210 104L200 97L220 85L210 78L210 62"/>`;
    s += hot('I', Hop.dev('cloud', 210, 44, { s: 1.25 }), 32) + txt(172, 50, 'Internet', 'nm', 'end', concepts ? 'untrusted' : null);
    s += Hop.dev('attacker', 338, 40) + txt(338, 82, T.h.atk.ip, 'ipl');
    s += `<g${dk('firewall')}>${Hop.dev('router', 210, 150)}</g>` + txt(184, 128, T.r, 'nm', 'end');
    s += hot('swA', Hop.dev('switch', 100, 206)) + hot('swB', Hop.dev('switch', 318, 206));
    s += hot('A1', Hop.dev('pc', 52, 266)) + hot('A2', Hop.dev('pc', 158, 266)) + hot('S', Hop.dev('server', 318, 264));
    const stag = (T.h.A1.ip.length + T.h.A2.ip.length) > 24;
    s += txt(52, 305, T.h.A1.ip, 'ipl') + txt(158, stag ? 323 : 305, T.h.A2.ip, 'ipl') + txt(318, 305, T.h.S.ip, 'ipl');
    s += txt(100, stag ? 346 : 332, 'LAN ' + netTxt(T.nets.A), 'netl') + txt(318, stag ? 346 : 332, 'LAN ' + netTxt(T.nets.B), 'netl');
    s += txt(172, 152, T.ifs.A, 'ifl', 'end', concepts ? 'iface' : null) + txt(248, 152, T.ifs.B, 'ifl', 'start', concepts ? 'iface' : null) + txt(222, 124, T.ifs.I, 'ifl', 'start', concepts ? 'iface' : null);
    ['A', 'B', 'I'].forEach(sd => {
      const [x, y] = P['if' + sd];
      s += ifPick ? `<g class="ifhot" data-if="${sd}" role="button" tabindex="0" aria-label="${T.ifs[sd]}"><circle cx="${x}" cy="${y}" r="20" fill="transparent"/><circle class="bg" cx="${x}" cy="${y}" r="8"/></g>` : `<circle cx="${x}" cy="${y}" r="5" fill="var(--bg)" stroke="var(--ink-2)" stroke-width="2"/>`;
    });
    s += '<g class="bdl"></g><g class="pkl"></g>';
    const svg = el('svg', { class: 'topo', viewBox: `0 0 400 ${stag ? 356 : 342}`, role: 'img', 'aria-label': 'แผนภาพเครือข่าย', html: s });
    host.append(svg);
    const bdl = $('.bdl', svg), pkl = $('.pkl', svg);
    if (pick) svg.addEventListener('click', e => { const g = e.target.closest('.hot'); if (g && onPick) onPick(g.dataset.node); });
    if (ifPick) svg.addEventListener('click', e => { const g = e.target.closest('.ifhot'); if (g) ifPick(g.dataset.if); });
    svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const g = e.target.closest('.hot,.ifhot'); if (g) { e.preventDefault(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } } });
    const fade = (g, delay) => new Promise(res => setTimeout(() => { const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, fill: 'forwards' }); a.onfinish = () => { g.remove(); res(); }; }, delay));
    return {
      svg,
      path(src, dst) { const a = SEG[src].map(n => P[n]), b = SEG[dst].map(n => P[n]).reverse(); return { pts: a.concat(b.slice(1)), inI: a.length - 2, outI: a.length }; },
      clearPk() { pkl.innerHTML = ''; },
      mark(node, cls) { $$('.hot', svg).forEach(g => g.classList.remove(cls)); if (node) { const g = $(`.hot[data-node="${node}"]`, svg); if (g) g.classList.add(cls); } },
      ifOn(side) { $$('.ifhot', svg).forEach(g => g.classList.toggle('on', g.dataset.if === side)); },
      badge(side, dir, { k = false } = {}) {
        bdl.innerHTML = '';
        if (!side) return;
        const p = P['if' + side], R = P.R;
        let v = [p[0] - R[0], p[1] - R[1]]; const L = Math.hypot(...v); v = [v[0] / L, v[1] / L];
        const n = side === 'B' ? [-v[1], v[0]] : [v[1], -v[0]];
        const c = [p[0] + n[0] * 22, p[1] + n[1] * 22];
        const sgn = dir === 'out' ? 1 : -1;
        const a = [c[0] - v[0] * 12 * sgn, c[1] - v[1] * 12 * sgn], b = [c[0] + v[0] * 12 * sgn, c[1] + v[1] * 12 * sgn];
        const u = [(b[0] - a[0]) / 24, (b[1] - a[1]) / 24];
        const head = `${b[0] + u[0] * 4},${b[1] + u[1] * 4} ${b[0] - u[0] * 5 + u[1] * 5},${b[1] - u[1] * 5 - u[0] * 5} ${b[0] - u[0] * 5 - u[1] * 5},${b[1] - u[1] * 5 + u[0] * 5}`;
        const tp = [c[0] + n[0] * 17, c[1] + n[1] * 17 + 5];
        bdl.innerHTML = `<g class="badge"${k ? ' data-k="acl" style="cursor:pointer"' : ''}>${Hop.dev('firewall', p[0], p[1], { s: .55 })}</g>`
          + `<g${k ? ` data-k="${dir === 'in' ? 'inbound' : 'outbound'}" style="cursor:pointer"` : ''}><path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round"/><polygon points="${head}" fill="var(--ink)"/>`
          + `<text x="${tp[0]}" y="${tp[1]}" text-anchor="middle" class="ifl">${dir}</text></g>`;
        bdl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      },
      mover(color) {
        const g = el('g', { class: 'pk' }); g.innerHTML = `<circle r="9" fill="${color}" stroke="var(--bg)" stroke-width="3"/>`;
        pkl.append(g);
        const place = (x, y) => g.setAttribute('transform', `translate(${x} ${y})`);
        return {
          go(pts, dur) {
            return new Promise(res => {
              if (pts.length < 2) { place(...pts[0]); return res(); }
              const seg = []; let tot = 0;
              for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
              dur = dur || Math.max(420, tot * 4.4);
              const t0 = performance.now(); place(...pts[0]);
              const tick = now => {
                if (!g.isConnected) return res();
                const k = clamp((now - t0) / dur, 0, 1); let dist = easeIO(k) * tot, i = 0;
                while (i < seg.length - 1 && dist > seg[i]) { dist -= seg[i]; i++; }
                const f = seg[i] ? clamp(dist / seg[i], 0, 1) : 1;
                place(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f));
                if (k < 1) requestAnimationFrame(tick); else res();
              };
              requestAnimationFrame(tick);
            });
          },
          drop() { g.innerHTML = `<circle r="11" fill="var(--c-rose)" stroke="var(--bg)" stroke-width="3"/><path d="M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5" stroke="var(--bg)" stroke-width="2.6" stroke-linecap="round"/>`; g.firstChild.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' }); return fade(g, 1100); },
          done() { return fade(g, 250); },
        };
      },
    };
  }
  const flowOf = (T, sk, dk, proto, dp) => ({ sk, dk, s: I2(T.h[sk].ip), d: I2(T.h[dk].ip), proto, dp: proto === 'icmp' ? null : dp, sp: proto === 'icmp' ? null : 49152, it: proto === 'icmp' ? 8 : null, ss: T.h[sk].side, ds: T.h[dk].side });

  /* =====================================================================
     MAP HERO
     ===================================================================== */
  (() => {
    const host = $('#map');
    const wrap = el('div', { class: 'hero' }); host.append(wrap);
    const left = el('div'), right = el('div'); wrap.append(left, right);
    const topo = drawTopo(left, T0, { concepts: true });
    topo.badge('B', 'out', { k: true });
    const PK = [
      { v: 'web', n: 'PC เปิดเว็บ server', src: 'A1', dst: 'S', proto: 'tcp', dp: 80 },
      { v: 'tel', n: 'PC telnet ไป server', src: 'A1', dst: 'S', proto: 'tcp', dp: 23 },
      { v: 'atk', n: 'คนนอก telnet ไป server', src: 'atk', dst: 'S', proto: 'tcp', dp: 23 },
      { v: 'ping', n: 'คนนอก ping server', src: 'atk', dst: 'S', proto: 'icmp' },
    ];
    let cur = 'tel', run = 0;
    pills(right, PK.map(p => [p.v, p.n]), cur, v => { cur = v; play(); });
    const hdr = el('div', { class: 'hdr' }); right.append(hdr);
    right.append(el('div', { class: 'lbl2', text: 'ACL ที่ตั้งไว้บน R1' }));
    const k = (t, r, kk) => TK(t, r, '', kk);
    const lines = [
      { toks: [k('access-list', 'kw', 'acl'), k('110', 'num', 'aclnum'), k('deny', 'deny', 'deny'), k('tcp', 'proto', 'tcp'), k('any', 'src', 'anykw'), k('host', 'dst', 'hostkw'), k('172.16.4.13', 'dst', 'dstip'), k('eq', 'port', 'eq'), k('23', 'port', 'port')] },
      { toks: [k('access-list', 'kw', 'acl'), k('110', 'num', 'aclnum'), k('permit', 'permit', 'permit'), k('ip', 'proto', 'proto'), k('any', 'src', 'anykw'), k('any', 'dst', 'anykw')] },
      { toks: [k('interface', 'kw', 'iface'), k('f0/0', 'ink', 'iface')] },
      { toks: [k('ip access-group', 'kw', 'accessgroup'), k('110', 'num', 'aclnum'), k('out', 'ink', 'outbound')], mode: 'i' },
    ];
    const code = codeBlock(lines); right.append(code);
    const rows = $$('.cl', code);
    const say = el('p', { class: 'say' }); right.append(say);
    const rules = parseCmds('access-list 110 deny tcp any host 172.16.4.13 eq 23\naccess-list 110 permit ip any any').rules[110];
    function fields(p) {
      const f = (key, n, v) => { const c = Hop.C[key]; return el('button', { class: 'hf', 'data-k': key, style: `--tc: var(--c-${c.c})`, html: `<div class="n">${n}</div><div class="v">${v}</div>` }); };
      hdr.replaceChildren(f('srcip', 'IP ต้นทาง', T0.h[p.src].ip), f('dstip', 'IP ปลายทาง', T0.h[p.dst].ip), f('proto', 'Protocol', p.proto.toUpperCase()), f('port', 'Port ปลายทาง', p.dp == null ? 'ไม่มี' : p.dp + (p.dp === 23 ? ' Telnet' : p.dp === 80 ? ' HTTP' : '')));
    }
    async function play() {
      const my = ++run, p = PK.find(x => x.v === cur);
      topo.clearPk(); fields(p);
      rows.forEach(r => r.classList.remove('hit', 'dim'));
      const who = p.src === 'atk' ? `เครื่องบน Internet ${T0.h.atk.ip}` : `PC ${T0.h.A1.ip}`;
      const inIf = T0.ifs[NODE_SIDE[p.src]];
      say.innerHTML = `packet ออกจาก${who} เข้า router ทาง ${inIf} (ขาเข้า ${inIf} ไม่มี ACL จึงผ่านไปก่อน)`;
      const path = topo.path(p.src, p.dst);
      const m = topo.mover(p.src === 'atk' ? 'var(--c-rose)' : 'var(--ink)');
      await m.go(path.pts.slice(0, path.outI + 1));
      if (my !== run) return;
      const f = flowOf(T0, p.src, p.dst, p.proto, p.dp), ev = evalAcl(rules, f);
      rows.forEach((r, i) => { if (i < 2) r.classList.add(i === ev.i ? 'hit' : 'dim'); else r.classList.add('hit'); });
      const skip = ev.i > 0 ? `บรรทัด 1 ไม่ตรง (${whyNot(rules[0], f)}) ` : '';
      if (ev.act === 'deny') {
        say.innerHTML = `จะออกทาง f0/0 จึงถูกตรวจด้วย ACL 110 ขาออก ${skip}บรรทัด ${ev.i + 1} ตรง: <b style="color:var(--c-rose)">deny</b> packet ถูกทิ้งตรงนี้ ไม่ถึง server`;
        m.drop();
      } else {
        say.innerHTML = `จะออกทาง f0/0 จึงถูกตรวจด้วย ACL 110 ขาออก ${skip}บรรทัด ${ev.i + 1} ตรง: <b style="color:var(--c-green)">permit</b> ส่งต่อถึง server`;
        await m.go(path.pts.slice(path.outI));
        if (my === run) m.done();
      }
    }
    fields(PK[1]);
    say.innerHTML = 'เลือก packet ด้านบน แล้วดูว่ามันผ่าน ACL ที่ขา f0/0 ได้หรือไม่ แตะคำไหนในรูปหรือในคำสั่งเพื่อดูความหมาย';
    Hop.onView(host, () => setTimeout(play, 300));
  })();

  /* =====================================================================
     1. firewall types vs attacks
     ===================================================================== */
  (() => {
    const host = $('#fig-fw');
    const TYPES = {
      pf: { n: 'Packet Filtering', ly: [3, 4], sees: 'อ่าน header ของทีละ packet: IP ต้นทาง ปลายทาง protocol และ port ตามกฎใน ACL ไม่จำว่าก่อนหน้าเกิดอะไร', pro: ['ราคาถูก', 'ทำงานเร็ว', 'รองรับการขยายเครือข่าย'], con: ['ไม่ตรวจ packet ที่สร้างผิดปกติ', 'ถูกปลอม IP (spoofing) ได้'] },
      stateful: { n: 'Stateful Inspection', ly: [3, 4, 7], sees: 'ทำทุกอย่างที่ packet filter ทำ บวกกับจำสถานะการเชื่อมต่อ (three-way handshake) ใน state table', pro: ['ตรวจสอบสถานะ', 'เปิด/ปิด port เฉพาะตอนเชื่อมต่อ', 'ทำหน้าที่คล้าย IDS'], con: ['ราคาสูง', 'ตรวจแค่สถานะ ไม่อ่านเนื้อหา'] },
      proxy: { n: 'Application Proxy', ly: [7], sees: 'เป็นตัวแทนรับการเชื่อมต่อ อ่านเนื้อหาชั้น application แล้วเปิดการเชื่อมต่อใหม่ไปหาปลายทางเอง', pro: ['ซ่อน IP ภายใน (IP Address Protection)', 'ตรวจรูปแบบ protocol'], con: ['ทำงานช้า', 'ส่งต่อเฉพาะ protocol ที่รู้จัก'] },
      hybrid: { n: 'Adaptive / Hybrid', ly: [3, 4, 7], sees: 'รวมการกรอง packet, การจำสถานะ และการตรวจเนื้อหาไว้ในตัวเดียว เป็น hardware, software หรือ cloud', pro: ['ครอบคลุมการโจมตีได้กว้างที่สุด'], con: ['ราคาและความซับซ้อนสูง'] },
      personal: { n: 'Personal (Hosted)', ly: [3, 4, 7], sees: 'ติดตั้งบนเครื่องปลายทางเครื่องเดียว (ในภาพนี้คือตัว server) มากับ OS เช่น Windows Firewall', pro: ['ราคาถูกหรือฟรี', 'มากับ OS'], con: ['ป้องกันแค่เครื่องที่ติดตั้ง', 'ต้องตั้งค่าทีละเครื่อง'] },
    };
    const LANES = [
      { k: 'web', n: 'คนนอกเปิดเว็บ server', d: 'packet ปกติ port 80', atk: false },
      { k: 'tel', n: 'Telnet จาก Internet', d: 'port 23 ที่ไม่ได้อนุญาต', atk: true },
      { k: 'spoof', n: 'IP Spoofing', d: 'ปลอม IP ต้นทางเป็นเครื่องภายใน', atk: true },
      { k: 'rep', n: '"คำตอบ" ที่ไม่มีใครขอ', d: 'แอบอ้างว่าเป็น packet ตอบกลับ', atk: true },
      { k: 'mal', n: 'Malware ใน HTTP', d: 'header ปกติ แต่เนื้อในอันตราย', atk: true },
      { k: 'dos', n: 'DDoS', d: 'request จำนวนมหาศาล', atk: true },
      { k: 'sniff', n: 'Sniffing', d: 'แอบอ่านข้อมูลระหว่างทาง', atk: true },
    ];
    const SNIFF = ['pass', 'ไม่ได้ส่ง packet มาให้ firewall ตัดสิน แค่แอบอ่านบนสาย ต้องใช้การเข้ารหัส (HTTPS, VPN)'];
    const M = {
      pf: { web: ['pass', 'ตรงกฎที่เปิด port 80'], tel: ['block', 'port 23 ไม่มีในกฎ ถูก ACL ทิ้ง'], spoof: ['pass', 'ตัดสินจาก IP ใน header ซึ่งถูกปลอมมา (ข้อเสียในสไลด์ p.43)'], rep: ['pass', 'ไม่จำว่าใครเคยขออะไร ถ้ากฎเปิดให้คำตอบกลับเข้ามา ของปลอมก็ผ่าน'], mal: ['pass', 'ไม่อ่านเนื้อใน packet เห็นแค่ว่าไป port 80'], dos: ['part', 'บล็อกได้แค่ IP หรือ port ที่รู้ว่าเป็นตัวปัญหา'], sniff: SNIFF },
      stateful: { web: ['pass', 'เปิดการเชื่อมต่อถูกขั้นตอน จดลง state table'], tel: ['block', 'port 23 ไม่มีในกฎ'], spoof: ['part', 'SYN แรกยังผ่าน แต่คำตอบไปหาเครื่องที่ถูกปลอม การเชื่อมต่อไม่สำเร็จ packet ต่อๆ ไปไม่มีใน state table'], rep: ['block', 'ไม่มีการเชื่อมต่อนี้ใน state table จึงทิ้ง'], mal: ['pass', 'ตรวจแค่สถานะ ไม่อ่านเนื้อหา (ข้อเสียในสไลด์ p.45)'], dos: ['part', 'จำกัดการเชื่อมต่อที่เปิดค้างได้ แต่ถ้าท่วมสายก็ช่วยไม่ได้'], sniff: SNIFF },
      proxy: { web: ['pass', 'proxy รับคำขอ แล้วเปิดการเชื่อมต่อใหม่ไปหา server แทน'], tel: ['block', 'ไม่มี proxy สำหรับ protocol นี้ ส่งต่อเฉพาะที่รู้จัก'], spoof: ['block', 'ต้องเชื่อมต่อกับ proxy ให้ครบก่อน IP ปลอมทำ handshake ไม่สำเร็จ'], rep: ['block', 'เครื่องข้างในไม่เคยคุยกับข้างนอกตรงๆ คำตอบปลอมไม่มีที่ไป'], mal: ['block', 'อ่านเนื้อหาและตรวจรูปแบบ protocol ได้'], dos: ['down', 'ทำงานช้าอยู่แล้ว ถูกถล่มจนล่มง่าย (กระทบ Availability)'], sniff: SNIFF },
      hybrid: { web: ['pass', 'ผ่านทุกชั้นการตรวจ'], tel: ['block', 'port 23 ไม่มีในกฎ'], spoof: ['block', 'ตรวจทั้งสถานะและชั้น application'], rep: ['block', 'ไม่มีใน state table'], mal: ['block', 'ตรวจเนื้อหาได้'], dos: ['part', 'รับได้มากกว่า แต่ถ้าเกินกำลังก็ยังล่ม'], sniff: SNIFF },
      personal: { web: ['pass', 'เครื่องนี้เปิดบริการเว็บไว้'], tel: ['block', 'ปิด port ที่เครื่องนี้ไม่ใช้'], spoof: ['part', 'จำการเชื่อมต่อของตัวเองได้ แต่ไม่ช่วยเครื่องอื่น'], rep: ['block', 'จำการเชื่อมต่อของเครื่องตัวเอง'], mal: ['part', 'ช่วยได้เมื่อใช้คู่กับ anti-virus บนเครื่อง'], dos: ['pass', 'ทราฟฟิกมาถึงตัวเครื่องแล้ว เครื่องก็ยังหนักอยู่ดี'], sniff: SNIFF },
    };
    let cur = 'pf', run = 0;
    pills(host, Object.keys(TYPES).map(k => [k, TYPES[k].n]), cur, v => { cur = v; draw(); fire(); });
    const card = el('div', { class: 'fwcard' }); host.append(card);
    const info = el('div', { class: 'fwinfo' }); const lanes = el('div', { class: 'lanes' });
    card.append(info, lanes);
    const laneEls = LANES.map(L => {
      const dot = el('div', { class: 'dot' + (L.atk ? ' atk' : '') }), wall = el('div', { class: 'wall' }), res = el('div', { class: 'res' }), why = el('div', { class: 'why' });
      const ln = el('div', { class: 'lane open' }, el('div', { class: 'lab', html: `${esc(L.n)} <span>${esc(L.d)}</span>` }), el('div', { class: 'trk' }, wall, dot), res, why);
      lanes.append(ln); return { L, ln, dot, wall, res, why };
    });
    function draw() {
      const t = TYPES[cur];
      const lyName = { 3: 'Network (IP)', 4: 'Transport (port, สถานะ)', 7: 'Application (เนื้อหา)' };
      info.innerHTML = `<h3>${t.n}</h3><div class="layers">${[3, 4, 7].map(l => `<span class="ly ${t.ly.includes(l) ? 'on' : ''}">L${l} ${lyName[l]}</span>`).join('')}</div><p>${t.sees}</p><div class="pc"><div><div class="h">ข้อดี</div><ul>${t.pro.map(x => `<li>${x}</li>`).join('')}</ul></div><div><div class="h">ข้อเสีย</div><ul>${t.con.map(x => `<li>${x}</li>`).join('')}</ul></div></div>`;
    }
    function fire() {
      const my = ++run;
      laneEls.forEach(({ L, dot, wall, res, why }, i) => {
        const [o, w] = M[cur][L.k];
        res.classList.remove('on'); why.textContent = w;
        dot.getAnimations().forEach(a => a.cancel()); wall.getAnimations().forEach(a => a.cancel());
        const W = dot.parentNode.clientWidth, wx = W * .58 - 6, end = W - 12;
        const good = L.atk ? (o === 'block') : (o === 'pass');
        const word = { pass: 'ผ่าน', block: 'ถูกบล็อก', part: 'ผ่านบางส่วน', down: 'ล่ม' }[o];
        const judge = !L.atk ? '' : o === 'block' ? '<span class="g">กันได้</span>' : o === 'part' ? '' : '<span class="b">กันไม่ได้</span>';
        res.innerHTML = `<span class="${!L.atk ? 'g' : o === 'block' ? 'g' : o === 'part' ? 'm' : 'b'}">${word}</span>${judge ? '<br>' + judge : ''}`;
        let kf, dur = 1300;
        if (L.k === 'sniff') { kf = [{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${end}px)`, opacity: 1, offset: .85 }, { transform: `translateX(${end}px)`, opacity: 0 }]; }
        else if (o === 'pass') kf = [{ transform: 'translateX(0)' }, { transform: `translateX(${wx}px)`, offset: .45 }, { transform: `translateX(${end}px)`, opacity: 1, offset: .88 }, { transform: `translateX(${end}px)`, opacity: 0 }];
        else if (o === 'block') kf = [{ transform: 'translateX(0)' }, { transform: `translateX(${wx - 4}px)`, offset: .45 }, { transform: `translateX(${wx - 22}px) scale(.8)`, opacity: .8, offset: .62 }, { transform: `translateX(${wx - 22}px) scale(.4)`, opacity: 0 }];
        else if (o === 'part') kf = [{ transform: 'translateX(0)' }, { transform: `translateX(${wx}px)`, offset: .45 }, { transform: `translateX(${end}px) scale(.6)`, opacity: .45, offset: .88 }, { transform: `translateX(${end}px) scale(.6)`, opacity: 0 }];
        else kf = [{ transform: 'translateX(0)' }, { transform: `translateX(${wx - 4}px)`, offset: .45 }, { transform: `translateX(${wx - 4}px)`, opacity: 1, offset: .8 }, { transform: `translateX(${wx - 4}px)`, opacity: 0 }];
        const a = dot.animate(kf, { duration: dur, delay: i * 140, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' });
        if (o === 'down') wall.animate([{ opacity: .85 }, { opacity: .2 }, { opacity: .85 }, { opacity: .2 }, { opacity: .85 }], { duration: 700, delay: i * 140 + 600 });
        setTimeout(() => { if (my === run) res.classList.add('on'); }, i * 140 + dur * .5);
      });
    }
    draw();
    Hop.onView(host, fire, .25);
    addEventListener('resize', () => { clearTimeout(fire._t); fire._t = setTimeout(fire, 300); });
  })();
  Hop.mcq($('#q-fw'), {
    q: 'Firewall แบบใดติดตาม TCP three-way handshake และเก็บการเชื่อมต่อไว้ใน state table',
    opts: ['Packet Filtering', 'Stateful Inspection', 'Application Proxy', 'Personal Firewall'], a: 1,
    whyWrong: { 0: 'Packet filtering ดูทีละ packet แยกกัน ไม่จำว่าการเชื่อมต่อไหนเปิดอยู่', 2: 'Application proxy เด่นที่การเป็นตัวแทนและอ่านเนื้อหาชั้น application', 3: 'Personal firewall บอกแค่ว่าติดตั้งบนเครื่องเดียว ไม่ได้บอกวิธีตรวจ' },
    why: 'Stateful inspection ดู SYN → SYN,ACK → ACK แล้วจดว่าการเชื่อมต่อ Established packet ที่ไม่อยู่ในการเชื่อมต่อที่รู้จักจะถูกทิ้ง ข้อเสียคือราคาสูงและไม่อ่านเนื้อหา',
  });
  Hop.mcq($('#q-fw'), {
    q: 'ข้อใดเป็นข้อเสียของ Packet Filtering ตามสไลด์',
    opts: ['ทำงานช้าเพราะต้องเปิดการเชื่อมต่อใหม่ทุกครั้ง', 'ถูกหลอกด้วยการปลอม IP และกรอง packet ที่สร้างผิดปกติไม่ได้', 'ป้องกันได้แค่เครื่องเดียว', 'ส่งต่อได้เฉพาะ protocol ที่รู้จัก'], a: 1,
    whyWrong: { 0: 'นี่คือข้อเสียของ application proxy packet filtering เด่นเรื่องเร็ว', 2: 'นี่คือข้อจำกัดของ personal firewall', 3: 'นี่คือข้อเสียของ application proxy' },
    why: 'packet filtering ตัดสินจาก header อย่างเดียว ถ้า IP ต้นทางถูกปลอม หรือเนื้อข้างในผิดปกติ มันมองไม่เห็น ข้อดีของมันคือถูก เร็ว และขยายได้',
  });

  /* =====================================================================
     2. ACL walker
     ===================================================================== */
  (() => {
    const host = $('#fig-list');
    const VER = [
      { v: 0, n: 'ตามลำดับ', l: ['deny host 172.16.3.2', 'permit 172.16.3.0 0.0.0.255'] },
      { v: 1, n: 'สลับลำดับ', l: ['permit 172.16.3.0 0.0.0.255', 'deny host 172.16.3.2'] },
      { v: 2, n: 'เพิ่ม permit any ท้ายสุด', l: ['deny host 172.16.3.2', 'permit 172.16.3.0 0.0.0.255', 'permit any'] },
    ];
    const PKS = [['172.16.3.2', 'PC ที่ต้องการห้าม'], ['172.16.3.100', 'PC อื่นใน LAN'], ['200.30.30.3', 'เครื่องบน Internet']];
    let ver = 0, pk = '172.16.3.2', run = 0;
    const walk = el('div', { class: 'walk' }); host.append(walk);
    pills(walk, VER.map(x => [x.v, x.n]), ver, v => { ver = +v; build(); go(); });
    const pkRow = el('div', { class: 'wl-pk' }); walk.append(pkRow);
    pills(walk, PKS.map(([ip, n]) => [ip, `<span class="mono">${ip}</span>`]), pk, v => { pk = v; go(); });
    walk.lastChild.style.marginBottom = '14px';
    const headEl = el('div', { class: 'wl-head', text: 'access-list 10 (ทุกบรรทัดขึ้นต้นด้วยคำนี้)' });
    const rowsEl = el('div', { class: 'wl-rows' });
    walk.append(headEl, rowsEl);
    const say = el('p', { class: 'say' }); walk.append(say);
    let rules = [], rowEls = [], scan;
    const tokRole = (w, i, arr) => w === 'permit' ? 'permit' : w === 'deny' ? 'deny' : 'src';
    function build() {
      const V = VER[ver];
      rules = parseCmds(V.l.map(x => 'access-list 10 ' + x).join('\n')).rules[10];
      rowsEl.innerHTML = '';
      scan = el('div', { class: 'wl-scan' }); rowsEl.append(scan);
      rowEls = V.l.map((x, i) => {
        const kk = w => w === 'permit' ? 'permit' : w === 'deny' ? 'deny' : w === 'host' ? 'hostkw' : w === 'any' ? 'anykw' : w === '0.0.0.255' ? 'wildcard' : 'srcip';
        const r = el('div', { class: 'wl-row' }, el('span', { class: 'n', text: i + 1 }), el('span', { html: x.split(' ').map((w, j) => `<button class="tk r-${tokRole(w)}" data-k="${kk(w)}">${w}</button>`).join(' ') }), el('span', { class: 'cmp' }));
        rowsEl.append(r); return r;
      });
      const imp = el('div', { class: 'wl-row imp' }, el('span', { class: 'n', text: '' }), el('span', { html: `<button class="tk r-deny" data-k="implicit" style="opacity:.7">deny any</button> <span style="font:500 13px var(--font)">implicit deny มองไม่เห็น</span>` }), el('span', { class: 'cmp' }));
      rowsEl.append(imp); rowEls.push(imp);
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    async function go() {
      const my = ++run;
      const f = { s: I2(pk), d: I2('172.16.4.13'), proto: 'tcp', dp: 80, sp: 49152 };
      const ev = evalAcl(rules, f), stop = ev.i < 0 ? rowEls.length - 1 : ev.i;
      pkRow.innerHTML = '';
      const cardEl = el('div', { class: 'card', html: `${pk} <span>IP ต้นทาง</span>` }); pkRow.append(cardEl);
      cardEl.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
      rowEls.forEach(r => { const c = r.lastChild; c.className = 'cmp'; c.textContent = ''; });
      scan.className = 'wl-scan'; scan.style.opacity = '0';
      say.textContent = '';
      await sleep(280);
      for (let i = 0; i <= stop; i++) {
        if (my !== run) return;
        const r = rowEls[i];
        scan.style.transform = `translateY(${r.offsetTop}px)`; scan.style.height = r.offsetHeight + 'px'; scan.style.opacity = '1';
        await sleep(420);
        if (my !== run) return;
        const c = r.lastChild;
        if (i < stop) { c.textContent = 'ไม่ตรง ข้าม'; c.className = 'cmp on no'; }
        else { const a = ev.i < 0 ? 'deny' : ev.act; c.textContent = `ตรง → ${a}`; c.className = 'cmp on ' + (a === 'permit' ? 'yp' : 'yd'); scan.classList.add(a); }
        await sleep(i < stop ? 260 : 120);
      }
      if (my !== run) return;
      const a = ev.i < 0 ? 'deny' : ev.act;
      if (a === 'permit') cardEl.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(60px)', opacity: 0 }], { duration: 520, delay: 200, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
      else cardEl.animate([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)', opacity: 1 }, { opacity: .25 }], { duration: 700, delay: 150, fill: 'forwards' });
      const n = stop + 1;
      let t;
      if (ev.i < 0) t = `${pk} ไม่ตรงบรรทัดไหนเลย จึงตกไปถึง <b style="color:var(--c-rose)">implicit deny</b> ที่ซ่อนอยู่ท้ายสุด ถูกทิ้ง ` + (ver !== 2 ? 'ถ้าโจทย์ต้องการให้เครื่องอื่นผ่านด้วย ต้องเพิ่ม permit any ท้ายรายการ' : '');
      else if (ver === 1 && pk === '172.16.3.2') t = `172.16.3.2 อยู่ในวง 172.16.3.0 จึง<b style="color:var(--c-green)">ตรงบรรทัด 1 (permit) ไปก่อน</b> บรรทัด deny host 172.16.3.2 ข้างล่างไม่ถูกอ่านเลย ACL นี้จึงไม่ได้ห้ามอะไร ต้องเอาบรรทัดเจาะจงขึ้นก่อน`;
      else t = `${pk} ตรงบรรทัด ${n} (${a}) ` + (a === 'permit' ? '<b style="color:var(--c-green)">ผ่าน</b>' : '<b style="color:var(--c-rose)">ถูกทิ้ง</b>') + (n < rules.length ? ` บรรทัดที่เหลือไม่ถูกอ่าน` : '') + (ver === 2 && pk === '200.30.30.3' ? ' เพราะเราเพิ่ม permit any ไว้ท้ายสุด ทุกเครื่องที่ไม่ถูก deny จึงผ่าน' : '');
      say.innerHTML = t;
    }
    build();
    Hop.onView(host, go);
  })();
  Hop.mcq($('#q-list'), {
    q: 'ACL 5 มีบรรทัดเดียวคือ <code>access-list 5 deny host 172.16.3.2</code> แล้ว apply out ที่ f0/0 ถ้าเครื่อง 172.16.3.100 ส่ง packet ไป server ในวง f0/0 จะเกิดอะไรขึ้น',
    opts: ['ผ่าน เพราะไม่ตรงกับบรรทัด deny', 'ถูกทิ้ง เพราะ implicit deny ท้าย ACL', 'ถูกทิ้ง เพราะตรงกับบรรทัด deny', 'router แจ้ง error เพราะ ACL ไม่มี permit'], a: 1,
    whyWrong: { 0: 'ไม่ตรงบรรทัด deny ก็จริง แต่ยังไม่จบ ท้ายทุก ACL มี deny any ที่มองไม่เห็นรออยู่', 2: '172.16.3.100 ไม่ใช่ host 172.16.3.2 จึงไม่ตรงบรรทัดนี้', 3: 'IOS รับ ACL ที่มีแต่ deny ได้ ไม่มี error แต่ผลคือทิ้งทุกอย่าง' },
    why: 'ACL ที่มีแต่ deny บล็อกทุกเครื่อง ต้องเพิ่ม <code>access-list 5 permit any</code> ไว้ท้ายสุด',
  });

  /* =====================================================================
     3. wildcard bits
     ===================================================================== */
  Hop.eq($('#eq-wc'), [['wildcard', 'wildcard'], ' = 255.255.255.255 − ', ['smask', 'subnet mask']], { sym: { wildcard: 'wildcard', smask: 'mask' } });
  (() => {
    const host = $('#fig-wc');
    const PRE = [['172.16.3.0', 8, '172.16.3.0 0.0.0.255'], ['172.16.3.0', 16, '172.16.3.0 0.0.255.255'], ['192.168.10.64', 5, '192.168.10.64 0.0.0.31'], ['172.16.1.4', 2, '172.16.1.4 0.0.0.3'], ['172.16.4.13', 0, 'host 172.16.4.13'], ['0.0.0.0', 32, 'any']];
    const TESTS = ['172.16.3.100', '172.16.4.7', '172.16.200.1', '192.168.10.70', '192.168.10.100', '172.16.1.6', '172.16.4.13'];
    let A = I2('172.16.3.0'), k = 8, test = I2('172.16.3.100'), sel = 3;
    const pre = pills(host, PRE.map((p, i) => [i, `<span class="mono">${p[2]}</span>`]), 0, i => { A = I2(PRE[i][0]); k = PRE[i][1]; sl.value = k; firstSel(); upd(); });
    const ctr = el('div', { class: 'ctrls' }, el('span', { class: 'readout', text: 'บิตที่ไม่สนใจ' }));
    const sl = el('input', { type: 'range', class: 'slider', min: 0, max: 32, value: k, 'aria-label': 'จำนวนบิต 1 ใน wildcard' });
    const kOut = el('span', { class: 'readout' });
    ctr.append(sl, kOut); host.append(ctr);
    sl.addEventListener('input', () => { k = +sl.value; pre.set(-1); upd(); });
    host.append(el('div', { class: 'lbl2', text: 'packet ที่จะทดสอบ' }));
    pills(host, TESTS.map(t => [t, `<span class="mono">${t}</span>`]), '172.16.3.100', t => { test = I2(t); upd(); });
    host.append(el('div', { style: 'height:18px' }));
    const grid = el('div', { class: 'wgrid' }); host.append(grid);
    const bits = el('div', { class: 'wbits' }); host.append(bits);
    const sum = el('div', { class: 'wsum' }); host.append(sum);
    const oct = (n, i) => (n >>> (24 - 8 * i)) & 255;
    function firstSel() { const w = k ? (2 ** k - 1) : 0; sel = 3; for (let i = 0; i < 4; i++) { const o = oct(w, i); if (o !== 0 && o !== 255) { sel = i; return; } } }
    function upd() {
      const W = k === 32 ? ALL : k ? (2 ** k - 1) >>> 0 : 0;
      sl.style.setProperty('--p', (k / 32 * 100) + '%');
      kOut.textContent = `${k} บิต`;
      grid.innerHTML = '';
      grid.append(el('div'), ...[0, 1, 2, 3].map(i => el('div', { class: 'rl', style: 'text-align:center', text: 'octet ' + (i + 1) })));
      const row = (lab, fn) => { grid.append(el('div', { class: 'rl', html: lab })); for (let i = 0; i < 4; i++) { const [t, c] = fn(i); grid.append(el('button', { class: 'oc ' + c + (i === sel ? ' sel' : ''), text: t, onclick: () => { sel = i; upd(); } })); } };
      const wc = i => oct(W, i), cls = i => wc(i) === 0 ? 'm' : wc(i) === 255 ? 'ig' : 'mix';
      row('ใน ACL', i => [oct(A, i), cls(i)]);
      row('wildcard', i => [wc(i), cls(i)]);
      const okOct = i => ((oct(A, i) ^ oct(test, i)) & ~wc(i) & 255) === 0;
      row('packet', i => [oct(test, i), wc(i) === 255 ? 'ig' : okOct(i) ? 'ok' : 'bad']);
      grid.append(el('div'));
      for (let i = 0; i < 4; i++) { const w = wc(i); grid.append(el('div', { class: 'vd ' + (w === 255 ? '' : okOct(i) ? 'ok' : 'bad'), text: w === 255 ? 'ข้าม' : w === 0 ? (okOct(i) ? 'ตรง' : 'ไม่ตรง') : (okOct(i) ? 'บิตตรง' : 'บิตไม่ตรง') })); }
      // bits of the selected octet
      bits.innerHTML = '';
      bits.append(el('div', { class: 'rl', text: 'octet ' + (sel + 1) }), ...[128, 64, 32, 16, 8, 4, 2, 1].map(v => el('div', { class: 'pv', text: v })));
      const a = oct(A, sel), w = wc(sel), t = oct(test, sel);
      const bitRow = (lab, val, fn) => { bits.append(el('div', { class: 'rl', text: lab })); for (let j = 7; j >= 0; j--) bits.append(el('div', { class: 'bit ' + fn(j), text: (val >> j) & 1 })); };
      bitRow('ใน ACL', a, j => (w >> j) & 1 ? 'ig' : 'm');
      bitRow('wildcard', w, j => (w >> j) & 1 ? 'w1' : 'w0');
      bitRow('packet', t, j => (w >> j) & 1 ? 'ig' : (((a ^ t) >> j) & 1) ? 'bad' : 'ok');
      const base = (A & ~W) >>> 0, last = (base | W) >>> 0, hit = addrMatch({ a: base, w: W }, test);
      const cnt = k === 32 ? '4,294,967,296' : (2 ** k).toLocaleString();
      const written = k === 0 ? `host ${S2(A)}` : k === 32 ? 'any' : `${S2(A)} ${S2(W)}`;
      const mask = S2((~W) >>> 0);
      const badOct = [0, 1, 2, 3].find(i => !okOct(i) && wc(i) !== 255);
      sum.innerHTML = `<code>${written}</code> จับ address ได้ <b class="m">${S2(base)} ถึง ${S2(last)}</b> (${cnt} ตัว) `
        + `${k > 0 && k < 32 ? `เท่ากับวง /${32 - k} ซึ่งมี subnet mask ${mask} ตรวจ: 255.255.255.255 − ${mask} = ${S2(W)}` : ''}<br>`
        + `packet ${S2(test)}: ` + (hit ? '<b style="color:var(--good)">ตรง</b> ทุกบิตที่ wildcard เป็น 0 ตรงกันหมด' : `<b style="color:var(--bad)">ไม่ตรง</b> octet ที่ ${badOct + 1} มีบิตที่ต้องตรงแต่ไม่ตรง`);
    }
    upd();
  })();
  Hop.mcq($('#q-wc'), {
    q: 'ต้องการให้ ACL จับทั้งวง 192.168.10.64/27 ต้องเขียน address กับ wildcard อย่างไร',
    opts: ['192.168.10.64 0.0.0.31', '192.168.10.64 255.255.255.224', '192.168.10.64 0.0.0.32', '192.168.10.64 0.0.0.224'], a: 0,
    whyWrong: { 1: '255.255.255.224 คือ subnet mask ใน ACL ต้องกลับด้านเป็น wildcard', 2: '32 คือขนาดวง wildcard คือขนาดวงลบ 1 (บิต host เป็น 1 หมด = 31)', 3: '224 คือ octet สุดท้ายของ mask ไม่ได้กลับด้าน' },
    why: '/27 → mask 255.255.255.224 → wildcard = 255 − 224 = 31 → 0.0.0.31 ในฐานสอง 224 = 11100000 กลับด้านเป็น 00011111 = 31 จับ .64 ถึง .95',
  });
  Hop.mcq($('#q-wc'), {
    q: 'สไลด์ p.39 เขียน <code>access-list 12 permit 172.16.3.0 0.0.255.255</code> บรรทัดนี้ permit ต้นทางช่วงใด',
    opts: ['172.16.3.0 ถึง 172.16.3.255 เท่านั้น', '172.16.0.0 ถึง 172.16.255.255', 'เฉพาะเครื่อง 172.16.3.0', '172.16.3.0 ถึง 172.16.4.255'], a: 1,
    whyWrong: { 0: 'นั่นคือ wildcard 0.0.0.255 ตัวนี้เป็น 255 สอง octet หลัง จึงไม่สน octet ที่ 3 ด้วย', 2: 'เครื่องเดียวต้องใช้ wildcard 0.0.0.0', 3: 'octet ที่ 3 ถูกข้ามทั้ง octet จึงเป็นอะไรก็ได้ 0–255 ไม่ใช่แค่ 3 กับ 4' },
    why: 'wildcard 0.0.255.255: สอง octet แรกต้องเป็น 172.16 สอง octet หลังไม่สนใจ จึงจับทุก 172.16.x.x ในรูปสไลด์จึงหมายถึง "ทุกเครื่องที่ไม่ได้มาจาก non-172.16.0.0"',
  });

  /* =====================================================================
     4. standard vs extended + placement
     ===================================================================== */
  (() => {
    const host = $('#tbl-type');
    host.innerHTML = `<table class="ctable"><thead><tr><th></th><th>Standard</th><th>Extended</th></tr></thead><tbody>
      <tr><td>ดูอะไรได้</td><td>${Hop.t('srcip')} อย่างเดียว</td><td>${Hop.t('srcip', 'ต้นทาง')}, ${Hop.t('dstip', 'ปลายทาง')}, ${Hop.t('proto', 'protocol')}, ${Hop.t('port')}</td></tr>
      <tr><td>เลข ACL</td><td class="mono">1–99<br>1300–1999</td><td class="mono">100–199<br>2000–2699</td></tr>
      <tr><td>วางที่ไหน</td><td>ใกล้<b>ปลายทาง</b></td><td>ใกล้<b>ต้นทาง</b></td></tr></tbody></table>`;
    const k = (t, r, kk) => TK(t, r, '', kk);
    host.append(el('div', { class: 'lbl2', text: 'รูปแบบ Standard' }), codeBlock([{ toks: [k('access-list', 'kw', 'acl'), k('1–99', 'num', 'aclnum'), k('permit', 'permit', 'permit'), k('|', 'kw'), k('deny', 'deny', 'deny'), k('ต้นทาง', 'src', 'srcip'), k('wildcard', 'src', 'wildcard')] }], { prompt: false }));
    host.append(el('div', { class: 'lbl2', text: 'รูปแบบ Extended' }), codeBlock([{ toks: [k('access-list', 'kw', 'acl'), k('100–199', 'num', 'aclnum'), k('permit', 'permit', 'permit'), k('|', 'kw'), k('deny', 'deny', 'deny'), k('protocol', 'proto', 'proto'), k('ต้นทาง', 'src', 'srcip'), k('wildcard', 'src', 'wildcard'), k('ปลายทาง', 'dst', 'dstip'), k('wildcard', 'dst', 'wildcard'), k('eq', 'port', 'eq'), k('port', 'port', 'port')] }], { prompt: false }));
    host.append(el('div', { class: 'lbl2', text: 'ผูกกับขาของ router (เหมือนกันทั้งสองแบบ)' }), codeBlock([{ toks: [k('interface', 'kw', 'iface'), k('ขา', 'ink', 'iface')] }, { toks: [k('ip access-group', 'kw', 'accessgroup'), k('เลข', 'num', 'aclnum'), k('in', 'ink', 'inbound'), k('|', 'kw'), k('out', 'ink', 'outbound')] }], { prompt: false }));
    host.append(el('p', { html: `สไลด์ p.38 เขียนช่องนี้ว่า [mask] หมายถึง wildcard mask ส่วนสไลด์ p.42 ใส่ <code>S0/0</code> ลงในช่องปลายทาง ซึ่งเป็นชื่อขา ไม่ใช่ address (กรอบแดงในสไลด์ชี้จุดนี้) ช่องต้นทางและปลายทางต้องเป็น address + wildcard, host หรือ any เท่านั้น` }));
  })();
  (() => {
    const host = $('#fig-place');
    const box = el('div', { class: 'place' }); host.append(box);
    const left = el('div'), right = el('div'); box.append(left, right);
    let type = 'std', side = 'A', dir = 'in', run = 0;
    const topo = drawTopo(left, T0, { ifPick: s => { side = s; ifSel.set(side + dir); upd(); } });
    pills(right, [['std', 'Standard ACL 10'], ['ext', 'Extended ACL 110']], type, v => { type = v; upd(); });
    right.append(el('div', { style: 'height:8px' }));
    const ifSel = pills(right, ['A', 'B', 'I'].flatMap(s => ['in', 'out'].map(d => [s + d, `<span class="mono">${T0.ifs[s]} ${d}</span>`])), side + dir, v => { side = v[0]; dir = v.slice(1); upd(); });
    const codeHost = el('div', { style: 'margin-top:14px' }); right.append(codeHost);
    const flowsEl = el('div', { class: 'flows' }); const verdict = el('div', { class: 'verdict' });
    box.append(el('div', {}, flowsEl, verdict));
    box.lastChild.style.gridColumn = '1 / -1';
    const FL = [
      { sk: 'A1', dk: 'S', n: 'PC 172.16.3.2 → Server', want: true },
      { sk: 'A1', dk: 'atk', n: 'PC 172.16.3.2 → Internet', want: false },
      { sk: 'A2', dk: 'S', n: 'PC 172.16.3.100 → Server', want: false },
      { sk: 'atk', dk: 'S', n: 'Internet → Server', want: false },
    ];
    function upd() {
      const my = ++run;
      ifSel.set(side + dir);
      topo.ifOn(side); topo.badge(side, dir);
      const txt = type === 'std' ? 'access-list 10 deny host 172.16.3.2\naccess-list 10 permit any' : 'access-list 110 deny ip host 172.16.3.2 host 172.16.4.13\naccess-list 110 permit ip any any';
      const num = type === 'std' ? 10 : 110;
      const parsed = parseCmds(txt + `\ninterface ${T0.ifs[side]}\nip access-group ${num} ${dir}`, T0);
      const k = (t, r, kk) => TK(t, r, '', kk);
      const n = String(num);
      const L1 = type === 'std' ? [k('access-list', 'kw', 'acl'), k(n, 'num', 'aclnum'), k('deny', 'deny', 'deny'), k('host', 'src', 'hostkw'), k('172.16.3.2', 'src', 'srcip')] : [k('access-list', 'kw', 'acl'), k(n, 'num', 'aclnum'), k('deny', 'deny', 'deny'), k('ip', 'proto', 'proto'), k('host', 'src', 'hostkw'), k('172.16.3.2', 'src', 'srcip'), k('host', 'dst', 'hostkw'), k('172.16.4.13', 'dst', 'dstip')];
      const L2 = type === 'std' ? [k('access-list', 'kw', 'acl'), k(n, 'num', 'aclnum'), k('permit', 'permit', 'permit'), k('any', 'src', 'anykw')] : [k('access-list', 'kw', 'acl'), k(n, 'num', 'aclnum'), k('permit', 'permit', 'permit'), k('ip', 'proto', 'proto'), k('any', 'src', 'anykw'), k('any', 'dst', 'anykw')];
      codeHost.replaceChildren(codeBlock([{ toks: L1 }, { toks: L2 }, { toks: [k('interface', 'kw', 'iface'), k(T0.ifs[side], 'ink', 'iface')] }, { toks: [k('ip access-group', 'kw', 'accessgroup'), k(n, 'num', 'aclnum'), k(dir, 'ink', dir === 'in' ? 'inbound' : 'outbound')], mode: 'i' }]));
      const res = FL.map(F => ({ F, r: simulate(parsed, flowOf(T0, F.sk, F.dk, 'tcp', 80)) }));
      flowsEl.replaceChildren(...res.map(({ F, r }) => el('div', { class: 'flow' }, el('div', { html: `${F.n}<div class="w">ต้องการ: ${F.want ? 'ถูกบล็อก' : 'ผ่าน'}</div>` }), el('div', { class: 'r ' + (r.blocked === F.want ? 'g' : 'b'), html: (r.blocked ? 'ถูกบล็อก' : 'ผ่าน') + '<br>' + (r.blocked === F.want ? 'ตรงโจทย์' : 'ผิด') }))));
      const over = res.filter(x => x.r.blocked && !x.F.want), miss = res.filter(x => !x.r.blocked && x.F.want);
      const where = `${T0.ifs[side]} ${dir}`;
      let v, good = false;
      if (miss.length) v = `<b>ไม่ได้ผล:</b> ที่ ${where} ACL ไม่เคยเจอ packet จาก 172.16.3.2 ที่ไปหา server ` + (dir === 'out' && side === 'A' ? '(packet ของ PC นี้<b>เข้า</b> router ทาง f0/1 ไม่ได้ออก)' : dir === 'in' && side === 'B' ? '(packet ไปหา server <b>ออก</b>ทาง f0/0 ไม่ได้เข้า)' : '(packet คู่นี้ไม่ผ่านขานี้เลย)');
      else if (over.length) v = `<b>บล็อกเกิน:</b> ${over.map(x => x.F.n).join(', ')} ถูกบล็อกไปด้วย ` + (type === 'std' ? 'standard ดูแค่ต้นทาง ACL นี้ห้าม 172.16.3.2 ไป<b>ทุกที่</b>ที่ผ่านขานี้ ต้องย้ายไปใกล้ปลายทาง (f0/0 out)' : '');
      else if (type === 'std') { good = true; v = '<b>ถูกต้อง:</b> standard วางใกล้ปลายทาง (f0/0 out) จึงห้ามแค่ทางที่ไปหา LAN ของ server' + ' ข้อจำกัดคือ 172.16.3.2 จะเข้าเครื่องอื่นในวง 172.16.4.0 ไม่ได้ด้วย ถ้าโจทย์ต้องการห้ามแค่ server ให้ใช้ extended'; }
      else if (side === 'A') { good = true; v = '<b>ถูกต้องและดีที่สุด:</b> extended ระบุปลายทางได้ จึงวางใกล้ต้นทาง (f0/1 in) packet ถูกทิ้งทันทีที่เข้า router'; }
      else { good = true; v = '<b>ใช้ได้</b> แต่ packet วิ่งข้าม router มาก่อนแล้วค่อยถูกทิ้ง ตามหลัก extended วางใกล้ต้นทาง (f0/1 in)'; }
      verdict.className = 'verdict ' + (good ? 'good' : 'bad'); verdict.innerHTML = v;
      // animate the four flows
      topo.clearPk();
      res.forEach(({ F, r }, i) => setTimeout(async () => {
        if (my !== run) return;
        const p = topo.path(F.sk, F.dk), m = topo.mover(F.sk === 'atk' ? 'var(--c-rose)' : F.sk === 'A1' ? 'var(--c-blue)' : 'var(--ink)');
        if (r.blocked) { await m.go(p.pts.slice(0, (r.ap.dir === 'in' ? p.inI : p.outI) + 1), 900); if (my === run) m.drop(); }
        else { await m.go(p.pts, 1500); if (my === run) m.done(); }
      }, i * 260));
    }
    Hop.onView(host, upd, .3);
    upd();
  })();
  Hop.mcq($('#q-type'), {
    q: 'โจทย์: ห้ามทุกเครื่องในวง 172.16.3.0/24 telnet ไปยัง server 172.16.4.13 ต้องใช้ ACL ชนิดไหน และเลขใดใช้ได้',
    opts: ['Standard เลข 10', 'Extended เลข 101', 'Standard เลข 101', 'Extended เลข 10'], a: 1,
    whyWrong: { 0: 'standard ดูได้แค่ต้นทาง ระบุว่า "telnet ไป server" ไม่ได้', 2: '101 อยู่ในช่วง 100–199 ซึ่งเป็น extended ไม่ใช่ standard', 3: 'เลข 10 อยู่ในช่วง 1–99 router จะถือเป็น standard และไม่รับ protocol/ปลายทาง' },
    why: 'ต้องระบุปลายทาง (server) และบริการ (tcp port 23) จึงต้อง extended ซึ่งใช้เลข 100–199 หรือ 2000–2699: <code>access-list 101 deny tcp 172.16.3.0 0.0.0.255 host 172.16.4.13 eq 23</code>',
  });
  Hop.mcq($('#q-type'), {
    q: 'สไลด์ p.41 สร้าง ACL 120 ที่อนุญาต packet <b>ไปหา</b> server 172.16.4.13 แล้วเขียน <code>int f0/0</code> <code>ip access-group 120 in</code> ตามหลักควรเป็นทิศไหน',
    opts: ['in ถูกแล้ว เพราะ packet เข้าหา server', 'out เพราะ packet ไปหา server ออกจาก router ทาง f0/0', 'ทิศไหนก็ได้ ผลเหมือนกัน', 'ต้อง apply ที่ s0/0 เท่านั้น'], a: 1,
    whyWrong: { 0: 'in/out มองจากตัว router ไม่ใช่จาก server packet ที่ไปหา server กำลังออกจาก router', 2: 'ไม่เหมือนกัน แบบ in ที่ f0/0 จะตรวจ packet ที่ server ส่งออกมา และ deny any any ท้ายสุดจะทิ้ง packet ของ server เอง', 3: 'packet จาก LAN 172.16.3.0 ไม่ผ่าน s0/0 เลย' },
    why: 'ACL 120 เขียนถึง packet ที่มีปลายทางเป็น server ซึ่งออกทาง f0/0 จึงต้องเป็น out (ชีทแล็บ 7 ใช้ out ที่ f0/0) ถ้าเจอรูปนี้ในข้อสอบให้ตอบตามหลักและอธิบายทิศ',
  });
  Hop.mcq($('#q-type'), {
    q: 'ต้องการให้เฉพาะเครื่อง 172.16.3.13 telnet เข้า<b>ตัว router</b> ได้ ข้อใดถูก',
    opts: ['<code>access-list 5 permit host 172.16.3.13</code> แล้ว <code>line vty 0 4</code> <code>access-class 5 in</code>', '<code>access-list 5 permit host 172.16.3.13</code> แล้ว <code>int f0/1</code> <code>ip access-group 5 in</code>', '<code>access-list 105 permit tcp host 172.16.3.13 any eq 80</code>', '<code>line vty 0 4</code> <code>ip access-group 5 in</code>'], a: 0,
    whyWrong: { 1: 'ACL ที่ f0/1 in แบบนี้จะทิ้งทุก packet จากเครื่องอื่นใน LAN ที่จะผ่าน router ไปที่อื่นด้วย ไม่ใช่แค่ telnet', 2: 'telnet คือ port 23 ไม่ใช่ 80 และ any ปลายทางไม่ได้จำกัดที่ตัว router', 3: 'บน line vty ใช้คำสั่ง access-class ไม่ใช่ ip access-group' },
    why: 'การ telnet เข้าตัว router คือ Management Access (สไลด์ p.36) ใช้ standard ACL ผูกกับ line vty ด้วย access-class',
  });

  /* =====================================================================
     5. ports
     ===================================================================== */
  (() => {
    const host = $('#fig-port');
    const P = [
      { s: 'Telnet', p: '23', q: 'tcp', ex: 'access-list 110 deny tcp any host 172.16.4.13 eq 23', x: 'remote login แบบไม่เข้ารหัส password วิ่งเป็นตัวอักษรธรรมดา (ชีทแล็บมี port นี้)' },
      { s: 'SSH', p: '22', q: 'tcp', ex: 'access-list 110 permit tcp 172.16.3.0 0.0.0.255 host 172.16.4.13 eq 22', x: 'remote login แบบเข้ารหัส ตัวแทนที่ปลอดภัยของ Telnet' },
      { s: 'HTTP เว็บ', p: '80', q: 'tcp', ex: 'access-list 110 permit tcp any host 172.16.4.13 eq 80', x: 'เว็บแบบไม่เข้ารหัส (สไลด์ p.41 บรรทัดแรก)' },
      { s: 'HTTPS', p: '443', q: 'tcp', ex: 'access-list 110 permit tcp any host 172.16.4.13 eq 443', x: 'เว็บผ่าน SSL/TLS' },
      { s: 'FTP', p: '20, 21', q: 'tcp', ex: 'access-list 101 deny tcp any host 172.16.4.13 eq 21\naccess-list 101 deny tcp any host 172.16.4.13 eq 20', x: 'ส่งไฟล์ ใช้สอง port: 21 ควบคุม, 20 ส่งข้อมูล บล็อก FTP ทั้งหมดต้องเขียนทั้งสองบรรทัด (ชีทแล็บ 7 หน้า 4)' },
      { s: 'DNS', p: '53', q: 'udp', ex: 'access-list 110 deny udp 172.16.3.0 0.0.0.255 any eq 53', x: 'แปลงชื่อเป็น IP ปกติใช้ UDP' },
      { s: 'SMTP อีเมล', p: '25', q: 'tcp', ex: 'access-list 110 permit tcp any host 172.16.4.13 eq 25', x: 'ส่งอีเมลระหว่าง mail server' },
      { s: 'SNMP', p: '161', q: 'udp', ex: 'access-list 110 deny udp any any eq 161', x: 'ใช้จัดการอุปกรณ์เครือข่าย (ชีทแล็บมี port นี้)' },
      { s: 'DHCP', p: '67, 68', q: 'udp', ex: 'access-list 110 permit udp any any eq 67', x: 'แจก IP อัตโนมัติ: server ฟังที่ 67, client ที่ 68' },
      { s: 'Ping', p: null, q: 'icmp', ex: 'access-list 110 deny icmp any host 172.16.4.13 echo', x: 'ใช้ ICMP ไม่มี port เขียน echo ต่อท้ายปลายทางแทน eq' },
    ];
    const grid = el('div', { class: 'ports' }); host.append(grid);
    const out = el('div', { style: 'margin-top:16px' }); host.append(out);
    const role = (w, i, arr) => {
      if (i < 2) return i ? 'num' : 'kw';
      if (w === 'permit' || w === 'deny') return w;
      if (['tcp', 'udp', 'icmp', 'ip'].includes(w)) return 'proto';
      if (w === 'eq' || w === 'echo' || arr[i - 1] === 'eq') return 'port';
      const pi = arr.findIndex(x => ['tcp', 'udp', 'icmp', 'ip'].includes(x));
      // source = first address group after protocol
      let j = pi + 1, sEnd = arr[j] === 'any' ? j : j + 1;
      return i <= sEnd ? 'src' : 'dst';
    };
    function show(i) {
      $$('.pt', grid).forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      const d = P[i];
      const lines = d.ex.split('\n').map(l => { const w = l.split(' '); return { toks: w.map((t, j) => TK(t, role(t, j, w))) }; });
      out.replaceChildren(codeBlock(lines, { prompt: false }), el('p', { class: 'say', html: `<b>${d.s}</b> ${d.p ? `ใช้ <span style="color:var(--c-amber);font-weight:600">${d.q.toUpperCase()}</span> port <span style="color:var(--c-teal);font-weight:600">${d.p}</span>` : `ใช้ <span style="color:var(--c-amber);font-weight:600">ICMP</span>`}: ${d.x}` }));
    }
    P.forEach((d, i) => grid.append(el('button', { class: 'pt', 'aria-pressed': 'false', onclick: () => show(i), html: `<div class="s">${d.s}</div><div class="p ${d.p ? '' : 'none'}">${d.p || 'ไม่มี port'}</div><div class="q">${d.q.toUpperCase()}</div>` })));
    show(0);
  })();
  Hop.mcq($('#q-port'), {
    q: 'ต้องการห้ามเครื่องจาก Internet ping server 172.16.4.13 แต่ให้ใช้เว็บได้ บรรทัดแรกควรเป็นข้อใด',
    opts: ['<code>access-list 112 deny icmp any host 172.16.4.13 echo</code>', '<code>access-list 112 deny tcp any host 172.16.4.13 eq 7</code>', '<code>access-list 112 deny ip any host 172.16.4.13</code>', '<code>access-list 12 deny icmp any host 172.16.4.13</code>'], a: 0,
    whyWrong: { 1: 'ping ไม่ได้ใช้ TCP และไม่มี port', 2: 'ip = ทุก protocol บรรทัดนี้ห้ามเว็บไปด้วย', 3: 'เลข 12 คือ standard ใส่ protocol กับปลายทางไม่ได้' },
    why: 'ping = ICMP echo request ระบุ <code>icmp</code> และต่อท้ายด้วย <code>echo</code> แล้วอย่าลืมปิดท้ายด้วย <code>access-list 112 permit ip any any</code>',
  });

  /* =====================================================================
     6. builder
     ===================================================================== */
  (() => {
    const host = $('#fig-build');
    const box = el('div', { class: 'bld' }); host.append(box);
    const left = el('div'), right = el('div'); box.append(left, right);
    const NODE2SEL = { A1: 'A1', A2: 'A2', swA: 'lanA', S: 'S', swB: 'lanB', I: 'I' };
    const SEL2NODE = { A1: 'A1', A2: 'A2', lanA: 'swA', S: 'S', lanB: 'swB', I: 'I' };
    let src = 'A1', dst = 'S', svc = 'telnet', act = 'block', mode = 'src';
    const topo = drawTopo(left, T0, { pick: true, onPick: n => { const s = NODE2SEL[n]; if (!s) return; if (mode === 'src') { src = s; mode = 'dst'; } else { dst = s; mode = 'src'; } upd(); } });
    left.append(el('p', { class: 'say', style: 'text-align:center;min-height:0', html: 'แตะ PC, switch (ทั้งวง), server หรือเมฆ Internet' }));
    const picked = el('div', { class: 'picked' }); right.append(picked);
    const anyRow = el('div', { class: 'row', style: 'margin:8px 0 0' }); right.append(anyRow);
    const anyBtn = el('button', { class: 'pill', 'aria-pressed': 'false', text: 'ต้นทาง = ทุกเครื่อง (any)', onclick: () => { src = src === 'any' ? 'A1' : 'any'; mode = 'dst'; upd(); } });
    anyRow.append(anyBtn);
    right.append(el('div', { class: 'lbl2', text: 'บริการ' }));
    pills(right, [['all', 'ทุกอย่าง'], ['web', 'เว็บ 80'], ['telnet', 'Telnet 23'], ['ssh', 'SSH 22'], ['ftp', 'FTP 20, 21'], ['ping', 'Ping'], ['dns', 'DNS 53']], svc, v => { svc = v; upd(); });
    right.append(el('div', { class: 'lbl2', text: 'ต้องการ' }));
    const actP = pills(right, [['block', 'ห้ามต้นทางนี้'], ['only', 'อนุญาตเฉพาะต้นทางนี้']], act, v => { act = v; upd(); });
    const out = el('div', { style: 'grid-column:1/-1' }); box.append(out);
    function upd() {
      picked.replaceChildren(
        el('button', { 'aria-pressed': String(mode === 'src'), style: '--tc: var(--c-blue)', onclick: () => { mode = 'src'; upd(); }, html: `<div class="n">ต้นทาง ${mode === 'src' ? '(กำลังเลือก)' : ''}</div><div class="v">${esc(selName(T0, src))}</div>` }),
        el('button', { 'aria-pressed': String(mode === 'dst'), style: '--tc: var(--c-violet)', onclick: () => { mode = 'dst'; upd(); }, html: `<div class="n">ปลายทาง ${mode === 'dst' ? '(กำลังเลือก)' : ''}</div><div class="v">${esc(selName(T0, dst))}</div>` }));
      anyBtn.setAttribute('aria-pressed', String(src === 'any'));
      topo.mark(SEL2NODE[src], 'src'); topo.mark(SEL2NODE[dst], 'dst');
      const A = genAnswer(T0, { src, dst, svc, act });
      if (A.invalid) { topo.badge(null); out.replaceChildren(el('div', { class: 'verdict bad', html: A.invalid })); return; }
      topo.badge(A.side, A.dir);
      const tkx = el('div', { class: 'tkx', html: '<span style="color:var(--muted)">แตะคำไหนในคำสั่งเพื่อดูว่าทำไมต้องเขียนแบบนั้น</span>' });
      const code = codeBlock(A.lines, { onTok: tk => { const c = { src: 'blue', dst: 'violet', proto: 'amber', port: 'teal', permit: 'green', deny: 'rose' }[tk.r]; tkx.style.setProperty('--tc', c ? `var(--c-${c})` : 'var(--ink)'); tkx.innerHTML = `<div class="h">${esc(tk.t)}</div>${tk.x}`; } });
      out.replaceChildren(el('p', { class: 'why2', html: A.typeWhy }), code, tkx, el('p', { class: 'why2', html: `<b>วางที่ ${A.ifn} ${A.dir}</b>: ${A.placeWhy}` }));
      code.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    }
    upd();
  })();

  /* =====================================================================
     7. drill
     ===================================================================== */
  const R = Hop.rnd, pick = Hop.pick;
  function mkTopo() {
    const ifs = pick([{ A: 'f0/1', B: 'f0/0', I: 's0/0' }, { A: 'g0/0', B: 'g0/1', I: 's0/0/0' }, { A: 'f0/0', B: 'f0/1', I: 's0/0/1' }, { A: 'g0/1', B: 'g0/0', I: 's0/1/0' }]);
    const fam = pick(['172.16', '192.168', '10.1', '172.20']);
    const a3 = R(1, 60), b3 = a3 + R(1, 9);
    const pA = pick([24, 24, 24, 25, 26]);
    const blk = 2 ** (32 - pA), aOff = blk * R(0, 256 / blk - 1);
    const A = { net: `${fam}.${a3}.${aOff}`, p: pA }, B = { net: `${fam}.${b3}.0`, p: 24 };
    const hostIn = (n, used) => { let ip; do { ip = S2(I2(n.net) + R(2, 2 ** (32 - n.p) - 2)); } while (used.includes(ip)); used.push(ip); return ip; };
    const used = [];
    const T = { r: pick(['R1', 'R1', 'Router']), ifs, nets: { A, B }, h: {} };
    T.h.A1 = { ip: hostIn(A, used), side: 'A' }; T.h.A2 = { ip: hostIn(A, used), side: 'A' }; T.h.A3 = { ip: hostIn(A, used), side: 'A' };
    T.h.S = { ip: `${fam}.${b3}.${pick([10, 13, 50, 100, 200, 250])}`, side: 'B' }; used.push(T.h.S.ip);
    T.h.B2 = { ip: hostIn(B, used), side: 'B' };
    T.h.atk = { ip: pick(['200.30.30.3', '203.150.10.9', '161.246.5.3', '58.97.20.14']), side: 'I' };
    T.h.I2 = { ip: T.h.atk.ip === '8.8.8.8' ? '1.1.1.1' : '8.8.8.8', side: 'I' };
    return T;
  }
  const TPL = [
    T => { const s = pick(['telnet', 'web', 'ftp', 'ssh']); return { req: { src: 'A1', dst: 'S', svc: s, act: 'block' }, txt: `ห้ามเครื่อง ${T.h.A1.ip} ใช้ ${SVC[s].n} ไปยัง Server ${T.h.S.ip} แต่การใช้งานอื่นทั้งหมดต้องเป็นปกติ` }; },
    T => ({ req: { src: 'lanA', dst: 'S', svc: 'web', act: 'only' }, txt: `ให้เฉพาะเครื่องในวง ${netTxt(T.nets.A)} เปิดเว็บ (HTTP) ของ Server ${T.h.S.ip} ได้ เครื่องอื่นห้ามเปิดเว็บของ server นี้ แต่ใช้งานอย่างอื่นได้ตามปกติ` }),
    T => {
      if (T.nets.A.p !== 24) return null;
      const off = 32 * R(0, 7); T.sub = { net: S2(I2(T.nets.A.net) + off), p: 27 };
      T.h.A1.ip = S2(I2(T.sub.net) + R(1, 30));
      let o; do { o = S2(I2(T.nets.A.net) + R(1, 254)); } while (inNet(o, T.sub) || o === T.h.A1.ip); T.h.A2.ip = o;
      const b0 = I2(T.sub.net) & 255;
      return { req: { src: 'sub', dst: 'S', svc: 'telnet', act: 'only' }, txt: `ให้เฉพาะเครื่อง ${T.nets.A.net.split('.').slice(0, 3).join('.')}.${b0} ถึง .${b0 + 31} telnet ไปยัง Server ${T.h.S.ip} ได้ เครื่องอื่นห้าม telnet ไป server นี้ แต่ traffic อื่นผ่านได้` };
    },
    T => ({ req: { src: 'I', dst: 'lanB', svc: 'ping', act: 'block' }, txt: `ห้ามเครื่องจาก Internet ping เข้ามาในวง ${netTxt(T.nets.B)} แต่ traffic อื่นผ่านได้ตามปกติ` }),
    T => ({ req: { src: 'A1', dst: 'lanB', svc: 'all', act: 'block' }, txt: `ห้ามเครื่อง ${T.h.A1.ip} เข้าถึงวง ${netTxt(T.nets.B)} ทั้งหมด แต่เครื่องนี้ยังต้องออก Internet ได้ และเครื่องอื่นใช้งานได้ปกติ` }),
    T => ({ req: { src: 'lanA', dst: 'lanB', svc: 'all', act: 'only' }, txt: `ให้เฉพาะวง ${netTxt(T.nets.A)} เข้าถึงวง ${netTxt(T.nets.B)} ได้ ที่อื่นทั้งหมดรวมถึง Internet ห้ามเข้าวง ${netTxt(T.nets.B)}` }),
    T => ({ req: { src: 'any', dst: 'S', svc: 'ftp', act: 'block' }, txt: `ห้ามทุกเครื่องใช้ FTP กับ Server ${T.h.S.ip} แต่บริการอื่นใช้ได้ตามปกติ` }),
    T => { const s = pick(['web', 'telnet']); return { req: { src: 'lanA', dst: 'S', svc: s, act: 'block' }, txt: `ห้ามทุกเครื่องในวง ${netTxt(T.nets.A)} ใช้ ${SVC[s].n} ไปยัง Server ${T.h.S.ip} แต่ใช้งานอื่นได้` }; },
    T => { const s = pick(['telnet', 'ssh']); return { req: { src: 'I', dst: 'S', svc: s, act: 'block' }, txt: `ห้ามเครื่องจาก Internet ใช้ ${SVC[s].n} เข้า Server ${T.h.S.ip} แต่ traffic อื่นผ่านได้` }; },
    T => ({ req: { src: 'A1', dst: 'I', svc: 'all', act: 'block' }, txt: `ห้ามเครื่อง ${T.h.A1.ip} ออก Internet แต่ยังใช้ server ภายในได้ และเครื่องอื่นออก Internet ได้ตามปกติ` }),
    T => ({ req: { src: 'A1', dst: 'S', svc: 'ping', act: 'block' }, txt: `ห้ามเครื่อง ${T.h.A1.ip} ping ไปยัง Server ${T.h.S.ip} แต่การใช้งานอื่นเป็นปกติ` }),
  ];
  function mkDrill(ti) {
    for (;;) { const T = mkTopo(); const q = (ti != null ? TPL[ti] : pick(TPL))(T); if (q) return { T, ...q }; }
  }
  function check(T, req, text) {
    const parsed = parseCmds(text, T);
    const res = { parsed, errs: parsed.errs.slice(), warns: parsed.warns.slice(), bad: [], total: 0 };
    if (!parsed.errs.length) {
      if (!Object.keys(parsed.rules).length) res.errs.push({ ln: 0, msg: 'ยังไม่มีบรรทัด <code>access-list</code>' });
      if (!parsed.apps.length) res.errs.push({ ln: 0, msg: 'ยังไม่ได้ผูก ACL กับขาของ router: ต้องมี <code>interface ...</code> ตามด้วย <code>ip access-group เลข in|out</code>' });
      parsed.apps.forEach(a => { if (!parsed.rules[a.num]) res.warns.push({ ln: a.ln, msg: `ACL ${a.num} ยังไม่ได้สร้างด้วย access-list ACL ที่ไม่มีอยู่จะปล่อยทุกอย่างผ่าน` }); });
    }
    if (res.errs.length) return res;
    const flows = allFlows(T);
    res.total = flows.length;
    flows.forEach(f => { const want = expectBlocked(T, req, f), got = simulate(parsed, f); if (want !== got.blocked) res.bad.push({ f, want, got }); });
    return res;
  }
  // self-test hook: every model answer must pass its own checker
  window.__aclSelfTest = (n = 300) => {
    let fails = [];
    for (let i = 0; i < n; i++) { const d = mkDrill(i % TPL.length); const A = genAnswer(d.T, d.req); const r = check(d.T, d.req, ansText(A)); if (r.errs.length || r.bad.length) fails.push({ txt: d.txt, ans: ansText(A), errs: r.errs, bad: r.bad.slice(0, 2).map(b => [b.f.sk, b.f.dk, b.f.svc, b.f.dp, b.want]) }); }
    const BS = ['A1', 'A2', 'lanA', 'S', 'lanB', 'I', 'any'], BD = ['A1', 'A2', 'lanA', 'S', 'lanB', 'I'];
    let combos = 0;
    for (const s of BS) for (const d of BD) for (const v of ['all', 'web', 'telnet', 'ssh', 'ftp', 'ping', 'dns']) for (const a of ['block', 'only']) {
      const req = { src: s, dst: d, svc: v, act: a }, A = genAnswer(T0, req); if (A.invalid) continue; combos++;
      const r = check(T0, req, ansText(A)); if (r.errs.length || r.bad.length) fails.push({ req, ans: ansText(A), errs: r.errs, bad: r.bad.slice(0, 2).map(b => [b.f.sk, b.f.dk, b.f.svc, b.f.dp, b.want]) });
    }
    return { drills: n, combos, fails: fails.length, sample: fails.slice(0, 3) };
  };
  window.__aclCheck = (ti, text) => { const d = mkDrill(ti); return { d, r: check(d.T, d.req, text(d.T)) }; };

  (() => {
    const host = $('#drill');
    let cur;
    function render() {
      cur = mkDrill();
      const { T, txt } = cur;
      host.innerHTML = '';
      const top = el('div', { class: 'dtop' }); const L = el('div'), Rt = el('div'); top.append(L, Rt);
      host.append(el('h3', { text: 'โจทย์' }), top);
      drawTopo(L, T);
      Rt.append(el('p', { class: 'prompt', html: `จากรูป ${esc(T.r)} มี LAN สองวงและต่อ Internet ทางขา ${T.ifs.I} ต้องการ<b>${esc(txt)}</b> จงเขียนคำสั่ง ACL ทั้งหมด พร้อมระบุ interface และทิศทางที่ apply` }));
      const ta = el('textarea', { class: 'ans', rows: 7, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', placeholder: 'access-list ...\naccess-list ...\ninterface ...\nip access-group ...', 'aria-label': 'คำตอบ' });
      Rt.append(ta);
      const ins = el('div', { class: 'ins' });
      ['access-list ', 'permit ', 'deny ', 'ip ', 'tcp ', 'udp ', 'icmp ', 'host ', 'any ', 'eq ', 'echo', 'interface ', 'ip access-group ', 'in', 'out', '↵'].forEach(w => ins.append(el('button', { text: w.trim() || w, onclick: () => {
        const s = ta.selectionStart, e = ta.selectionEnd, v = w === '↵' ? '\n' : w;
        ta.value = ta.value.slice(0, s) + v + ta.value.slice(e); ta.selectionStart = ta.selectionEnd = s + v.length; ta.focus({ preventScroll: true });
      } })));
      Rt.append(ins);
      const out = el('div', { class: 'res2' }), work = el('div');
      host.append(el('div', { class: 'bar2' },
        el('button', { class: 'btn primary', html: `${icon('check')} ตรวจคำตอบ`, onclick: () => grade(ta.value, out) }),
        el('button', { class: 'btn', html: `${icon('eye')} ดูวิธีทำ`, onclick: () => show(work) }),
        el('button', { class: 'btn ghost', html: `${icon('shuffle')} โจทย์ใหม่`, onclick: render })), out, work);
    }
    const fName = (T, f) => `${hostName(T, f.sk)} → ${hostName(T, f.dk)} ${f.proto === 'icmp' ? 'ping' : `${f.proto.toUpperCase()} ${f.dp}${{ 80: ' (เว็บ)', 23: ' (Telnet)', 22: ' (SSH)', 21: ' (FTP)', 20: ' (FTP data)', 53: ' (DNS)', 443: ' (HTTPS)', 25: ' (SMTP)' }[f.dp] || ''}`}`;
    function grade(text, out) {
      const { T, req } = cur;
      const r = check(T, req, text);
      out.innerHTML = '';
      if (!text.trim()) { out.append(el('div', { class: 'sum bad', html: '<div class="h">ยังไม่มีคำตอบ</div>พิมพ์คำสั่งในช่อง บรรทัดละคำสั่ง' })); return; }
      if (r.errs.length) {
        out.append(el('div', { class: 'sum bad', html: `<div class="h">มีบรรทัดที่ router ไม่รับ</div>แก้ตามนี้ก่อน แล้วกดตรวจอีกครั้ง` }));
        r.errs.forEach(e => out.append(el('div', { class: 'err', html: (e.ln ? `บรรทัด ${e.ln}: ` : '') + e.msg })));
      } else {
        const A = genAnswer(T, req);
        if (!r.bad.length) {
          let note = '';
          const ap = r.parsed.apps[0];
          if (ap && (ap.side !== A.side || ap.dir !== A.dir)) note = ` คุณวางที่ ${T.ifs[ap.side]} ${ap.dir} ได้ผลถูกต้อง เฉลยวางที่ ${A.ifn} ${A.dir}: ${A.placeWhy}`;
          out.append(el('div', { class: 'sum good', html: `<div class="h">ถูกต้อง</div>ลอง packet ${r.total} แบบ (ทุกคู่เครื่องที่ผ่าน router หลายบริการ) ผลตรงกับโจทย์ทุกกรณี${note}` }));
        } else {
          const nb = r.bad.filter(b => b.want).length, np = r.bad.length - nb;
          out.append(el('div', { class: 'sum bad', html: `<div class="h">ยังไม่ถูก</div>จาก packet ${r.total} แบบ มี ${r.bad.length} แบบที่ผลไม่ตรงโจทย์` + (nb ? ` (ควรถูกบล็อกแต่ผ่าน ${nb})` : '') + (np ? ` (ควรผ่านแต่ถูกบล็อก ${np})` : '') + ' ตัวอย่าง:' }));
          const seen = new Set();
          r.bad.sort((a, b) => b.want - a.want).filter(b => { const k = b.f.sk + b.f.dk + b.want; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4).forEach(b => {
            const where = b.got.blocked ? ` แต่ถูกทิ้งที่ ${T.ifs[b.got.ap.side]} ${b.got.ap.dir} โดย ${b.got.i < 0 ? 'implicit deny (ไม่ตรงบรรทัดไหนเลย ลืม permit ปิดท้ายหรือเปล่า)' : `บรรทัดที่ ${b.got.rule.ln} ของคุณ`}` : ' แต่ผ่านไปได้';
            out.append(el('div', { class: 'case', html: `<div class="m">${esc(fName(T, b.f))}</div>โจทย์ต้องการให้<b>${b.want ? 'ถูกบล็อก' : 'ผ่าน'}</b>${where}` }));
          });
        }
      }
      r.warns.forEach(w => out.append(el('div', { class: 'case', html: (w.ln ? `บรรทัด ${w.ln}: ` : '') + w.msg })));
    }
    function show(work) {
      const { T, req } = cur;
      const A = genAnswer(T, req);
      const lines = [{ note: true, html: `ต้นทาง: ${esc(selName(T, req.src))}  ปลายทาง: ${esc(selName(T, req.dst))}  บริการ: ${SVC[req.svc].n}  ${req.act === 'block' ? 'ต้องการห้าม' : 'อนุญาตเฉพาะต้นทางนี้'}` }, { note: true, html: A.typeWhy }];
      tokHtml(A.lines, T).forEach(h => lines.push({ html: h }));
      const seen = new Set();
      A.lines.forEach(Ln => Ln.toks.forEach(t => { if (['access-list', 'interface', 'ip access-group'].includes(t.t) || !t.x || seen.has(t.x)) return; if (['num'].includes(t.r) && seen.has('num')) return; seen.add(t.x); if (t.r === 'num') seen.add('num'); if (['host'].includes(t.t) && seen.has('host')) return; if (t.t === 'host') seen.add('host'); const plain = t.x.replace(/<[^>]+>/g, ''); if (plain.startsWith(t.t)) { lines.push({ note: true, html: t.x }); return; }
        lines.push({ note: true, html: `<b class="mono" style="color:var(--${t.r === 'src' ? 'c-blue' : t.r === 'dst' ? 'c-violet' : t.r === 'proto' ? 'c-amber' : t.r === 'port' ? 'c-teal' : t.r === 'permit' ? 'c-green' : t.r === 'deny' ? 'c-rose' : 'ink'})">${esc(t.t)}</b>  ${t.x}` }); }));
      lines.push({ note: true, html: `<b>ทำไมวางที่ ${A.ifn} ${A.dir}</b>: ${A.placeWhy}` });
      // walk one packet that must drop and one that must pass
      const parsed = parseCmds(ansText(A), T), flows = allFlows(T);
      const fd = flows.find(f => expectBlocked(T, req, f)), fp = flows.find(f => !expectBlocked(T, req, f) && (f.sk === fd.sk || f.dk === fd.dk)) || flows.find(f => !expectBlocked(T, req, f));
      [fd, fp].forEach(f => {
        if (!f) return;
        const r = simulate(parsed, f), rules = parsed.rules[A.num];
        let t = `ตรวจ: ${fName(T, f)} → `;
        if (r.blocked) t += `ตรงบรรทัด ${r.i + 1} (deny) ถูกทิ้งที่ ${A.ifn} ${A.dir}`;
        else { const passAt = (A.dir === 'in' ? f.ss : f.ds) === A.side; t += passAt ? `ตรงบรรทัด ${evalAcl(rules, f).i + 1} (permit) ผ่าน` : `ไม่ผ่านขา ${A.ifn} ${A.dir} เลย จึงไม่ถูกตรวจ ผ่าน`; }
        lines.push({ note: true, t });
      });
      Hop.work(work, lines, { stagger: 70 });
    }
    render();
  })();
})();
