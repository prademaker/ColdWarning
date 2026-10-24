// ColdWarning — touch controls for phones and tablets: tap to select and to give orders, drag
// to scroll, pinch to zoom, hold then drag for a selection box, and an on-screen command bar
// for the things a keyboard would do.
'use strict';

const TOUCH_HOLD = 350;   // ms a finger rests before dragging draws a selection box instead of scrolling
const TOUCH_SLOP = 10;    // page pixels a finger may wander and still count as a tap
const BUILD_HOLD = 450;   // ms on a build button: hold / cancel what's queued, or show its details

// Touch.on turns the touch layout on (body.touch): from the start on phones and tablets, or
// as soon as a finger lands on a touchscreen laptop.
const Touch = {
  on: false,
  // no mouse at all (phones, most tablets): no edge scrolling from stray emulated mouse events
  only: !matchMedia('(any-pointer: fine)').matches && navigator.maxTouchPoints > 0,
  enable() {
    if (this.on) return;
    this.on = true;
    document.body.classList.add('touch');
    if (window.G && UI.canvas) { UI.selKey = null; UI.buildGridKey = null; }
  },
  // phones held upright: the game asks to be turned sideways
  portrait() { return this.on && window.innerHeight > window.innerWidth && window.innerWidth < 600; },
  // a full screen in landscape where the browser allows it (Android; iOS needs Add to Home Screen)
  fullscreen() {
    if (!this.on || document.fullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try {
      Promise.resolve(req.call(el, { navigationUI: 'hide' }))
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
        .catch(() => {});
    } catch (err) { /* not allowed here */ }
  },
};
if (matchMedia('(pointer: coarse)').matches) Touch.enable();
addEventListener('pointerdown', e => { if (e.pointerType === 'touch') Touch.enable(); }, true);

Object.assign(UI, {
  fingers: new Map(), gesture: null,

  bindTouch() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault(); // no emulated mouse events after this
      Sfx.resume();
      c.setPointerCapture(e.pointerId);
      this.fingerDown(e);
    });
    c.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && this.fingers.has(e.pointerId)) this.fingerMove(e); });
    c.addEventListener('pointerup', e => { if (e.pointerType === 'touch') this.fingerUp(e, false); });
    c.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') this.fingerUp(e, true); });
    this.buildTouchBar();
  },

  // finger position in page pixels from the view's top-left
  fingerXY(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  },

  fingerDown(e) {
    const [x, y] = this.fingerXY(e);
    this.fingers.set(e.pointerId, { x, y });
    clearTimeout(this.holdTimer);
    if (this.fingers.size === 1) {
      this.gesture = { kind: 'tap', x0: x, y0: y, cx: this.cam.x, cy: this.cam.y };
      this.holdTimer = setTimeout(() => this.fingerHold(), TOUCH_HOLD);
    } else if (this.fingers.size === 2) {
      // a second finger turns whatever the first was doing into a pinch
      this.drag = null;
      const [a, b] = [...this.fingers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.gesture = { kind: 'pinch', d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), z0: this.zoom,
        px: this.cam.x + mx / this.zoom, py: this.cam.y + my / this.zoom };
    }
  },

  // resting a finger, then dragging, draws a selection box (not while placing or targeting)
  fingerHold() {
    const g = this.gesture;
    if (!g || g.kind !== 'tap' || this.fingers.size !== 1 || !G || G.over || Main.paused) return;
    if (this.placing || this.mode || this.superTargeting) return;
    g.kind = 'box';
    this.mouse.x = g.x0 / this.zoom; this.mouse.y = g.y0 / this.zoom;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    this.drag = { x0: this.mouse.x, y0: this.mouse.y, x1: this.mouse.x, y1: this.mouse.y, shift: false, ent: this.entityAt(w.x, w.y) };
    if (navigator.vibrate) navigator.vibrate(12);
  },

  fingerMove(e) {
    const f = this.fingers.get(e.pointerId);
    [f.x, f.y] = this.fingerXY(e);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'tap' && Math.hypot(f.x - g.x0, f.y - g.y0) > TOUCH_SLOP) { g.kind = 'pan'; clearTimeout(this.holdTimer); }
    if (g.kind === 'pan') {
      this.cam.x = g.cx - (f.x - g.x0) / this.zoom;
      this.cam.y = g.cy - (f.y - g.y0) / this.zoom;
      this.clampCam();
    } else if (g.kind === 'box') {
      // update() copies the mouse into the drag box every frame
      this.mouse.x = f.x / this.zoom; this.mouse.y = f.y / this.zoom;
      this.drag.x1 = this.mouse.x; this.drag.y1 = this.mouse.y;
    } else if (g.kind === 'pinch' && this.fingers.size === 2) {
      // zoom by the spread of the fingers and keep the spot between them under them
      const [a, b] = [...this.fingers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.zoom = Math.max(this.minZoom(), Math.min(ZOOM_MAX, g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0));
      this.resize(false);
      this.cam.x = g.px - mx / this.zoom;
      this.cam.y = g.py - my / this.zoom;
      this.clampCam();
    }
  },

  fingerUp(e, cancelled) {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    this.fingers.delete(e.pointerId);
    const g = this.gesture;
    if (this.fingers.size) {
      // lifting one finger of a pinch: ignore the other until it lifts too
      if (g && g.kind === 'pinch') g.kind = 'done';
      return;
    }
    clearTimeout(this.holdTimer);
    this.gesture = null;
    if (!g || !G) return;
    if (g.kind === 'tap' && !cancelled) this.tap(g.x0 / this.zoom, g.y0 / this.zoom);
    else if (g.kind === 'box') {
      if (cancelled || G.over || Main.paused) this.drag = null;
      else this.onUp({ button: 0 });
    }
  },

  // a tap at canvas point (x, y)
  tap(x, y) {
    if (G.over || Main.paused) return;
    const w = this.toWorld(x, y), tx = Math.floor(w.x / TILE), ty = Math.floor(w.y / TILE);
    // placing: the first tap puts the outline down, a tap on the outline builds it there
    if (this.placing) {
      const pl = this.placing, def = BUILDINGS[pl.key];
      if (pl.armed && tx >= pl.tx && tx < pl.tx + def.w && ty >= pl.ty && ty < pl.ty + def.h) {
        this.onDown({ button: 0 });
        if (this.placing) this.placing.armed = true; // the next wall section
        return;
      }
      this.mouse.x = x; this.mouse.y = y;
      pl.armed = true;
      this.hint('Tap the outline again to build');
      return;
    }
    this.mouse.x = x; this.mouse.y = y;
    const ent = this.entityAt(w.x, w.y);
    // attack-move on a bridge brings it down (Ctrl+right-click with a mouse)
    if (this.mode === 'amove' && ent && ent.def.bridge && G.bridgeUp(ent)) {
      this.mode = null;
      this.onRight(w, { ctrlKey: true });
      return;
    }
    if (this.superTargeting || this.mode) { this.onDown({ button: 0 }); return; }
    const now = performance.now(), last = this.lastTap;
    this.lastTap = { t: now, x, y };
    if (last && now - last.t < 320 && Math.hypot(x - last.x, y - last.y) < 24 / this.zoom && ent && ent.team === G.player) {
      this.onDbl({}); // double tap: every unit of that type on screen, or a building made primary
      return;
    }
    const units = this.ownUnits();
    if (units.length && this.tapOrders(ent, units)) { this.onRight(w, { ctrlKey: false }); return; }
    // otherwise it's a left click: select what's there, or clear the selection
    this.drag = { x0: x, y0: y, x1: x, y1: y, shift: false, ent };
    this.onUp({ button: 0 });
  },

  // with units selected, does tapping this (or bare ground) give them an order?
  tapOrders(ent, units) {
    if (!ent || ent.team !== G.player) return true;
    if (ent.kind === 'unit') return !!ent.def.transport && units.some(u => G.canBoard(u, ent));
    if (ent.def.garrison && units.some(u => G.canGarrison(u, ent))) return true;
    if (ent.key === 'refinery' && units.some(u => u.def.harvester)) return true;
    return ent.hp < ent.maxHp && units.some(u => u.def.engineer);
  },

  // a line in the message feed without the announcer reading it out
  hint(text) {
    if (G.messages.some(m => m.text === text && G.time - m.t < 3)) return;
    G.messages.push({ text, t: G.time });
    if (G.messages.length > 6) G.messages.shift();
  },

  // build buttons: tap to build, hold to put on hold / cancel, or to read about it
  touchBuildDown(e, key, el) {
    const x0 = e.clientX, y0 = e.clientY;
    let held = false, tip = false;
    const timer = setTimeout(() => {
      held = true;
      const q = G.playerTeam.queues[queueTypeOf(key)];
      if (q.items.includes(key)) this.clickBuild(key, true, false);
      else { this.showTip(key, el); tip = true; }
      if (navigator.vibrate) navigator.vibrate(12);
    }, BUILD_HOLD);
    const end = ev => {
      clearTimeout(timer);
      el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
      if (tip) this.hideTip();
      if (ev.type === 'pointerup' && !held && Math.hypot(ev.clientX - x0, ev.clientY - y0) < TOUCH_SLOP) this.clickBuild(key, false, false);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  },

  // group buttons: tap to select (twice to jump), hold to put the selection in that group
  touchGroupDown(e, n) {
    const el = e.target.closest('[data-g]');
    let held = false;
    const timer = setTimeout(() => { held = true; this.setGroup(n, false); if (navigator.vibrate) navigator.vibrate(12); }, BUILD_HOLD);
    const end = ev => {
      clearTimeout(timer);
      el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
      if (ev.type === 'pointerup' && !held) this.recallGroup(n, false);
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  },

  // the command bar: what the keyboard does, for fingers
  buildTouchBar() {
    const bar = document.getElementById('touchbar');
    const acts = [
      ['tb-clear', '✕', 'Clear', () => { if (!this.cancelModes()) this.selection = []; }],
      ['tb-amove', '⌖', 'Attack', () => { if (!this.ownUnits().length) return; this.placing = null; this.superTargeting = false; this.mode = this.mode === 'amove' ? null : 'amove'; }],
      ['tb-stop', '■', 'Stop', () => G.commandStop(this.ownUnits())],
      ['tb-deploy', '⤓', 'Deploy', () => this.deployAction()],
      ['tb-army', '⚑', 'Army', () => this.selectArmy()],
      ['tb-group', '+', 'Group', () => {
        if (!this.ownUnits().length) return;
        let n = 1;
        while (n < 10 && (this.groups[n] || []).some(u => !u.dead && u.team === G.player)) n++;
        if (n < 10) this.setGroup(String(n), false); else Sfx.play('error');
      }],
      ['tb-home', '⌂', 'Base', () => this.jumpHome()],
      ['tb-alert', '!', 'Alert', () => this.jumpAlert()],
    ];
    bar.innerHTML = '';
    for (const [id, icon, label, fn] of acts) {
      const b = document.createElement('button');
      b.id = id; b.innerHTML = `<b>${icon}</b>${label}`;
      b.addEventListener('click', () => { if (!G || G.over || Main.paused) return; Sfx.resume(); fn(); this.updateTouchBar(); });
      bar.appendChild(b);
    }
  },

  updateTouchBar() {
    if (!Touch.on) return;
    const units = this.ownUnits(), sel = this.ownSelected();
    const set = (id, on, off) => { const b = document.getElementById(id); b.classList.toggle('on', !!on); b.classList.toggle('off', !!off); };
    set('tb-clear', false, !sel.length && !this.placing && !this.mode && !this.superTargeting);
    set('tb-amove', this.mode === 'amove', !units.length);
    set('tb-stop', false, !units.length);
    set('tb-deploy', false, !units.some(u => u.def.mcv || u.def.dig || u.def.mines || (u.passengers && u.passengers.length)) &&
      !sel.some(b => b.garrison && b.garrison.length));
    set('tb-group', false, !units.length);
  },
});
