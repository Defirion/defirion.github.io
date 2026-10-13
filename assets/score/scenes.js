// Shared pieces for the S2 interpretations: the generative field, the mixer widget and the diagrams.
import { simulateMix } from './shared.js';

export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const hexRgb = (h) => { h = h.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const cssVar = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

/* ------------------------------------------------------------------ field */
// A grid of cells drawn as characters or as LED dots. Modes write cells through put().
export function createField(canvas, opts = {}) {
  const o = { renderer: 'chars', target: 5200, font: 'monospace', colors: () => ({ fg: [255, 179, 71], hi: [255, 226, 176] }), dim: null, fixed: false, ...opts };
  const cx = canvas.getContext('2d');
  const s = { W: 0, H: 0, cols: 0, rows: 0, cell: 16, cw: 10, mouse: { x: -9999, y: -9999, on: false }, t0: performance.now(), mode: null, visible: true, data: o.data, extra: {} };
  const LEVELS = 7;
  let last = 0, buckets = [], colors = o.colors(), running = false;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    s.W = canvas.clientWidth; s.H = canvas.clientHeight;
    canvas.width = s.W * dpr; canvas.height = s.H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ratio = o.renderer === 'dots' ? 1 : 0.62;
    s.cell = Math.max(s.W < 600 ? 12 : 14, Math.sqrt((s.W * s.H) / (ratio * o.target)));
    s.cw = s.cell * ratio;
    s.cols = Math.ceil(s.W / s.cw); s.rows = Math.ceil(s.H / s.cell);
    cx.font = `${s.cell}px ${o.font}`;
    cx.textBaseline = 'top';
  }
  function put(ch, c, r, v, hot) {
    if (ch === ' ') return;
    if (o.dim) v *= o.dim(c * s.cw, r * s.cell, s);
    if (v <= 0.03 || c < 0 || r < 0 || c >= s.cols || r >= s.rows) return;
    const lvl = Math.min(LEVELS - 1, Math.floor(Math.min(1, v) * LEVELS));
    buckets[(hot ? LEVELS : 0) + lvl].push(ch, c * s.cw, r * s.cell);
  }
  function flush() {
    buckets.forEach((b, k) => {
      if (!b.length) return;
      const a = ((k % LEVELS) + 1) / LEVELS, [R, G, B] = k >= LEVELS ? colors.hi : colors.fg;
      cx.fillStyle = `rgba(${R},${G},${B},${k >= LEVELS ? a : a * 0.72})`;
      if (o.renderer === 'dots') {
        const rad = s.cell * (0.16 + 0.26 * a);
        cx.beginPath();
        for (let j = 0; j < b.length; j += 3) { cx.moveTo(b[j + 1] + s.cw / 2 + rad, b[j + 2] + s.cell / 2); cx.arc(b[j + 1] + s.cw / 2, b[j + 2] + s.cell / 2, rad, 0, 6.283); }
        cx.fill();
      } else {
        for (let j = 0; j < b.length; j += 3) cx.fillText(b[j], b[j + 1], b[j + 2]);
      }
    });
  }
  function frame(t, force) {
    if (!reduce && running) requestAnimationFrame(frame);
    if (!force && (!s.visible || t - last < 33)) return;
    last = t;
    cx.clearRect(0, 0, s.W, s.H);
    buckets = Array.from({ length: LEVELS * 2 }, () => []);
    const fn = MODES[s.mode];
    if (fn) fn({ ...s, t, put });
    flush();
  }
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    s.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: e.clientY >= r.top && e.clientY <= r.bottom };
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => (s.mouse.on = false));
  if (!o.fixed) new IntersectionObserver(([e]) => (s.visible = e.isIntersecting)).observe(canvas);
  addEventListener('resize', () => { size(); if (reduce) frame(performance.now(), true); });
  return {
    state: s,
    setMode(m) { if (s.mode === m) return; s.mode = m; s.t0 = performance.now(); if (reduce) frame(performance.now() + 9000, true); },
    refreshColors() { colors = o.colors(); if (reduce) frame(performance.now() + 9000, true); },
    redraw() { frame(performance.now() + 9000, true); },
    start() { size(); running = true; frame(performance.now(), true); },
    // test hook: draw one frame synchronously and return its cost in ms
    probe(m) { s.mode = m; s.visible = true; const a = performance.now(); frame(a + 60000, true); return performance.now() - a; },
  };
}

const RAMP = ' .·:-=+*#%@';
const LUM = '.,-~:;=!*#$@';
export const MODES = {
  // Layered waves with a ripple around the cursor.
  waves(f, calm = 1) {
    const { cols, rows, cw, cell, t, mouse, put } = f;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const nx = c / cols, ny = r / rows;
      let v = Math.sin(nx * 7 + t / 1900) * .5 + Math.sin(ny * 5 - t / 2600 + nx * 3) * .5 + Math.sin((nx + ny) * 11 + t / 1300) * .25;
      v = (v + 1.25) / 2.5;
      const d = Math.hypot(c * cw - mouse.x, r * cell - mouse.y);
      v += Math.max(0, 1 - d / 240) * (0.6 + 0.4 * Math.sin(d / 14 - t / 120));
      v *= (0.3 + ny * 0.75) * calm;
      const i = Math.max(0, Math.min(RAMP.length - 1, Math.floor(v * RAMP.length)));
      if (i) put(RAMP[i], c, r, v * .8, d < 170);
    }
  },
  calm(f) { MODES.waves(f, 0.55); },

  // The original site's orbit artwork as rotating rings around a striped core.
  orbit(f) {
    const { cols, rows, cw, cell, t, mouse, put, W, H, extra } = f;
    const narrow = W < 800;
    const ox = extra.ox ?? (narrow ? cols * .5 : cols * .7), oy = extra.oy ?? (narrow ? rows * .36 : rows * .5);
    const S = Math.min(W, H) * (extra.scale ?? (narrow ? .26 : .27));
    const tx = mouse.on ? (mouse.y / H - .5) * .9 : 0, ty = mouse.on ? (mouse.x / W - .5) * .9 : 0;
    const zbuf = new Float32Array(cols * rows), lum = new Float32Array(cols * rows).fill(-2);
    const rings = [{ R: 1, r: .085, tilt: .35, spin: 1 }, { R: .74, r: .06, tilt: 1.35, spin: -1.3 }, { R: 1.32, r: .035, tilt: -.7, spin: .7 }];
    for (const ring of rings) {
      const A = ring.tilt + t / 5200 * ring.spin + tx, B = t / 7300 + ty;
      const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
      for (let th = 0; th < 6.283; th += .026) {
        const ct = Math.cos(th), st = Math.sin(th);
        for (let ph = 0; ph < 6.283; ph += .42) {
          const cp = Math.cos(ph), sp = Math.sin(ph);
          let x = (ring.R + ring.r * cp) * ct, y = (ring.R + ring.r * cp) * st, z = ring.r * sp;
          let nx = cp * ct, ny = cp * st, nz = sp;
          let y1 = y * cA - z * sA, z1 = y * sA + z * cA; y = y1; z = z1;
          let ny1 = ny * cA - nz * sA, nz1 = ny * sA + nz * cA; ny = ny1; nz = nz1;
          let x2 = x * cB + z * sB, z2 = -x * sB + z * cB; x = x2; z = z2;
          let nx2 = nx * cB + nz * sB, nz2 = -nx * sB + nz * cB; nx = nx2; nz = nz2;
          const ooz = 1 / (z + 3.2);
          const c = Math.round(ox + (x * S * ooz * 3.2) / cw), r = Math.round(oy + (y * S * ooz * 3.2) / cell);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const idx = r * cols + c;
          if (ooz > zbuf[idx]) { zbuf[idx] = ooz; lum[idx] = ny * -.55 + nz * -.83 + nx * .1; }
        }
      }
    }
    const coreR = S * .22;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const idx = r * cols + c, d = Math.hypot((c - ox) * cw, (r - oy) * cell);
      const hot = mouse.on && Math.hypot(c * cw - mouse.x, r * cell - mouse.y) < 150;
      if (lum[idx] > -2) { const L = Math.max(0, lum[idx]); put(LUM[Math.min(LUM.length - 1, Math.floor(L * LUM.length))], c, r, .25 + L * .75, hot); }
      else if (d < coreR && c % 2 === 0) put('|', c, r, .35 + .25 * Math.sin(t / 700 + r * .4), hot);
      else if (((c * 73856093) ^ (r * 19349663)) % 97 === 0) put('·', c, r, .25 + .2 * Math.sin(t / 900 + c), hot);
    }
  },

  // Real 30-day gold holdings as terrain. Hover a column to read the day.
  gold(f) {
    const { cols, rows, cw, t, t0, mouse, put, W, data, extra } = f;
    if (!data) return;
    const obs = data.launch.filter((p) => p.gold != null);
    const at = (day) => {
      let a = obs[0], b = obs.at(-1);
      for (let i = 0; i < obs.length - 1; i++) if (obs[i].day_number <= day && obs[i + 1].day_number >= day) { a = obs[i]; b = obs[i + 1]; break; }
      const k = b.day_number === a.day_number ? 0 : (day - a.day_number) / (b.day_number - a.day_number);
      return a.gold + (b.gold - a.gold) * k;
    };
    const reveal = reduce ? 1 : Math.min(1, (t - t0) / 2800);
    const c0 = Math.floor(cols * (extra.from ?? 0)), c1 = Math.floor(cols * (extra.to ?? 1)), span = Math.max(2, c1 - c0);
    const base = rows * (extra.base ?? (W < 800 ? .5 : .66)), height = rows * (extra.height ?? (W < 800 ? .36 : .5));
    const hoverC = mouse.on ? Math.floor(mouse.x / cw) : -1;
    for (let c = c0; c < c0 + span * reveal; c++) {
      const day = ((c - c0) / (span - 1)) * 30, v = at(day) / 30e6, top = Math.round(base - v * height), hot = c === hoverC;
      for (let r = Math.max(0, top); r <= base; r++) {
        const depth = (r - top) / Math.max(1, base - top);
        if (r === top) put('▄', c, r, 1, hot);
        else { const sh = .5 + .5 * Math.sin(c * .35 + r * .6 - t / 500); put(depth < .15 ? '#' : depth < .4 ? '+' : depth < .7 ? ':' : '.', c, r, (1 - depth) * .55 * (.6 + .4 * sh) + .08, hot); }
      }
    }
    for (let c = c0; c < c1; c += 2) put('·', c, Math.round(base) + 1, .3, false);
    if (hoverC >= c0 && hoverC < c0 + span * reveal) {
      const day = Math.round(((hoverC - c0) / (span - 1)) * 30), p = data.launch[day];
      const label = p.gold == null ? `day ${day}: not recorded` : `day ${day}: ${(p.gold / 1e6).toFixed(2)}M g`;
      const lc = Math.min(c1 - label.length - 1, hoverC + 2), lr = Math.max(1, Math.round(base - (at(day) / 30e6) * height) - 2);
      [...label].forEach((ch, i) => put(ch, lc + i, lr, 1, true));
    }
  },

  // Every cell points at the cursor.
  arrows(f) {
    const { cols, rows, cw, cell, t, mouse, put, W, H } = f;
    const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const px = mouse.on ? mouse.x : W * (.6 + .25 * Math.cos(t / 3100)), py = mouse.on ? mouse.y : H * (.4 + .2 * Math.sin(t / 2300));
    const maxD = Math.hypot(W, H) * .6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c += 2) {
      const dx = px - c * cw, dy = py - r * cell, d = Math.hypot(dx, dy);
      const v = (1 - d / maxD) * .9 + Math.sin(c * .31 + t / 1500) * Math.cos(r * .27 - t / 1900) * .25;
      if (v < .18) continue;
      put(ARROWS[Math.round(((Math.atan2(dy, dx) + 6.283) % 6.283) / .785) % 8], c, r, v, d < 180);
    }
  },

  // The mix itself scrolling past: bachata on the upper band, salsa below.
  lanes(f) {
    const { cols, rows, t, put, extra } = f;
    const seq = extra.seq; if (!seq) return;
    const total = seq.reduce((n, s) => n + s.dur, 0);
    const pxPerSec = cols / 900; // 15 minutes across the screen
    const offset = (t / 1000) * 12; // seconds of music per real second
    const bands = { a: [rows * .28, rows * .42], b: [rows * .58, rows * .72] };
    for (let c = 0; c < cols; c++) {
      let sec = ((c / pxPerSec) + offset) % total, i = 0;
      while (sec > seq[i].dur) { sec -= seq[i].dur; i = (i + 1) % seq.length; }
      const song = seq[i], edge = sec < 6 || seq[i].dur - sec < 6;
      const [r0, r1] = bands[song.g];
      for (let r = Math.floor(r0); r < r1; r++) put(edge ? ' ' : song.g === 'a' ? '▓' : '▒', c, r, song.g === 'a' ? .9 : .6, song.g === 'a');
    }
  },

  // Tiles being chosen, flipped and placed.
  tiles(f) {
    const { cols, rows, t, mouse, cw, cell, put } = f;
    const S = 4;
    for (let r = 1; r < rows - S; r += S + 1) for (let c = 2; c < cols - S * 2; c += S * 2 + 2) {
      const ph = Math.sin(t / 900 - c * .05 - r * .09);
      const near = mouse.on && Math.hypot(c * cw - mouse.x, r * cell - mouse.y) < 140;
      const face = near || ph > .6;
      for (let y = 0; y < S; y++) for (let x = 0; x < S * 2; x++) {
        const edge = y === 0 || y === S - 1 || x === 0 || x === S * 2 - 1;
        put(face ? (edge ? '#' : '+') : (edge ? '·' : ' '), c + x, r + y, face ? .8 : .35, near);
      }
    }
  },
};

/* ------------------------------------------------------------------ mixer */
export function buildMixer(root, { onChange } = {}) {
  root.innerHTML = `
    <div class="mx-ratio" aria-live="polite"><div class="mx-side a"><span>bachata</span><b data-a>55</b></div><span class="mx-colon">:</span><div class="mx-side b"><span>salsa</span><b data-b>45</b></div></div>
    <div class="mx-slider"><span>more salsa</span><input type="range" min="10" max="90" step="5" value="55" aria-label="Bachata share of listening time"><span>more bachata</span></div>
    <div class="mx-lanes" aria-hidden="true"><span class="mx-label a">bachata</span><div class="mx-lane a"></div><span class="mx-label b">salsa</span><div class="mx-lane b"></div><div class="mx-axis"><span>start</span><span data-len></span></div></div>
    <p class="mx-sentence" data-sentence></p>`;
  const laneA = root.querySelector('.mx-lane.a'), laneB = root.querySelector('.mx-lane.b');
  function mix(w) {
    root.querySelector('[data-a]').textContent = w;
    root.querySelector('[data-b]').textContent = 100 - w;
    const res = simulateMix({ weightA: w, minA: 2, maxA: 2, minB: 1, maxB: 2, songs: 40 });
    const { out, time, count } = res, total = time.a + time.b;
    let at = 0;
    const pools = { a: [...laneA.children], b: [...laneB.children] }, used = { a: 0, b: 0 };
    out.forEach((s) => {
      let node = pools[s.g][used[s.g]];
      if (!node) { node = document.createElement('i'); node.style.left = (at / total) * 100 + '%'; node.style.width = '0'; (s.g === 'a' ? laneA : laneB).appendChild(node); pools[s.g].push(node); }
      used[s.g]++;
      node.style.opacity = 1; node.style.left = (at / total) * 100 + '%'; node.style.width = `calc(${(s.dur / total) * 100}% - 2px)`;
      at += s.dur;
    });
    ['a', 'b'].forEach((g) => pools[g].slice(used[g]).forEach((n) => { n.style.opacity = 0; n.style.width = '0'; }));
    const mins = Math.round(total / 60);
    root.querySelector('[data-len]').textContent = `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
    const tA = Math.round((time.a / total) * 100);
    root.querySelector('[data-sentence]').innerHTML = `<b class="a">Bachata</b> gets ${tA}% of the time with ${count.a} of 40 songs. <b class="b">Salsa</b> gets ${100 - tA}% with ${count.b}.`;
    onChange?.(w, out);
  }
  root.querySelector('input').addEventListener('input', (e) => mix(+e.target.value));
  mix(55);
}

/* ------------------------------------------------------------------ diagrams */
const ah = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ah"/></marker></defs>`;
function node(i, x, y, w, h, lines) {
  const ty = y + h / 2 - (lines.length - 1) * 9 + 5;
  return `<g class="step" data-i="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${lines.map((l, k) => `<text x="${x + 14}" y="${ty + k * 18}"${k ? ' class="sub"' : ''}>${l}</text>`).join('')}</g>`;
}
export const diagrams = {
  grc: (p = 'g') => `<svg class="dg" viewBox="0 0 470 290" role="img" aria-label="Source notes become proposed facts, go through review, and only confirmed facts reach the approved register">${ah(p + 'a')}
    ${node(0, 10, 10, 150, 40, ['source notes'])}<path class="ln" d="M85 50 V92" marker-end="url(#${p}a)"/>
    ${node(1, 10, 96, 170, 60, ['proposed facts', 'unconfirmed'])}<path class="ln" d="M180 126 H256" marker-end="url(#${p}a)"/>
    ${node(2, 260, 96, 150, 60, ['review', 'questions'])}<path class="ln" d="M335 156 V226" marker-end="url(#${p}a)"/><text class="note" x="345" y="196">if confirmed</text>
    ${node(3, 240, 230, 200, 44, ['approved register'])}</svg>`,
  turn: (p = 't') => `<svg class="dg" viewBox="0 0 520 180" role="img" aria-label="Choose or flip a tile, place it, resolve its effects, then the next turn">${ah(p + 'a')}
    ${node(0, 10, 20, 140, 60, ['choose /', 'flip a tile'])}<path class="ln" d="M150 50 H182" marker-end="url(#${p}a)"/>
    ${node(1, 186, 20, 140, 60, ['place it'])}<path class="ln" d="M326 50 H358" marker-end="url(#${p}a)"/>
    ${node(2, 362, 20, 148, 60, ['resolve', 'effects'])}
    <g class="step" data-i="3"><path class="ln" d="M436 80 V140 H80 V86" marker-end="url(#${p}a)"/><text x="258" y="160" text-anchor="middle">next turn</text></g></svg>`,
  lab: () => `<svg class="dg" viewBox="0 0 500 230" role="img" aria-label="Proxmox hosts OPNsense for firewall rules and AdGuard for DNS filtering. The line is conceptual.">
    <rect class="host" x="6" y="6" width="488" height="190" rx="4"/><text class="hl" x="26" y="36">proxmox</text>
    ${node(9, 40, 80, 160, 62, ['opnsense', 'firewall rules'])}${node(9, 300, 80, 160, 62, ['adguard', 'dns filtering'])}
    <path class="ln dotted" d="M200 111 H300"/><circle class="pkt" cx="200" cy="111" r="4"/>
    <text class="note" x="250" y="222" text-anchor="middle">relationships between services, drawn conceptually</text></svg>`,
};
// Steps light up once, in order, when the diagram first scrolls into view; hovering a step lights it.
export function playOnce(svg, ms = 700) {
  const steps = [...svg.querySelectorAll('.step')].filter((s) => s.dataset.i !== '9');
  const n = Math.max(...steps.map((s) => +s.dataset.i)) + 1;
  steps.forEach((s) => s.addEventListener('pointerenter', () => steps.forEach((x) => x.classList.toggle('on', x.dataset.i === s.dataset.i))));
  svg.addEventListener('pointerleave', () => steps.forEach((x) => x.classList.remove('on')));
  if (reduce) return;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    for (let i = 0; i <= n; i++) setTimeout(() => steps.forEach((s) => s.classList.toggle('on', +s.dataset.i === i)), i * ms);
  }, { threshold: .6 });
  io.observe(svg);
}

/* ------------------------------------------------------------------ misc */
export function typeOnce(el, text, delay = 900) {
  if (reduce) { el.textContent = text; return; }
  [...text].forEach((ch, i) => setTimeout(() => (el.textContent += ch), delay + i * 55));
}
