// Cold War 2: 2030 — procedural artwork for structures and units.
// Vehicle hulls and turrets are rendered once per faction into cached high-resolution sprites
// and rotated at draw time; moving parts (tracks, wheels, rotors, exhaust) are drawn live.
'use strict';

// ---------- colour helpers ----------
function hexRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tone(hex, amt) { // amt < 0 darkens, > 0 lightens
  const [r, g, b] = hexRgb(hex), f = amt < 0 ? 0 : 255, p = Math.abs(amt);
  return `rgb(${Math.round((f - r) * p + r)},${Math.round((f - g) * p + g)},${Math.round((f - b) * p + b)})`;
}
function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function shade(hex, amt) { return tone(hex, amt); }

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

// Fill a shape with a camouflage pattern, directional lighting and an outline.
function camoFill(ctx, shape, camo, seed, bw, bh) {
  ctx.save();
  shape(); ctx.clip();
  ctx.fillStyle = camo[0]; ctx.fillRect(-bw, -bh, bw * 2, bh * 2);
  const r = makeRng(seed);
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = camo[1 + (i % 2)];
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse((r() - 0.5) * bw * 2, (r() - 0.5) * bh * 2, 1.5 + r() * bw * 0.3, 1.2 + r() * bh * 0.35, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(-bw, -bh, bw * 0.6, bh);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = g; ctx.fillRect(-bw, -bh, bw * 2, bh * 2);
  ctx.restore();
  shape();
  ctx.strokeStyle = 'rgba(10,10,8,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
}

function metalFill(ctx, shape, a, b, bw, bh) {
  ctx.save(); shape(); ctx.clip();
  const g = ctx.createLinearGradient(-bw, -bh, bw, bh);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(-bw, -bh, bw * 2, bh * 2);
  ctx.restore();
  shape(); ctx.strokeStyle = 'rgba(10,10,10,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
}

function barrel(ctx, x0, x1, w, y = 0) {
  const g = ctx.createLinearGradient(0, y - w / 2, 0, y + w / 2);
  g.addColorStop(0, '#6b6f6a'); g.addColorStop(0.5, '#3a3d3a'); g.addColorStop(1, '#1e201e');
  ctx.fillStyle = g; ctx.fillRect(x0, y - w / 2, x1 - x0, w);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5; ctx.strokeRect(x0, y - w / 2, x1 - x0, w);
}

function glass(ctx, x, y, rx, ry, rot = 0, gold) {
  const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  g.addColorStop(0, gold ? '#f3d58a' : '#c6ecff'); g.addColorStop(1, gold ? '#5a4214' : '#123248');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();
}

const Art = {
  cache: new Map(),

  // Cached sprite drawn at 2x resolution, centred on the origin, facing +x.
  sprite(id, size, fn) {
    let c = this.cache.get(id);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = size * 2;
      const x = c.getContext('2d');
      x.scale(2, 2); x.translate(size / 2, size / 2);
      fn(x);
      this.cache.set(id, c);
    }
    return c;
  },

  part(ctx, u, team, name, size, angle, ox = 0) {
    const spec = VEHICLES[u.key];
    const c = this.sprite(`${u.key}|${name}|${team.faction}|${team.color}`, size, x => spec[name](x, team, team.camo || FACTIONS[team.faction].camo));
    ctx.save();
    ctx.rotate(angle);
    ctx.drawImage(c, -size / 2 + ox, -size / 2, size, size);
    ctx.restore();
  },

  unit(ctx, u, team) {
    const fn = UNIT_LIVE[u.key];
    if (fn) fn(ctx, u, team);
  },
};

// ---------- tracks & wheels (live, so they animate) ----------
function trackPair(ctx, L, y0, w, u) {
  const off = u.moving ? (u.anim * 22) % 3 : 0;
  for (const s of [-1, 1]) {
    const y = s > 0 ? y0 : -y0 - w;
    ctx.fillStyle = '#1d1e1c'; ctx.fillRect(-L / 2, y, L, w);
    ctx.fillStyle = '#3d3f3a';
    for (let x = -L / 2 + off; x < L / 2 - 0.5; x += 3) ctx.fillRect(x, y, 1.2, w);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-L / 2, y, L, 0.8);
  }
}
function wheels(ctx, xs, y, rx, ry, u) {
  for (const s of [-1, 1]) for (const x of xs) {
    ctx.fillStyle = '#151614';
    ctx.beginPath(); ctx.ellipse(x, s * y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3c38';
    ctx.beginPath(); ctx.ellipse(x, s * y, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- vehicle sprite parts ----------
const VEHICLES = {
  tank: {
    hull(x, team, camo) {
      const s = () => poly(x, [[-13, -7], [10, -7], [13.5, -4], [13.5, 4], [10, 7], [-13, 7]]);
      camoFill(x, s, camo, 11, 14, 8);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.6;
      for (let i = -12; i < -5; i += 1.6) { x.beginPath(); x.moveTo(i, -4.5); x.lineTo(i, 4.5); x.stroke(); }
      x.fillStyle = team.color; x.fillRect(-13, -7, 3, 2); x.fillRect(-13, 5, 3, 2);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(9, -6, 1, 12);
    },
    turret(x, team, camo) {
      barrel(x, 6, 23, 2.2);
      x.fillStyle = '#2a2c2a'; x.fillRect(12, -1.7, 3, 3.4); x.fillRect(21.5, -1.6, 2, 3.2);
      const s = () => poly(x, [[-8, -6], [3, -6.5], [7.5, -3], [7.5, 3], [3, 6.5], [-8, 6]]);
      camoFill(x, s, camo, 21, 9, 7);
      x.fillStyle = team.color; x.fillRect(-6, -2.6, 4.5, 5.2);
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 0.5; x.strokeRect(-6, -2.6, 4.5, 5.2);
      x.fillStyle = '#484a44'; x.beginPath(); x.arc(-1, 3.4, 1.8, 0, Math.PI * 2); x.fill(); x.stroke();
      x.fillStyle = '#2b2d2a'; x.fillRect(1.5, -4.8, 2.5, 1.6);
    },
  },
  ifv: {
    hull(x, team, camo) {
      const s = () => poly(x, [[-12, -6], [8, -6], [12.5, -2.5], [12.5, 2.5], [8, 6], [-12, 6]]);
      camoFill(x, s, camo, 12, 13, 7);
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.6;
      x.strokeRect(-11.5, -3.5, 4, 7);
      x.fillStyle = team.color; x.fillRect(-12, -6, 2.5, 1.8); x.fillRect(-12, 4.2, 2.5, 1.8);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(8, -5, 0.8, 10);
    },
    turret(x, team, camo) {
      barrel(x, 3, 15, 1.3);
      x.fillStyle = '#5b5e58'; x.fillRect(-3, -6.2, 6, 2.2);
      x.fillStyle = '#2a2c2a'; x.fillRect(2.6, -6, 0.8, 1.8);
      const s = () => poly(x, [[-4.5, -3.8], [2, -4], [4, -1.8], [4, 1.8], [2, 4], [-4.5, 3.8]]);
      camoFill(x, s, camo, 33, 5, 4.5);
      x.fillStyle = team.color; x.fillRect(-3.5, -1.2, 2.4, 2.4);
    },
  },
  mlrs: {
    hull(x, team, camo) {
      const bed = () => poly(x, [[-13, -6], [5, -6], [5, 6], [-13, 6]]);
      camoFill(x, bed, camo, 13, 14, 7);
      const cab = () => poly(x, [[6, -6], [11, -6], [13.5, -3], [13.5, 3], [11, 6], [6, 6]]);
      camoFill(x, cab, camo, 14, 14, 7);
      glass(x, 11.5, 0, 1.2, 4.2);
      x.fillStyle = team.color; x.fillRect(6.5, -6, 3, 1.6); x.fillRect(6.5, 4.4, 3, 1.6);
    },
    turret(x, team, camo) {
      const s = () => poly(x, [[-8, -5], [7, -5], [7, 5], [-8, 5]]);
      camoFill(x, s, [tone(camo[0], -0.2), camo[1], camo[2]], 44, 9, 6);
      x.fillStyle = '#121310';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(5.5 - i * 0.2, -3.6 + j * 2.4, 0.8, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 0.4;
      for (let i = -6; i < 5; i += 2.4) { x.beginPath(); x.moveTo(i, -5); x.lineTo(i, 5); x.stroke(); }
    },
  },
  railtank: {
    hull(x, team, camo) {
      const s = () => poly(x, [[-13, -7], [8, -7], [14, -3], [14, 3], [8, 7], [-13, 7]]);
      camoFill(x, s, camo, 15, 15, 8);
      x.fillStyle = 'rgba(80,220,255,0.85)';
      for (let i = 0; i < 3; i++) { x.fillRect(-11 + i * 3, -6, 1.6, 1.2); x.fillRect(-11 + i * 3, 4.8, 1.6, 1.2); }
      x.fillStyle = team.color; x.fillRect(4, -7, 3.5, 1.6); x.fillRect(4, 5.4, 3.5, 1.6);
    },
    turret(x, team, camo) {
      for (const y of [-1.6, 1.6]) barrel(x, 3, 25, 1.4, y);
      x.fillStyle = '#6ef';
      for (let i = 0; i < 5; i++) x.fillRect(7 + i * 3.5, -2.6, 1, 5.2);
      const s = () => poly(x, [[-8, -6], [1, -6], [6, -2.5], [6, 2.5], [1, 6], [-8, 6]]);
      camoFill(x, s, camo, 16, 9, 7);
      x.fillStyle = team.color; x.fillRect(-6.5, -2.4, 4, 4.8);
      x.fillStyle = 'rgba(80,220,255,0.9)'; x.fillRect(-7.5, -0.5, 1.5, 1);
    },
  },
  titan: {
    hull(x, team, camo) {
      const s = () => poly(x, [[-15.5, -9], [12, -9], [15.5, -5.5], [15.5, 5.5], [12, 9], [-15.5, 9]]);
      camoFill(x, s, camo, 17, 16, 10);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 0.6;
      for (let i = -14; i < -6; i += 1.6) { x.beginPath(); x.moveTo(i, -6); x.lineTo(i, 6); x.stroke(); }
      x.fillStyle = team.color; x.fillRect(-15.5, -9, 3.5, 2.2); x.fillRect(-15.5, 6.8, 3.5, 2.2);
    },
    turret(x, team, camo) {
      for (const y of [-3, 3]) { barrel(x, 7, 27, 2.2, y); x.fillStyle = '#262826'; x.fillRect(25, y - 1.6, 2.4, 3.2); }
      for (const y of [-12, 8.5]) {
        const p = () => poly(x, [[-7, y], [3, y], [3, y + 3.5], [-7, y + 3.5]]);
        metalFill(x, p, '#71756e', '#3a3d38', 10, 14);
        x.fillStyle = '#121310'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(2, y + 0.9 + i * 0.9, 0.35, 0, Math.PI * 2); x.fill(); }
      }
      const s = () => poly(x, [[-10, -8.5], [5, -8.5], [10, -4], [10, 4], [5, 8.5], [-10, 8.5]]);
      camoFill(x, s, camo, 27, 11, 9);
      x.fillStyle = team.color; x.fillRect(-8, -3.5, 6, 7);
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 0.5; x.strokeRect(-8, -3.5, 6, 7);
      x.fillStyle = '#484a44'; x.beginPath(); x.arc(1, 4.6, 2, 0, Math.PI * 2); x.fill(); x.stroke();
    },
  },
  harvester: {
    hull(x, team) {
      const s = () => poly(x, [[-14, -8], [9, -8], [9, 8], [-14, 8]]);
      metalFill(x, s, '#d4a73a', '#7a5a14', 15, 9);
      x.save(); s(); x.clip();
      x.fillStyle = '#1b1b18';
      for (let i = -16; i < 12; i += 4) { x.beginPath(); x.moveTo(i, 8); x.lineTo(i + 2, 8); x.lineTo(i + 5, 5); x.lineTo(i + 3, 5); x.fill(); }
      x.restore();
      const cab = () => poly(x, [[9, -8], [12.5, -8], [14, -5], [14, 5], [12.5, 8], [9, 8]]);
      metalFill(x, cab, '#6d757d', '#2c3237', 15, 9);
      glass(x, 12.5, 0, 0.9, 5);
      x.fillStyle = team.color; x.fillRect(5, -8, 3.5, 16);
      x.fillStyle = '#5a5e60'; x.fillRect(14, -9, 2.4, 18);
      x.fillStyle = '#2e3133'; for (let i = -8; i < 9; i += 2) x.fillRect(14.5, i, 1.4, 1);
    },
  },
  mcv: {
    hull(x, team, camo) {
      const s = () => poly(x, [[-15, -9], [11, -9], [15, -5], [15, 5], [11, 9], [-15, 9]]);
      camoFill(x, s, camo, 19, 16, 10);
      const box = () => poly(x, [[-12, -6.5], [5, -6.5], [5, 6.5], [-12, 6.5]]);
      metalFill(x, box, '#8f979e', '#3f464c', 13, 8);
      x.fillStyle = team.color; x.fillRect(-12, -1.2, 17, 2.4);
      x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 0.5;
      for (let i = -10; i < 5; i += 3) { x.beginPath(); x.moveTo(i, -6.5); x.lineTo(i, 6.5); x.stroke(); }
      glass(x, 12.5, 0, 1, 4.5);
      x.strokeStyle = '#ddd'; x.lineWidth = 0.6; x.beginPath(); x.moveTo(-9, -5); x.lineTo(-13, -11); x.stroke();
    },
  },
  heli: {
    body(x, team, camo) {
      const boom = () => poly(x, [[-22, -1.3], [-4, -2.2], [-4, 2.2], [-22, 1.3]]);
      camoFill(x, boom, camo, 41, 23, 3);
      x.fillStyle = team.color; x.fillRect(-23.5, -1, 3, 5.5);
      x.fillStyle = tone(camo[1], -0.1); x.fillRect(-18, -5, 2, 10);
      const wing = () => poly(x, [[-3, -10], [2, -10], [2, 10], [-3, 10]]);
      camoFill(x, wing, camo, 42, 4, 11);
      for (const y of [-8.5, 8.5]) { metalFill(x, () => { x.beginPath(); x.ellipse(-0.5, y, 4, 1.6, 0, 0, Math.PI * 2); }, '#83877f', '#33362f', 5, 10); }
      const body = () => { x.beginPath(); x.ellipse(2, 0, 11, 4.2, 0, 0, Math.PI * 2); };
      camoFill(x, body, camo, 43, 13, 5);
      glass(x, 8.5, 0, 3.2, 2.2); glass(x, 3.5, 0, 3, 2.4);
      x.fillStyle = '#1b1d1b'; x.beginPath(); x.arc(12.8, 0, 1.4, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#30332f'; x.fillRect(11, -0.4, 4, 0.8);
    },
  },
  jet: {
    body(x, team) {
      const west = FACTIONS[team.faction].side === 'west';
      const shape = () => poly(x, [[17, 0], [9, -2.6], [3, -4], [-2, -12.5], [-7.5, -12.5], [-6, -4.5], [-11, -4.5], [-15, -8], [-17, -8],
        [-14.5, -2.4], [-14.5, 2.4], [-17, 8], [-15, 8], [-11, 4.5], [-6, 4.5], [-7.5, 12.5], [-2, 12.5], [3, 4], [9, 2.6]]);
      metalFill(x, shape, west ? '#aab3bb' : '#9aa49a', west ? '#4d565e' : '#4b544b', 17, 13);
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.4;
      x.beginPath(); x.moveTo(-10, 0); x.lineTo(8, 0); x.moveTo(-4, -9); x.lineTo(1, -4); x.moveTo(-4, 9); x.lineTo(1, 4); x.stroke();
      x.fillStyle = team.color;
      x.fillRect(-14, -6.5, 3.5, 1.4); x.fillRect(-14, 5.1, 3.5, 1.4);
      for (const y of [-9, 9]) { x.beginPath(); x.arc(-4.5, y, 1.3, 0, Math.PI * 2); x.fill(); }
      glass(x, 7.5, 0, 4, 1.5, 0, true);
      x.fillStyle = '#2a2d30'; x.fillRect(-15.5, -2.2, 1.5, 4.4);
    },
  },
};

// ---------- live drawing per unit (origin at unit, already lifted for aircraft) ----------
function infantryArt(ctx, u, team, kit) {
  const camo = team.camo || FACTIONS[team.faction].camo;
  const step = u.moving ? Math.sin(u.anim * 12) * 2 : 0;
  ctx.rotate(u.facing);
  ctx.scale(1.35, 1.35);
  ctx.fillStyle = '#20211d';
  ctx.fillRect(-2 + step, -3, 3, 1.8); ctx.fillRect(-2 - step, 1.2, 3, 1.8);
  ctx.fillStyle = team.color; ctx.fillRect(-4.6, -2.2, 2.6, 4.4);
  ctx.fillStyle = camo[1]; ctx.beginPath(); ctx.ellipse(-0.6, 0, 3, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = camo[0]; ctx.beginPath(); ctx.ellipse(-0.2, 0, 2.4, 3.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
  kit && kit(camo);
  ctx.fillStyle = u.key === 'engineer' ? '#f2c230' : tone(camo[2], -0.35);
  ctx.beginPath(); ctx.arc(0.6, 0, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.arc(0.1, -0.6, 0.9, 0, Math.PI * 2); ctx.fill();
}

function vehicle(L, trackY, trackW, hullSize, turretSize, wheelSpec) {
  return (ctx, u, team) => {
    ctx.save(); ctx.rotate(u.facing);
    if (wheelSpec) wheels(ctx, wheelSpec[0], wheelSpec[1], wheelSpec[2], wheelSpec[3], u);
    else trackPair(ctx, L, trackY, trackW, u);
    ctx.restore();
    Art.part(ctx, u, team, 'hull', hullSize, u.facing);
    if (turretSize) {
      const rec = (u.recoil || 0) * 2.5;
      Art.part(ctx, u, team, 'turret', turretSize, u.turret, -rec);
      if (u.recoil) u.recoil = Math.max(0, u.recoil - 0.08);
    }
  };
}

const UNIT_LIVE = {
  rifle(ctx, u, team) {
    infantryArt(ctx, u, team, () => { ctx.fillStyle = '#151614'; ctx.fillRect(0.5, 1.4, 8, 1.3); ctx.fillRect(4, 1, 1.2, 2.2); });
  },
  rocket(ctx, u, team) {
    infantryArt(ctx, u, team, camo => { ctx.fillStyle = tone(camo[1], -0.2); ctx.fillRect(-4.5, -3.6, 12, 2.4); ctx.fillStyle = '#111'; ctx.fillRect(7, -3.6, 1, 2.4); });
  },
  engineer(ctx, u, team) {
    infantryArt(ctx, u, team, () => { ctx.fillStyle = '#c9a43a'; ctx.fillRect(-5.5, -1.8, 3, 3.6); ctx.fillStyle = '#555'; ctx.fillRect(1, 2.2, 4, 1); });
  },
  tank: vehicle(26, 6, 4, 40, 52),
  ifv: vehicle(0, 0, 0, 36, 36, [[-8, -2.7, 2.7, 8], 6.4, 2.6, 1.7]),
  mlrs: vehicle(0, 0, 0, 36, 28, [[-9, -4, 9], 6.4, 2.6, 1.8]),
  railtank: vehicle(26, 6.2, 4, 40, 56),
  titan: vehicle(31, 8.5, 5.5, 44, 60),
  harvester(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    trackPair(ctx, 28, 7.5, 4.5, u);
    ctx.restore();
    Art.part(ctx, u, team, 'hull', 40, u.facing);
    // ore bin shows the load
    ctx.save(); ctx.rotate(u.facing);
    const f = u.cargo / u.def.capacity;
    ctx.fillStyle = '#2a2418'; ctx.fillRect(-12, -6, 15, 12);
    ctx.fillStyle = '#e2ae3c'; ctx.fillRect(-12, 6 - 12 * f, 15, 12 * f);
    ctx.fillStyle = 'rgba(255,240,180,0.35)';
    for (let i = 0; i < 6 * f; i++) ctx.fillRect(-11 + (i * 5) % 13, 5 - 12 * f + (i * 3) % 6, 1.5, 1.5);
    if (u.hstate === 'mine') { ctx.fillStyle = '#999'; ctx.fillRect(15 + Math.sin(u.anim * 20) * 0.8, -9, 1.6, 18); }
    ctx.restore();
  },
  mcv: vehicle(30, 7.5, 5, 44, 0),
  heli(ctx, u, team) {
    Art.part(ctx, u, team, 'body', 52, u.facing);
    // tail rotor
    ctx.save(); ctx.rotate(u.facing); ctx.translate(-22, 3.5);
    ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = 1;
    const ta = u.anim * 50;
    ctx.beginPath(); ctx.moveTo(Math.cos(ta) * 3.5, Math.sin(ta) * 1); ctx.lineTo(-Math.cos(ta) * 3.5, -Math.sin(ta) * 1); ctx.stroke();
    ctx.restore();
    // main rotor: blur disc + blades
    ctx.fillStyle = 'rgba(210,215,220,0.09)';
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(25,25,25,0.75)'; ctx.lineWidth = 1.6;
    const a = u.anim * 28;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const b = a + i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * 17, Math.sin(b) * 17); }
    ctx.stroke();
    ctx.fillStyle = '#2a2c2a'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
  },
  jet(ctx, u, team) {
    ctx.save(); ctx.rotate(u.facing);
    const fl = 5 + Math.random() * 4;
    const g = ctx.createLinearGradient(-15, 0, -15 - fl, 0);
    g.addColorStop(0, 'rgba(255,240,200,0.95)'); g.addColorStop(0.4, 'rgba(255,150,50,0.8)'); g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    for (const y of [-1.2, 1.2]) { ctx.beginPath(); ctx.moveTo(-15, y - 1); ctx.lineTo(-15 - fl, y); ctx.lineTo(-15, y + 1); ctx.fill(); }
    ctx.restore();
    Art.part(ctx, u, team, 'body', 40, u.facing);
  },
};

// ---------- structures ----------
const STEEL_A = '#6a737c', STEEL_B = '#30363c';

function hazard(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#d9ad2b'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1b1b1b';
  for (let i = -h; i < w; i += 6) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + 3, y + h); ctx.lineTo(x + i + 3 + h, y); ctx.lineTo(x + i + h, y); ctx.fill(); }
  ctx.restore();
}

// An oblique block: roof on top, front wall facing the viewer, shadow to the lower right.
function bBlock(ctx, x, y, w, h, hgt, roofA, roofB, opt = {}) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  const sh = hgt * 0.75;
  ctx.beginPath();
  ctx.moveTo(x + w, y + 1); ctx.lineTo(x + w + sh, y + sh * 0.55 + 1); ctx.lineTo(x + w + sh, y + h + sh * 0.55);
  ctx.lineTo(x + sh, y + h + sh * 0.55); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
  const wy = y + h - hgt;
  const g = ctx.createLinearGradient(0, wy, 0, y + h);
  g.addColorStop(0, opt.wall || '#5c656e'); g.addColorStop(1, '#22272b');
  ctx.fillStyle = g; ctx.fillRect(x, wy, w, hgt);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
  for (let i = x + 6; i < x + w - 1; i += 7) { ctx.beginPath(); ctx.moveTo(i + 0.5, wy); ctx.lineTo(i + 0.5, y + h); ctx.stroke(); }
  const rg = ctx.createLinearGradient(x, y, x + w * 0.7, wy);
  rg.addColorStop(0, roofA); rg.addColorStop(1, roofB);
  ctx.fillStyle = rg; ctx.fillRect(x, y, w, h - hgt);
  if (opt.ribs) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let i = x + 4; i < x + w - 1; i += opt.ribs) { ctx.beginPath(); ctx.moveTo(i + 0.5, y + 2); ctx.lineTo(i + 0.5, wy - 1); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(x, y, w, 1.5); ctx.fillRect(x, y, 1.5, h - hgt);
  ctx.strokeStyle = 'rgba(8,10,12,0.75)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.beginPath(); ctx.moveTo(x, wy + 0.5); ctx.lineTo(x + w, wy + 0.5); ctx.stroke();
  return wy;
}

function teamRoof(team) { return [tone(team.color, -0.05), tone(team.color, -0.55)]; }

function windows(ctx, x, y, w, n, lit, color = '#ffd27a') {
  const gap = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = lit ? color : '#20262b';
    ctx.fillRect(x + i * gap + gap * 0.2, y, gap * 0.6, 2.2);
    if (lit) { ctx.fillStyle = rgba(color === '#ffd27a' ? '#ffd27a' : '#9fd8ff', 0.18); ctx.fillRect(x + i * gap, y - 1, gap, 4.2); }
  }
}

function cylinder(ctx, cx, by, r, h, a, b, top) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(cx + h * 0.4, by + h * 0.2, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, b); g.addColorStop(0.35, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(cx - r, by - h, r * 2, h);
  ctx.beginPath(); ctx.ellipse(cx, by, r, r * 0.45, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = top || a;
  ctx.beginPath(); ctx.ellipse(cx, by - h, r, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
}

function flagpole(ctx, x, y, faction, t) {
  ctx.strokeStyle = '#c8ccd0'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24); ctx.stroke();
  const img = FLAG_IMG[faction];
  if (!img || !img.complete || !img.naturalWidth) return;
  const W = 13, H = 8.5, n = 5, sw = img.naturalWidth / n;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(t * 5 - i * 0.9) * 0.9 * (i / n);
    ctx.drawImage(img, i * sw, 0, sw, img.naturalHeight, x + i * W / n, y - 24 + wave, W / n + 0.3, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y - 24, W, H);
}

function blink(ctx, x, y, on, color) {
  ctx.fillStyle = on ? color : '#3a1010';
  ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
  if (on) { ctx.fillStyle = rgba(color, 0.25); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
}

function dish(ctx, cx, cy, r, a) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#3a4046'; ctx.fillRect(-1.5, 0, 3, r * 0.8);
  ctx.rotate(0.3); ctx.scale(Math.max(0.15, Math.abs(Math.cos(a))), 1);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
  g.addColorStop(0, '#f2f5f7'); g.addColorStop(1, '#9aa3ab');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#59616a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#59616a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function sandbags(ctx, cx, cy, r) {
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    ctx.fillStyle = i % 2 ? '#a8996c' : '#8e8058';
    ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, 3.4, 2.4, a, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
}

const BLD_ART = {
  cc(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const [ra, rb] = teamRoof(team);
    const wy = bBlock(ctx, X + 4, Y + 22, W - 10, H - 26, hgt, ra, rb, { ribs: 8 });
    hazard(ctx, X + W / 2 - 16, Y + H - 6, 32, 3);
    ctx.fillStyle = '#1a1e21'; ctx.fillRect(X + W / 2 - 14, wy + 4, 28, hgt - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(X + W / 2 - 14, wy + 6 + i * 4); ctx.lineTo(X + W / 2 + 14, wy + 6 + i * 4); ctx.stroke(); }
    windows(ctx, X + 8, wy + 6, 26, 4, !low); windows(ctx, X + W - 38, wy + 6, 26, 4, !low);
    // helipad on the main roof
    ctx.fillStyle = '#2e3337'; ctx.beginPath(); ctx.arc(X + 26, Y + 34, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e6e6e6'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(X + 26, Y + 34, 9.5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e6e6e6'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', X + 26, Y + 34.5);
    // command tower
    const ty = bBlock(ctx, X + W - 38, Y + 4, 28, 40, 22, STEEL_A, STEEL_B);
    windows(ctx, X + W - 36, ty + 4, 24, 5, !low, '#9fd8ff');
    windows(ctx, X + W - 36, ty + 10, 24, 5, !low, '#9fd8ff');
    ctx.fillStyle = '#e9edf0'; ctx.beginPath(); ctx.arc(X + W - 18, Y + 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7c868f'; ctx.stroke();
    ctx.strokeStyle = '#c9ced2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X + W - 30, Y + 10); ctx.lineTo(X + W - 30, Y - 12); ctx.stroke();
    blink(ctx, X + W - 30, Y - 12, Math.sin(t * 4) > 0, '#ff4040');
    flagpole(ctx, X + 10, Y + 26, team.faction, t);
  },
  power(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const wy = bBlock(ctx, X + 3, Y + 18, W - 6, H - 21, 10, STEEL_A, STEEL_B, { ribs: 6 });
    windows(ctx, X + 6, wy + 4, W - 12, 5, !low);
    // fusion dome
    const cx = X + 23, cy = Y + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 6, cy + 6, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - 5, cy - 6, 2, cx, cy, 15);
    g.addColorStop(0, '#f2f5f7'); g.addColorStop(1, '#6d777f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = team.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 11, 0.2, Math.PI - 0.2); ctx.stroke();
    const pulse = low ? 0.12 : 0.55 + 0.45 * Math.sin(t * 3 + b.anim);
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    cg.addColorStop(0, `rgba(200,250,255,${pulse})`); cg.addColorStop(1, `rgba(60,200,255,0)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    // striped exhaust stack
    const sx = X + W - 11, sb = Y + H - 14;
    cylinder(ctx, sx, sb, 5, 34, '#d9dde0', '#7f878e');
    ctx.save(); ctx.beginPath(); ctx.rect(sx - 5, sb - 34, 10, 34); ctx.clip();
    ctx.fillStyle = team.color; for (let i = 0; i < 4; i++) ctx.fillRect(sx - 5, sb - 32 + i * 9, 10, 4.5);
    ctx.restore();
    blink(ctx, sx, sb - 36, Math.sin(t * 3 + 1) > 0, '#ff4040');
    if (!low && Math.random() < 0.08 && G && b.team !== undefined) G.effects.push({ type: 'smoke', x: sx, y: sb - 36, t: 0, life: 1.6, size: 3 });
  },
  refinery(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const [ra, rb] = teamRoof(team);
    const wy = bBlock(ctx, X + 4, Y + 8, W * 0.6, H - 34, hgt, ra, rb, { ribs: 7 });
    windows(ctx, X + 8, wy + 5, W * 0.6 - 8, 5, !low);
    for (let i = 0; i < 2; i++) cylinder(ctx, X + W * 0.8, Y + 30 + i * 30, 10, 18, '#c9cfd4', '#636b72', '#9aa2a8');
    ctx.fillStyle = '#e2ae3c'; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(X + W * 0.8, Y + 12 + i * 30, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#3c4247'; ctx.fillRect(X + W * 0.62, Y + 20, W * 0.12, 5);
    ctx.fillStyle = '#26292c'; ctx.fillRect(X + TILE, Y + H - 20, TILE, 18);
    hazard(ctx, X + TILE, Y + H - 20, TILE, 3);
    blink(ctx, X + TILE + 3, Y + H - 4, Math.floor(t * 2) % 2 === 0, '#ffcc33');
    blink(ctx, X + 2 * TILE - 3, Y + H - 4, Math.floor(t * 2) % 2 === 1, '#ffcc33');
  },
  barracks(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const [ra, rb] = teamRoof(team);
    const wy = bBlock(ctx, X + 4, Y + 10, W - 8, H - 18, hgt, ra, rb, { ribs: 5 });
    windows(ctx, X + 6, wy + 4, W - 12, 4, !low);
    ctx.fillStyle = '#1a1e21'; ctx.fillRect(X + W / 2 - 6, wy + 3, 12, hgt - 3);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#a8996c' : '#8e8058';
      ctx.beginPath(); ctx.ellipse(X + 8 + i * 5, Y + H - 4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(X + W - 8 - i * 5, Y + H - 4, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    flagpole(ctx, X + 8, Y + 12, team.faction, t);
  },
  factory(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const [ra, rb] = teamRoof(team);
    const wy = bBlock(ctx, X + 3, Y + 6, W - 6, H - 9, hgt, ra, rb, { ribs: 9 });
    ctx.fillStyle = 'rgba(160,210,240,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(X + 12 + i * 20, Y + 12, 10, 3);
    ctx.fillStyle = '#16191b'; ctx.fillRect(X + W / 2 - 24, wy + 2, 48, hgt - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(X + W / 2 - 24, wy + 5 + i * 3.5); ctx.lineTo(X + W / 2 + 24, wy + 5 + i * 3.5); ctx.stroke(); }
    hazard(ctx, X + W / 2 - 24, wy, 48, 3);
    windows(ctx, X + 6, wy + 5, 16, 2, !low); windows(ctx, X + W - 22, wy + 5, 16, 2, !low);
    ctx.strokeStyle = '#d9ad2b'; ctx.lineWidth = 3;
    const ca = Math.sin(t * 0.5 + b.anim) * 0.5;
    ctx.beginPath(); ctx.moveTo(X + 14, Y + 18); ctx.lineTo(X + 14 + Math.cos(ca) * 36, Y + 18 + Math.sin(ca) * 14); ctx.stroke();
    ctx.fillStyle = '#2b2f33'; ctx.fillRect(X + 11, Y + 15, 6, 6);
  },
  radar(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const [ra, rb] = teamRoof(team);
    const wy = bBlock(ctx, X + 4, Y + 16, W - 8, H - 20, hgt, STEEL_A, STEEL_B);
    windows(ctx, X + 7, wy + 5, W - 14, 4, !low, '#9fd8ff');
    ctx.fillStyle = ra; ctx.fillRect(X + 4, Y + 16, W - 8, 4);
    ctx.strokeStyle = '#8a939b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X + W / 2 - 6, Y + 24); ctx.lineTo(X + W / 2, Y + 4); ctx.lineTo(X + W / 2 + 6, Y + 24); ctx.stroke();
    dish(ctx, X + W / 2, Y + 8, 12, low ? 0 : t * 1.4);
    blink(ctx, X + 8, Y + 18, Math.sin(t * 5) > 0.3, '#40ff70');
  },
  airfield(ctx, b, X, Y, W, H, hgt, team, low, t) {
    ctx.fillStyle = '#2b2f32'; ctx.fillRect(X + 2, Y + 2, W - 4, H - 4);
    ctx.fillStyle = '#35393c'; ctx.fillRect(X + 4, Y + 20, W - 8, 24);
    ctx.fillStyle = '#e8e8e8';
    for (let i = 0; i < 6; i++) ctx.fillRect(X + 10 + i * 13, Y + 31.5, 7, 1.5);
    for (let i = 0; i < 4; i++) { ctx.fillRect(X + 6, Y + 22 + i * 5.5, 5, 2); }
    ctx.fillStyle = team.color; ctx.fillRect(X + 4, Y + 20, W - 8, 1.2); ctx.fillRect(X + 4, Y + 43, W - 8, 1.2);
    for (let i = 0; i < 8; i++) blink(ctx, X + 8 + i * 11.5, Y + 47, !low && Math.floor(t * 6) % 8 === i, '#ffd040');
    const wy = bBlock(ctx, X + W - 24, Y + 2, 20, 16, 10, ...teamRoof(team));
    windows(ctx, X + W - 22, wy + 3, 16, 3, !low, '#9fd8ff');
    // parked jet silhouette
    ctx.save(); ctx.translate(X + 26, Y + 32); ctx.fillStyle = 'rgba(150,160,168,0.85)';
    poly(ctx, [[12, 0], [3, -2], [-1, -9], [-5, -9], [-4, -2], [-9, -3], [-11, -5], [-10, 0], [-11, 5], [-9, 3], [-4, 2], [-5, 9], [-1, 9], [3, 2]]);
    ctx.fill(); ctx.restore();
  },
  tech(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const wy = bBlock(ctx, X + 3, Y + 12, W - 6, H - 16, hgt, '#d9dde0', '#7d868d');
    windows(ctx, X + 6, wy + 5, W - 12, 5, !low, '#9fd8ff');
    const cx = X + W / 2, cy = Y + 22;
    const g = ctx.createRadialGradient(cx - 3, cy - 4, 1, cx, cy, 11);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, rgba(team.color, 0.9)); g.addColorStop(1, team.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, 10, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    for (let i = 0; i < 3; i++) blink(ctx, X + 9 + i * 4, Y + 15, !low && Math.floor(t * 3 + i) % 3 === 0, '#60e0ff');
  },
  super_lance(ctx, b, X, Y, W, H, hgt, team, low, t) {
    bBlock(ctx, X + 4, Y + 10, W - 8, H - 14, hgt, STEEL_A, STEEL_B, { ribs: 8 });
    const tm = b.team !== undefined && G ? G.teams[b.team] : team;
    const charge = tm.superReady ? 1 : Math.min(1, (tm.superTimer || 0) / BUILDINGS.super_lance.superweapon.charge);
    const cx = X + W / 2, cy = Y + H / 2 - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 8, cy + 8, 24, 18, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 24);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8c959d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#59616a'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = rgba('#5ac8ff', 0.4 + 0.6 * charge); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.4;
      ctx.strokeStyle = '#6d7680'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); ctx.lineTo(cx, cy); ctx.stroke();
    }
    ctx.fillStyle = tm.superReady ? `rgba(200,240,255,${0.6 + 0.4 * Math.sin(t * 8)})` : '#4a5560';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = team.color; ctx.fillRect(X + 4, Y + H - 4 - hgt - 4, W - 8, 3);
  },
  super_silo(ctx, b, X, Y, W, H, hgt, team, low, t) {
    bBlock(ctx, X + 4, Y + 8, W - 8, H - 12, hgt, '#5f6458', '#2f322b');
    const tm = b.team !== undefined && G ? G.teams[b.team] : team;
    const charge = tm.superReady ? 1 : Math.min(1, (tm.superTimer || 0) / BUILDINGS.super_silo.superweapon.charge);
    const cx = X + W / 2, cy = Y + H / 2 - 6;
    ctx.fillStyle = '#16171a'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
    const open = tm.superReady ? 9 : 0;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.clip();
    const dg = ctx.createLinearGradient(cx - 20, 0, cx + 20, 0);
    dg.addColorStop(0, '#8f9488'); dg.addColorStop(1, '#4b4f46');
    ctx.fillStyle = dg; ctx.fillRect(cx - 20, cy - 20, 20 - open, 40); ctx.fillRect(cx + open, cy - 20, 20 - open, 40);
    hazard(ctx, cx - 20, cy - 2, 20 - open, 4); hazard(ctx, cx + open, cy - 2, 20 - open, 4);
    if (tm.superReady) { ctx.fillStyle = `rgba(255,80,40,${0.5 + 0.5 * Math.sin(t * 8)})`; ctx.fillRect(cx - open, cy - 20, open * 2, 40); }
    ctx.restore();
    ctx.strokeStyle = '#2a2c28'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.fillRect(X + 10, Y + H - 12, W - 20, 4);
    ctx.fillStyle = team.color; ctx.fillRect(X + 10, Y + H - 12, (W - 20) * charge, 4);
  },
  turret(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2 + 1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx + 3, cy + 4, 13, 0, Math.PI * 2); ctx.fill();
    sandbags(ctx, cx, cy, 11);
    const g = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 9);
    g.addColorStop(0, '#8a9198'); g.addColorStop(1, '#3a4046');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx, cy - 2); ctx.rotate(b.turret);
    for (const y of [-1.6, 0, 1.6]) barrel(ctx, 3, 15, 1.1, y);
    metalFill(ctx, () => poly(ctx, [[-5, -5], [3, -5], [5, -2], [5, 2], [3, 5], [-5, 5]]), tone(team.color, 0.15), team.dark, 6, 6);
    ctx.restore();
  },
  railturret(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2;
    bBlock(ctx, X + 3, Y + 6, W - 6, H - 8, 6, STEEL_A, STEEL_B);
    ctx.save(); ctx.translate(cx, cy - 4); ctx.rotate(b.turret);
    for (const y of [-1.3, 1.3]) barrel(ctx, 2, 22, 1.2, y);
    ctx.fillStyle = low ? '#334' : '#6ef'; for (let i = 0; i < 4; i++) ctx.fillRect(6 + i * 4, -2.2, 1, 4.4);
    metalFill(ctx, () => poly(ctx, [[-7, -6], [1, -6], [5, -2], [5, 2], [1, 6], [-7, 6]]), tone(team.color, 0.1), team.dark, 8, 7);
    ctx.restore();
  },
  sam(ctx, b, X, Y, W, H, hgt, team, low, t) {
    const cx = X + W / 2, cy = Y + H / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(cx - 10, cy - 7, 24, 20);
    ctx.fillStyle = '#3d4247'; ctx.fillRect(cx - 12, cy - 10, 24, 20);
    hazard(ctx, cx - 12, cy + 8, 24, 2);
    ctx.save(); ctx.translate(cx, cy - 2); ctx.rotate(b.turret);
    metalFill(ctx, () => poly(ctx, [[-8, -8], [8, -8], [8, 8], [-8, 8]]), tone(team.color, -0.1), team.dark, 9, 9);
    ctx.fillStyle = '#1a1c1e';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.arc(6, -4 + i * 8 + (j ? 0 : 0), 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-6, -6, 10, 3.5); ctx.fillRect(-6, 2.5, 10, 3.5);
    ctx.fillStyle = '#d33'; ctx.fillRect(3, -6, 1.5, 3.5); ctx.fillRect(3, 2.5, 1.5, 3.5);
    ctx.restore();
  },
};

// ---------- sidebar cameos ----------
// Units and structures shown in the style mock use its artwork; everything else gets a
// procedural cameo rendered in the same dark style.
const CAMEO_ART = { tank: 1, ifv: 1, heli: 1, jet: 1, rifle: 1, sam: 1, cc: 1, barracks: 1, factory: 1, power: 1, radar: 1, airfield: 1 };
function cameoUrl(key, faction) { return CAMEO_ART[key] ? `assets/cameos/${faction}/${key}.webp` : null; }

function drawIcon(key, team, w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, '#22344a'); g.addColorStop(1, '#0a131f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const savedG = G;
  try {
    G = null;
    if (BUILDINGS[key]) {
      const def = BUILDINGS[key];
      const s = Math.min((w - 8) / (def.w * TILE), (h - 10) / (def.h * TILE + 18));
      ctx.translate(w / 2 - def.w * TILE * s / 2, h / 2 - def.h * TILE * s / 2 + 6 * s);
      ctx.scale(s, s);
      const fake = { key, def, tx: 0, ty: 0, w: def.w, h: def.h, x: def.w * TILE / 2, y: def.h * TILE / 2, hp: 1, maxHp: 1, built: 1, turret: -0.6, anim: 0 };
      const fakeTeam = Object.assign({ superTimer: 200, superReady: false, lowPower: false }, team);
      ctx.fillStyle = '#3a3e42'; ctx.fillRect(1, 1, def.w * TILE - 2, def.h * TILE - 2);
      BLD_ART[key](ctx, fake, 0, 0, def.w * TILE, def.h * TILE, def.height, fakeTeam, false, 0.5);
    } else {
      const def = UNITS[key];
      const s = Math.min(2.6, (h - 8) / (def.radius * 2.8));
      ctx.translate(w / 2, h / 2 + 2);
      ctx.scale(s, s);
      const fake = { key, def, facing: -0.55, turret: -0.55, anim: 0.3, moving: false, cargo: def.capacity ? def.capacity * 0.6 : 0, alt: 0, air: !!def.air };
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(2, 3, def.radius, def.radius * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      UNIT_LIVE[key](ctx, fake, team);
    }
  } finally { G = savedG; }
  return c;
}
