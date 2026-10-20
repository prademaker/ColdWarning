// Cold War 2: 2030 — faction flags drawn as SVG (used in the UI and on buildings).
'use strict';

function starPath(cx, cy, r, rot = -Math.PI / 2) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.382 : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
  }
  return d + 'Z';
}

const FLAG_SVG = {
  usa() {
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="190" height="100" viewBox="0 0 190 100">';
    for (let i = 0; i < 13; i++) s += `<rect y="${(i * 100 / 13).toFixed(3)}" width="190" height="${(100 / 13 + 0.2).toFixed(3)}" fill="${i % 2 ? '#fff' : '#b22234'}"/>`;
    s += '<rect width="76" height="53.85" fill="#3c3b6e"/><g fill="#fff">';
    let d = '';
    for (let row = 0; row < 9; row++) {
      const n = row % 2 ? 5 : 6;
      for (let c = 0; c < n; c++) d += starPath(6.33 + (row % 2 ? 6.33 : 0) + c * 12.67, 5.38 + row * 5.38, 2.2);
    }
    return s + `<path d="${d}"/></g></svg>`;
  },
  russia() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="34" fill="#fff"/>' +
      '<rect y="33.3" width="150" height="34" fill="#0039a6"/><rect y="66.6" width="150" height="33.4" fill="#d52b1e"/></svg>';
  },
  china() {
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="#ee1c25"/><g fill="#ffde00">';
    s += `<path d="${starPath(25, 25, 15)}"/>`;
    for (const [x, y] of [[50, 10], [60, 20], [60, 35], [50, 45]]) {
      const rot = Math.atan2(25 - y, 25 - x);
      s += `<path d="${starPath(x, y, 5, rot)}"/>`;
    }
    return s + '</g></svg>';
  },
  eu() {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      d += starPath(75 + Math.cos(a) * 33, 50 + Math.sin(a) * 33, 5.5);
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="#003399"/><path fill="#ffcc00" d="${d}"/></svg>`;
  },
  uk() {
    // Union Jack: saltires (St Andrew, St Patrick offset) under the St George cross
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 60 30">' +
      '<clipPath id="u"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="t"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath>' +
      '<g clip-path="url(#u)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/>' +
      '<path d="M0 0l60 30m0-30L0 30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/>' +
      '<path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>';
  },
  japan() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="#fff"/>' +
      '<circle cx="75" cy="50" r="30" fill="#bc002d"/></svg>';
  },
  northkorea() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="#024fa2"/>' +
      '<rect y="16.7" width="150" height="66.6" fill="#fff"/><rect y="20" width="150" height="60" fill="#ed1c27"/>' +
      `<circle cx="50" cy="50" r="19" fill="#fff"/><path d="${starPath(50, 50, 18.5)}" fill="#ed1c27"/></svg>`;
  },
  soviet() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="#cc0000"/>' +
      `<path d="${starPath(25, 13, 6)}" fill="none" stroke="#ffd700" stroke-width="1.6"/>` +
      '<g stroke="#ffd700" stroke-width="3.2" fill="none" stroke-linecap="round">' +
      '<path d="M18 27 A10 10 0 1 0 33 37"/><path d="M19 38 L22 35"/>' +
      '<path d="M18 39 L30 26"/><path d="M26.5 23 L33 29.5"/></g></svg>';
  },
};

const FLAGS = {};
const FLAG_IMG = {};
for (const k of Object.keys(FLAG_SVG)) {
  FLAGS[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(FLAG_SVG[k]());
  const img = new Image();
  img.src = FLAGS[k];
  FLAG_IMG[k] = img;
}
