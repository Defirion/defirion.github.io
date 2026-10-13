// S3 Score: the S2 field with wipe transitions between scenes, a small game portal with two playable games,
// a compact two-colour mix, an office skyline and the expanded homelab diagram.
import { MODES as S2_MODES, reduce } from './scenes.js';

const TAP = matchMedia('(hover: none)').matches ? 'tap' : 'click';
const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % 1000 / 1000;
const text = (put, s, c, r, v, hot) => [...s].forEach((ch, i) => put(ch, c + i, r, v, hot));
const edgeCol = (f, pad = 3) => Math.ceil((f.extra.edge || 0) / f.cw) + pad;

/* ------------------------------------------------------------------ field */
export function createField(canvas, opts = {}) {
  const o = { target: 5200, font: 'monospace', colors: () => ({ fg: [255, 179, 71], hi: [255, 226, 176] }), dim: null, ...opts };
  const cx = canvas.getContext('2d');
  const s = { W: 0, H: 0, cols: 0, rows: 0, cell: 16, cw: 10, mouse: { x: -9999, y: -9999, on: false }, t0: performance.now(), mode: null, prev: null, data: o.data, extra: {}, visible: !o.lazy };
  const LEVELS = o.levels ?? 7, WIPE = 750;
  let last = 0, buckets = [], colors = o.colors(), running = false, pending = null, swapT = 0;

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (o.fit) {
      // A figure in the page: a fixed grid, with the canvas height following its width.
      s.W = canvas.clientWidth;
      if (!s.W) return;
      s.cols = o.fit.cols; s.rows = o.fit.rows; s.cw = s.W / s.cols; s.cell = s.cw / 0.62; s.H = s.rows * s.cell;
      canvas.style.height = `${s.H}px`;
      canvas.width = s.W * dpr; canvas.height = s.H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.font = `${s.cell}px ${o.font}`;
      cx.textBaseline = 'top';
      return;
    }
    s.W = canvas.clientWidth; s.H = canvas.clientHeight;
    canvas.width = s.W * dpr; canvas.height = s.H * dpr;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dens = o.density?.[s.mode] ?? 1;
    s.cell = Math.max((s.W < 600 ? 12 : 14) / Math.sqrt(dens), Math.sqrt((s.W * s.H) / (0.62 * o.target * dens)));
    s.cw = s.cell * 0.62;
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
      for (let j = 0; j < b.length; j += 3) cx.fillText(b[j], b[j + 1], b[j + 2]);
    });
  }
  // The new scene replaces the old one cell by cell, in a noisy sweep from left to right.
  const cut = (c, r) => (c / s.cols) * 0.55 + hash(c, r) * 0.45;
  function frame(t, force) {
    if (!reduce && running) requestAnimationFrame(frame);
    if (!s.visible || !s.W) return;
    if (!force && t - last < 33) return;
    last = t;
    cx.clearRect(0, 0, s.W, s.H);
    buckets = Array.from({ length: LEVELS * 2 }, () => []);
    const fn = MODES[s.mode], k = s.prev ? (t - s.t0) / WIPE : 1;
    if (s.prev && k < 1) {
      MODES[s.prev]?.({ ...s, t, t0: s.pt0, put: (ch, c, r, v, hot) => cut(c, r) > k && put(ch, c, r, v, hot) });
      fn?.({ ...s, t, put: (ch, c, r, v, hot) => cut(c, r) <= k && put(ch, c, r, v, hot) });
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
        const d = cut(c, r) - k;
        if (d > 0 && d < 0.035) put('#+:'[Math.floor(hash(c + (t >> 6), r) * 3)], c, r, 0.75, true);
      }
    } else {
      s.prev = null;
      fn?.({ ...s, t, put });
    }
    flush();
  }
  if (o.pointer !== false) ['pointermove', 'pointerdown'].forEach((type) => addEventListener(type, (e) => {
    const r = canvas.getBoundingClientRect();
    s.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: !o.fit || (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) };
  }, { passive: true }));
  document.documentElement.addEventListener('pointerleave', () => (s.mouse.on = false));
  addEventListener('resize', () => { size(); if (reduce) frame(performance.now(), true); });
  // A lazy field only draws while it is on screen, and starts its scene over when it comes into view.
  if (o.lazy) new IntersectionObserver(([e]) => {
    s.visible = e.isIntersecting;
    if (!s.visible) return;
    size(); s.t0 = performance.now();
    if (reduce) frame(performance.now() + 9000, true);
  }).observe(canvas);
  return {
    state: s,
    setMode(m) {
      if ((pending ?? s.mode) === m) return;
      clearTimeout(swapT); pending = null;
      const dens = (x) => o.density?.[x] ?? 1;
      // A scene drawn at another character size cannot share a wipe, so it swaps behind a short fade.
      if (running && !reduce && s.mode && dens(m) !== dens(s.mode)) {
        pending = m; canvas.style.opacity = 0;
        swapT = setTimeout(() => { pending = null; s.prev = null; s.mode = m; s.t0 = performance.now(); size(); canvas.style.opacity = 1; }, 260);
        return;
      }
      s.prev = reduce ? null : s.mode; s.pt0 = s.t0; s.mode = m; s.t0 = performance.now();
      if (dens(s.prev) !== dens(m)) { s.prev = null; if (running) size(); }
      if (reduce) frame(performance.now() + 9000, true);
    },
    refreshColors() { colors = o.colors(); if (reduce) frame(performance.now() + 9000, true); },
    redraw() { frame(performance.now() + 9000, true); },
    start() { size(); running = true; frame(performance.now(), true); },
  };
}

/* ------------------------------------------------------------------ scenes */
export const MODES = {
  ...S2_MODES,

  gold(f) { S2_MODES.gold({ ...f, extra: f.extra.gold ?? f.extra }); },

  // A 20-minute window of the mix, bachata and salsa in their own colours, with the time share underneath.
  lanes(f) {
    const { cols, rows, t, put, extra } = f, L = extra.lanes;
    if (!L?.seq) return;
    // With no text column beside it (a figure in the page), the strip takes the whole grid.
    const narrow = !(extra.edge > 0);
    const g0 = narrow ? 0 : Math.max(edgeCol(f), Math.floor(cols * 0.5)), c0 = g0 + 9, c1 = cols - (narrow ? 1 : 4), span = c1 - c0;
    if (span < 24) return;
    const seq = L.seq, total = seq.reduce((n, x) => n + x.dur, 0), secPerCol = 20 * 60 / span;
    const offset = (t / 1000) * 9, ph = c0 + Math.floor(span * 0.2);
    // Songs are wider than they are tall, so each lane reads as a track on a timeline.
    const BH = 2, r0 = narrow ? 1 : Math.round(rows * 0.5) - BH - 4, bands = { a: r0 + 1, b: r0 + BH + 2 }, end = bands.b + BH;
    const inBand = (r) => (r >= bands.a && r < bands.a + BH) || (r >= bands.b && r < end);
    const pulse = L.pulse ? (t - L.pulse) / 900 : 9;
    for (let c = c0; c < c1; c++) {
      let sec = ((c - c0) * secPerCol + offset) % total, i = 0;
      while (sec > seq[i].dur) { sec -= seq[i].dur; i = (i + 1) % seq.length; }
      if (sec < secPerCol) continue; // one blank column between songs
      const g = seq[i].g, wave = pulse < 1 && Math.abs(c - c0 - pulse * span) < 4;
      const v = c === ph ? 1 : c < ph ? 0.3 : 0.85;
      for (let r = bands[g]; r < bands[g] + BH; r++) put('█', c, r, wave ? 1 : v, g === 'a');
    }
    text(put, 'bachata', g0, bands.a + ((BH - 1) >> 1), 1, true);
    text(put, 'salsa', g0 + 2, bands.b + ((BH - 1) >> 1), 1, false);
    put('▼', ph, r0 - 1, 1, true);
    for (let r = r0; r <= end; r++) if (!inBand(r)) put('·', ph, r, 0.5, true);
    // Time share, easing towards the slider.
    L.shown = (L.shown ?? L.share) + (L.share - (L.shown ?? L.share)) * 0.12;
    const cut = Math.round(span * L.shown / 100), rb = end + 2;
    for (let c = 0; c < span; c++) put('=', c0 + c, rb, 1, c < cut);
    const a = `${Math.round(L.shown)}% bachata`, b = `salsa ${100 - Math.round(L.shown)}%`;
    text(put, a, c0, rb + 1, 1, true);
    text(put, b, c1 - b.length, rb + 1, 1, false);
  },

  // A portal with two playable games; it lives in extra.flip.
  tiles(f) { f.extra.flip?.draw(f); },

  // Office blocks rise where the cursor goes and settle back slowly.
  city(f) {
    const { cols, rows, cw, t, mouse, put, extra } = f;
    const c0 = Math.max(edgeCol(f, 2), 2), ground = rows - 4;
    let C = extra.city;
    if (!C || C.key !== `${c0}:${cols}:${rows}`) {
      let seed = 11, rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      C = extra.city = { key: `${c0}:${cols}:${rows}`, b: [] };
      for (let x = c0; x < cols - 4;) {
        const w = 7 + 2 * Math.floor(rand() * 5), maxH = Math.round(ground * (0.25 + rand() * 0.55));
        if (x + w > cols - 2) break;
        C.b.push({ x, w, maxH, g: 0.06, ant: rand() < 0.35, id: C.b.length });
        x += w + 1 + Math.floor(rand() * 3);
      }
    }
    const mc = mouse.on ? mouse.x / cw : -99;
    for (const b of C.b) {
      const mid = b.x + b.w / 2, near = Math.max(0, 1 - Math.abs(mc - mid) / 16);
      b.g += (Math.max(0.06, near) - b.g) * (near > b.g ? 0.09 : 0.012);
      const h = Math.round(b.maxH * b.g), roof = ground - h, hot = near > 0.5;
      if (h < 2) { for (let x = 0; x < b.w; x++) put('_', b.x + x, ground, 0.35, false); continue; }
      for (let x = 0; x < b.w; x++) put(x === 0 || x === b.w - 1 ? '.' : '-', b.x + x, roof, 0.8, hot);
      for (let r = roof + 1; r <= ground; r++) { put('|', b.x, r, 0.6, false); put('|', b.x + b.w - 1, r, 0.6, false); }
      for (let r = roof + 2; r < ground; r += 2) for (let x = 2; x < b.w - 2; x += 2) {
        const lit = hash(b.id * 31 + x, r + Math.floor(t / 5000 + hash(b.id, x) * 7)) > 0.58;
        put(lit ? '#' : ':', b.x + x, r, lit ? 0.9 : 0.25, lit && hot);
      }
      if (b.ant && h > 6) {
        const ax = b.x + (b.w >> 1);
        put('|', ax, roof - 1, 0.6, false); put('|', ax, roof - 2, 0.6, false);
        put('*', ax, roof - 3, Math.sin(t / 400 + b.id) > 0 ? 1 : 0.2, true);
      }
    }
    for (let c = c0; c < cols; c++) put('_', c, ground + 1, 0.3, false);
  },
};

/* ------------------------------------------------------------------ game a: tiles */
// One board and the 72 tile pairings, from the project's data files.
const BOARD = ['-- -- .. -- --', '-- -- .. .. --', '-- .. .. .. ..', '.. .. .. -- ..', '.. .. .. -- ..'].map((l) => l.split(' ').map((x) => x === '..'));
const COL_REWARD = [null, 'MAP', '+5', null, '+3'];
const CHARS = ['swabby', 'carpenter', 'cartographer', 'cook', 'gunner', 'lookout', 'monkey', 'navigator', 'parrot'];
const FACE = {
  swabby: ['swabby', 'end: cols'], carpenter: ['carpenter', 'end +3'], cartographer: ['carto-', 'grapher'], cook: ['cook', '+1/in row'],
  gunner: ['gunner', '+5'], lookout: ['lookout', 'end +4'], monkey: ['monkey', '+1 & flip'], navigator: ['navigator', '+2/map'], parrot: ['parrot', 'draw 1'],
};
const TW = 11, TH = 4, GX = 1, GY = 1;
const center = (s, n) => { const p = n - s.length; return ' '.repeat(p >> 1) + s + ' '.repeat(p - (p >> 1)); };

export function createFlipGame() {
  const g = { occ: new Map(), bag: [], hand: null, coins: 0, map: false, msg: '', over: null, parrot: false, flash: {}, lay: null };
  const key = (c, r) => c * 10 + r;
  const spaces = (c) => BOARD.map((row, r) => (row[c] ? r : -1)).filter((r) => r >= 0);
  const target = (c) => { const e = spaces(c).filter((r) => !g.occ.has(key(c, r))); return e.length ? Math.max(...e) : -1; };
  const at = (c, r) => g.occ.get(key(c, r))?.face;
  const all = () => [...g.occ.entries()].map(([k, v]) => ({ c: Math.floor(k / 10), r: k % 10, face: v.face }));

  function reset() {
    g.occ.clear(); g.coins = 0; g.map = false; g.over = null; g.msg = ''; g.parrot = false;
    g.bag = [];
    CHARS.forEach((a, i) => CHARS.slice(i + 1).forEach((b) => g.bag.push([a, b], [a, b])));
    for (let i = g.bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]]; }
    draw();
  }
  function draw() {
    const p = g.bag.pop(), s = Math.random() < 0.5 ? 0 : 1;
    g.hand = { face: p[s], back: p[1 - s], flipped: false };
  }
  function apply(face, c, r, log, depth) {
    if (face === 'gunner') { g.coins += 5; log.push('gunner +5'); }
    else if (face === 'cook') { const n = BOARD[r].filter((_, cc) => at(cc, r)).length; g.coins += n; log.push(`cook +${n}`); }
    else if (face === 'navigator') { const n = all().filter((x) => x.face === 'cartographer').length * 2; g.coins += n; log.push(`navigator +${n}`); }
    else if (face === 'cartographer') { g.map = true; log.push('takes the map'); }
    else if (face === 'parrot') { g.parrot = true; log.push('parrot: draw again'); }
    else if (face === 'monkey') {
      g.coins += 1;
      const adj = [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]].filter(([x, y]) => at(x, y));
      if (!adj.length || depth > 3) { log.push('monkey +1'); return; }
      const [x, y] = adj[Math.floor(Math.random() * adj.length)], t = g.occ.get(key(x, y));
      [t.face, t.back] = [t.back, t.face];
      g.flash[key(x, y)] = performance.now();
      log.push(`monkey +1, flips a ${t.back} to ${t.face}`);
      apply(t.face, x, y, log, depth + 1);
    } else log.push(`${face} scores at the end`);
  }
  function score() {
    const tiles = all(), lines = [];
    let bonus = 0;
    tiles.forEach(({ c, r, face }) => {
      if (face === 'lookout' && !tiles.some((x) => x.c === c && x.r < r)) { bonus += 4; lines.push('lookout +4'); }
      if (face === 'carpenter' && !tiles.some((x) => x.face === 'gunner' && (x.c === c || x.r === r))) { bonus += 3; lines.push('carpenter +3'); }
      if (face === 'parrot') { bonus -= 1; lines.push('parrot -1'); }
    });
    const sw = new Set(tiles.filter((x) => x.face === 'swabby').map((x) => x.c)).size;
    if (sw) { bonus += sw * sw; lines.push(`swabbies +${sw * sw}`); }
    g.coins = Math.max(0, g.coins + bonus);
    const guns = tiles.filter((x) => x.face === 'gunner').length;
    g.over = { lines, sunk: guns >= 3 };
    g.msg = lines.join(' · ') || 'no endgame points';
  }
  function place(c) {
    const r = target(c);
    if (r < 0 || g.over) return;
    g.occ.set(key(c, r), { face: g.hand.face, back: g.hand.back });
    g.flash[key(c, r)] = performance.now();
    const log = [];
    g.parrot = false;
    apply(g.hand.face, c, r, log, 0);
    if (target(c) < 0 && COL_REWARD[c]) {
      const rw = COL_REWARD[c];
      if (rw === 'MAP') { g.map = true; log.push('column: the map'); } else { g.coins += +rw; log.push(`column ${rw}`); }
    }
    const done = [0, 1, 2, 3, 4].filter((x) => target(x) < 0).length;
    if (!g.parrot && g.map) { g.coins += 1; log.push('map +1'); }
    g.msg = log.join(' · ');
    if (done >= 4) { g.hand = null; score(); return; }
    // A Parrot with nowhere legal to go goes back in the bag; the board always has a free column here.
    draw();
  }
  function hit(x, y) {
    const L = g.lay;
    if (!L) return null;
    const c = Math.floor(x / L.cw), r = Math.floor(y / L.cell);
    if (g.hand && c >= L.bx && c < L.bx + TW && r >= L.by && r < L.by + TH) return 'hand';
    if (r < L.by - 2 || r >= L.by + L.bh + 1) return null;
    for (let k = 0; k < 5; k++) { const x0 = L.bx + k * (TW + GX); if (c >= x0 && c < x0 + TW && !g.over && target(k) >= 0 && !(k === 0 && g.hand && r < L.by + TH)) return k; }
    return null;
  }
  function tile(put, face, x, y, v, hot, mark) {
    const [l1, l2] = FACE[face];
    text(put, '+' + '-'.repeat(TW - 2) + '+', x, y, v, hot);
    text(put, '|' + center(l1, TW - 2) + '|', x, y + 1, v, hot);
    text(put, '|' + center(l2, TW - 2) + '|', x, y + 2, v * 0.75, hot);
    text(put, '+' + '-'.repeat(TW - 2) + '+', x, y + 3, v, hot);
    if (mark) put(mark, x + TW - 2, y, 1, true);
  }
  reset();
  return {
    click(x, y) {
      const h = hit(x, y);
      if (g.over) { reset(); return true; }
      if (h === 'hand') { if (!g.hand.flipped) { [g.hand.face, g.hand.back] = [g.hand.back, g.hand.face]; g.hand.flipped = true; } return true; }
      if (typeof h === 'number') { place(h); return true; }
      return false;
    },
    hit,
    draw(f) {
      const { cols, rows, cw, cell, t, mouse, put } = f;
      const bw = 5 * TW + 4 * GX, bh = 5 * TH + 4 * GY;
      const bx = Math.max(edgeCol(f, 1), cols - bw - 5), by = Math.max(4, Math.round((rows - bh) / 2));
      g.lay = { bx, by, bw, bh, cw, cell };
      const h = mouse.on ? hit(mouse.x, mouse.y) : null;
      for (let c = 0; c < 5; c++) {
        const sp = spaces(c), x = bx + c * (TW + GX), tg = target(c);
        if (COL_REWARD[c]) { const y = by + Math.min(...sp) * (TH + GY) - 2; text(put, center(COL_REWARD[c], TW), x, y, tg < 0 ? 0.3 : 0.9, tg >= 0 && h === c); }
        for (const r of sp) {
          const y = by + r * (TH + GY), o = g.occ.get(key(c, r));
          if (o) { const fl = t - (g.flash[key(c, r)] ?? -9e9) < 900; tile(put, o.face, x, y, 0.85, fl); continue; }
          if (r === tg && h === c && g.hand) { tile(put, g.hand.face, x, y, 0.45 + 0.25 * Math.sin(t / 160), true); continue; }
          const on = r === tg && !g.over;
          for (let i = 0; i < TW; i += 2) { put('·', x + i, y, on ? 0.6 : 0.3, false); put('·', x + i, y + TH - 1, on ? 0.6 : 0.3, false); }
          put(':', x, y + 1, on ? 0.6 : 0.3, false); put(':', x + TW - 1, y + 1, on ? 0.6 : 0.3, false);
          put(':', x, y + 2, on ? 0.6 : 0.3, false); put(':', x + TW - 1, y + 2, on ? 0.6 : 0.3, false);
          if (on) put('+', x + (TW >> 1), y + 1 + (TH >> 2), 0.5 + 0.3 * Math.sin(t / 300 + c), true);
        }
      }
      // The drawn tile waits in the empty top-left corner of the board.
      if (g.hand) tile(put, g.hand.face, bx, by, 1, h === 'hand', g.hand.flipped ? null : '↻');
      const sy = by + bh + 1;
      text(put, `${g.coins} coin${g.coins === 1 ? '' : 's'}${g.map ? ' · map' : ''}`, bx, sy, 1, true);
      if (g.msg) text(put, g.msg.slice(0, bw), bx, sy + 1, 0.7, false);
      const hint = g.over ? `final: ${g.coins} coins${g.over.sunk ? ', but 3 gunners cannot win' : ''}. ${TAP} to deal again`
        : g.hand?.flipped ? 'flipped. now pick a column' : `${TAP} the tile to flip it, or a column to place it`;
      text(put, hint.slice(0, bw), bx, sy + 2, 0.45, g.over != null);
    },
  };
}

/* ------------------------------------------------------------------ game b: dice */
// Eight dice, pushed as far as you dare: skulls lock, and three of them lose the roll.
const SIDES = ['skull', 'sword', 'parrot', 'monkey', 'coin', 'diamond'];
const SETS = [0, 0, 0, 100, 200, 500, 1000, 2000, 4000];
const DW = 13, DH = 5, DGX = 2, DGY = 1;

export function createDiceGame() {
  const g = { dice: [], total: 0, end: null, last: 0, lay: null };
  const roll = (die, i) => Object.assign(die, { face: SIDES[Math.floor(Math.random() * 6)], pick: false, until: reduce ? 0 : performance.now() + 320 + i * 70 });
  const skulls = () => g.dice.filter((d) => d.face === 'skull').length;
  const picked = () => g.dice.filter((d) => d.pick);
  const rolling = (t) => g.dice.some((d) => t < d.until);
  function worth() {
    const n = {};
    g.dice.forEach((d) => (n[d.face] = (n[d.face] || 0) + 1));
    let pts = ((n.coin || 0) + (n.diamond || 0)) * 100;
    SIDES.slice(1).forEach((s) => (pts += SETS[n[s] || 0]));
    // A full chest: every die adds to the score.
    const full = !n.skull && g.dice.every((d) => d.face === 'coin' || d.face === 'diamond' || n[d.face] >= 3);
    return pts + (full ? 500 : 0);
  }
  const settle = () => { if (skulls() >= 3) g.end = 'sunk'; };
  function deal() { g.end = null; g.dice = Array.from({ length: 8 }, (_, i) => roll({}, i)); settle(); }
  function hit(x, y) {
    const L = g.lay;
    if (!L) return null;
    const c = Math.floor(x / L.cw), r = Math.floor(y / L.cell);
    for (let i = 0; i < 8; i++) {
      const x0 = L.bx + (i % 4) * (DW + DGX), y0 = L.dy + (i >> 2) * (DH + DGY);
      if (c >= x0 && c < x0 + DW && r >= y0 && r < y0 + DH) return i;
    }
    if (g.end || Math.abs(r - L.ry) > 1) return null;
    if (c >= L.bx && c < L.bx + L.fire) return 'fire';
    return c >= L.bankX && c < L.bankX + L.bank ? 'bank' : null;
  }
  // The dice wait blank until the first roll.
  g.dice = Array.from({ length: 8 }, () => ({ face: '', pick: false, until: 0 }));
  g.end = 'ready';
  return {
    click(x, y) {
      if (rolling(performance.now())) return true;
      if (g.end) { deal(); return true; }
      const h = hit(x, y);
      if (typeof h === 'number') { const d = g.dice[h]; if (d.face !== 'skull') d.pick = !d.pick; return true; }
      if (h === 'fire') { const p = picked(); if (p.length >= 2) { p.forEach(roll); settle(); } return true; }
      if (h === 'bank') { g.last = worth(); g.total += g.last; g.end = 'banked'; return true; }
      return false;
    },
    hit,
    draw(f) {
      const { cols, rows, cw, cell, t, mouse, put } = f;
      const bx = Math.max(edgeCol(f, 1), cols - 59 - 5), by = Math.max(4, Math.round((rows - 24) / 2));
      const dy = by + 1, ry = dy + 2 * DH + DGY + 4, busy = rolling(t), n = picked().length, pts = worth();
      const fire = `[ fire ${n} ]`, bank = `[ bank ${pts} ]`, bankX = bx + fire.length + 3;
      g.lay = { bx, dy, ry, cw, cell, fire: fire.length, bankX, bank: bank.length };
      const h = mouse.on && !busy ? hit(mouse.x, mouse.y) : null;
      g.dice.forEach((d, i) => {
        const x = bx + (i % 4) * (DW + DGX), y = dy + (i >> 2) * (DH + DGY), spin = t < d.until;
        const face = spin ? SIDES[Math.floor(hash(i + (t >> 6), i) * 6)] : d.face, skull = !spin && d.face === 'skull';
        const v = spin ? 0.6 : skull ? 0.4 : d.pick || !d.face ? 0.55 : 0.9, hot = !spin && !skull && (d.pick || h === i);
        text(put, '+' + '-'.repeat(DW - 2) + '+', x, y, v, hot);
        for (let k = 1; k < DH - 1; k++) { put('|', x, y + k, v, hot); put('|', x + DW - 1, y + k, v, hot); }
        text(put, center(face, DW - 2), x + 1, y + (DH >> 1), v, hot);
        text(put, '+' + '-'.repeat(DW - 2) + '+', x, y + DH - 1, v, hot);
        if (d.pick && !spin) put('↻', x + DW - 2, y, 1, true);
      });
      if (busy) return;
      const sk = skulls(), status = g.end === 'ready' ? '' : g.end === 'sunk' ? 'three skulls. the roll is lost' : g.end === 'banked' ? `banked ${g.last}`
        : `${sk} skull${sk === 1 ? '' : 's'} · ${pts} on the table`;
      text(put, status, bx, ry - 2, 1, g.end !== 'sunk');
      if (!g.end) {
        text(put, fire, bx, ry, n >= 2 ? 1 : 0.35, n >= 2 && h === 'fire');
        text(put, bank, bankX, ry, 1, h === 'bank');
      }
      text(put, g.end === 'ready' ? `${TAP} to roll` : g.end ? `${TAP} to roll again` : 'pick two or more dice to fire again, or bank', bx, ry + 2, 0.45, g.end != null);
      text(put, `total ${g.total}`, bx, ry + 4, 0.7, false);
    },
  };
}

/* ------------------------------------------------------------------ portal */
// A small stand-in for the portal: pick a game, it starts, and only one runs at a time.
const CARDS = [{ id: 'a', name: 'game a', kind: 'tiles' }, { id: 'b', name: 'game b', kind: 'dice' }];
const CW = 28, CH = 10, CG = 3;

export function createNexus() {
  const games = { a: createFlipGame(), b: createDiceGame() };
  const n = { at: null, starting: null, lay: null };
  function hit(x, y) {
    const L = n.lay;
    if (!L) return null;
    const c = Math.floor(x / L.cw), r = Math.floor(y / L.cell);
    if (n.at) return r === L.sr && c >= L.bx && c < L.bx + 7 ? 'back' : games[n.at].hit(x, y);
    if (r < L.cy || r >= L.cy + CH) return null;
    const k = CARDS.findIndex((_, i) => c >= L.bx + i * (CW + CG) && c < L.bx + i * (CW + CG) + CW);
    return k < 0 ? null : CARDS[k].id;
  }
  return {
    click(x, y) {
      const h = hit(x, y);
      if (n.at) { if (h !== 'back') return games[n.at].click(x, y); n.at = null; return true; }
      if (!h || n.starting) return h != null;
      if (reduce) n.at = h; else n.starting = { id: h, t0: performance.now() };
      return true;
    },
    hit,
    draw(f) {
      const { cols, rows, cw, cell, t, mouse, put } = f;
      const bx = Math.max(edgeCol(f, 1), cols - 59 - 5), by = Math.max(4, Math.round((rows - 24) / 2));
      // The two cards sit in the middle of the space the board would take.
      const py = Math.max(by, Math.round((rows - CH - 4) / 2));
      n.lay = { bx, sr: by - 4, cy: py + 4, cw, cell };
      if (n.starting && t - n.starting.t0 > 800) { n.at = n.starting.id; n.starting = null; }
      const h = mouse.on ? hit(mouse.x, mouse.y) : null;
      if (n.at) {
        text(put, '‹ games', bx, by - 4, h === 'back' ? 1 : 0.7, h === 'back');
        text(put, `${CARDS.find((x) => x.id === n.at).name} · running`, bx + 11, by - 4, 0.45, false);
        games[n.at].draw(f);
        return;
      }
      text(put, 'tabletop nexus', bx, py, 1, true);
      text(put, 'one game runs at a time', bx, py + 1, 0.45, false);
      CARDS.forEach((card, i) => {
        const x = bx + i * (CW + CG), y = py + 4, st = n.starting?.id === card.id, on = h === card.id && !n.starting;
        const v = n.starting && !st ? 0.3 : 0.8;
        text(put, '+' + '-'.repeat(CW - 2) + '+', x, y, v, on || st);
        for (let k = 1; k < CH - 1; k++) { put('|', x, y + k, v, on || st); put('|', x + CW - 1, y + k, v, on || st); }
        text(put, '+' + '-'.repeat(CW - 2) + '+', x, y + CH - 1, v, on || st);
        text(put, card.name, x + 3, y + 2, v + 0.2, true);
        text(put, card.kind, x + 3, y + 3, v * 0.7, false);
        if (st) text(put, 'starting' + '.'.repeat(1 + (Math.floor((t - n.starting.t0) / 200) % 3)), x + 3, y + 6, 1, true);
        else if (!n.starting) text(put, '[ start ]', x + 3, y + 6, on ? 1 : 0.7, on);
      });
    },
  };
}

/* ------------------------------------------------------------------ homelab */
function nd(cls, x, y, w, h, lines, cap) {
  const ty = y + h / 2 - (lines.length - 1) * 9 + 5;
  return `<g class="step ${cls}" data-cap="${cap}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${lines.map((l, k) => `<text x="${x + 14}" y="${ty + k * 18}"${k ? ' class="sub"' : ''}>${l}</text>`).join('')}</g>`;
}
// Solid boxes are running today; dashed ones are planned.
export const labSvg = () => `<svg class="dg lab" viewBox="0 0 600 398" role="img" aria-label="Everything from the internet arrives at OPNsense, the firewall, which also runs AdGuard for DNS. Behind it sit the home network, a management network and a planned isolated segment. A Debian VM with Docker runs the AC panel today; a message bus, alerts, the game portal, a scale tracker and bus times are planned to join it.">
  <rect class="host" x="160" y="8" width="430" height="382" rx="4"/><text class="hl" x="180" y="36">proxmox</text>
  <path class="ln bus" d="M120 62 H172"/><path class="ah" d="M181 62 l-11 -6 v12 z"/>
  <path class="ln bus" d="M180 128 H140 V283"/><text class="note" x="132" y="160" text-anchor="end">lan</text>
  <path class="ln" d="M120 215 H140 M120 283 H192 M517 146 V176"/>
  <path class="ln dotted" d="M570 110 H581 V253 H572"/>
  ${nd('n-net', 10, 40, 110, 44, ['internet'], 'Everything from outside arrives at the firewall first. Inbound connections are refused unless a rule allows them.')}
  ${nd('n-phone', 10, 190, 110, 50, ['phone, pc', 'browser'], 'Any device on the home network opens the panels in a browser. No app and no cloud account.')}
  ${nd('n-ac', 10, 261, 110, 44, ['bedroom', 'ac'], 'An air conditioner with a Wi-Fi module, controlled over the local network.')}
  <g class="step n-fw" data-cap="Firewall and router for every segment. I write the rules."><rect x="180" y="50" width="390" height="96" rx="3"/><text x="194" y="78">opnsense</text><text class="sub" x="194" y="96">firewall rules</text></g>
  ${nd('n-dns', 318, 62, 118, 72, ['adguard', 'dns filter'], 'Runs on the firewall. DNS for the whole network, with ad and tracker filtering.')}
  ${nd('n-ids soon', 444, 62, 114, 72, ['suricata', 'detection'], 'Intrusion detection on the outside-facing interface. Planned, in detection-only mode first.')}
  ${nd('n-mgmt', 462, 176, 110, 46, ['mgmt', 'admin'], 'A separate management network for the hypervisor and the firewall.')}
  ${nd('n-dmz soon', 462, 230, 110, 46, ['dmz', 'isolated vm'], 'A planned segment for a VM that may reach the internet but never the home network.')}
  <rect class="vm" x="180" y="176" width="270" height="196" rx="3"/><text class="sub" x="194" y="198">debian vm · docker</text>
  ${nd('n-bus soon', 192, 208, 118, 42, ['mqtt bus', 'messages'], 'A planned message bus the services share for state, events and commands. Each service keeps its own data.')}
  ${nd('n-push soon', 320, 208, 118, 42, ['alerts', 'phone push'], 'Planned self-hosted push notifications, for the services and for the infrastructure itself.')}
  ${nd('n-ac-app', 192, 262, 118, 42, ['ac panel', 'schedules'], 'A small Python web app I wrote. It finds the AC on the network and runs schedules around the clock, such as cool 22° at 00:30.')}
  ${nd('n-nexus soon', 320, 262, 118, 42, ['games', 'portal'], 'The portal for the tabletop games. It runs in Docker on my PC for now and moves here next.')}
  ${nd('n-scale soon', 192, 316, 118, 42, ['scale', 'weigh-ins'], 'A tracker that records weigh-ins from a Bluetooth scale. It runs on my PC for now.')}
  ${nd('n-oasa soon', 320, 316, 118, 42, ['bus times', 'departures'], 'Departure times for the bus I take to dance class. It runs on my PC for now.')}
  <rect class="key" x="462" y="346" width="26" height="14" rx="2"/><text class="note" x="496" y="358">planned</text>
  <g class="flow"><circle class="lp" r="4.5" cx="-20" cy="-20"/><text class="lp-t" x="-99" y="-99"></text></g></svg>`;

// Hover a box to read about it; while in view, requests travel the network on a loop.
export function animateLab(svg, cap) {
  const def = cap.textContent, dot = svg.querySelector('.lp'), tag = svg.querySelector('.lp-t');
  const nodes = [...svg.querySelectorAll('.step')];
  const light = (...cls) => nodes.forEach((n) => n.classList.toggle('on', cls.some((c) => n.classList.contains(c))));
  nodes.forEach((n) => n.addEventListener('pointerenter', () => { cap.textContent = n.dataset.cap; light([...n.classList].find((c) => c.startsWith('n-'))); }));
  svg.addEventListener('pointerleave', () => { cap.textContent = def; light(); });
  if (reduce) return;
  const route = (d) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); return p; };
  const hops = [
    { p: route('M120 62 H180'), from: 'n-net', to: 'n-fw', label: 'inbound' },
    { p: route('M120 215 H140 V128 H318'), from: 'n-phone', to: 'n-dns', label: 'dns' },
    { p: route('M120 215 H140 V283 H192'), from: 'n-phone', to: 'n-ac-app', label: 'http' },
    { p: route('M192 283 H120'), from: 'n-ac-app', to: 'n-ac', label: 'cool 22°' },
  ];
  let seen = false, i = 0, t0 = 0, hovering = false;
  svg.addEventListener('pointerenter', () => (hovering = true));
  svg.addEventListener('pointerleave', () => (hovering = false));
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) { t0 = performance.now(); requestAnimationFrame(tick); } }, { threshold: 0.3 }).observe(svg);
  function tick(t) {
    if (!seen) return;
    requestAnimationFrame(tick);
    const hop = hops[i], k = (t - t0) / 1300;
    if (k >= 1.5) { i = (i + 1) % hops.length; t0 = t + (i === 0 ? 900 : 0); return; }
    if (k < 0) { dot.setAttribute('cx', -999); tag.setAttribute('x', -999); if (!hovering) light(); return; }
    const e = Math.min(1, k), len = hop.p.getTotalLength(), pt = hop.p.getPointAtLength(len * (e < .5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2));
    dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
    tag.textContent = hop.label; tag.setAttribute('x', pt.x + 8); tag.setAttribute('y', pt.y - 9);
    if (!hovering) light(k < 1 ? hop.from : hop.to);
  }
}
