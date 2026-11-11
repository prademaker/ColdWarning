// Cold War 2: 2030 — combat feedback, so a fight can be read at a glance: a flash on every hit,
// battered units and structures that look the part, health bars that show the chunk a hit just
// took, short floating notes (weak hits, promotions) and arrows at the screen edge that point to
// attacks out of view. Cosmetic only: nothing here changes the simulation, and none of it is saved.
'use strict';

// how long a hit flash lasts, and how long the bar keeps showing the chunk a hit took
const HIT_FLASH = 0.14, GHOST_HOLD = 0.45;
// a warhead doing this little against the armour gets a "weak" note (rifles on tanks...)
const WEAK_HIT = 0.3;
const EDGE_KINDS = { base: 'BASE', unit: 'UNIT', harv: 'HARVESTER' };

const Combat = {
  game: null, state: new WeakMap(), texts: [], arrows: [],
  showText: true, // floating combat text (menu option)

  // per-entity feedback state, dropped with the game it belongs to
  st(e) {
    if (this.game !== G) { this.game = G; this.state = new WeakMap(); this.texts = []; this.arrows = []; }
    let s = this.state.get(e);
    if (!s) { s = { ghost: e.hp, holdT: -9, seenT: G.time, flashT: -9, noteT: -9, sparkT: -9 }; this.state.set(e, s); }
    return s;
  },

  // Game.damage calls this once a hit lands: before is the hp it had, mult the warhead's factor
  // against the target's armour
  onHit(g, t, before, mult, warhead, by) {
    if (g !== G || typeof document === 'undefined') return;
    const s = this.st(t);
    if (s.ghost < before) s.ghost = before; // healed since the last hit: the trail starts afresh
    s.holdT = g.time; s.flashT = g.time;
    const pid = g.player;
    if (!(t.team === pid || g.isVisibleTo(t, pid))) return;
    if (mult <= WEAK_HIT && by && warhead !== 'flak') {
      // a glancing hit: a few pale sparks off the armour, and a note if it is our own fire
      if (g.time - s.sparkT > 0.35) {
        s.sparkT = g.time;
        g.effects.push({ type: 'spark', x: t.x, y: t.y, z: aimZ(t), t: 0, life: 0.35, color: '#e8e4d8' });
      }
      if (by.team === pid && this.showText && g.time - s.noteT > 5) {
        s.noteT = g.time;
        this.note(t, mult === 0 ? 'NO EFFECT' : 'WEAK', '#b9c6d2');
      }
    }
  },

  // a short line that rises off an entity and fades
  note(e, text, color) {
    if (this.game !== G) this.st(e);
    if (!this.showText) return;
    const z = (e.kind === 'building' ? e.def.height : (e.alt || 0) + (e.def.cat === 'infantry' ? 22 : 28)) + 6;
    // a fresh note on the same spot replaces the older one instead of stacking on it
    this.texts = this.texts.filter(n => n.e !== e || n.text !== text);
    this.texts.push({ e, x: e.x, y: e.y, z, text, color, t0: G.time, life: 1.6 });
    if (this.texts.length > 24) this.texts.shift();
  },

  // draws an entity's sprite(s), then again as a hit flash and as wear when it is badly hurt
  // (draw paints the sprites; it can be called more than once)
  overlay(ctx, e, draw) {
    const s = this.state.get(e);
    const f = e.hp / e.maxHp;
    // below half health the paint darkens and goes dull, as if scorched
    const wear = f < 0.55 ? Math.min(0.5, (0.55 - f) * 1.1) : 0;
    const age = s ? G.time - s.flashT : 9;
    const flash = age < HIT_FLASH ? 0.55 * (1 - age / HIT_FLASH) : 0;
    if (!wear && !flash) return;
    const a0 = ctx.globalAlpha, op = ctx.globalCompositeOperation;
    if (wear) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a0 * wear; draw(); }
    if (flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a0 * flash; draw(); }
    ctx.globalCompositeOperation = op; ctx.globalAlpha = a0;
  },

  // whether a unit or structure is in a fight right now (its health bar shows)
  engaged(e) {
    return (e.hitT && G.time - e.hitT < 2.5) || (e.firedT && G.time - e.firedT < 1.5 && e.team !== NEUTRAL);
  },

  // health bar fill with the trail of recent damage: the chunk a hit took shows pale for a
  // moment, then drains away
  drawBar(ctx, e, x, y, w) {
    const f = Math.max(0, e.hp / e.maxHp), s = this.st(e);
    const dt = Math.max(0, G.time - s.seenT); s.seenT = G.time;
    if (e.hp >= s.ghost) s.ghost = e.hp;
    else if (G.time - s.holdT > GHOST_HOLD) s.ghost = Math.max(e.hp, s.ghost - e.maxHp * 0.9 * dt);
    const g = Math.max(f, Math.min(1, s.ghost / e.maxHp));
    const crit = f <= 0.25 && f > 0;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, w + 2, 5);
    if (g > f) {
      const fresh = G.time - s.holdT < GHOST_HOLD;
      ctx.fillStyle = fresh ? '#fff' : '#ff8a3a';
      ctx.fillRect(x + w * f, y, w * (g - f), 3);
    }
    ctx.fillStyle = f > 0.6 ? '#3f3' : f > 0.3 ? '#fd3' : '#f33';
    ctx.fillRect(x, y, w * f, 3);
    // quarter marks on the longer bars, so you can read how much is left
    if (w >= 40) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let i = 1; i < 4; i++) ctx.fillRect(Math.round(x + w * i / 4), y, 1, 3);
    }
    if (crit && Math.sin(G.time * 12) > 0) {
      // nearly gone: the bar's frame blinks red
      ctx.strokeStyle = 'rgba(255,70,50,0.95)'; ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, w + 3, 6);
    }
  },

  // floating notes and edge arrows, in screen space, over everything else in the view
  drawOverlay(ctx, R) {
    if (this.game !== G) { this.game = G; this.state = new WeakMap(); this.texts = []; this.arrows = []; }
    const now = G.time;
    this.texts = this.texts.filter(n => now - n.t0 < n.life);
    if (this.texts.length) {
      ctx.font = '600 10px Oswald, sans-serif'; ctx.textAlign = 'center';
      for (const n of this.texts) {
        const p = (now - n.t0) / n.life;
        if (!n.e.dead) { n.x = n.e.x; n.y = n.e.y; }
        const [x, y] = R.P(n.x, n.y, n.z + p * 16);
        ctx.globalAlpha = p < 0.7 ? 1 : (1 - p) / 0.3;
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(n.text, x + 1, y + 1);
        ctx.fillStyle = n.color; ctx.fillText(n.text, x, y);
      }
      ctx.globalAlpha = 1;
    }
    this.drawEdgeAlerts(ctx, R);
  },

  // Attacks out of view: an arrow at the edge of the screen pointing at each one, in the radar
  // ping's colour. Clicking (or tapping) an arrow jumps there.
  drawEdgeAlerts(ctx, R) {
    this.arrows = [];
    // shrunk a little as the view zooms in, so they stay a sensible size on the page
    const S = 1 / Math.sqrt(Math.max(1, (typeof UI !== 'undefined' && UI.zoom) || 1)), W = ctx.canvas.width, H = ctx.canvas.height, m = 30 * S, now = G.time;
    for (const p of G.pings || []) {
      const age = now - p.t;
      if (age > PING_LIFE || !EDGE_KINDS[p.kind]) continue;
      const [sx, sy] = R.P(p.x, p.y);
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      // clamp the direction from the centre of the view onto a box inside the edges
      const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
      const x = cx + dx * k, y = cy + dy * k;
      if (this.arrows.some(a => Math.hypot(a.x - x, a.y - y) < 34 * S)) continue;
      const ang = Math.atan2(dy, dx), col = PING_COLORS[p.kind] || '#f33';
      const fade = age > PING_LIFE - 1 ? PING_LIFE - age : 1, pulse = 0.5 + 0.5 * Math.sin(age * 9);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y); ctx.scale(S, S);
      // a pulsing halo, then the arrow head
      ctx.fillStyle = col; ctx.globalAlpha = fade * (0.18 + 0.2 * pulse);
      ctx.beginPath(); ctx.arc(0, 0, 15 + pulse * 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = fade;
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-7, -10); ctx.lineTo(-3, 0); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-5, -7.5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 7.5); ctx.closePath(); ctx.fill();
      ctx.restore();
      // what is under attack, just inside the arrow
      ctx.globalAlpha = fade;
      ctx.font = `600 ${Math.round(10 * S)}px Oswald, sans-serif`; ctx.textAlign = 'center';
      const tw = ctx.measureText(EDGE_KINDS[p.kind]).width;
      const lx = x - Math.cos(ang) * (20 * S + tw / 2), ly = y - Math.sin(ang) * 24 * S + 3.5 * S;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillText(EDGE_KINDS[p.kind], lx + 1, ly + 1);
      ctx.fillStyle = col; ctx.fillText(EDGE_KINDS[p.kind], lx, ly);
      ctx.globalAlpha = 1;
      this.arrows.push({ x, y, r: 22 * S, wx: p.x, wy: p.y });
    }
  },

  // the alert arrow under a point on the screen, if any
  arrowAt(x, y, r) {
    if (this.game !== G) return null;
    return this.arrows.find(a => Math.hypot(a.x - x, a.y - y) < (r || a.r)) || null;
  },
};
