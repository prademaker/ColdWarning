// Low-poly structures: concrete, steel cladding and glass; team colour on trim, not whole roofs.
//
//   node mesh_buildings.js
//
// One unit is 2 game pixels; a 3x3-tile structure covers 48x48 units centred on the origin.
// Lights, flags, the radar dish and other animated details are drawn live by the game at fixed
// spots (BLD_LIVE / BLD_LIVE_AX in js/art.js, game px from the footprint corner, so half that
// here); features here sit under them. The rotating weapons of defences are separate models
// (b_<key>_gun) at their real height over the footprint centre.
//
// Looks: Allied structures are steel cladding and glass; Axis ones (_ax) warm concrete, brick
// and green roofs. Mk II refits (_up) add armour skirts, roof plant and extra kit.
'use strict';
const { model, writeModel } = require('./mesh_lib');

// footprint W x H units; helpers take corner coordinates (as BLD_LIVE does, in units)
function site(W, H, o = {}) {
  const m = model();
  const X = x => x - W / 2, Y = y => y - H / 2;
  m.cb = (x0, x1, y0, y1, z0, z1, mat, op) => m.box(X(x0), X(x1), Y(y0), Y(y1), z0, z1, mat, op);
  m.cc = (x, y, rad, z0, z1, mat, op = {}) => m.cyl([X(x), Y(y), (z0 + z1) / 2], rad, z1 - z0, 'z', mat, { seg: 20, ...op });
  m.sp = (x, y, z, rad, mat, op = {}) => m.sph([X(x), Y(y), z], rad, mat, op);
  m.X = X; m.Y = Y; m.W = W; m.H = H; m.ax = o.ax; m.up = o.up;
  m.wall = o.ax ? 'warm' : 'metal'; m.wallDark = o.ax ? 'warmDark' : 'steel'; m.roof = o.ax ? 'roofGreen' : 'roof';
  if (o.pad !== false) {
    // ground: 1 marks the slab in a 'ground' mask sheet, so the game can weather it to the map
    m.cb(0.3, W - 0.3, 0.3, H - 0.3, 0, 0.5, 'concreteDark', { ground: 1 });
    m.cb(1.2, W - 1.2, 1.2, H - 1.2, 0.5, 0.6, o.ax ? 'warmDark' : 'asphalt', { ground: 1 });
    if (o.up) for (const [x, y] of [[1, 1], [W - 1, 1], [1, H - 1], [W - 1, H - 1]]) m.cb(x - 0.8, x + 0.8, y - 0.8, y + 0.8, 0.5, 1.6, 'hazard'); // refit: corner bollards
  }
  return m;
}
// a clad block: walls, a roof slab, a team fascia band under the eaves
function block(m, x0, x1, y0, y1, h, o = {}) {
  m.cb(x0, x1, y0, y1, 0.6, h, o.wall || m.wall);
  m.cb(x0 - 0.3, x1 + 0.3, y0 - 0.3, y1 + 0.3, h, h + 0.6, o.roof || m.roof);
  if (o.fascia !== false) m.cb(x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, h - 1.2, h - 0.2, 'team');
  if (o.parapet) m.cb(x0 - 0.3, x1 + 0.3, y0 - 0.3, y1 + 0.3, h + 0.6, h + 1.1, m.ax ? 'warm' : 'concrete');
  if (m.up && o.plant !== false && (x1 - x0) > 8 && (y1 - y0) > 6) {   // refit: roof plant
    m.cb(x0 + 2, x0 + 5, y0 + 2, y0 + 4.5, h + 0.6, h + 2.0, 'steel');
    m.cb(x0 + 2.4, x0 + 4.6, y0 + 2.4, y0 + 4.1, h + 2.0, h + 2.2, 'grille');
  }
  if (m.up && o.skirt !== false) m.cb(x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5, 0.6, 2.0, 'concreteDark');   // refit: armoured skirt
  if (m.ax && o.brick !== false) m.cb(x0 - 0.04, x1 + 0.04, y0 - 0.04, y1 + 0.04, 0.6, Math.min(3, h * 0.35), 'brick');
}
// window strip on the +y face (front) or +x face (side)
const winY = (m, x0, x1, y, z0, z1, mat = 'glass') => m.cb(x0, x1, y - 0.1, y + 0.08, z0, z1, mat);
const winX = (m, y0, y1, x, z0, z1, mat = 'glass') => m.cb(x - 0.1, x + 0.08, y0, y1, z0, z1, mat);
// a run of separate windows
function windowsY(m, x0, x1, y, z0, z1, w = 1.6, gap = 1.4) { for (let x = x0; x + w <= x1 + 0.01; x += w + gap) winY(m, x, x + w, y, z0, z1); }
function windowsX(m, y0, y1, x, z0, z1, w = 1.6, gap = 1.4) { for (let y = y0; y + w <= y1 + 0.01; y += w + gap) winX(m, y, y + w, x, z0, z1); }
function door(m, x0, x1, y, h, o = {}) {
  m.cb(x0, x1, y - 0.1, y + 0.25, 0.6, h, 'grille');
  if (o.stripe !== false) for (let x = x0; x < x1 - 0.01; x += 1) m.cb(x, Math.min(x1, x + 1), y + 0.25, y + 0.45, h, h + 0.7, Math.round(x - x0) % 2 ? 'hazard' : 'black');
}
const name = (key, o) => `b_${key}${o.ax ? '_ax' : ''}${o.up ? '_up' : ''}`;
const gunName = (key, o) => name(key, o) + '_gun';

// ---------- Command Center (3x3) ----------
function cc(o) {
  const m = site(48, 48, o);
  if (!o.ax) {
    // low headquarters with a helipad roof (pad drawn live at 14,29,12.6) and an office tower
    block(m, 2.5, 44.5, 15.5, 44.5, 12, { parapet: true, plant: false });
    windowsY(m, 4, 14, 44.5, 6.4, 9.6); windowsY(m, 32, 43, 44.5, 6.4, 9.6); windowsX(m, 21, 43, 44.5, 6.4, 9.6);
    door(m, 19, 28, 44.5, 7.6);
    m.cc(14, 29, 7.4, 12.6, 12.75, 'asphalt', { seg: 28 });
    block(m, 28.5, 43.5, 2.5, 19.5, 24, { plant: false });
    for (let z = 4; z < 23; z += 3.2) { winY(m, 29.5, 42.5, 19.5, z, z + 2); winX(m, 3.5, 18.5, 43.5, z, z + 2); }
    m.sp(39, 8, 24.6, 2.4, 'metalLight', { s: [1, 1, 0.8], seg: 14 });
    m.cc(32.35, 5.35, 0.25, 24.6, 37, 'steelDark', { seg: 6 });                // mast (beacon drawn live)
    m.cc(7, 20, 0.6, 12.6, 13.2, 'steelDark');                                  // flag socket
  } else {
    // stepped concrete ministry with a central tower; helipad on the left wing, flag on the right
    block(m, 2, 46, 2, 46, 6, { plant: false });
    block(m, 2, 20, 26, 46, 10, { skirt: false, plant: false });
    m.cc(8.5, 35.5, 5.6, 10.6, 10.75, 'asphalt', { seg: 24 });
    block(m, 36, 46, 36, 46, 9.6, { skirt: false, plant: false });
    block(m, 20, 37, 16, 33, 30, { skirt: false, plant: false });
    for (let z = 8; z < 29; z += 3) { windowsY(m, 21, 36, 33, z, z + 1.6, 1.2, 1); windowsX(m, 17, 32, 37, z, z + 1.6, 1.2, 1); }
    windowsY(m, 3, 19, 46, 7.4, 8.8); windowsX(m, 3, 35, 46, 2.4, 4.4);
    door(m, 22, 32, 46, 4.8);
    m.cc(28.5, 24.5, 0.3, 30.6, 38.5, 'steelDark', { seg: 6 });
    m.cb(24, 33, 20, 29, 30.6, 32.4, 'warmDark');
  }
  writeModel(name('cc', o), m);
}

// ---------- Power Plant (2x2) ----------
function power(o) {
  const m = site(32, 32, o);
  if (!o.ax) {
    block(m, 2, 30, 18, 30, 6.5);
    winY(m, 4, 28, 30, 3.2, 4.4);
    for (let x = 6; x <= 26; x += 5) m.cb(x, x + 2.5, 22, 26, 7.1, 8.2, 'steelDark');
    m.cc(12, 11, 7.5, 0.6, 5.5, 'concrete', { seg: 28 });
    m.cc(12, 11, 7.6, 3.9, 5.0, 'team', { seg: 28 });
    m.sp(12, 11, 5.5, 7.4, 'concreteLight', { s: [1, 1, 0.62], seg: 28 });
    m.cc(12, 11, 1.9, 9.5, 10.4, 'cyan', { seg: 14 });
    m.cc(25, 7, 2.4, 0.6, 23, 'concrete', { r2: 1.9 });
    for (const z of [17, 20.5]) m.cc(25, 7, 2.15, z, z + 1.5, 'team', { r2: 2.05 });
    m.cc(25, 7, 2.0, 23, 23.4, 'black');
    m.cb(17, 22, 9.6, 11, 2, 3.2, 'steelDark'); m.cb(20.5, 22, 9.6, 11, 0.6, 3.2, 'steelDark');
    m.cb(25, 30, 12, 16, 0.6, 4, 'steel'); for (let y = 12.5; y < 16; y += 1.2) m.cb(30, 30.4, y, y + 0.6, 0.8, 3.6, 'steelDark');
    if (o.up) { m.cc(4.5, 5, 2.2, 0.6, 8, 'concrete'); m.cc(4.5, 5, 2.25, 6, 7, 'team'); m.cc(4.5, 5, 1.0, 8, 9.4, 'cyan'); }
  } else {
    // cooling tower (steam drawn live at 11.5,12.5,20), a brick turbine hall and a tall stack
    m.cc(11.5, 12.5, 9.2, 0.6, 9, 'warm', { r2: 6.6, seg: 28 });
    m.cc(11.5, 12.5, 6.6, 9, 19.4, 'warm', { r2: 7.4, seg: 28 });
    m.cc(11.5, 12.5, 7.5, 16.6, 18.0, 'team', { r2: 7.45, seg: 28 });
    m.cc(11.5, 12.5, 6.9, 19.3, 19.45, 'black', { seg: 28 });
    block(m, 3, 30, 22.5, 30, 7);
    windowsY(m, 5, 28, 30, 3, 5.4, 1.2, 1.2);
    m.cc(26.5, 6.5, 2.0, 0.6, 27.5, 'brick', { r2: 1.6 });
    m.cc(26.5, 6.5, 1.75, 23, 24.4, 'team', { r2: 1.7 });
    m.cb(21, 30, 12, 20, 0.6, 3.4, 'steel');
    if (o.up) { m.cc(26.5, 15.5, 2.0, 3.4, 8.4, 'warm'); m.cc(26.5, 15.5, 2.05, 6.4, 7.2, 'team'); }
  }
  writeModel(name('power', o), m);
}

// ---------- Ore Refinery (3x3): processing hall, ore silos, unloading bay at the front ----------
function refinery(o) {
  const m = site(48, 48, o);
  block(m, 2, 30, 3, 30, o.ax ? 11 : 12);
  windowsY(m, 4, 28, 30, 7, 9); windowsX(m, 5, 28, 30, 7, 9);
  for (const cy of [12, 29]) {
    if (!o.ax) {
      m.cc(39, cy, 5.6, 0.6, 15, 'metal', { seg: 22 });
      m.cc(39, cy, 5.65, 10, 11.4, 'team', { seg: 22 });
      m.cc(39, cy, 5.6, 15, 17, 'metalLight', { r2: 1.6, seg: 22 });
    } else {
      m.cb(33.5, 44.5, cy - 5.5, cy + 5.5, 0.6, 13, 'warm');
      m.cb(33.45, 44.55, cy - 5.55, cy + 5.55, 10, 11.4, 'team');
      m.ext('front', [[-5.5, 13], [5.5, 13], [0, 16]].map(([y, z]) => [y + m.Y(cy), z]), m.X(33.5), m.X(44.5), 'roofGreen');
    }
    m.cc(39, cy, 1.2, o.ax ? 15 : 17, o.ax ? 16.2 : 17.6, 'ore', { seg: 10 });
  }
  m.cb(29, 34, 15.4, 17, 9, 10.2, 'steelDark', { r: [0, -8, 0] });             // conveyor
  // unloading bay (amber lights drawn live at the kerb)
  m.cb(15.5, 32.5, 32, 47, 0.6, 0.7, 'concreteLight');
  m.cb(15.5, 32.5, 30, 38, 7, 7.6, m.roof);
  for (const x of [16, 31.6]) m.cb(x, x + 0.8, 37, 37.8, 0.6, 7, 'steel');
  m.cb(15.5, 32.5, 37.7, 38.05, 6.2, 7.0, 'team');
  door(m, 17, 31, 30, 6.2);
  if (o.up) { m.cb(4, 12, 32, 40, 0.6, 3.4, 'steel'); m.cc(8, 36, 1.8, 3.4, 6.4, 'metalLight'); }
  writeModel(name('refinery', o), m);
}

// ---------- Barracks (2x2): pitched-roof drill hall, sandbags (flag drawn live) ----------
function barracks(o) {
  const m = site(32, 32, o);
  const y0 = o.ax ? 4 : 6, y1 = o.ax ? 26 : 27;
  m.cb(2, 30, y0, y1, 0.6, 7, m.wall);
  if (o.ax) m.cb(1.96, 30.04, y0 - 0.04, y1 + 0.04, 0.6, 2.6, 'brick');
  const mid = (y0 + y1) / 2, hw = (y1 - y0) / 2 + 0.5;
  m.ext('front', [[-hw, 7], [hw, 7], [0, 12.4]].map(([y, z]) => [y + m.Y(mid), z]), m.X(1.6), m.X(30.4), m.roof);
  m.ext('front', [[-hw - 0.05, 7.0], [hw + 0.05, 7.0], [hw + 0.05, 7.6], [-hw - 0.05, 7.6]].map(([y, z]) => [y + m.Y(mid), z]), m.X(1.55), m.X(30.45), 'team');
  door(m, 13, 19, y1, 5);
  windowsY(m, 3.5, 11, y1, 3.2, 5); windowsY(m, 20.5, 28.5, y1, 3.2, 5); windowsX(m, y0 + 2, y1 - 2, 30, 3.2, 5);
  // sandbag walls either side of the door
  for (const [a, b] of [[3, 11], [21, 29]]) for (let x = a; x < b; x += 1.6) m.cb(x, x + 1.5, y1 + 2, y1 + 3.4, 0.6, 1.5, 'sand');
  if (o.up) { m.cb(3, 29, y1 + 1.6, y1 + 3.6, 1.5, 2.4, 'sand'); m.cb(24, 29, y0 - 3.5, y0 - 0.5, 0.6, 3, 'olive'); }
  m.cb(o.ax ? 5.4 : 3.4, o.ax ? 6.6 : 4.6, o.ax ? 7.4 : 6.4, o.ax ? 8.6 : 7.6, 0.6, o.ax ? 9 : 7, 'steelDark');
  writeModel(name('barracks', o), m);
}

// ---------- War Factory (3x3): assembly hall with a barrel roof and a big roller door ----------
function factory(o) {
  const m = site(48, 48, o);
  m.cb(2, 46, 5, 44, 0.6, 14, m.wall);
  if (o.ax) m.cb(1.96, 46.04, 4.96, 44.04, 0.6, 4, 'brick');
  if (o.up) m.cb(1.5, 46.5, 4.5, 44.5, 0.6, 2.4, 'concreteDark');
  if (!o.ax) {
    const arch = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; arch.push([-Math.cos(a) * 20.4, 14 + Math.sin(a) * 4]); }
    m.ext('front', arch.map(([y, z]) => [y + m.Y(24.5), z]), m.X(1.6), m.X(46.4), 'roof');
    for (let x = 8; x <= 40; x += 8) m.ext('front', arch.map(([y, z]) => [y * 0.6 + m.Y(24.5), z + 0.35]), m.X(x), m.X(x + 2.6), 'glassLight');
  } else {
    // sawtooth roof: north-light glazing on each tooth
    for (let x = 2; x < 46; x += 7.3) {
      m.ext('side', [[m.X(x), 14], [m.X(x + 7.3), 14], [m.X(x + 7.3), 19]], m.Y(4.6), m.Y(44.4), 'roofGreen');
      m.ext('side', [[m.X(x + 7.0), 14.4], [m.X(x + 7.35), 14.4], [m.X(x + 7.35), 19.1], [m.X(x + 7.0), 18.8]], m.Y(5.4), m.Y(43.6), 'glass');
    }
  }
  m.cb(1.6, 46.4, 4.1, 44.9, 13.4, 14.2, 'team');
  door(m, 12, 36, 44, 11.4);
  m.cb(11, 12, 44, 44.6, 0.6, 12.4, 'concreteDark'); m.cb(36, 37, 44, 44.6, 0.6, 12.4, 'concreteDark');
  winY(m, 3.5, 10, 44, 8, 10); winY(m, 38, 44.5, 44, 8, 10); winX(m, 8, 41, 46, 8, 10);
  m.cb(12, 36, 44.5, 47.5, 0.5, 0.65, 'concreteLight');
  if (!o.ax) { m.cb(4, 5.2, 6, 7.2, 14, 22, 'hazard'); m.cb(4, 30, 6, 7.2, 21.6, 22.8, 'hazard'); m.cb(28, 29, 6.2, 7, 18, 21.6, 'black'); }
  else { m.cc(6, 8, 1.6, 14, 26, 'brick', { r2: 1.3 }); m.cc(6, 8, 1.65, 22, 23, 'team'); }
  m.cb(37, 46, 1, 5, 0.6, 8, o.ax ? 'warm' : 'concrete'); m.cb(37, 46, 1, 5, 8, 8.5, 'roofDark'); winY(m, 38, 45, 5, 5, 6.5);
  m.cc(42, 3, 1.3, 14, 20, 'steel'); m.cc(42, 3, 1.4, 19.2, 20, 'black');
  if (o.up) { m.cb(38, 46, 38, 47.5, 0.6, 5, 'steel'); m.cb(37.8, 46.2, 37.8, 47.7, 5, 5.5, 'roofDark'); m.cb(38.5, 45.5, 47.4, 47.6, 1, 4, 'grille'); }
  writeModel(name('factory', o), m);
}

// ---------- Radar Station (2x2): operations block and a lattice tower (dish drawn live at 16,16,19) ----------
function radar(o) {
  const m = site(32, 32, o);
  block(m, 4, 27, 12, 28, 8);
  windowsY(m, 6, 25, 28, 3, 5.4);
  m.cb(13.4, 18.6, 13.4, 18.6, 8.6, 9.2, 'steelDark');
  for (const [x, y] of [[14, 14], [18, 14], [14, 18], [18, 18]]) m.cc(x, y, 0.3, 9.2, 17.8, 'steelDark', { seg: 6 });
  for (const z of [11.5, 14.5]) m.cb(13.6, 18.4, 13.6, 18.4, z, z + 0.3, 'steelDark');
  m.cc(16, 16, 1.6, 17.6, 18.6, 'steel');
  m.cc(5, 13, 0.4, 8.6, 9.4, 'steelDark');
  m.cb(22, 27, 3, 9, 0.6, 3.6, o.ax ? 'warm' : 'steel');
  writeModel(name('radar', o), m);
}

// ---------- Airfield (3x2): runway with the edge lights drawn live along y = 25, control tower ----------
function airfield(o) {
  const m = site(48, 32, { ...o, pad: false });
  m.cb(0.5, 47.5, 0.5, 31.5, 0, 0.4, 'asphalt', { ground: 1 });
  m.cb(1.5, 46.5, 9.4, 26, 0.4, 0.45, 'roofDark');
  for (let x = 6; x <= 40; x += 6) m.cb(x, x + 3, 17.2, 18.0, 0.45, 0.5, 'white');
  for (let y = 11; y <= 23; y += 3) m.cb(2, 4.4, y, y + 1.4, 0.45, 0.5, 'white');
  m.cb(1.5, 46.5, 9.4, 10, 0.45, 0.5, 'team'); m.cb(1.5, 46.5, 25.6, 26.2, 0.45, 0.5, 'team');
  // tower and a small hangar along the back edge
  block(m, 37, 45, 2, 8.6, 10, { fascia: false });
  m.cb(36.4, 45.6, 1.4, 9.2, 10.6, 13.6, 'glass');
  m.cb(36.2, 45.8, 1.2, 9.4, 13.6, 14.4, o.ax ? 'roofGreen' : 'roof');
  m.cb(36.15, 45.85, 1.15, 9.45, 13.0, 13.6, 'team');
  m.cc(41, 5, 0.12, 14.4, 18, 'black', { seg: 4 });
  const arch = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; arch.push([-Math.cos(a) * 4.4, 0.6 + Math.sin(a) * 5.4]); }
  m.ext('side', arch.map(([x, z]) => [x + m.X(14), z]), m.Y(1.5), m.Y(8.4), o.ax ? 'warm' : 'metal');
  m.ext('side', arch.map(([x, z]) => [x * 0.8 + m.X(14), z * 0.8]), m.Y(8.4), m.Y(8.6), 'grille');
  if (o.up) { m.cb(22, 32, 2, 7, 0.4, 2.4, 'olive'); m.cb(22, 32, 2, 7, 2.4, 2.6, 'roofDark'); }
  writeModel(name('airfield', o), m);
}

// ---------- Tech Lab (2x2): research block with a domed observatory ----------
function tech(o) {
  const m = site(32, 32, o);
  if (!o.ax) {
    block(m, 3, 29, 7, 29, 11, { wall: 'concreteLight' });
    for (const z of [3.6, 7.2]) { windowsY(m, 5, 27, 29, z, z + 2); windowsX(m, 9, 27, 29, z, z + 2); }
    m.cb(5, 13.5, 28.9, 29.4, 8.8, 10.2, 'black');                              // light strip (lights drawn live)
    m.cc(16, 17, 6, 11.6, 13, 'steel', { seg: 24 });
    m.sp(16, 17, 13, 5.6, 'metalLight', { s: [1, 1, 0.9], seg: 24 });
    m.cb(14.6, 17.4, 11.2, 22.6, 17.6, 18.4, 'team', { r: [0, 0, 0] });
    m.cc(6.35, 9.35, 0.3, 11.6, 18, 'steelDark', { seg: 6 });
  } else {
    block(m, 3, 29, 4, 29.25, 7.5);
    m.cb(4, 13.5, 29.1, 29.5, 6.6, 8.4, 'black');
    windowsX(m, 6, 27, 29, 3, 5.4);
    m.cc(18, 15, 6.4, 8.1, 9.2, 'warmDark', { seg: 24 });
    m.sp(18, 15, 9.2, 6.0, 'warm', { s: [1, 1, 0.75], seg: 24 });
    m.cc(18, 15, 6.45, 8.6, 9.2, 'team', { seg: 24 });
    m.cc(6.5, 9.5, 0.9, 8.1, 16, 'warm', { r2: 0.5 });
    m.cc(6.5, 9.5, 0.25, 16, 23, 'steelDark', { seg: 6 });
  }
  writeModel(name('tech', o), m);
}

// ---------- Orbital Lance (3x3): uplink dish on a concrete ring (charge ring drawn live) ----------
function superLance(o) {
  const m = site(48, 48, o);
  block(m, 3, 44, 34, 44, 7, { plant: false });
  windowsY(m, 5, 42, 44, 3, 5);
  m.cc(24, 25, 12, 0.6, 3.4, o.ax ? 'warm' : 'concrete', { seg: 32 });
  m.cc(24, 25, 12.05, 2.4, 3.0, 'team', { seg: 32 });
  m.cc(24, 25, 6.6, 3.4, 9.4, 'steel', { r2: 11.4, seg: 32 });
  m.cc(24, 25, 10.6, 9.3, 9.5, 'metalLight', { seg: 32 });
  m.cc(24, 25, 1.4, 9.4, 22, 'steelDark', { r2: 0.9, seg: 10 });
  m.cc(24, 25, 1.8, 22, 24, 'cyan', { seg: 12 });
  for (const a of [0, 2.1, 4.2]) m.cb(24 + Math.cos(a) * 9 - 0.3, 24 + Math.cos(a) * 9 + 0.3, 25 + Math.sin(a) * 9 - 0.3, 25 + Math.sin(a) * 9 + 0.3, 9.4, 13, 'steelDark');
  writeModel(name('super_lance', o), m);
}

// ---------- Hypersonic Silo (3x3): armoured silo doors that slide open; charge bar at the front edge ----------
function superSilo(open) {
  const m = site(48, 48, {});
  m.cb(4, 44, 4, 42, 0.6, 3.6, 'concrete');
  m.cb(3.95, 44.05, 3.95, 42.05, 2.2, 2.9, 'team');
  m.cb(14, 34, 12, 34, 3.6, 3.65, 'grille');
  if (!open) for (const [a, b] of [[14, 24], [24, 34]]) { m.cb(a, b, 12, 34, 3.6, 4.6, 'concreteDark'); m.cb(a + 1, b - 1, 12.5, 33.5, 4.6, 4.7, 'hazard'); }
  else {
    m.cb(4.5, 14, 12, 34, 3.6, 4.6, 'concreteDark'); m.cb(34, 43.5, 12, 34, 3.6, 4.6, 'concreteDark');
    m.cc(24, 23, 2.4, 3.6, 16, 'white', { seg: 16 });
    m.cc(24, 23, 2.4, 16, 20, 'white', { r2: 0.2, seg: 16 });
    m.cc(24, 23, 2.45, 10, 11, 'red', { seg: 16 });
  }
  m.cb(36, 43, 4.5, 10, 3.6, 7.2, 'metal'); m.cb(36, 43, 4.5, 10, 7.2, 7.6, 'roof'); winY(m, 37, 42, 10, 5, 6.4);
  m.cb(5, 43, 44.8, 46.2, 0.6, 1.2, 'black');
  writeModel('b_super_silo' + (open ? '_open' : ''), m);
}

// ---------- defences: 1x1 bases and their guns ----------
// Gatling turret: low armoured base, rotary cannon in a rounded mount
function turret(o) {
  const m = site(16, 16, o);
  m.cc(8, 8, 6.6, 0.6, 2.6, o.ax ? 'warm' : 'concrete', { r2: 5.8, seg: 20 });
  m.cc(8, 8, 5.9, 2.6, o.ax ? 4 : 3.5, o.ax ? 'warmDark' : 'concreteDark', { seg: 20 });
  m.cc(8, 8, 6.65, 1.4, 2.0, 'team', { r2: 6.4, seg: 20 });
  if (o.up) for (let a = 0; a < 6.2; a += 1.05) m.box(Math.cos(a) * 6.6 - 0.8, Math.cos(a) * 6.6 + 0.8, Math.sin(a) * 6.6 - 0.8, Math.sin(a) * 6.6 + 0.8, 0.5, 1.8, 'sand');
  writeModel(name('turret', o), m);
  const g = model(), z = o.ax ? 4 : 3.5;
  g.cyl([0, 0, z + 0.6], 3.2, 1.2, 'z', 'steelDark', { seg: 16 });
  if (!o.ax) g.sph([0, 0, z + 1.2], 3.0, 'camo', { s: [1, 1, 0.8], seg: 16 });
  else g.box(-3, 2.4, -2.6, 2.6, z + 1.2, z + 4.0, 'camo');
  g.cyl([0, 0, z + 1.6], 3.05, 0.6, 'z', 'team', { seg: 16 });
  g.cyl([5, 0, z + 2.0], 0.9, 5, 'x', 'gunDark', { seg: 10 });
  for (const a of [0, 1.57, 3.14, 4.71]) g.cyl([7.6, Math.cos(a) * 0.45, z + 2.0 + Math.sin(a) * 0.45], 0.2, 1.4, 'x', 'gun', { seg: 6 });
  g.box(-2.6, -0.8, 1.8, 3.4, z + 1.2, z + 3.4, 'olive');                       // ammo box
  if (o.up) g.box(1.2, 2.8, -2.8, 2.8, z + 0.8, z + 3.6, 'camoDark');
  writeModel(gunName('turret', o), g);
}
// Rail turret: tall base, long twin-rail gun
function railturret(o) {
  const m = site(16, 16, o);
  m.cb(2, 14, 2, 14, 0.6, 3.6, o.ax ? 'warm' : 'concrete');
  m.cb(3, 13, 3, 13, 3.6, 5, o.ax ? 'warmDark' : 'concreteDark');
  m.cb(1.95, 14.05, 1.95, 14.05, 2.2, 2.8, 'team');
  for (const [x, y] of [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]]) m.cc(x, y, 0.6, 3.6, 4.4, 'cyan');
  if (o.up) m.cb(1.4, 14.6, 1.4, 14.6, 0.6, 1.8, 'concreteDark');
  writeModel(name('railturret', o), m);
  const g = model(), z = 5;
  g.cyl([0, 0, z + 0.6], 3.4, 1.2, 'z', 'steelDark', { seg: 16 });
  g.box(-3.4, 2.6, -2.8, 2.8, z + 1.2, z + 4, 'camo');
  g.box(-3.45, 2.65, -2.85, 2.85, z + 2.4, z + 3.0, 'team');
  g.sides(s => g.box(2, 12.5, s * 0.8 - 0.4, s * 0.8 + 0.4, z + 2, z + 3, 'gunDark'));
  g.box(2.4, 12.2, -0.3, 0.3, z + 2.3, z + 2.7, 'cyan');
  for (const x of [4, 7, 10]) g.box(x, x + 0.8, -1.5, 1.5, z + 1.8, z + 3.2, 'steelDark');
  if (o.up) g.sides(s => g.box(-3, 1.5, s * 3.2 - 0.4, s * 3.2 + 0.4, z + 1.2, z + 3.8, 'camoDark'));
  writeModel(gunName('railturret', o), g);
}
// SAM site: sandbagged pad, four-cell launcher on a turntable
function sam(o) {
  const m = site(16, 16, o);
  m.cb(2, 14, 2, 14, 0.6, 3, o.ax ? 'warm' : 'concrete');
  m.cb(1.95, 14.05, 1.95, 14.05, 1.6, 2.2, 'team');
  m.cb(10.5, 14, 10.5, 14, 3, 6, 'steelDark'); m.cb(10.6, 13.9, 10.6, 13.9, 6, 6.2, 'white');      // radar box
  if (o.up) m.cb(1.4, 14.6, 1.4, 14.6, 0.6, 1.6, 'sand');
  writeModel(name('sam', o), m);
  const g = model(), z = 3;
  g.cyl([0, 0, z + 0.5], 2.6, 1.0, 'z', 'steelDark', { seg: 14 });
  g.group([0, 0, z + 1.8], [0, 30, 0], () => {
    g.box(-4, 4, -3.4, 3.4, 0, 3.6, 'camo');
    g.box(-4.05, 4.05, -3.45, 3.45, 2.4, 3.0, 'team');
    for (const y of [-1.7, 1.7]) for (const zz of [0.9, 2.7]) g.cyl([4.02, y, zz], 0.75, 0.1, 'x', 'white', { seg: 10 });
  });
  if (o.up) g.sides(s => g.box(-1, 1, s * 3.8 - 0.4, s * 3.8 + 0.4, z + 1, z + 4, 'camoDark'));
  writeModel(gunName('sam', o), g);
}
// Laser tower (EU): tall pylon, lens head on top
function laser(o) {
  const m = site(16, 16, o);
  m.cb(3, 13, 3, 13, 0.6, 2.4, 'concrete');
  m.cc(8, 8, 3.4, 2.4, 9, 'metal', { r2: 2.4, seg: 6 });
  m.cc(8, 8, 3.0, 5, 6, 'team', { seg: 6 });
  if (o.up) for (const [x, y] of [[3.6, 3.6], [12.4, 3.6], [3.6, 12.4], [12.4, 12.4]]) m.cc(x, y, 0.8, 2.4, 6, 'cyan', { seg: 8 });
  writeModel(name('laser', o), m);
  const g = model(), z = 10;
  g.cyl([0, 0, z - 0.5], 2.4, 1, 'z', 'steelDark', { seg: 12 });
  g.box(-2.6, 2.4, -2, 2, z, z + 3.4, 'metalLight');
  g.box(-2.65, 2.45, -2.05, 2.05, z + 1.4, z + 2.0, 'team');
  g.cyl([3.4, 0, z + 1.7], 1.4, 2.2, 'x', 'steelDark', { seg: 14 });
  g.cyl([4.55, 0, z + 1.7], 1.0, 0.1, 'x', 'cyan', { seg: 14 });
  if (o.up) g.sides(s => g.cyl([0, s * 2.6, z + 1.7], 0.8, 3, 'x', 'steel', { seg: 8 }));
  writeModel(gunName('laser', o), g);
}
// Mortar pit: sandbag ring, mortar tube on a bipod
function mortar(o) {
  const m = site(16, 16, o);
  for (let a = 0; a < 6.28; a += 0.45) m.box(Math.cos(a) * 6 - 1, Math.cos(a) * 6 + 1, Math.sin(a) * 6 - 1, Math.sin(a) * 6 + 1, 0.5, 2.0, 'sand', { r: [0, 0, a * 57.3] });
  m.cc(8, 8, 4.8, 0.5, 0.7, 'warmDark');
  m.cb(12, 13.6, 2.4, 6, 0.6, 1.6, 'olive');
  m.cc(3, 12.5, 0.5, 2.0, 2.6, 'team');
  m.cb(2.5, 5, 11.5, 13.5, 2.0, 2.6, 'team');
  if (o.up) for (let a = 0.2; a < 6.28; a += 0.45) m.box(Math.cos(a) * 6 - 0.9, Math.cos(a) * 6 + 0.9, Math.sin(a) * 6 - 0.9, Math.sin(a) * 6 + 0.9, 2.0, 3.0, 'sand', { r: [0, 0, a * 57.3] });
  writeModel(name('mortar', o), m);
  const z = 1;
  // the tube points up at 50 degrees: rebuild it with the pitch
  const g2 = model();
  g2.cyl([0, 0, z + 0.2], 1.6, 0.4, 'z', 'steelDark', { seg: 12 });
  g2.group([0, 0, z + 0.6], [0, 50, 0], () => { g2.cyl([2.6, 0, 0], 0.55, 5.4, 'x', 'gun', { seg: 10 }); g2.cyl([5.1, 0, 0], 0.65, 0.5, 'x', 'gunDark', { seg: 10 }); });
  g2.sides(s => g2.box(2.0, 2.3, s * 0.9 - 0.12, s * 0.9 + 0.12, z, z + 2.6, 'steelDark', { r: [s * 15, 0, 0] }));
  g2.box(-1.6, -0.4, -1.2, 1.2, z, z + 0.5, 'steel');
  if (o.up) g2.box(-0.6, 0.6, 1.8, 3.4, z, z + 1.2, 'olive');
  writeModel(gunName('mortar', o), g2);
}
// Missile nest (Allies): bunker with a box launcher on top
function missilenest(o) {
  const m = site(16, 16, o);
  m.ext('front', [[-6.4, 0.6], [6.4, 0.6], [5, 6], [-5, 6]].map(([y, z]) => [y, z]), -6.4, 6.4, 'concrete');
  m.cb(1.55, 14.45, 1.55, 14.45, 2.6, 3.2, 'team');
  m.cb(3, 13, 14.2, 14.4, 2.0, 3.0, 'grille');
  if (o.up) m.cb(1, 15, 1, 15, 0.6, 1.6, 'sand');
  writeModel(name('missilenest', o), m);
  const g = model(), z = 6;
  g.cyl([0, 0, z + 0.4], 2.2, 0.8, 'z', 'steelDark', { seg: 12 });
  g.group([0, 0, z + 1.4], [0, 15, 0], () => {
    g.box(-3, 3, -3, 3, 0, 3.2, 'camo');
    g.box(-3.05, 3.05, -3.05, 3.05, 2.2, 2.8, 'team');
    for (const y of [-1.8, 0, 1.8]) for (const zz of [0.8, 2.2]) g.cyl([3.02, y, zz], 0.5, 0.1, 'x', 'black', { seg: 8 });
  });
  if (o.up) g.sides(s => g.box(-2.4, 2.4, s * 3.4 - 0.4, s * 3.4 + 0.4, z + 1.4, z + 4, 'camoDark'));
  writeModel(gunName('missilenest', o), g);
}
// Flame tower (Axis): fuel tank tower with a nozzle head on top
function flametower(o) {
  const m = site(16, 16, o);
  m.cb(3, 13, 3, 13, 0.6, 2.4, 'warm');
  m.cc(8, 8, 3.2, 2.4, 10.4, 'warmDark', { seg: 12 });
  m.cc(8, 8, 3.25, 7, 8, 'team', { seg: 12 });
  m.sides(s => m.cc(8 + s * 4.3, 11.5, 1.2, 2.4, 7.4, 'hazard', { seg: 12 }));
  if (o.up) m.cb(2.4, 13.6, 2.4, 13.6, 0.6, 1.6, 'concreteDark');
  writeModel(name('flametower', o), m);
  const g = model(), z = 11;
  g.cyl([0, 0, z - 0.3], 2.6, 0.8, 'z', 'steelDark', { seg: 12 });
  g.box(-2.4, 2, -2, 2, z, z + 2.6, 'camo');
  g.box(-2.45, 2.05, -2.05, 2.05, z + 1.2, z + 1.8, 'team');
  g.cyl([4, 0, z + 1.3], 0.5, 4.4, 'x', 'steelDark', { seg: 8 });
  g.cyl([6.4, 0, z + 1.3], 0.7, 0.5, 'x', 'flame', { seg: 8 });
  if (o.up) g.sides(s => g.box(-1.6, 1.6, s * 2.4 - 0.4, s * 2.4 + 0.4, z, z + 2.4, 'camoDark'));
  writeModel(gunName('flametower', o), g);
}
// THAAD battery (USA, 2x2): radar trailer and a launcher truck on the turntable
function thaad(o) {
  const m = site(32, 32, o);
  m.cb(3, 29, 3, 29, 0.6, 1.6, 'concrete');
  m.cb(2.95, 29.05, 2.95, 29.05, 1.0, 1.4, 'team');
  m.cb(3, 11, 21, 29, 1.6, 6, 'steelDark');                                    // AN/TPY-2 radar
  m.cb(10.8, 11.1, 21.6, 28.4, 2.4, 7.4, 'black', { r: [0, -12, 0] });
  if (o.up) m.cb(20, 28, 4, 9, 1.6, 4, 'olive');
  writeModel(name('thaad', o), m);
  const g = model(), z = 2;
  g.cyl([0, 0, z + 0.4], 4.6, 0.8, 'z', 'steelDark', { seg: 16 });
  g.box(-6, 6, -3, 3, z + 0.8, z + 2.4, 'camoDark');
  g.group([-5, 0, z + 2.4], [0, 32, 0], () => {
    g.box(0, 11, -2.8, 2.8, 0, 3.4, 'camo');
    g.box(0, 11.05, -2.85, 2.85, 2.2, 2.8, 'team');
    for (const y of [-1.8, 0, 1.8]) for (const zz of [0.9, 2.3]) g.cyl([11.05, y, zz], 0.55, 0.1, 'x', 'white', { seg: 8 });
  });
  if (o.up) g.sides(s => g.box(-4, 2, s * 3.4 - 0.4, s * 3.4 + 0.4, z + 0.8, z + 3, 'camoDark'));
  writeModel(gunName('thaad', o), g);
}
// Koksan gun (North Korea, 2x2): dug-in emplacement, long 170 mm barrel
function koksan(o) {
  const m = site(32, 32, o);
  m.cc(16, 16, 13, 0.6, 3.6, 'sand', { r2: 11.6, seg: 28 });
  m.cc(16, 16, 9.6, 3.0, 3.7, 'warmDark', { seg: 28 });
  m.cc(16, 16, 13.05, 1.6, 2.2, 'team', { r2: 12.8, seg: 28 });
  if (o.up) m.cb(22, 29, 3, 8, 0.6, 3.6, 'olive');
  writeModel(name('koksan', o), m);
  const g = model(), z = 4;
  g.cyl([0, 0, z + 0.4], 4.4, 0.8, 'z', 'steelDark', { seg: 16 });
  g.box(-5, 3, -3.4, 3.4, z + 0.8, z + 4.6, 'camo');
  g.box(-5.05, 3.05, -3.45, 3.45, z + 2.8, z + 3.4, 'team');
  g.group([2, 0, z + 3.0], [0, 14, 0], () => { g.cyl([10, 0, 0], 0.7, 18, 'x', 'gun', { r2: 0.6, seg: 10 }); g.cyl([19.2, 0, 0], 0.95, 1.6, 'x', 'gunDark', { seg: 10 }); });
  if (o.up) g.sides(s => g.box(-4, 2, s * 3.8 - 0.4, s * 3.8 + 0.4, z + 0.8, z + 4, 'camoDark'));
  writeModel(gunName('koksan', o), g);
}

// ---------- Sensor Tower (1x1): slim mast with a sensor head (beacon drawn live at 7.5,7.5,23) ----------
function sensor(o) {
  const m = site(16, 16, o);
  m.cb(4, 12, 4, 12, 0.6, 2.0, o.ax ? 'warm' : 'concrete');
  m.cc(7.5, 7.5, 1.2, 2.0, 18, 'metal', { r2: 0.7, seg: 8 });
  m.cc(7.5, 7.5, 1.1, 9, 10, 'team', { seg: 8 });
  m.cc(7.5, 7.5, 2.4, 18, 21.6, 'metalLight', { seg: 12 });
  m.cc(7.5, 7.5, 2.45, 19.4, 20.2, 'black', { seg: 12 });
  m.cc(7.5, 7.5, 0.3, 21.6, 22.6, 'steelDark', { seg: 6 });
  if (o.up) { m.cb(9.6, 12.2, 4.6, 6.6, 2.0, 4.2, 'steel'); m.cc(7.5, 7.5, 3.2, 14, 14.4, 'steelDark', { seg: 12 }); }
  writeModel(name('sensor', o), m);
}

// ---------- Ore Drill (2x2): pumpjack (beam drawn live from 10,10,27) and a holding tank ----------
function drill(o) {
  const m = site(32, 32, o);
  m.cb(5, 15, 5, 15, 0.6, 1.6, 'concreteDark');
  m.sides(s => m.box(m.X(10) - 0.3, m.X(10) + 0.3, m.Y(10) + s * 2.6 - 0.3, m.Y(10) + s * 2.6 + 0.3, 1.6, 27, 'steelDark', { r: [s * -6, 0, 0] }));
  m.cc(10, 10, 0.6, 26.4, 27.2, 'steelDark', { seg: 8 });
  m.cb(8.5, 11.5, 8.5, 11.5, 1.6, 3.6, 'hazard');
  m.cc(23, 22, 5, 0.6, 9, o.ax ? 'warm' : 'metal', { seg: 22 });
  m.cc(23, 22, 5.05, 6, 7, 'team', { seg: 22 });
  m.sp(23, 22, 9, 5, o.ax ? 'warm' : 'metal', { s: [1, 1, 0.25], seg: 22 });
  m.cb(12, 19, 21.4, 22.6, 1.2, 2.2, 'steelDark');
  m.cb(22, 30, 3, 10, 0.6, 4.6, o.ax ? 'warm' : 'metal'); m.cb(22, 30, 3, 10, 4.6, 5, m.roof);
  if (o.up) { m.cc(23, 22, 5.6, 0.6, 2.4, 'concreteDark', { seg: 22 }); m.cb(4, 7, 22, 29, 0.6, 3, 'olive'); }
  writeModel(name('drill', o), m);
}

// ---------- Naval Shipyard (3x3, on the water): floating dock with a gantry crane ----------
function shipyard(o) {
  const m = site(48, 48, { ...o, pad: false });
  m.sides(s => m.box(-23, 23, s * 16 - 4, s * 16 + 4, 0, 3, o.ax ? 'warm' : 'concrete'));
  m.box(-23, -15, -12, 12, 0, 3, o.ax ? 'warm' : 'concrete');
  m.sides(s => m.box(-23.05, 23.05, s * 12.05 - 0.1, s * 12.05 + 0.1, 1.8, 2.4, 'team'));
  m.box(-15, 23, -12, 12, 0, 0.6, 'steelDark');                                  // flooded dock floor
  // gantry crane spanning the dock
  m.sides(s => m.box(2, 4, s * 17 - 1, s * 17 + 1, 3, 15, 'hazard'));
  m.box(1.6, 4.4, -18.4, 18.4, 15, 17, 'hazard');
  m.box(2.4, 3.6, -1, 1, 12.6, 15, 'steelDark');
  m.box(-22, -16, -19, -13, 3, 9, m.wall); m.box(-22.3, -15.7, -19.3, -12.7, 9, 9.5, m.roof);
  winY(m, 2, 7, 5, 5.4, 7.4);
  for (const [x, y] of [[-20, 17], [16, 17], [16, -17]]) m.box(x, x + 2, y - 1, y + 1, 3, 4.6, 'olive');
  if (o.up) { m.box(10, 20, 13, 19, 3, 7, m.wall); m.box(10, 20, 13, 19, 7, 7.4, m.roof); m.cyl([-18, 16, 8], 0.12, 10, 'z', 'black', { seg: 4 }); }
  writeModel(name('shipyard', o), m);
}

// ---------- Concrete wall (1x1) ----------
function wall(o) {
  const m = site(16, 16, { ...o, pad: false });
  m.box(-8, 8, -8, 8, 0, 6, o.ax ? 'warm' : 'concrete');
  m.box(-8.05, 8.05, -8.05, 8.05, 4.4, 5.0, 'team');
  m.box(-7.6, 7.6, -7.6, 7.6, 6, 6.6, o.ax ? 'warmDark' : 'concreteDark');
  writeModel(name('wall', o), m);
}

// ---------- national specials (one look each) ----------
// Support Hub (China): field hospital tent and a repair gantry
function hub() {
  const m = site(32, 32, {});
  const tent = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; tent.push([-Math.cos(a) * 7, 0.6 + Math.sin(a) * 6]); }
  m.ext('front', tent.map(([y, z]) => [y + m.Y(10), z]), m.X(3), m.X(17), 'canvas');
  m.ext('front', [[-2, 3.6], [2, 3.6], [2, 7.6], [-2, 7.6]].map(([y, z]) => [y + m.Y(10), z]), m.X(16.95), m.X(17.05), 'white');
  m.cb(15, 15.2, 9.2, 10.8, 4.6, 6.6, 'red'); m.cb(15, 15.2, 8.2, 11.8, 5.2, 6.0, 'red');
  m.cb(2.9, 17.1, 2.9, 17.1, 0.6, 1.4, 'team');
  for (const x of [20, 29]) m.cb(x, x + 1, 18, 30, 0.6, 9, 'hazard');
  m.cb(20, 30, 18, 30, 9, 10, 'hazard'); m.cb(20.2, 29.8, 23.6, 24.4, 6, 9, 'black');
  m.cb(21, 29, 4, 12, 0.6, 5, 'metal'); m.cb(21, 29, 4, 12, 5, 5.5, 'roof'); m.cb(20.95, 29.05, 3.95, 12.05, 4, 4.6, 'team');
  writeModel('b_hub', m);
}
// GCHQ (UK): the "doughnut" ring building and a mast (light at 24,6,20.5)
function gchq() {
  const m = site(32, 32, {});
  m.cc(14, 18, 11, 0.6, 7, 'metal', { seg: 32 });
  m.cc(14, 18, 11.05, 5, 5.8, 'team', { seg: 32 });
  m.cc(14, 18, 6, 7, 7.1, 'roofGreen', { seg: 28 });
  m.cc(14, 18, 11.2, 7, 7.4, 'roof', { seg: 32 });
  m.cc(14, 18, 5, 0.6, 7.2, 'roofGreen', { seg: 28 });
  m.cc(24, 6, 0.4, 0.6, 20.5, 'steelDark', { seg: 6 });
  for (const z of [10, 14]) m.cc(24, 6, 1.6, z, z + 0.8, 'white', { seg: 8 });
  m.sp(28, 12, 2.6, 2.4, 'white', { seg: 14 });
  writeModel('b_gchq', m);
}
// Robotics plant (Japan): white automated factory with an exposed robot arm on the roof
function robotics() {
  const m = site(32, 32, {});
  block(m, 3, 29, 5, 29, 9, { wall: 'white' });
  winY(m, 5, 27, 29, 4, 6.6); winX(m, 7, 27, 29, 4, 6.6);
  door(m, 12, 20, 29, 3.8);
  m.cc(10, 12, 1.4, 9.6, 11, 'hazard');
  m.group([m.X(10), m.Y(12), 11], [0, 40, -30], () => m.box(0, 7, -0.6, 0.6, -0.6, 0.6, 'hazard'));
  m.cb(20, 27, 8, 15, 9.6, 10.4, 'glassLight');
  writeModel('b_robotics', m);
}
// Krasukha EW station (Russia): jamming truck with a big folded dish (light at 23,15,10)
function krasukha() {
  const m = site(32, 32, {});
  m.cb(4, 28, 9, 21, 0.6, 2.2, 'steelDark');
  for (const x of [7, 11, 19, 23]) m.sides(s => m.box(m.X(x) - 1.6, m.X(x) + 1.6, m.Y(15) + s * 5.6 - 0.7, m.Y(15) + s * 5.6 + 0.7, 0, 3.2, 'rubber'));
  m.cb(21, 28, 9.4, 20.6, 2.2, 8, 'camo'); m.cb(27.9, 28.05, 10.4, 19.6, 5, 7, 'glass');
  m.cb(4, 21, 9.4, 20.6, 2.2, 6, 'camo'); m.cb(3.95, 21.05, 9.35, 20.65, 4.6, 5.2, 'team');
  m.cc(23, 15, 0.4, 8, 9.6, 'steelDark');
  m.group([m.X(12), m.Y(15), 6], [0, 55, 0], () => { m.cyl([0, 0, 0], 6.6, 0.8, 'x', 'metalLight', { seg: 22 }); m.cyl([0.6, 0, 0], 0.6, 1.8, 'x', 'steelDark', { seg: 8 }); });
  writeModel('b_krasukha', m);
}
// Propaganda tower (Soviet, 1x1): loudspeaker mast (flag drawn live at 4,4,1.5)
function propaganda() {
  const m = site(16, 16, {});
  m.cb(5, 13, 5, 13, 0.6, 2, 'warm');
  m.cc(9, 9, 0.8, 2, 18, 'steelDark', { seg: 8 });
  for (const a of [0, 1.57, 3.14, 4.71]) m.group([m.X(9) + Math.cos(a) * 1.4, m.Y(9) + Math.sin(a) * 1.4, 16], [0, -15, a * 57.3], () => m.cyl([0.8, 0, 0], 0.5, 1.8, 'x', 'warmDark', { r2: 1.2, seg: 10 }));
  m.cb(7, 11, 8.8, 9.2, 8, 13, 'team');
  m.cb(7, 11, 8.75, 8.85, 9, 12, 'red');
  writeModel('b_propaganda', m);
}

// ---------- write everything ----------
const LOOKS = [{}, { up: true }, { ax: true }, { ax: true, up: true }];
for (const o of LOOKS) {
  if (!o.up) { cc(o); radar(o); tech(o); superLance(o); wall(o); }
  power(o); refinery(o); barracks(o); factory(o); airfield(o); shipyard(o); drill(o);
  turret(o); railturret(o); sam(o); mortar(o); sensor(o);
  if (!o.ax) { laser(o); missilenest(o); thaad(o); koksan(o); flametower(o); }
}
superSilo(false); superSilo(true);
hub(); gchq(); robotics(); krasukha(); propaganda();
