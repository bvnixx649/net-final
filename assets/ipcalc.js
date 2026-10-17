// Pure IPv4 / VLSM math used by the VLSM chapter figures and drills. No DOM here.
const IP = (() => {
  const toInt = s => s.split('.').reduce((a, o) => (a * 256) + (+o), 0) >>> 0;
  const toStr = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');
  const bits = n => (n >>> 0).toString(2).padStart(32, '0');
  const maskInt = p => p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
  const maskStr = p => toStr(maskInt(p));
  const netOf = (n, p) => (n & maskInt(p)) >>> 0;
  const size = p => 2 ** (32 - p);
  const bcastOf = (n, p) => (netOf(n, p) + size(p) - 1) >>> 0;

  // class by first octet, the way the course slides define it
  function cls(n) {
    const o = n >>> 24;
    if (o < 128) return { c: 'A', prefix: 8, from: 1, to: 126 };
    if (o < 192) return { c: 'B', prefix: 16, from: 128, to: 191 };
    if (o < 224) return { c: 'C', prefix: 24, from: 192, to: 223 };
    if (o < 240) return { c: 'D', prefix: null, from: 224, to: 239 };
    return { c: 'E', prefix: null, from: 240, to: 255 };
  }

  // smallest n with 2^n - 2 >= hosts (slide: "2^n - 2 = 500, n = 9")
  function hostBits(hosts) { let n = 2; while (2 ** n - 2 < hosts) n++; return n; }

  // VLSM: largest first, each block placed at the next free aligned address
  function vlsm(base, prefix, demands) {
    const start = netOf(toInt(base), prefix), end = start + size(prefix);
    const order = demands.map((d, i) => ({ ...d, i })).sort((a, b) => b.hosts - a.hosts || a.i - b.i);
    let cur = start; const out = [];
    for (const d of order) {
      const h = hostBits(d.hosts), p = 32 - h, sz = 2 ** h;
      cur = Math.ceil((cur - start) / sz) * sz + start; // always aligned when sorted, kept for safety
      const net = cur, b = net + sz - 1;
      out.push({ ...d, h, p, sz, net, first: net + 1, last: b - 1, bcast: b, fits: b < end, usable: sz - 2 });
      cur = net + sz;
    }
    return { start, end, prefix, order: out, used: cur - start, free: end - cur };
  }

  // bit string split for display: [ {b:'1', role:'net'|'sub'|'host', i} ... ]
  function roles(n, basePrefix, newPrefix) {
    return [...bits(n)].map((b, i) => ({ b, i, role: i < basePrefix ? 'net' : i < newPrefix ? 'sub' : 'host' }));
  }

  return { toInt, toStr, bits, maskInt, maskStr, netOf, bcastOf, size, cls, hostBits, vlsm, roles };
})();
if (typeof module !== 'undefined') module.exports = IP;
