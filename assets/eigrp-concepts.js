// EIGRP chapter concepts. Colours: cost-to-neighbour teal, RD amber, FD violet, successor green, feasible successor blue, failure/query rose.
(() => {
  // small R --cost-- N --RD-- X strip with an FD brace, used inside concept sheets
  const strip = (hl = 'all') => {
    const on = k => hl === 'all' || hl === k;
    const op = k => on(k) ? 1 : .25;
    return `<svg viewBox="0 0 320 120" aria-hidden="true">
      <line x1="40" y1="56" x2="160" y2="56" stroke="var(--c-teal)" stroke-width="5" stroke-linecap="round" opacity="${op('cost')}"/>
      <line x1="160" y1="56" x2="280" y2="56" stroke="var(--c-amber)" stroke-width="5" stroke-linecap="round" opacity="${op('rd')}"/>
      ${Hop.dev('router', 40, 56, { s: .8 })}${Hop.dev('router', 160, 56, { s: .8 })}${Hop.dev('cloud', 284, 56, { s: .8 })}
      <text x="40" y="26" text-anchor="middle" font-size="14" font-weight="600" fill="var(--ink)">เรา</text>
      <text x="160" y="26" text-anchor="middle" font-size="14" font-weight="600" fill="var(--ink)">เพื่อนบ้าน</text>
      <text x="284" y="26" text-anchor="middle" font-size="14" font-weight="600" fill="var(--ink)">ปลายทาง</text>
      <text x="100" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="var(--c-teal)" opacity="${op('cost')}">cost</text>
      <text x="222" y="80" text-anchor="middle" font-size="13" font-weight="600" fill="var(--c-amber)" opacity="${op('rd')}">RD</text>
      <path d="M40 92v8h240v-8" fill="none" stroke="var(--c-violet)" stroke-width="2" opacity="${op('fd')}"/>
      <text x="160" y="116" text-anchor="middle" font-size="13" font-weight="600" fill="var(--c-violet)" opacity="${op('fd')}">FD = cost + RD</text>
    </svg>`;
  };

  Hop.define({
    eigrp: { t: 'EIGRP', en: 'Enhanced Interior Gateway Routing Protocol', c: 'ink', hint: 'routing protocol ของ Cisco ใช้ DUAL',
      short: 'routing protocol ภายในองค์กร (IGP) ของ Cisco เป็น distance vector ขั้นสูง ใช้อัลกอริทึม DUAL หาเส้นทางที่ดีที่สุดพร้อมเส้นทางสำรองที่ไม่วนลูป',
      more: '<p>ค่า AD ของ EIGRP (internal) คือ 90 ใน routing table จะขึ้นต้นด้วยตัว D เช่น <code>D 192.168.1.0/24 [90/3012096] via 192.168.10.10</code></p><p>สไลด์เรียก EIGRP ว่า distance vector เพราะยังเรียนเส้นทางจากเพื่อนบ้าน แต่มันเก็บตาราง topology ไว้ด้วย อาจารย์จึงบอกว่าเป็นลูกผสมที่ค่อนไปทาง distance vector</p>',
      parts: ['hybrid', 'dual', 'topotbl', 'metric', 'ad'] },
    hybrid: { t: 'Advanced distance vector', en: 'hybrid (DV + topology table)', c: 'ink', hint: 'ค่อนไปทาง DV แต่เก็บ topology นิดหน่อย',
      short: 'แบบลูกผสม: เรียนเส้นทางจากเพื่อนบ้านเหมือน distance vector แต่เก็บทุกเส้นทางที่เพื่อนบ้านบอกไว้ในตาราง topology คล้าย link state',
      more: '<p>ต่างจาก link state ตรงที่ EIGRP ไม่ได้รู้แผนที่ทั้งเครือข่าย รู้แค่ว่าเพื่อนบ้านแต่ละตัวอยู่ห่างปลายทางเท่าไร (RD) จึงยังนับเป็นฝั่ง distance vector</p><p>ต่างจาก RIP ตรงที่ไม่ส่งตารางทั้งหมดทุก 30 วินาที แต่ส่งเฉพาะส่วนที่เปลี่ยน (partial, bounded update) และเก็บทางสำรองไว้ล่วงหน้า</p>',
      parts: ['dv', 'ls', 'topotbl'] },
    dv: { t: 'Distance vector', en: 'distance vector', c: 'ink', hint: 'รู้แค่ระยะกับทิศทางจากเพื่อนบ้าน',
      short: 'router รู้แค่ "ระยะ" (distance) กับ "ทิศทาง" (vector คือ next hop) ไปแต่ละเครือข่าย ซึ่งได้ยินมาจากเพื่อนบ้าน ไม่เห็นแผนที่ทั้งเครือข่าย',
      more: '<p>ตัวอย่าง: RIP (Bellman-Ford, metric = hop count) และ EIGRP (DUAL, metric = bandwidth + delay)</p>' },
    ls: { t: 'Link state', en: 'link state', c: 'ink', hint: 'ทุกตัวมีแผนที่ทั้งเครือข่าย',
      short: 'router ทุกตัวเก็บแผนที่ทั้งเครือข่ายเหมือนกัน แล้วคำนวณเส้นทางสั้นที่สุดเองด้วย SPF (Dijkstra)',
      more: '<p>ตัวอย่าง: OSPF (metric = cost จาก bandwidth) และ IS-IS ดูรายละเอียดในบท OSPF</p>' },
    dual: { t: 'DUAL', en: 'Diffusing Update Algorithm', c: 'ink', hint: 'อัลกอริทึมเลือก successor และ FS',
      short: 'อัลกอริทึมของ EIGRP ที่เลือกเส้นทางดีที่สุด (successor) และเส้นทางสำรองที่ไม่วนลูป (feasible successor) จากตาราง topology',
      more: '<p>สไลด์อธิบายว่า DUAL เป็น finite state machine คอยติดตามทุกเส้นทาง ใช้ metric ของ EIGRP เลือกทางที่ปลอดลูปและใส่ทางที่ดีที่สุดลง routing table</p><p>ถ้า successor ล่มและมี FS อยู่ DUAL ยก FS ขึ้นมาแทนทันที ถ้าไม่มี FS จึงต้องเข้า active state แล้วส่ง query ถามเพื่อนบ้าน</p>',
      parts: ['successor', 'fs', 'fc', 'active'] },
    nbrtbl: { t: 'Neighbor table', en: 'neighbor table', c: 'ink', hint: 'รายชื่อ router ที่ต่อกับเราโดยตรง',
      short: 'ตารางรายชื่อ router เพื่อนบ้านที่ต่อตรงกับเราและคุยกันด้วย EIGRP อยู่ พร้อม IP และ interface ที่ต่อกัน',
      more: '<p>EIGRP ส่ง Hello เป็นระยะเพื่อเช็คว่าเพื่อนบ้านยังอยู่ (เรื่อง packet ไม่ออกสอบ)</p>' },
    topotbl: { t: 'Topology table', en: 'topology table', c: 'ink', hint: 'ทุกเส้นทางที่เพื่อนบ้านบอกมา',
      short: 'ตารางเก็บทุกเส้นทางไปทุกปลายทางที่เพื่อนบ้านแต่ละตัวบอกมา พร้อมตัวเลข FD และ RD ของแต่ละทาง ทั้งทางหลักและทางสำรองอยู่ในตารางนี้',
      more: '<p>ดูได้ด้วย <code>show ip eigrp topology</code> แต่ละบรรทัดเขียนว่า <code>via &lt;IP เพื่อนบ้าน&gt; (FD/RD), &lt;interface&gt;</code> ตัวเลขแรกในวงเล็บคือ FD ของทางนั้น ตัวที่สองคือ RD ที่เพื่อนบ้านบอกมา</p>',
      parts: ['fd', 'rd', 'rtbl'] },
    rtbl: { t: 'Routing table', en: 'routing table', c: 'ink', hint: 'เก็บเฉพาะทางที่ดีที่สุด',
      short: 'ตารางที่ router ใช้ส่งแพ็กเก็ตจริง เก็บเฉพาะเส้นทางที่ดีที่สุด (successor) ของแต่ละปลายทาง',
      more: '<p>บรรทัดของ EIGRP เช่น <code>D 192.168.1.0/24 [90/3012096] via 192.168.10.10, Serial0/0/1</code> แปลว่า AD 90, FD 3,012,096, successor คือ 192.168.10.10 ส่งออกทาง Serial0/0/1</p>',
      parts: ['successor', 'fd', 'ad'] },
    ad: { t: 'Administrative distance', en: 'AD (route source trust)', c: 'ink', hint: 'EIGRP = 90 ยิ่งน้อยยิ่งเชื่อ',
      short: 'ค่าความน่าเชื่อถือของแหล่งที่มาของเส้นทาง ใช้ตัดสินเมื่อหลายโปรโตคอลรู้จักเครือข่ายเดียวกัน ยิ่งน้อยยิ่งเชื่อ',
      more: '<p>Connected 0, Static 1, EIGRP 90, OSPF 110, RIP 120</p><p>อย่าสับสนกับ Advertised Distance ซึ่งเป็นอีกชื่อของ RD ในสไลด์ EIGRP</p>' },
    metric: { t: 'Metric ของ EIGRP', en: 'composite metric', c: 'violet', sym: 'metric', hint: 'คิดจาก bandwidth + delay',
      short: 'ตัวเลขบอกว่าเส้นทางดีแค่ไหน ยิ่งน้อยยิ่งดี EIGRP คิดจาก bandwidth ของลิงก์ที่ช้าที่สุดบนเส้นทาง บวก delay รวมของทุก interface แล้วคูณ 256',
      more: '<p>สูตรเต็มมี load กับ reliability ด้วย แต่ค่า K เริ่มต้นปิดสองตัวนั้นไว้ สูตรที่ใช้จริงจึงเหลือ (bandwidth + delay) × 256</p><p>ข้อสอบจะให้ตัวเลข metric มาเลย ไม่ต้องคำนวณจากสูตรนี้ ให้รู้ว่าตัวเลขมาจากไหนก็พอ</p>',
      parts: ['bw', 'delay', 'kval'] },
    bw: { t: 'Bandwidth term', en: '10,000,000 / slowest bandwidth (kb/s)', c: 'ink', sym: 'bandwidth', hint: '10⁷ หารด้วย bandwidth ที่ช้าที่สุด',
      short: '10,000,000 หารด้วย bandwidth (kb/s) ของลิงก์ที่ช้าที่สุดบนเส้นทาง ปัดเศษทิ้ง ลิงก์ยิ่งช้า ตัวเลขนี้ยิ่งใหญ่',
      more: '<p>ใช้ลิงก์ที่ช้าที่สุดตัวเดียว (คอขวด) ไม่ใช่ผลรวม เช่น 64 kb/s ได้ 156,250 แต่ 1,024 kb/s ได้แค่ 9,765 ลิงก์ช้าเส้นเดียวจึงทำให้ทั้งเส้นทางแย่</p>' },
    delay: { t: 'Delay term', en: 'sum of delays (µs) / 10', c: 'ink', sym: 'delay', hint: 'delay รวมทุก interface หาร 10',
      short: 'delay ของทุก interface ขาออกตลอดเส้นทาง (หน่วยไมโครวินาที) บวกกันแล้วหาร 10',
      more: '<p>ค่า delay ตามชนิดลิงก์ (สไลด์): Gigabit 10, FastEthernet 100, Ethernet 1,000, Serial 20,000 µs</p>' },
    kval: { t: 'ค่า K', en: 'K1–K5 weights', c: 'ink', sym: 'K', hint: 'ตัวเปิด/ปิดแต่ละส่วนของสูตร',
      short: 'ตัวคูณที่เลือกว่าจะเอาส่วนไหนของสูตรมาคิด ค่าเริ่มต้นคือ K1 = 1 (bandwidth), K3 = 1 (delay), K2 = K4 = K5 = 0',
      more: '<p>K2 คุม load และ K4, K5 คุม reliability พอเป็น 0 สองเรื่องนี้จึงไม่ถูกนับ (วงเล็บของ K5 ถือว่าไม่ใช้ ไม่อย่างนั้นทั้งสูตรจะกลายเป็น 0)</p>' },
    load: { t: 'Load', en: 'interface load (x/255)', c: 'ink', sym: 'load', hint: 'ไม่ใช้เมื่อ K2 = 0',
      short: 'ความหนาแน่นของการใช้งานลิงก์ เป็นเศษส่วนของ 255 ค่าเริ่มต้นไม่นำมาคิด (K2 = 0)' },
    rel: { t: 'Reliability', en: 'reliability (x/255)', c: 'ink', sym: 'reliability', hint: 'ไม่ใช้เมื่อ K4 = K5 = 0',
      short: 'ความน่าเชื่อถือของลิงก์ เป็นเศษส่วนของ 255 (255/255 = 100%) ค่าเริ่มต้นไม่นำมาคิด' },
    nbr: { t: 'Neighbor', en: 'neighbor router', c: 'ink', hint: 'router ที่ต่อตรงกับเรา',
      short: 'router ที่ต่อตรงกับเรา ทุกเส้นทางของ EIGRP เริ่มด้วยการส่งให้เพื่อนบ้านตัวใดตัวหนึ่ง เส้นทางจึงเรียกตามชื่อเพื่อนบ้านนั้น เช่น "ทางผ่าน R3"',
      parts: ['cost', 'rd', 'nexthop'] },
    cost: { t: 'Cost ถึงเพื่อนบ้าน', en: 'cost to neighbor (link metric)', c: 'teal', sym: 'cost', hint: 'ระยะจากเราถึงเพื่อนบ้าน',
      short: 'ระยะของลิงก์จากเราไปถึงเพื่อนบ้านตัวนั้น เป็นส่วนที่เราเห็นเองโดยตรง',
      more: '<p>ในโจทย์ที่ให้เลขมาตรงๆ ใช้บวกกับ RD ได้เลย ส่วน EIGRP ของจริงคิดทั้งเส้นด้วยสูตร metric (ใช้ bandwidth ที่ช้าที่สุดของทั้งเส้น) ผลต่าง FD − RD จึงเป็น "ส่วนที่ลิงก์ของเราเพิ่มเข้าไป"</p>',
      viz: v => { v.innerHTML = strip('cost'); } },
    rd: { t: 'Reported Distance', en: 'RD (advertised distance)', c: 'amber', sym: 'RD', hint: 'ระยะที่เพื่อนบ้านบอกว่าตัวเองอยู่ห่างปลายทาง',
      short: 'ระยะจากเพื่อนบ้านไปถึงปลายทาง ที่เพื่อนบ้านบอก (report) มาให้เรา ไม่รวมลิงก์ระหว่างเรากับเพื่อนบ้าน',
      more: '<p>RD ของเพื่อนบ้านคือ FD ของเพื่อนบ้านตัวนั้นเอง เช่น R1 มี FD ไป 192.168.1.0/24 = 2,170,112 พอส่งมาบอก R2 ตัวเลขนี้จึงเป็น RD ของ R1 ในมุมของ R2</p><p>ในข้อสอบ RD จะถูกให้มาเลย อาจารย์บอกว่าไม่ต้องคำนวณ RD จาก router อื่น สไลด์เรียกอีกชื่อว่า advertised distance</p>',
      viz: v => { v.innerHTML = strip('rd'); } },
    fd: { t: 'Feasible Distance', en: 'FD = cost + RD', c: 'violet', sym: 'FD', hint: 'ระยะรวมจากเราถึงปลายทาง',
      short: 'ระยะรวมจากเราไปถึงปลายทางผ่านเพื่อนบ้านตัวหนึ่ง = cost ถึงเพื่อนบ้าน + RD ของเพื่อนบ้าน',
      more: '<p>คำว่า FD ใช้สองแบบ: FD ของแต่ละทาง (ผลรวมผ่านเพื่อนบ้านตัวนั้น) และ FD ของเส้นทางไปปลายทาง ซึ่งคือ FD ของทางที่ดีที่สุด (successor) เมื่อโจทย์ถาม "FD เท่าไร" ให้ตอบตัวหลังนี้</p><p>ใน routing table FD คือตัวเลขที่สองใน [90/FD]</p>',
      viz: v => { v.innerHTML = strip('fd'); }, parts: ['cost', 'rd'] },
    successor: { t: 'Successor', en: 'successor (best path)', c: 'green', hint: 'next hop ของทางที่ FD ต่ำสุด',
      short: 'เพื่อนบ้านที่อยู่บนเส้นทางที่ FD ต่ำที่สุด เป็น next hop ที่ถูกใส่ลง routing table',
      more: '<p>สไลด์นิยามว่า successor คือ "IP address" ของเส้นทางที่ cost ต่ำที่สุด หมายถึง IP ของ router เพื่อนบ้านตัวนั้น จะตอบเป็น IP, interface ขาออก, ลูกศรในรูป หรือเป็นประโยคก็ได้</p>',
      parts: ['fd', 'nexthop', 'exitif'] },
    fs: { t: 'Feasible Successor', en: 'FS (loop-free backup)', c: 'blue', sym: 'FS', hint: 'ทางสำรองที่ผ่านเงื่อนไข RD < FD',
      short: 'เพื่อนบ้านที่เป็นทางสำรอง โดยต้องผ่านเงื่อนไข RD ของมัน น้อยกว่า FD ของ successor ทางสำรองนี้รับประกันว่าไม่วนลูป จึงใช้แทนได้ทันทีเมื่อ successor ล่ม',
      more: '<p>มี FS ได้หลายตัวหรือไม่มีเลยก็ได้ ถ้ามีหลายตัว ตัวที่ FD ต่ำที่สุดจะขึ้นเป็น successor ใหม่</p><p>สังเกตว่าเงื่อนไขดูที่ RD ของทางนั้น ไม่ได้ดูที่ FD ของทางนั้น ทางที่ FD รวมสูงมากก็ยังเป็น FS ได้</p>',
      parts: ['fc', 'rd', 'fd'] },
    fc: { t: 'Feasibility Condition', en: 'RD < FD of successor', c: 'blue', hint: 'กฎตัดสินว่าใครเป็น FS',
      short: 'เพื่อนบ้านจะเป็น feasible successor ได้ก็ต่อเมื่อ RD ของมัน น้อยกว่า FD ของ successor อย่างเคร่งครัด (เท่ากันไม่ผ่าน)',
      more: '<p>เหตุผล: ถ้าเพื่อนบ้านบอกว่าตัวเองอยู่ใกล้ปลายทางกว่าทางที่ดีที่สุดของเรา เส้นทางของมันไม่มีทางวนกลับมาผ่านเรา เพราะถ้าผ่านเรา ระยะของมันต้องมากกว่าระยะของเรา</p><p>ถ้า RD ≥ FD ของเรา เพื่อนบ้านตัวนั้นอาจกำลังส่งไปปลายทางผ่านเราอยู่ ถ้าเราส่งให้มัน แพ็กเก็ตอาจวนกลับมาหาเรา (loop)</p>',
      parts: ['rd', 'fd', 'loop'] },
    loop: { t: 'Routing loop', en: 'routing loop', c: 'rose', hint: 'แพ็กเก็ตวนไปมาไม่ถึงปลายทาง',
      short: 'สภาพที่แพ็กเก็ตถูกส่งวนไปมาระหว่าง router โดยไม่ถึงปลายทาง เพราะต่างคนต่างคิดว่าอีกฝ่ายเป็นทางไป' },
    nexthop: { t: 'Next hop', en: 'next-hop IP', c: 'ink', hint: 'IP ของ router ถัดไปที่จะส่งให้',
      short: 'IP ของ interface ฝั่งเพื่อนบ้านที่เราส่งแพ็กเก็ตไปให้ เช่น successor ของ R2 คือ 192.168.10.10 (ขาของ R3 ที่ต่อกับ R2)' },
    exitif: { t: 'Exit interface', en: 'outgoing interface', c: 'ink', hint: 'พอร์ตขาออกของเรา',
      short: 'พอร์ตของ router เราที่แพ็กเก็ตออกไปหาเพื่อนบ้าน เช่น Serial0/0/1 ของ R2 ซึ่งต่อไปหา R3' },
    active: { t: 'Active state', en: 'active (querying)', c: 'rose', hint: 'ไม่มี FS ต้องถามเพื่อนบ้าน',
      short: 'สถานะเมื่อ successor ล่มและไม่มี FS router ต้องส่ง query ถามเพื่อนบ้านว่ามีทางไปปลายทางไหม แล้วรอคำตอบก่อนจึงเลือก successor ใหม่ได้',
      more: '<p>สถานะปกติเรียกว่า passive (ตัว P ใน topology table) ถ้าไม่มีเพื่อนบ้านตัวไหนมีทาง ปลายทางนั้นจะถูกลบออกจาก topology table และ routing table</p>' },
    conv: { t: 'Convergence', en: 'convergence', c: 'ink', hint: 'ทุกตัวรู้เส้นทางถูกต้องตรงกัน',
      short: 'ช่วงที่ router ทุกตัวปรับตารางเส้นทางจนถูกต้องและตรงกันหลังมีการเปลี่ยนแปลง EIGRP เร็วเพราะมี FS รออยู่แล้ว' },
  });
})();
