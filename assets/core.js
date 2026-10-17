// Hop core: chapter bar, concept sheet (drill-down stack), terms, formulas, MCQ checks, scrubber timeline, worked-answer reveal, device glyphs.
const Hop = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs = {}, ...kids) {
    const isSvg = ['svg','g','path','circle','rect','line','text','polyline','polygon','tspan','defs','marker','use','ellipse','foreignObject','clipPath','mask','linearGradient','stop'].includes(tag);
    const e = isSvg ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const ICON = {
    chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3.5M14 9.5C15 8 16 7 17 7h3M18 4l3 3-3 3M18 14l3 3-3 3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  const CHAPTERS = [
    { n: 1, href: 'vlsm.html', t: 'VLSM', s: 'แบ่ง IP ให้ทุกแผนกพอดีขนาด' },
    { n: 2, href: 'routing.html', t: 'Router เลือกทางยังไง', s: 'Routing table, AD, metric, IGP/EGP, DV/LS' },
    { n: 3, href: 'rip.html', t: 'RIP', s: 'นับ hop, อัปเดตทุก 30 วิ, convergence' },
    { n: 4, href: 'eigrp.html', t: 'EIGRP', s: 'Successor, Feasible successor, FD, RD' },
    { n: 5, href: 'ospf.html', t: 'OSPF', s: 'Link state, ขั้นตอนการทำงาน, ข้อดี' },
    { n: 6, href: 'threats.html', t: 'ภัยคุกคามและ CIA', s: 'Attack approach แต่ละแบบกระทบ CIA ยังไง' },
    { n: 7, href: 'acl.html', t: 'Firewall & ACL', s: 'ประเภท firewall, เขียนคำสั่ง ACL' },
    { n: 8, href: 'protocols.html', t: 'Security protocols & NAT', s: 'OSI กับ HTTPS, SSL/TLS, VPN, IPSec, NAT' },
  ];

  const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="7" cy="23" r="4.2" fill="var(--accent)"/><circle cx="25" cy="9" r="4.2" fill="none" stroke="var(--ink)" stroke-width="2.4"/><path d="M10 20.5 C 14 12, 17 20, 21.5 11.5" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.1 5.2"/></svg>`;

  /* ---------- bar + chapter menu ---------- */
  function bar(current) {
    const cur = CHAPTERS.find(c => c.n === current);
    const b = el('header', { class: 'bar' },
      el('div', { class: 'bar-in' },
        el('a', { class: 'brand', href: 'index.html', html: `${LOGO}<span>Hop</span>` }),
        el('button', { class: 'chap-pill', 'aria-haspopup': 'true', html: cur ? `<span class="mono">${cur.n}</span> ${esc(cur.t)} ${icon('down')}` : `บททั้งหมด ${icon('down')}`, onclick: () => menu.classList.add('open') }),
        el('button', { class: 'iconbtn', 'aria-label': 'สลับโหมดมืด', html: icon('moon'), onclick: toggleTheme })),
      el('div', { class: 'progress' }));
    const menu = el('div', { class: 'menu' },
      el('div', { class: 'scrim', onclick: () => menu.classList.remove('open') }),
      el('nav', { class: 'panel' }, CHAPTERS.map(c => el('a', { href: c.href, 'aria-current': c.n === current ? 'page' : null, html: `<span class="n">${c.n}</span><span><div class="t">${esc(c.t)}</div><div class="s">${esc(c.s)}</div></span>` }))));
    document.body.prepend(b); document.body.append(menu);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.classList.remove('open'); });
    const prog = $('.progress', b);
    const onScroll = () => {
      b.classList.toggle('scrolled', scrollY > 4);
      const h = document.documentElement.scrollHeight - innerHeight;
      prog.style.width = (h > 0 ? clamp(scrollY / h, 0, 1) * 100 : 0) + '%';
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  function toggleTheme() {
    const r = document.documentElement, dark = r.dataset.theme !== 'light';
    r.dataset.theme = dark ? 'light' : 'dark';
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = dark ? '#FBFBFA' : '#0F0F12';
    try { localStorage.setItem('hop-theme', r.dataset.theme); } catch (e) {}
  }
  // dark is the default; a saved choice wins
  let saved = null; try { saved = localStorage.getItem('hop-theme'); } catch (e) {}
  document.documentElement.dataset.theme = saved || 'dark';
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = (saved || 'dark') === 'dark' ? '#0F0F12' : '#FBFBFA';

  /* ---------- concepts + sheet ---------- */
  const C = {};
  const define = obj => Object.assign(C, obj);
  const colorCls = c => 't-' + (c || 'ink');
  // inline term html: Hop.t('fd') or Hop.t('fd','ระยะ FD')
  const t = (k, label) => { const c = C[k]; if (!c) console.warn('missing concept', k); return `<button class="term ${colorCls(c && c.c)}" data-k="${k}">${label || (c ? c.t : k)}</button>`; };

  let sheet, stack = [];
  function buildSheet() {
    sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'scrim', onclick: close }),
      el('div', { class: 'card' },
        el('div', { class: 'grab' }),
        el('div', { class: 'top' }, el('div', { class: 'crumbs' }), el('button', { class: 'iconbtn', 'aria-label': 'ปิด', html: icon('x'), onclick: close })),
        el('div', { class: 'body' })));
    document.body.append(sheet);
    // drag to dismiss (handle + top area)
    const card = $('.card', sheet), grab = $('.grab', sheet);
    let y0 = null, t0 = 0, dy = 0;
    grab.addEventListener('pointerdown', e => { y0 = e.clientY; t0 = performance.now(); dy = 0; grab.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
    grab.addEventListener('pointermove', e => { if (y0 == null) return; dy = e.clientY - y0; const d = dy < 0 ? dy * .2 : dy; card.style.transform = `translate(-50%, ${d}px)`; });
    const end = () => { if (y0 == null) return; card.style.transition = ''; card.style.transform = ''; const v = dy / (performance.now() - t0); if (dy > 120 || v > .5) close(); y0 = null; };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('open')) close(); });
  }
  function open(k, push = false) {
    if (!C[k]) return;
    if (!sheet) buildSheet();
    if (push) { const at = stack.indexOf(k); stack = at >= 0 ? stack.slice(0, at + 1) : [...stack, k]; } else stack = [k];
    render(false);
    sheet.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
  }
  function close() { if (!sheet) return; sheet.classList.remove('open'); document.documentElement.style.overflow = ''; }
  function render(back) {
    const k = stack[stack.length - 1], c = C[k];
    const crumbs = $('.crumbs', sheet); crumbs.innerHTML = '';
    stack.forEach((id, i) => {
      if (i) crumbs.append(el('i', { text: '›' }));
      crumbs.append(el('button', { text: C[id].t, onclick: () => { if (i < stack.length - 1) { stack = stack.slice(0, i + 1); render(true); } } }));
    });
    const body = $('.body', sheet);
    const pane = el('div', { class: 'pane' + (back ? ' back' : ''), style: `--tc: var(--c-${c.c || 'ink'})` },
      el('h2', { text: c.t }), c.en ? el('div', { class: 'en', text: c.en }) : null,
      el('div', { class: 'short', html: c.short }),
      c.viz ? el('div', { class: 'viz' }) : null,
      c.more ? el('div', { class: 'more', html: c.more }) : null);
    if (c.parts && c.parts.length) {
      pane.append(el('div', { class: 'parts' }, el('div', { class: 'h', text: c.partsLabel || 'เจาะลึกต่อ' }),
        el('div', { class: 'list' }, c.parts.map(p => {
          const pc = C[p]; if (!pc) return null;
          return el('button', { class: 'part', style: `--tc: var(--c-${pc.c || 'ink'})`, onclick: () => { stack.push(p); render(false); body.scrollTop = 0; },
            html: `<span class="dot"></span><span><div class="t">${pc.t}</div><div class="s">${pc.hint || ''}</div></span>${icon('chev')}` });
        }))));
    }
    body.replaceChildren(pane); body.scrollTop = 0;
    if (c.viz) c.viz($('.viz', pane));
  }
  document.addEventListener('click', e => {
    const tEl = e.target.closest('[data-k]');
    if (!tEl) return;
    const inSheet = !!tEl.closest('.sheet');
    open(tEl.dataset.k, inSheet);
  });

  /* ---------- formula with tappable coloured tokens ---------- */
  // parts: strings (operators) or [conceptKey, label]
  function eq(host, parts, opts = {}) {
    const box = el('div', { class: 'eq' });
    for (const p of parts) {
      if (typeof p === 'string') box.append(el('span', { class: 'op', text: p }));
      else { const c = C[p[0]] || {}; box.append(el('button', { class: 'tok ' + colorCls(c.c), 'data-k': p[0], style: `--tc: var(--c-${c.c || 'ink'}); --tcs: var(--c-${c.c || 'ink'}-s)`, text: p[1] || c.t })); }
    }
    host.append(box);
    if (opts.legend !== false) {
      const keys = [...new Set(parts.filter(p => typeof p !== 'string').map(p => p[0]))];
      host.append(el('div', { class: 'legend' }, keys.map(k => { const c = C[k] || {}; return el('button', { 'data-k': k, style: `--tc: var(--c-${c.c || 'ink'})`, html: `<b>${esc(opts.sym && opts.sym[k] || c.sym || c.t)}</b><span>${c.hint || ''}</span>` }); })));
    }
    return box;
  }

  /* ---------- MCQ check ---------- */
  // {q, opts:[html], a: index, why: html (shown after) , whyWrong: {index: html}}
  function mcq(host, d) {
    const box = el('div', { class: 'check' }, el('p', { class: 'q', html: d.q }));
    const opts = el('div', { class: 'opts' });
    let done = false;
    d.opts.forEach((o, i) => {
      const b = el('button', { class: 'tile', html: `<span class="L">${'ABCDE'[i]}</span><span>${o}</span>` });
      b.addEventListener('click', e => {
        if (e.target.closest('[data-k]')) return;
        if (done) return; done = true;
        const ok = i === d.a;
        $$('.tile', opts).forEach((x, j) => x.classList.add(j === d.a ? 'right' : j === i ? 'wrong' : 'dim'));
        const fb = el('div', { class: 'fb ' + (ok ? 'good' : 'bad'), html: `<div class="h">${ok ? 'ถูกต้อง' : 'ยังไม่ใช่'}</div>${(!ok && d.whyWrong && d.whyWrong[i]) ? d.whyWrong[i] + ' ' : ''}${d.why || ''}` });
        const again = el('button', { class: 'btn small ghost', html: `${icon('replay')} ลองใหม่`, style: 'margin-top:8px', onclick: () => { done = false; $$('.tile', opts).forEach(x => x.classList.remove('right', 'wrong', 'dim')); fb.remove(); again.remove(); } });
        box.append(fb, again);
      });
      opts.append(b);
    });
    box.append(opts); host.append(box); return box;
  }

  /* ---------- scrubber: named stops, continuous t in [0, n-1] ---------- */
  function scrub(host, { stops, onFrame, speed = 1100, autoplay = false, loop = false }) {
    const n = stops.length;
    const wrap = el('div', { class: 'scrub' });
    const play = el('button', { class: 'play', 'aria-label': 'เล่น', html: icon('play') });
    const track = el('div', { class: 'track', role: 'slider', tabindex: 0, 'aria-valuemin': 0, 'aria-valuemax': n - 1 });
    const rail = el('div', { class: 'rail' }), fill = el('div', { class: 'fill' }), knob = el('div', { class: 'knob' });
    track.append(rail, fill);
    const stopEls = stops.map((s, i) => { const d = el('div', { class: 'stop' }); d.style.left = (n > 1 ? i / (n - 1) * 100 : 0) + '%'; track.append(d); return d; });
    track.append(knob);
    const label = el('div', { class: 'label' });
    wrap.append(el('div', { class: 'row' }, play, track), label);
    host.append(wrap);
    let tv = 0, raf = 0, playing = false, lastShown = -1;
    function set(v, fromUser) {
      tv = clamp(v, 0, n - 1);
      const p = n > 1 ? tv / (n - 1) * 100 : 0;
      knob.style.left = p + '%'; fill.style.width = p + '%';
      const idx = Math.round(tv) === tv ? tv : Math.floor(tv + 1e-6);
      stopEls.forEach((s, i) => s.classList.toggle('past', i <= tv + 1e-6));
      const show = Math.min(n - 1, Math.floor(tv + .5));
      if (show !== lastShown) { lastShown = show; label.innerHTML = stops[show].label || ''; track.setAttribute('aria-valuenow', show); }
      onFrame(tv, idx);
    }
    function stopPlay() { playing = false; cancelAnimationFrame(raf); play.innerHTML = icon('play'); }
    function startPlay() {
      if (tv >= n - 1 - 1e-6) set(0);
      playing = true; play.innerHTML = icon('pause');
      let last = performance.now();
      const tick = now => {
        if (!playing) return;
        const dt = now - last; last = now;
        // ease within each segment: move linearly in "segment time", map to eased position
        seg += dt / speed;
        const i = Math.floor(seg), f = seg - i;
        if (i >= n - 1) { set(n - 1); if (loop) { seg = 0; set(0); } else { stopPlay(); return; } }
        else set(i + easeIO(Math.min(1, f * 1.25)));
        raf = requestAnimationFrame(tick);
      };
      let seg = Math.floor(tv);
      raf = requestAnimationFrame(tick);
    }
    play.addEventListener('click', () => playing ? stopPlay() : startPlay());
    const fromX = x => { const r = track.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * (n - 1); };
    let drag = false;
    track.addEventListener('pointerdown', e => { drag = true; stopPlay(); track.setPointerCapture(e.pointerId); set(fromX(e.clientX), true); });
    track.addEventListener('pointermove', e => { if (drag) set(fromX(e.clientX), true); });
    const up = () => { if (!drag) return; drag = false; animateTo(Math.round(tv)); };
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { stopPlay(); animateTo(Math.min(n - 1, Math.round(tv) + 1)); e.preventDefault(); } if (e.key === 'ArrowLeft') { stopPlay(); animateTo(Math.max(0, Math.round(tv) - 1)); e.preventDefault(); } });
    function animateTo(target) {
      const from = tv, t0 = performance.now(), dur = 260;
      const step = now => { const k = clamp((now - t0) / dur, 0, 1); set(lerp(from, target, ease(k))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
    set(0);
    if (autoplay) {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); setTimeout(startPlay, 300); } }, { threshold: .6 });
      io.observe(host);
    }
    return { set, go: animateTo, play: startPlay, stop: stopPlay, get t() { return tv; } };
  }

  /* ---------- worked answer reveal ---------- */
  // lines: [{t: text, note: bool}] revealed one after another with a short stagger
  function work(host, lines, { stagger = 120 } = {}) {
    const box = el('div', { class: 'work' });
    lines.forEach(l => box.append(el('div', { class: 'ln' + (l.note ? ' note' : ''), html: l.html || esc(l.t) })));
    host.replaceChildren(box);
    $$('.ln', box).forEach((ln, i) => setTimeout(() => ln.classList.add('on'), 40 + i * stagger));
    return box;
  }

  /* ---------- toast ---------- */
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', { class: 'toast' }); document.body.append(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  /* ---------- device glyphs (SVG strings, centred on 0,0, ~44px) ---------- */
  const DEV = {
    router: (c = 'var(--ink)') => `<circle r="21" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><g stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-9 -9l-5 -5M-14 -9v-5h5"/><path d="M9 9l5 5M14 9v5h-5"/><path d="M9 -9l5 -5M9 -14h5v5" opacity=".9"/><path d="M-9 9l-5 5M-9 14h-5v-5" opacity=".9"/></g>`,
    switch: (c = 'var(--ink)') => `<rect x="-22" y="-15" width="44" height="30" rx="8" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><g stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-12 -4h22M6 -8l4 4-4 4"/><path d="M12 5h-22M-6 1l-4 4 4 4"/></g>`,
    pc: (c = 'var(--ink)') => `<rect x="-18" y="-16" width="36" height="25" rx="5" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><path d="M-7 16h14M0 9v7" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
    server: (c = 'var(--ink)') => `<rect x="-14" y="-20" width="28" height="40" rx="6" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><path d="M-14 -6h28M-14 7h28" stroke="${c}" stroke-width="2"/><circle cx="7" cy="-13" r="2" fill="${c}"/><circle cx="7" cy="0.5" r="2" fill="${c}"/><circle cx="7" cy="13.5" r="2" fill="${c}"/>`,
    firewall: (c = 'var(--c-rose)') => `<rect x="-20" y="-17" width="40" height="34" rx="6" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><path d="M-20 -5.5h40M-20 5.5h40M-6 -17v11.5M8 -5.5v11M-6 5.5v11.5" stroke="${c}" stroke-width="2"/>`,
    cloud: (c = 'var(--ink)') => `<path d="M-14 12h28a10 10 0 0 0 1-20 13 13 0 0 0-25-3 9 9 0 0 0-4 23z" fill="var(--bg)" stroke="${c}" stroke-width="2.4" stroke-linejoin="round"/>`,
    attacker: (c = 'var(--c-rose)') => `<circle cy="-9" r="9" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><path d="M-16 19c1-10 7-14 16-14s15 4 16 14" fill="var(--bg)" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><path d="M-6 -10h12" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`,
    user: (c = 'var(--ink)') => `<circle cy="-9" r="9" fill="var(--bg)" stroke="${c}" stroke-width="2.4"/><path d="M-16 19c1-10 7-14 16-14s15 4 16 14" fill="var(--bg)" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
  };
  const dev = (type, x, y, { c, s = 1, label, sub, lc } = {}) =>
    `<g transform="translate(${x} ${y}) scale(${s})">${DEV[type](c)}${label ? `<text y="${type === 'router' ? 40 : 38}" text-anchor="middle" font-size="14" font-weight="600" fill="${lc || 'var(--ink)'}">${label}</text>` : ''}${sub ? `<text y="${type === 'router' ? 57 : 55}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--mono)">${sub}</text>` : ''}</g>`;

  /* ---------- reveal-on-scroll for figures that draw in ---------- */
  function onView(node, fn, threshold = .35) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } }), { threshold });
    io.observe(node);
  }

  // seeded-free random helpers for drills
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // page setup: bar + turn [[key]] / [[key|label]] markers in the prose into tappable terms
  function page(n) {
    bar(n);
    $$('main p, main li, main h2, main h3, main td').forEach(e => {
      if (e.innerHTML.includes('[[')) e.innerHTML = e.innerHTML.replace(/\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g, (m, k, l) => t(k, l));
    });
  }

  return { page, $, $$, el, esc, clamp, lerp, ease, easeIO, icon, CHAPTERS, LOGO, bar, define, C, t, open, close, eq, mcq, scrub, work, toast, dev, onView, rnd, pick, shuffle };
})();
