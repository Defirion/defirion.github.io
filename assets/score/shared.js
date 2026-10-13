// Shared helpers for the September 2026 prototypes. Dependency-free.
const NS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function loadGold(url = 'assets/wow-gold-data.json') {
  const res = await fetch(url);
  return res.json();
}

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

export const fmtM = (g) => (g / 1e6).toFixed(2) + 'M g';

// Line chart of holdings for the 30 days after launch. The line breaks on unobserved days.
export function goldLine(target, data, { color = '#e8b75a', w = 640, h = 300, compact = false, gaps = 'connect' } = {}) {
  const pad = compact ? { l: 4, r: 4, t: 8, b: 8 } : { l: 48, r: 16, t: 16, b: 34 };
  const max = 30e6;
  // 'connect' draws one continuous line through observed days (the missing day is simply skipped);
  // 'bridge' keeps separate runs joined by a dashed segment.
  const pts = gaps === 'connect' ? data.launch.filter((p) => p.gold != null) : data.launch;
  const x = (d) => pad.l + (d / 30) * (w - pad.l - pad.r);
  const y = (g) => h - pad.b - (g / max) * (h - pad.t - pad.b);
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', class: 'gold-line' });
  el('title', {}, svg).textContent = 'Recorded gold holdings, 30 days after Midnight launch: 3.01M to 26.89M gold';
  if (!compact) {
    for (let g = 0; g <= max; g += 10e6) {
      el('line', { x1: pad.l, x2: w - pad.r, y1: y(g), y2: y(g), class: 'grid' }, svg);
      const t = el('text', { x: pad.l - 10, y: y(g) + 4, 'text-anchor': 'end', class: 'tick' }, svg);
      t.textContent = g ? g / 1e6 + 'M' : '0';
    }
    [[0, 'Launch'], [15, 'Day 15'], [30, 'Day 30']].forEach(([d, label]) => {
      const t = el('text', { x: x(d), y: h - 10, 'text-anchor': d === 0 ? 'start' : d === 30 ? 'end' : 'middle', class: 'tick' }, svg);
      t.textContent = label;
    });
  }
  // Split into observed runs so gaps stay visible.
  const runs = [];
  let run = [];
  for (const p of pts) {
    if (p.gold == null) { if (run.length) runs.push(run); run = []; continue; }
    run.push(p);
  }
  if (run.length) runs.push(run);
  const area = runs.map((r) => `M${x(r[0].day_number)},${y(0)} ` + r.map((p) => `L${x(p.day_number)},${y(p.gold)}`).join(' ') + ` L${x(r.at(-1).day_number)},${y(0)}Z`).join(' ');
  el('path', { d: area, fill: color, opacity: 0.08, class: 'area' }, svg);
  runs.forEach((r) => {
    el('path', { d: r.map((p, i) => `${i ? 'L' : 'M'}${x(p.day_number)},${y(p.gold)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': compact ? 2 : 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'draw' }, svg);
  });
  // Dashed bridge (and hollow mark) across unobserved days: continuous, but not presented as data.
  runs.slice(1).forEach((r, k) => {
    const a = runs[k].at(-1), b = r[0];
    const d = `M${x(a.day_number)},${y(a.gold)} L${x(b.day_number)},${y(b.gold)}`;
    el('path', { d: `${d} L${x(b.day_number)},${y(0)} L${x(a.day_number)},${y(0)}Z`, fill: color, opacity: 0.08, class: 'area' }, svg);
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': compact ? 1.5 : 2, 'stroke-dasharray': '5 6', opacity: 0.75, class: 'bridge' }, svg);
    for (let day = a.day_number + 1; day < b.day_number; day++) {
      const g = a.gold + ((b.gold - a.gold) * (day - a.day_number)) / (b.day_number - a.day_number);
      el('circle', { cx: x(day), cy: y(g), r: compact ? 2.5 : 4, style: 'fill: var(--surface, #0f1110); stroke: var(--muted, #a2a6a2)', 'stroke-width': 1.5, class: 'bridge' }, svg);
    }
  });
  const last = pts.at(-1);
  el('circle', { cx: x(30), cy: y(last.gold), r: compact ? 3.5 : 5, fill: color, class: 'end-dot' }, svg);
  target.appendChild(svg);
  return svg;
}

// Daily change bars; hollow ticks mark days without a comparable observation.
export function goldBars(target, data, { up = '#e8b75a', down = '#b7a3ef', w = 640, h = 260 } = {}) {
  const pad = { l: 52, r: 12, t: 12, b: 34 };
  const lim = 500000;
  const days = data.ongoing_daily;
  const bw = (w - pad.l - pad.r) / days.length;
  const y = (v) => pad.t + ((lim - v) / (2 * lim)) * (h - pad.t - pad.b);
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', class: 'gold-bars' });
  el('title', {}, svg).textContent = 'Daily change in recorded gold, 11 Aug to 9 Sep 2026';
  [-500000, -250000, 0, 250000, 500000].forEach((v) => {
    el('line', { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), class: v ? 'grid' : 'zero' }, svg);
    const t = el('text', { x: pad.l - 10, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, svg);
    t.textContent = v ? (v > 0 ? '+' : '−') + Math.abs(v) / 1000 + 'k' : '0';
  });
  days.forEach((d, i) => {
    const cx = pad.l + i * bw + bw / 2;
    if (d.gold_change == null) {
      el('circle', { cx, cy: y(0), r: 3, fill: 'none', stroke: '#6d726c', class: 'missing' }, svg);
      return;
    }
    const v = d.gold_change;
    el('rect', { x: cx - bw * 0.32, width: bw * 0.64, y: Math.min(y(v), y(0)), height: Math.max(1, Math.abs(y(v) - y(0))), fill: v >= 0 ? up : down, rx: 1.5, class: v < 0 ? 'bar neg' : 'bar', style: `--i:${i}` }, svg);
  });
  [[0, '11 Aug'], [15, '26 Aug'], [29, '9 Sep']].forEach(([i, label]) => {
    const t = el('text', { x: pad.l + i * bw + bw / 2, y: h - 10, 'text-anchor': 'middle', class: 'tick' }, svg);
    t.textContent = label;
  });
  target.appendChild(svg);
  return svg;
}

// Counts a number up once it scrolls into view. Final value is in the markup for no-JS.
export function countUp(node, target, format, ms = 1400) {
  if (reduceMotion) { node.textContent = format(target); return; }
  node.textContent = format(0);
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      node.textContent = format(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: 0.6 });
  io.observe(node);
}

// Adds .in when an element enters the viewport (fallback where CSS scroll timelines are absent).
export function revealOnView(nodes, threshold = 0.35) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold });
  nodes.forEach((n) => io.observe(n));
}

// Soft cursor spotlight: writes --mx/--my on the given element. Fine pointers only.
export function spotlight(root = document.documentElement) {
  if (reduceMotion || !matchMedia('(pointer: fine)').matches) return;
  let frame = 0;
  addEventListener('pointermove', (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      root.style.setProperty('--mx', e.clientX + 'px');
      root.style.setProperty('--my', e.clientY + 'px');
    });
  }, { passive: true });
}

// A simplified simulation of time-weighted mixing. Not the mixer's code: illustrative
// track lengths (3:00–4:30) from a seeded generator, greedy pick of the genre furthest
// below its target share of listening time, groups sized within each genre's min–max.
export function simulateMix({ weightA, minA, maxA, minB, maxB, songs = 40, seed = 7 }) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out = [];
  const time = { a: 0, b: 0 };
  while (out.length < songs) {
    const total = time.a + time.b || 1;
    const gapA = weightA / 100 - time.a / total;
    let g = gapA >= 0 ? 'a' : 'b';
    if (weightA === 100) g = 'a';
    if (weightA === 0) g = 'b';
    const [lo, hi] = g === 'a' ? [minA, maxA] : [minB, maxB];
    const n = lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < n && out.length < songs; i++) {
      const dur = 180 + Math.round(rand() * 90);
      out.push({ g, dur, groupStart: i === 0 });
      time[g] += dur;
    }
  }
  const count = { a: out.filter((x) => x.g === 'a').length, b: out.filter((x) => x.g === 'b').length };
  return { out, time, count };
}

// The hero name becomes the header identity (same element, no duplicate), adapted from assets/identity.js.
// Markup: <h1 class="dock-name"><a href="#top"><span class="w">karim</span> <span class="w">romani.</span></a></h1>
// plus an empty <span class="dock-slot"></span> inside a fixed header.
export function dockName({ heading = '.dock-name', slot = '.dock-slot', size = 20, gap = 6, end } = {}) {
  const h = document.querySelector(heading);
  const dock = document.querySelector(slot);
  if (!h || !dock) return;
  const words = [...h.querySelectorAll('.w')];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let geo, pending = false;
  function render() {
    pending = false;
    if (!geo) return;
    const p0 = Math.min(1, Math.max(0, scrollY / geo.end));
    const p = motion.matches ? (p0 < 1 ? 0 : 1) : p0;
    const eased = 1 - Math.pow(1 - p, 2);
    words.forEach((w, i) => {
      const s = geo.starts[i], t = geo.target[i];
      const vy = s.y - scrollY;
      const x = s.x + (t.x - s.x) * eased;
      const y = vy + (t.y - vy) * eased;
      const k = 1 + (geo.scale - 1) * eased;
      w.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    });
    document.documentElement.classList.toggle('docked', p >= 1);
  }
  function measure() {
    document.documentElement.classList.remove('dock-on');
    h.style.height = '';
    words.forEach((w) => (w.style.transform = ''));
    const starts = words.map((w) => { const r = w.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; });
    const hh = h.getBoundingClientRect().height;
    const r = dock.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(h).fontSize);
    const want = typeof size === 'function' ? size() : size;
    const scale = want / fs;
    // Words sit side by side in the dock, vertically centred on the slot.
    const y0 = r.top + (r.height - starts[0].h * scale) / 2;
    const target = [{ x: r.left, y: y0 }, { x: r.left + starts[0].w * scale + gap, y: y0 }];
    geo = { starts, target, scale, end: typeof end === 'function' ? end() : end || Math.max(200, starts[0].y + hh * 0.6) };
    h.style.height = hh + 'px';
    document.documentElement.classList.add('dock-on');
    render();
  }
  addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(render); } }, { passive: true });
  addEventListener('resize', measure);
  addEventListener('pageshow', measure);
  motion.addEventListener('change', render);
  document.fonts.ready.then(measure);
  measure();
}
