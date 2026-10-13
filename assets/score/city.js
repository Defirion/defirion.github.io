// An isometric office block cluster drawn in ASCII and lit by a soft point light.
// Geometry is solved once per size: every character cell is traced into the scene to find the
// surface it sees, and its character comes from that surface (edge, frame, window, roof, ground).
// Each frame recomputes brightness and runs the small signs of life: windows, leaves, fans,
// steam, a blinking antenna, lamps and the occasional car.

const C30 = Math.cos(Math.PI / 6);
const hash = (a, b, c = 0) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0) % 1000 / 1000;
const frac = (x) => x - Math.floor(x);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// World units: 1 = one storey = one window bay. z is up; the camera looks down the (-1,-1,-1) diagonal,
// so the visible faces of any box are +x (right façade), +y (left façade) and the roof.
const BUILDINGS = [
  { x0: 4, y0: 2, x1: 9.5, y1: 7, h: 13 },        // tower, back
  { x0: 11, y0: 1, x1: 16, y1: 6, h: 9.5 },       // right
  { x0: 1.5, y0: 10, x1: 6.5, y1: 15, h: 6 },     // left, front
  { x0: 9.5, y0: 9.5, x1: 17, y1: 14.5, h: 4.5 }, // front, low and wide
];
const PLINTH = { x0: -1, y0: -1, x1: 19, y1: 17, z0: -0.45, z1: 0 };
const ROOF_KIT = [
  [0, 5, 3, 6.8, 4.6, 1.3], [0, 7.4, 4.8, 8.8, 5.9, 0.7],
  [1, 12, 2, 13.6, 3.4, 1.1], [1, 14, 4, 15.2, 5.2, 0.6],
  [2, 2.5, 11, 4, 12.2, 0.8], [2, 4.6, 12.8, 5.8, 13.8, 0.6],
  [3, 11, 10.5, 13.5, 12, 0.9], [3, 15, 12.5, 16, 13.5, 0.5],
];
const kitTop = (i) => { const [b, x0, y0, x1, y1, h] = ROOF_KIT[i]; return [(x0 + x1) / 2, (y0 + y1) / 2, BUILDINGS[b].h + h]; };
const POLES = [
  { x: 8.6, y: 6.2, z0: 13, z1: 15.2, top: '*', beacon: true }, { x: 15.4, y: 1.8, z0: 9.5, z1: 11.2, top: '+' }, { x: 2.2, y: 14.3, z0: 6, z1: 7.4, top: '+' },
  { x: 8.3, y: 16.5, z0: 0, z1: 1.3, top: 'o', lamp: true }, { x: 18.2, y: 8, z0: 0, z1: 1.3, top: 'o', lamp: true },
  { x: 0, y: 8.8, z0: 0, z1: 1.3, top: 'o', lamp: true }, { x: 18.2, y: 16.5, z0: 0, z1: 1.3, top: 'o', lamp: true },
];
const LAMPS = POLES.filter((p) => p.lamp);
const FANS = [kitTop(1), kitTop(6)];
const STEAM_AT = kitTop(2);
const STREET_Y = 15.85; // the front street, along the two façades that face the viewer

const BOXES = [
  { ...PLINTH, kind: 'plinth' },
  ...BUILDINGS.map((b, i) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, z0: 0, z1: b.h, kind: 'building', i })),
  ...ROOF_KIT.map(([bi, x0, y0, x1, y1, h]) => ({ x0, y0, x1, y1, z0: BUILDINGS[bi].h, z1: BUILDINGS[bi].h + h, kind: 'kit' })),
];
const NORMALS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Trace the line of sight through the ground point (gx, gy, 0). Returns the surface nearest the camera.
// Along that line z grows towards the camera, so a hit's z is also its depth.
function trace(gx, gy) {
  let best = null;
  for (let k = 0; k < BOXES.length; k++) {
    const b = BOXES[k];
    const hx = b.x1 - gx, hy = b.y1 - gy, hz = b.z1;
    const lo = Math.max(b.x0 - gx, b.y0 - gy, b.z0), hi = Math.min(hx, hy, hz);
    if (lo > hi || (best && hi <= best.t)) continue;
    best = { t: hi, k, face: hi === hz ? 2 : hi === hx ? 0 : 1 };
  }
  if (!best) return null;
  best.P = [gx + best.t, gy + best.t, best.t];
  return best;
}

export function createCity() {
  let geo = null;

  function build(f) {
    const { W, H, cols, rows, cw, cell, extra } = f;
    const left = (extra.edge || 0) + 60, right = W - Math.max(40, W * 0.03);
    const pts = [];
    for (const b of BOXES) for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) pts.push([(x - y) * C30, (x + y) * 0.5 - z]);
    POLES.forEach((p) => pts.push([(p.x - p.y) * C30, (p.x + p.y) * 0.5 - p.z1]));
    const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]));
    const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
    const s = Math.min((right - left) * 0.9 / (maxX - minX), H * 0.8 / (maxY - minY));
    const ox = (left + right) / 2 - ((minX + maxX) / 2) * s, oy = H * 0.52 - ((minY + maxY) / 2) * s;
    const project = (x, y, z) => [ox + (x - y) * C30 * s, oy + ((x + y) * 0.5 - z) * s];
    const ground = (px, py) => { const a = (px - ox) / (C30 * s), b = (2 * (py - oy)) / s; return [(a + b) / 2, (b - a) / 2]; };
    const hitAt = (px, py) => { const [gx, gy] = ground(px, py); return trace(gx, gy); };
    const sid = (h) => (h ? h.k * 3 + h.face : -1);

    const du = cw / (C30 * s), dv = cell / s;
    const cells = [], zbuf = new Float32Array(cols * rows).fill(-99), windows = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) * cw, py = (r + 0.5) * cell;
      const h = hitAt(px, py);
      if (!h) continue;
      zbuf[r * cols + c] = h.P[2];
      // Edges: where the 3x3 samples inside the cell see more than one surface.
      // Every non-vertical edge in this view is shallow, so it is drawn with - and _ rather than slashes.
      const S = [];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) S.push(sid(hitAt(px + (i - 1) * cw * 0.34, py + (j - 1) * cell * 0.34)));
      const vertical = S[0] !== S[2] && S[3] !== S[5] && S[6] !== S[8];
      const across = S[0] !== S[6] || S[1] !== S[7] || S[2] !== S[8];
      const side = S[3] !== S[5];
      const box = BOXES[h.k], [X, Y, Z] = h.P;
      let ch = null, mat = 'edge', win = null;
      if (vertical) ch = '|';
      else if (across) ch = S[1] !== S[4] || S[0] !== S[3] || S[2] !== S[5] ? '-' : '_';
      else if (side) ch = '|';
      else if (h.face === 2) {
        if (box.kind === 'plinth') {
          const near = Math.min(...BUILDINGS.map((b) => Math.max(b.x0 - X, X - b.x1, b.y0 - Y, Y - b.y1)));
          if (Math.abs(near - 0.9) < dv * 0.45) { ch = '.'; mat = 'curb'; }
          else if (near > 0.9 && Math.abs(Y - STREET_Y) < dv * 0.35 && frac(X) < 0.5) { ch = '-'; mat = 'curb'; }
          else if (near > 0.9 && hash(Math.round(X * 2), Math.round(Y * 2)) > 0.93) { ch = '.'; mat = 'ground'; }
          else if (near > 0.9 && (Math.abs(frac(X / 2) - 0.5) < du * 0.25 && Math.abs(frac(Y / 2) - 0.5) < dv * 0.5)) { ch = '+'; mat = 'ground'; }
          else mat = 'ground';
        } else {
          const inset = Math.min(X - box.x0, box.x1 - X, Y - box.y0, box.y1 - Y);
          if (box.kind === 'building' && Math.abs(inset - 0.35) < dv * 0.4) { ch = ':'; mat = 'parapet'; }
          else if ((c + r * 2) % 4 === 0) { ch = '.'; mat = 'roof'; }
        }
      } else {
        // Façades: a grid of bays and storeys with recessed windows.
        const u0 = h.face === 0 ? box.y0 : box.x0, u1 = h.face === 0 ? box.y1 : box.x1, u = h.face === 0 ? Y : X;
        if (box.kind !== 'building') { if ((c + r) % 3 === 0) { ch = ':'; mat = 'wall'; } }
        else if (u < u0 + 0.35 || u > u1 - 0.35 || Z > box.z1 - 0.45 || Z < 0.25) { ch = ':'; mat = 'wall'; }
        else {
          const fu = frac(u - u0 - 0.35), fv = frac(Z), mu = fu < du * 0.5 || fu > 1 - du * 0.5, fl = fv < dv * 0.5 || fv > 1 - dv * 0.5;
          if (mu && fl) { ch = '+'; mat = 'frame'; }
          else if (mu) { ch = '|'; mat = 'frame'; }
          else if (fl) { ch = fv < 0.5 ? '_' : '-'; mat = 'frame'; }
          else {
            const bay = Math.floor(u - u0 - 0.35), floor = Math.floor(Z), id = `${box.i}:${h.face}:${bay}:${floor}`;
            if (!windows.has(id)) windows.set(id, { id, cells: [], lit: hash(box.i * 7 + h.face, bay, floor) > 0.955, pos: [X, Y, Z] });
            win = windows.get(id);
            ch = '.'; mat = 'recess';
          }
        }
      }
      // Ground cells without a character still take light, so leaves and car beams can pick them out.
      if (ch || mat === 'ground') {
        const q = { c, r, ch, mat, px, py, P: h.P, n: NORMALS[h.face], win };
        cells.push(q);
        if (win) win.cells.push(q);
      }
    }
    // Antennas and lamp posts, hidden where something stands in front of them.
    for (const p of POLES) {
      const steps = Math.ceil(((p.z1 - p.z0) * s) / (cell * 0.5));
      const seen = new Set();
      for (let i = 0; i <= steps; i++) {
        const z = p.z0 + ((p.z1 - p.z0) * i) / steps, [px, py] = project(p.x, p.y, z);
        const c = Math.floor(px / cw), r = Math.floor(py / cell), key = r * cols + c;
        if (c < 0 || r < 0 || c >= cols || r >= rows || seen.has(key) || z < zbuf[key] - 0.05) continue;
        seen.add(key);
        const top = i === steps;
        cells.push({ c, r, ch: top ? p.top : '|', mat: top && p.lamp ? 'lamp' : top && p.beacon ? 'beacon' : 'pole', px, py, P: [p.x, p.y, z], n: [0.6, 0.6, 0.5], pole: p });
      }
    }
    const lit = [...windows.values()];
    lit.forEach((w) => w.cells.sort((a, b) => a.c - b.c));
    return { key: `${W}:${H}:${cols}:${extra.edge}`, cells, project, hitAt, s, zbuf, cols, rows, cw, cell, windows: lit };
  }

  // Base brightness at rest, and how much light each material can take.
  const MAT = {
    edge: [0.085, 1], parapet: [0.02, 0.6], frame: [0.01, 0.62], recess: [0, 0.14], lit: [0.26, 0.6],
    wall: [0.006, 0.45], roof: [0.005, 0.4], curb: [0.02, 0.5], ground: [0, 0.34], pole: [0.05, 0.8],
    lamp: [0.34, 0.6], beacon: [0.1, 0.6],
  };
  const GROUND_CH = '.';

  /* ---------------------------------------------------------------- life */
  // Long quiet stretches with the odd event. Buildings never move.
  const life = { started: false, nextWin: 0, flicker: null, shadow: null, leaves: [], nextGust: 0, car: null, nextCar: 0, steam: [], nextPuff: 0, buzz: null, nextBuzz: 0, last: 0 };
  function startLife(t) {
    Object.assign(life, { started: true, nextWin: t + rnd(2500, 5000), nextGust: t + rnd(1500, 4000), nextCar: t + rnd(6000, 12000), nextBuzz: t + rnd(8000, 16000), last: t });
  }
  function stepLife(t) {
    const dt = Math.min(0.1, (t - life.last) / 1000);
    life.last = t;
    const W = geo.windows;
    if (t > life.nextWin && W.length) {
      const on = W.filter((w) => w.lit), roll = Math.random();
      if (roll < 0.45) { const w = pick(W); w.lit = !w.lit; }
      else if (roll < 0.7 && on.length) life.flicker = { w: pick(on), t0: t, dur: rnd(1200, 2200) };
      else if (on.length) life.shadow = { w: pick(on), t0: t, dur: rnd(1600, 2600), dir: Math.random() < 0.5 ? 1 : -1 };
      life.nextWin = t + rnd(3500, 9000);
    }
    if (life.flicker && t - life.flicker.t0 > life.flicker.dur) life.flicker = null;
    if (life.shadow && t - life.shadow.t0 > life.shadow.dur) life.shadow = null;
    // Leaves arrive in loose gusts from the upwind side and tumble across the ground.
    if (t > life.nextGust) {
      const y = Math.random() < 0.65 ? rnd(7.8, 16.4) : rnd(-0.5, 7.5), n = 4 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) life.leaves.push({ x: rnd(-1.2, -0.4), y: y + rnd(-1.2, 1.2), vx: rnd(1.4, 2.6), vy: rnd(-0.25, 0.55), ph: rnd(0, 6), spin: rnd(5, 11), delay: rnd(0, 1.4) });
      life.nextGust = t + rnd(7000, 16000);
    }
    for (const l of life.leaves) {
      if ((l.delay -= dt) > 0) continue;
      const gust = 0.75 + 0.5 * Math.sin(t / 700 + l.ph);
      l.x += l.vx * gust * dt; l.y += (l.vy + 0.3 * Math.sin(t / 450 + l.ph * 3)) * dt; l.ph += l.spin * dt;
      for (const b of BUILDINGS) {
        if (l.x > b.x0 - 0.15 && l.x < b.x1 + 0.15 && l.y > b.y0 - 0.15 && l.y < b.y1 + 0.15) {
          // Slide around the corner nearest to the leaf's side.
          if (l.y - b.y0 < b.y1 - l.y) l.y = b.y0 - 0.16; else l.y = b.y1 + 0.16;
          l.vy = (l.y < (b.y0 + b.y1) / 2 ? -1 : 1) * Math.abs(l.vy + 0.4);
        }
      }
    }
    life.leaves = life.leaves.filter((l) => l.x < PLINTH.x1 + 0.3 && l.y > PLINTH.y0 - 0.3 && l.y < PLINTH.y1 + 0.3);
    // A car now and then, its headlights running along the street.
    if (!life.car && t > life.nextCar) life.car = { t0: t, dir: Math.random() < 0.6 ? 1 : -1, speed: rnd(2.6, 3.6) };
    if (life.car) {
      const d = ((t - life.car.t0) / 1000) * life.car.speed;
      life.car.x = life.car.dir > 0 ? PLINTH.x0 - 1 + d : PLINTH.x1 + 1 - d;
      if (d > PLINTH.x1 - PLINTH.x0 + 3) { life.car = null; life.nextCar = t + rnd(16000, 32000); }
    }
    // Steam from one roof vent.
    if (t > life.nextPuff) { life.steam.push({ t0: t, x: STEAM_AT[0] + rnd(-0.2, 0.2), y: STEAM_AT[1] + rnd(-0.2, 0.2), dur: rnd(3500, 5200) }); life.nextPuff = t + rnd(550, 1100); }
    life.steam = life.steam.filter((p) => t - p.t0 < p.dur);
    // One lamp buzzes occasionally.
    if (t > life.nextBuzz) { life.buzz = { lamp: pick(LAMPS), t0: t, dur: rnd(900, 1800) }; life.nextBuzz = t + rnd(14000, 26000); }
    if (life.buzz && t - life.buzz.t0 > life.buzz.dur) life.buzz = null;
  }

  return {
    get geo() { return geo; },
    life,
    // light: { x, y, k } in screen px with k the strength 0..1, or null. t: time, or null for a still frame.
    draw(f, light, t = null) {
      const key = `${f.W}:${f.H}:${f.cols}:${f.extra.edge}`;
      if (!geo || geo.key !== key) geo = build(f);
      if (t != null) { if (!life.started) startLife(t); stepLife(t); }
      const { put, W, H } = f;
      const R1 = Math.min(W, H) * 0.2, R2 = Math.min(W, H) * 0.5;
      let L = null;
      if (light && light.k > 0.001) {
        const h = geo.hitAt(light.x, light.y);
        const base = h ? h.P : [0, 0, 0];
        // The light floats in front of whatever is under the pointer, towards the viewer and a little up.
        L = [base[0] + 2.2, base[1] + 2.2, base[2] + 3.2];
      }
      const car = t != null && life.car;
      const beam = car ? [car.x + car.dir * 1.6, STREET_Y, 0.55] : null;
      const lambert = (q, Lp) => {
        const dx = Lp[0] - q.P[0], dy = Lp[1] - q.P[1], dz = Lp[2] - q.P[2], len = Math.hypot(dx, dy, dz) || 1;
        return [Math.max(0, (q.n[0] * dx + q.n[1] * dy + q.n[2] * dz) / len), len];
      };
      // Brightness a point gets from every light, before its material is applied.
      const shade = (q, gain, edge) => {
        let v = 0;
        if (L) {
          const d2 = (q.px - light.x) ** 2 + (q.py - light.y) ** 2;
          const g = Math.exp(-d2 / (R1 * R1)) + 0.38 * Math.exp(-d2 / (R2 * R2));
          if (g > 0.004) v += 2.3 * light.k * g * gain * (edge ? 0.35 + 0.65 * lambert(q, L)[0] : 0.12 + 0.88 * lambert(q, L)[0]);
        }
        if (beam) {
          const ahead = (q.P[0] - car.x) * car.dir;
          if (ahead > -0.5 && ahead < 7) {
            const [lam, len] = lambert(q, beam), spread = Math.abs(q.P[1] - STREET_Y) / (0.8 + ahead * 0.45);
            v += 1.2 * gain * (0.25 + 0.75 * lam) * Math.exp(-(len * len) / 16) * Math.exp(-spread * spread * 0.6);
          }
        }
        return v;
      };
      const now = t ?? 0;
      const fl = life.flicker, sh = life.shadow;
      for (const q of geo.cells) {
        let mat = q.mat, ch = q.ch, hot = false;
        if (q.win) {
          let on = q.win.lit;
          if (fl && fl.w === q.win) on = hash(Math.floor(now / 55), 3) > (now - fl.t0 < fl.dur * 0.7 ? 0.45 : 0.2);
          if (on) {
            if (sh && sh.w === q.win) {
              // Someone walks past: a dark sliver crosses the lit window.
              const cs = q.win.cells, c0 = cs[0].c, c1 = cs[cs.length - 1].c, k = (now - sh.t0) / sh.dur;
              const at = sh.dir > 0 ? c0 - 1 + k * (c1 - c0 + 2) : c1 + 1 - k * (c1 - c0 + 2);
              if (Math.abs(q.c - at) < 0.8) continue;
            }
            mat = 'lit'; ch = '#'; hot = true;
          }
        } else if (mat === 'lamp') {
          hot = true;
          if (life.buzz && life.buzz.lamp === q.pole && hash(Math.floor(now / 70), 9) < 0.55) continue;
        } else if (mat === 'beacon') {
          hot = true;
          if (t != null && (now % 2600) < 140) mat = 'lit';
        }
        const [b0, gain] = MAT[mat];
        let v = b0 + shade(q, gain, mat === 'edge');
        // Lamps pool faint light on the ground around their posts.
        if (q.mat === 'ground' || q.mat === 'curb') for (const p of LAMPS) {
          const d2 = (q.P[0] - p.x) ** 2 + (q.P[1] - p.y) ** 2;
          if (d2 < 4) v += 0.1 * Math.exp(-d2 / 1.1) * (life.buzz?.lamp === p && hash(Math.floor(now / 70), 9) < 0.55 ? 0 : 1);
        }
        const c = ch ?? (v > 0.05 ? GROUND_CH : null);
        if (c) put(c, q.c, q.r, v, hot);
      }
      if (t == null) return;

      const visible = (x, y, z) => {
        const [px, py] = geo.project(x, y, z), c = Math.floor(px / geo.cw), r = Math.floor(py / geo.cell);
        if (c < 0 || r < 0 || c >= geo.cols || r >= geo.rows || z < geo.zbuf[r * geo.cols + c] - 0.05) return null;
        return { c, r, px, py, P: [x, y, z], n: [0, 0, 1] };
      };
      // Fans turn slowly on two roofs.
      FANS.forEach(([x, y, z], i) => {
        const q = visible(x, y, z);
        if (q) put('|/-\\'[Math.floor(now / 420 + i * 2) % 4], q.c, q.r, 0.05 + shade(q, 0.9, false), false);
      });
      for (const p of life.steam) {
        const k = (now - p.t0) / p.dur, q = visible(p.x + k * 1.1, p.y + k * 0.4, STEAM_AT[2] + 0.2 + k * 2.4);
        if (q) put(k < 0.3 ? '.' : k < 0.65 ? 'o' : '~', q.c, q.r, (1 - k) * (0.03 + shade(q, 0.8, false)), false);
      }
      for (const l of life.leaves) {
        if (l.delay > 0) continue;
        const q = visible(l.x, l.y, 0.06 + Math.abs(Math.sin(l.ph * 0.5)) * 0.3);
        if (q) put(",'`.~"[Math.floor(l.ph) % 5], q.c, q.r, 0.04 + shade(q, 1, false), false);
      }
      if (car) {
        for (let i = 0; i < 4; i++) {
          const q = visible(car.x - car.dir * i * 0.45, STREET_Y, 0.3);
          if (q) put(i === 0 ? 'o' : '=', q.c, q.r, i === 0 ? 0.9 : 0.12 + shade(q, 0.8, false), i === 0);
        }
      }
    },
  };
}
