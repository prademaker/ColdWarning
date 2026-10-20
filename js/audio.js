// ColdWarning — synthesized sound effects, ambience, announcer and unit voices.
// Everything is generated with Web Audio at runtime; there are no sound files.
'use strict';

const Sfx = {
  ctx: null, muted: false, last: {},
  // volumes 0..1, saved per browser
  vol: { master: 0.8, sfx: 0.8, music: 0.55, voice: 0.8 },

  init(ctx) {
    try { Object.assign(this.vol, JSON.parse(localStorage.getItem('cw-audio') || '{}')); } catch (e) { /* storage is optional */ }
    try {
      const c = this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      // master -> limiter -> speakers; sfx and music buses feed the master, both with a reverb send
      this.limiter = c.createDynamicsCompressor();
      this.limiter.threshold.value = -10; this.limiter.knee.value = 6; this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003; this.limiter.release.value = 0.2;
      this.master = c.createGain();
      this.master.connect(this.limiter); this.limiter.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(2.4, 2.8);
      this.reverbOut = c.createGain(); this.reverbOut.gain.value = 0.5;
      this.reverb.connect(this.reverbOut); this.reverbOut.connect(this.master);
      // big explosions go through a soft-clipping bus so they sound heavy rather than just loud
      this.dirt = c.createWaveShaper(); this.dirt.curve = this.shaper(3); this.dirt.oversample = '2x';
      this.dirtOut = c.createGain(); this.dirtOut.gain.value = 0.7;
      this.dirt.connect(this.dirtOut); this.dirtOut.connect(this.sfxBus);
      const len = c.sampleRate * 2;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // sparse clicks for debris and fire crackle
      this.crackle = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const k = this.crackle.getChannelData(0);
      for (let i = 0; i < k.length; i++) if (Math.random() < 0.004) k[i] = (Math.random() * 2 - 1) * (1 - i / k.length);
      this.applyVolume();
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setVolume(key, v) {
    this.vol[key] = v;
    try { localStorage.setItem('cw-audio', JSON.stringify(this.vol)); } catch (e) { /* ignore */ }
    this.applyVolume();
  },

  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.05);
  },

  setMuted(m) {
    this.muted = m;
    if (m && window.speechSynthesis) speechSynthesis.cancel();
    this.applyVolume();
  },

  // stereo impulse response: decaying noise, a little darker at the tail
  impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) {
        const f = 0.25 + 0.7 * (1 - i / n);
        lp += f * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - i / n, decay);
      }
    }
    return b;
  },

  shaper(amount) {
    const n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    return curve;
  },

  // ---- building blocks: each makes nodes for one sound starting at time t into `out` ----

  // output for one sound: gain -> panner -> sfx bus (+ reverb send)
  voiceOut(vol, pan, wet) {
    const c = this.ctx, g = c.createGain();
    g.gain.value = vol;
    let node = g;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.sfxBus);
    if (wet) { const s = c.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.reverb); }
    return g;
  },

  osc(out, type, f0, f1, t, dur, vol, attack = 0.002) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    return o;
  },

  // filtered noise; type is a biquad type, f0 -> f1 sweeps the filter
  hiss(out, type, f0, f1, t, dur, vol, q = 0.8, attack = 0.002, buf = this.noise) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * (buf.duration - dur - 0.1 > 0 ? buf.duration - dur - 0.1 : 0)); s.stop(t + dur + 0.05);
  },

  // metallic clank: a few inharmonic partials
  clank(out, t, base, vol, dur = 0.5) {
    for (const r of [1, 2.76, 5.4, 8.93]) this.osc(out, 'sine', base * r, base * r * 0.995, t, dur / Math.sqrt(r), vol / r);
  },

  // ---- sound catalogue ----

  // pan -1..1 and distance volume come from the UI (screen position of the source)
  play(name, vol = 1, pan = 0) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = performance.now();
    const gap = { gun: 55, flak: 80, pop: 45, cannon: 60, rocket: 70, boom: 80, rail: 90, crush: 80, click: 30, ack: 60 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const t = this.ctx.currentTime + 0.005, r = 0.9 + Math.random() * 0.2; // small pitch jitter
    switch (name) {
      case 'gun': { // rifle / MG crack
        const o = this.voiceOut(0.5 * vol, pan, 0.12);
        this.hiss(o, 'highpass', 1600 * r, 900, t, 0.05, 0.6);
        this.hiss(o, 'bandpass', 900 * r, 500, t, 0.09, 0.45, 1.2);
        this.osc(o, 'sine', 160 * r, 60, t, 0.07, 0.35);
        break;
      }
      case 'flak': { // airburst thump with a sharp top
        const o = this.voiceOut(0.5 * vol, pan, 0.25);
        this.hiss(o, 'bandpass', 700 * r, 250, t, 0.18, 0.7, 1.5);
        this.hiss(o, 'highpass', 3000, 2000, t, 0.04, 0.35);
        this.osc(o, 'sine', 110 * r, 50, t, 0.14, 0.4);
        break;
      }
      case 'cannon': { // tank gun: transient, blast, sub, reverb tail
        const o = this.voiceOut(0.65 * vol, pan, 0.35);
        this.osc(o, 'square', 1800, 600, t, 0.015, 0.25);
        this.hiss(o, 'lowpass', 2400 * r, 160, t, 0.45, 0.9);
        this.osc(o, 'sine', 95 * r, 32, t, 0.4, 0.8);
        this.hiss(o, 'lowpass', 500, 120, t + 0.03, 0.7, 0.3, 0.5, 0.06);
        break;
      }
      case 'rocket': { // launch thump and a rising whoosh
        const o = this.voiceOut(0.45 * vol, pan, 0.2);
        this.osc(o, 'sine', 140 * r, 50, t, 0.12, 0.5);
        this.hiss(o, 'bandpass', 700 * r, 2800, t, 0.6, 0.7, 2.5, 0.05);
        this.hiss(o, 'lowpass', 1200, 300, t, 0.35, 0.35);
        break;
      }
      case 'rail': { // charged zap with an FM snarl
        const c = this.ctx, o = this.voiceOut(0.4 * vol, pan, 0.4);
        const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
        car.type = 'sawtooth'; car.frequency.setValueAtTime(2600 * r, t); car.frequency.exponentialRampToValueAtTime(180, t + 0.35);
        mod.frequency.setValueAtTime(420, t); mg.gain.setValueAtTime(1600, t); mg.gain.exponentialRampToValueAtTime(30, t + 0.35);
        g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(o);
        car.start(t); mod.start(t); car.stop(t + 0.45); mod.stop(t + 0.45);
        this.osc(o, 'sine', 80, 35, t, 0.5, 0.7);
        this.hiss(o, 'highpass', 5000, 2500, t, 0.25, 0.25);
        break;
      }
      case 'pop': { // small explosion
        const o = this.voiceOut(0.55 * vol, pan, 0.3);
        this.hiss(o, 'lowpass', 2200 * r, 200, t, 0.4, 0.9);
        this.osc(o, 'sine', 120 * r, 38, t, 0.3, 0.6);
        this.hiss(o, 'highpass', 2500, 2500, t + 0.05, 0.35, 0.2, 0.7, 0.01, this.crackle);
        break;
      }
      case 'boom': { // big explosion: distorted sub, rumble, debris
        const o = this.voiceOut(0.75 * vol, pan, 0.5);
        const d = this.ctx.createGain(); d.gain.value = 0.9 * vol; d.connect(this.dirt);
        this.osc(d, 'sine', 70 * r, 24, t, 1.3, 1);
        this.hiss(d, 'lowpass', 1600 * r, 90, t, 1.6, 1, 0.7);
        this.hiss(o, 'bandpass', 3000, 800, t, 0.12, 0.5, 0.8);
        this.hiss(o, 'lowpass', 300, 80, t + 0.1, 2.2, 0.5, 0.5, 0.2);
        this.hiss(o, 'highpass', 1800, 1800, t + 0.08, 1.0, 0.45, 0.7, 0.01, this.crackle);
        break;
      }
      case 'crush': {
        const o = this.voiceOut(0.45 * vol, pan, 0.1);
        this.hiss(o, 'bandpass', 500, 200, t, 0.18, 0.7, 2);
        this.osc(o, 'sine', 90, 40, t, 0.12, 0.4);
        break;
      }
      case 'click': { const o = this.voiceOut(0.3, 0); this.osc(o, 'square', 1400, 1100, t, 0.03, 0.12); this.hiss(o, 'highpass', 4000, 4000, t, 0.02, 0.1); break; }
      case 'ack': { // radio chirp
        const o = this.voiceOut(0.3, 0);
        this.hiss(o, 'bandpass', 2200, 1800, t, 0.06, 0.25, 3);
        this.osc(o, 'square', 1250, 1250, t, 0.05, 0.08); this.osc(o, 'square', 1650, 1650, t + 0.055, 0.05, 0.08);
        break;
      }
      case 'radio': { const o = this.voiceOut(0.25, 0); this.hiss(o, 'bandpass', 2500, 1500, t, 0.09, 0.4, 2); break; }
      case 'ready': { // two-note chime
        const o = this.voiceOut(0.35, 0, 0.3);
        this.osc(o, 'sine', 880, 880, t, 0.4, 0.25); this.osc(o, 'sine', 1318, 1318, t + 0.11, 0.6, 0.25);
        this.osc(o, 'triangle', 1760, 1760, t + 0.11, 0.3, 0.06);
        break;
      }
      case 'place': { // heavy slab landing, then a clank
        const o = this.voiceOut(0.6 * vol, pan, 0.3);
        this.osc(o, 'sine', 90, 40, t, 0.35, 0.8);
        this.hiss(o, 'lowpass', 900, 150, t, 0.4, 0.6);
        this.clank(o, t + 0.04, 210, 0.25, 0.6);
        break;
      }
      case 'sell': { // cash register
        const o = this.voiceOut(0.4, 0, 0.2);
        this.clank(o, t, 1900, 0.18, 0.25);
        this.osc(o, 'sine', 2637, 2637, t + 0.08, 0.5, 0.18); this.osc(o, 'sine', 3520, 3520, t + 0.08, 0.6, 0.12);
        break;
      }
      case 'capture': {
        const o = this.voiceOut(0.4, pan, 0.2);
        [523, 659, 784].forEach((f, i) => this.osc(o, 'square', f, f, t + i * 0.08, 0.14, 0.07));
        break;
      }
      case 'siren': { // air-raid siren: slow rise and fall, three cycles
        const c = this.ctx, o = this.voiceOut(0.55, 0, 0.5);
        const s1 = c.createOscillator(), s2 = c.createOscillator(), g = c.createGain();
        s1.type = 'sawtooth'; s2.type = 'square';
        for (let i = 0; i < 3; i++) {
          const a = t + i * 1.6;
          s1.frequency.setValueAtTime(260, a); s1.frequency.linearRampToValueAtTime(820, a + 0.9); s1.frequency.linearRampToValueAtTime(260, a + 1.6);
          s2.frequency.setValueAtTime(262, a); s2.frequency.linearRampToValueAtTime(826, a + 0.9); s2.frequency.linearRampToValueAtTime(262, a + 1.6);
        }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.3);
        g.gain.setValueAtTime(0.16, t + 4.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        s1.connect(lp); s2.connect(lp); lp.connect(g); g.connect(o);
        s1.start(t); s2.start(t); s1.stop(t + 4.9); s2.stop(t + 4.9);
        break;
      }
      case 'error': { const o = this.voiceOut(0.3, 0); this.osc(o, 'square', 180, 170, t, 0.09, 0.12); this.osc(o, 'square', 140, 135, t + 0.1, 0.12, 0.12); break; }
    }
  },

  // ---- ambience: wind, louder in arctic and desert ----
  ambience(theater) {
    if (!this.ctx) return;
    this.stopAmbience();
    const c = this.ctx, t = c.currentTime;
    const amt = { arctic: 0.5, desert: 0.4, steppe: 0.35, temperate: 0.22, jungle: 0.18 }[theater] || 0.25;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300;
    lfo.connect(lg); lg.connect(f.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amt * 0.12, t + 3);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); lfo.start(t);
    this.amb = { s, lfo, g };
  },

  stopAmbience() {
    if (!this.amb) return;
    const { s, lfo, g } = this.amb, t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.3); s.stop(t + 1.5); lfo.stop(t + 1.5);
    this.amb = null;
  },

  // ---- speech: the announcer has priority over unit chatter ----

  pickVoice(female) {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices().filter(v => v.lang && v.lang.startsWith('en')) : [];
    if (!vs.length) return null;
    const re = female ? /female|zira|samantha|susan|hazel|libby|sonia|aria|jenny|google uk english female/i
      : /male|david|daniel|george|ryan|guy|mark|alex|fred|google uk english male/i;
    return vs.find(v => re.test(v.name) && !(!female && /female/i.test(v.name))) || vs[0];
  },

  speak(text, opts) {
    if (this.muted || !this.vol.voice || !window.speechSynthesis) return false;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate; u.pitch = opts.pitch; u.volume = Math.min(1, this.vol.voice * this.vol.master * 1.1);
      const v = this.pickVoice(opts.female);
      if (v) u.voice = v;
      speechSynthesis.speak(u);
      return u;
    } catch (e) { return false; /* speech is optional */ }
  },

  say(text) { // announcer
    if (!window.speechSynthesis) return;
    if (this.unitTalking && speechSynthesis.speaking) { speechSynthesis.cancel(); this.unitTalking = false; }
    if (speechSynthesis.speaking && speechSynthesis.pending) return;
    this.speak(text, { rate: 1.05, pitch: 0.75, female: true });
  },

  // unit replies when selected or ordered (kind: select | move | attack)
  unitVoice(u, kind) {
    if (!u || !window.speechSynthesis || this.muted || !this.vol.voice) return;
    const now = performance.now();
    if (now - (this.lastUnitVoice || 0) < 1400 || speechSynthesis.speaking || speechSynthesis.pending) return;
    this.lastUnitVoice = now;
    const team = G.teams[u.team], east = FACTIONS[team.faction].side === 'east';
    const role = u.def.harvester ? 'harvester' : u.def.engineer ? 'engineer' : u.def.cat === 'infantry' ? 'infantry' : u.air ? 'air' : 'vehicle';
    const lines = UNIT_LINES[role][kind] || UNIT_LINES[role].select;
    const extra = east ? (UNIT_LINES_EAST[kind] || []) : [];
    const pool = lines.concat(extra);
    const text = pool[Math.floor(Math.random() * pool.length)];
    const pitch = { infantry: 0.95, engineer: 1.15, vehicle: 0.6, harvester: 0.8, air: 1.0 }[role];
    this.play('radio');
    setTimeout(() => {
      const u2 = this.speak(text, { rate: role === 'air' ? 1.2 : 1.1, pitch, female: role === 'air' && Math.random() < 0.5 });
      if (u2) { this.unitTalking = true; u2.onend = () => { this.unitTalking = false; }; }
    }, 90);
  },
};

const UNIT_LINES = {
  infantry: {
    select: ['Reporting.', 'Ready, commander.', 'Awaiting orders.', 'Standing by.', 'Yes, sir?'],
    move: ['Moving out.', 'On my way.', 'Double time!', 'Affirmative.', 'Copy that.'],
    attack: ['Engaging!', 'Open fire!', 'Weapons free!', 'Taking them down.', 'Contact!'],
  },
  engineer: {
    select: ['Engineer here.', 'Tools ready.', 'What needs fixing?'],
    move: ['On it.', 'Heading over.', 'Right away.'],
    attack: ['Moving to secure it.', 'Let me at it.'],
  },
  vehicle: {
    select: ['Armor ready.', 'Tank crew standing by.', 'Engines hot.', 'Vehicle reporting.', 'Locked and loaded.'],
    move: ['Rolling out.', 'Moving.', 'Advancing.', 'Changing position.', 'Acknowledged.'],
    attack: ['Target locked.', 'Firing!', 'Main gun ready.', 'Target acquired.', 'Bringing the hammer.'],
  },
  harvester: {
    select: ['Harvester ready.', 'Ore truck here.', 'Need a field.'],
    move: ['Heading out.', 'Moving to the field.', 'On my way.'],
  },
  air: {
    select: ['Pilot here.', 'Airborne and ready.', 'Flight standing by.', 'Rotors spinning.'],
    move: ['Vectoring.', 'Heading in.', 'Wilco.', 'Course set.'],
    attack: ['Going hot!', 'Attack run!', 'Weapons hot.', 'Fox three!'],
  },
};
const UNIT_LINES_EAST = { select: ['Da, commander?'], move: ['Da!', 'For the motherland.'], attack: ['Ura!', 'For the homeland!'] };
