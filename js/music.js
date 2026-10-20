// ColdWarning — generative soundtrack in the spirit of Red Alert's industrial military rock.
// Each track is built from a seed: tempo, key, mode, chord progressions, guitar riffs, drum
// patterns and a lead motif. The arrangement follows the battle: calm passages play drums,
// bass, pads and arpeggios; when fighting breaks out the distorted guitars, brass stabs and
// lead come in. Everything is synthesized with Web Audio.
'use strict';

const TRACKS = [
  { title: 'Iron Curtain 2030', seed: 2030 },
  { title: 'Grid Lock', seed: 77 },
  { title: 'Red Shift', seed: 1917 },
  { title: 'Deterrence', seed: 404 },
  { title: 'Hypersonic', seed: 5150 },
  { title: 'Cold Front', seed: 1962 },
  { title: 'Hell Lance', seed: 31337 },
];

const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};
// chord roots per bar, as scale degrees (0 = i)
const PROGS = [[0, 5, 6, 0], [0, 0, 5, 4], [0, 1, 0, 6], [0, 3, 5, 4], [0, 6, 5, 6], [0, 0, 3, 1], [0, 5, 3, 4]];
// guitar riffs, one bar of 16ths: X = open power chord, x = palm-muted chug, 1-6 = power chord
// that many scale steps above the chord root, . = rest
const RIFFS = [
  'X.xxX.xxX.xx3.2.', 'Xxx.Xxx.Xx.xX.1.', 'X..xX..xX.xx2..1', 'Xx.xXx.xX.x.X.6.',
  'X.x.x.X.x.x.X.x2', 'XxxXxxXxXxxXxx4.', 'X.xx.xX.xx.xX.5.', 'Xx.Xx.Xx.X.x1.2.',
];
const LEAD_RHYTHMS = ['X..X..X.X...X...X..X..X.X.X.X...', 'X.X.X...X..XX...X.X.X...X...X...', 'X...X..X..X.X...X...X..X..X.X.X.'];

const Music = {
  on: true, mode: null, level: 1, heat: 0, lastHeat: 0,

  init(ctx, out, reverb) {
    if (!ctx) return;
    this.ctx = ctx;
    const c = ctx;
    this.out = c.createGain(); this.out.connect(out);
    this.wet = c.createGain(); this.wet.gain.value = 0.35; this.wet.connect(reverb);
    this.drums = c.createGain(); this.drums.gain.value = 0.8; this.drums.connect(this.out);
    // guitar amp: drive -> clip -> cabinet filters
    this.gtr = c.createGain(); this.gtr.gain.value = 6;
    const clip = c.createWaveShaper(); clip.curve = Sfx.shaper(4); clip.oversample = '2x';
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 700; mid.gain.value = -5; mid.Q.value = 0.8;
    const cab = c.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3400; cab.Q.value = 0.9;
    const cab2 = c.createBiquadFilter(); cab2.type = 'lowpass'; cab2.frequency.value = 5000;
    this.gtrOut = c.createGain(); this.gtrOut.gain.value = 0.16;
    this.gtr.connect(clip); clip.connect(hp); hp.connect(mid); mid.connect(cab); cab.connect(cab2); cab2.connect(this.gtrOut);
    this.gtrOut.connect(this.out);
    this.synth = c.createGain(); this.synth.gain.value = 0.75; this.synth.connect(this.out); this.synth.connect(this.wet);
  },

  // ---- transport ----

  play(mode) {
    if (!this.ctx) return;
    const same = this.mode === mode;
    this.mode = mode;
    if (!this.on || (same && this.timer)) return;
    this.startTrack(Math.floor(Math.random() * TRACKS.length));
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },

  stop() {
    clearInterval(this.timer); this.timer = null; this.song = null;
    if (this.out) { const t = this.ctx.currentTime; this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(this.out.gain.value, t); this.out.gain.linearRampToValueAtTime(0, t + 0.6); }
  },

  setOn(on) {
    this.on = on;
    if (!on) this.stop(); else if (this.mode) this.play(this.mode);
  },

  next() { if (this.song) this.startTrack((this.trackIdx + 1) % TRACKS.length); },

  startTrack(i) {
    this.trackIdx = i;
    this.song = this.compose(TRACKS[i]);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t); this.out.gain.setValueAtTime(1, t + 0.05);
    this.pos = { sec: 0, bar: 0, step: 0 };
    this.nextTime = t + 0.1;
    this.curLevel = -1;
    if (this.onTrack) this.onTrack(TRACKS[i].title);
  },

  // called by the game loop; the game counts combat involving the player in G.heat
  update(dt, heat) {
    if (heat !== undefined) {
      const d = Math.max(0, heat - this.lastHeat);
      this.lastHeat = heat;
      this.heat = Math.min(40, this.heat * Math.exp(-dt / 12) + d);
    }
  },

  wanted() {
    if (this.mode === 'menu') return 2;
    if (this.mode === 'end') return 1;
    return this.heat > 3 ? 2 : 1;
  },

  tick() {
    if (!this.song || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.05; // tab was in the background: skip ahead
    this.schedule(now + 0.15);
  },

  schedule(until) {
    const s = this.song, spb = 60 / s.bpm / 4;
    while (this.nextTime < until) {
      this.step(this.nextTime, spb);
      this.nextTime += spb * (this.pos.step % 2 === 0 ? 1 + s.swing : 1 - s.swing);
      if (++this.pos.step === 16) {
        this.pos.step = 0;
        if (++this.pos.bar >= s.form[this.pos.sec].bars) {
          this.pos.bar = 0;
          if (++this.pos.sec >= s.form.length) {
            if (++this.loops >= 2 && this.mode !== 'offline') { this.startTrack((this.trackIdx + 1) % TRACKS.length); return; }
            this.pos.sec = 1;
          }
        }
      }
    }
  },

  // ---- composition ----

  compose(track) {
    let a = track.seed >>> 0;
    const rng = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const mode = pick(Object.keys(SCALES));
    const progA = pick(PROGS);
    let progB = pick(PROGS); while (progB === progA) progB = pick(PROGS);
    const riffA = pick(RIFFS);
    let riffB = pick(RIFFS); while (riffB === riffA) riffB = pick(RIFFS);
    // lead motif: two bars, chord tones with the odd passing note
    const lr = pick(LEAD_RHYTHMS), lead = [];
    let deg = pick([0, 2, 4, 7]);
    for (let i = 0; i < 32; i++) {
      if (lr[i] !== 'X') { lead.push(null); continue; }
      deg = Math.max(-1, Math.min(9, deg + pick([-2, -1, 1, 2, 0, 2, -2, 3])));
      let len = 1; while (i + len < 32 && lr[i + len] === '.' && len < 6) len++;
      lead.push({ deg, len });
    }
    this.loops = 0;
    return {
      bpm: pick([112, 118, 124, 130, 136, 142]), root: pick([38, 40, 41, 43]), scale: SCALES[mode],
      swing: pick([0, 0, 0, 0.08]), progA, progB, riffA, riffB, lead,
      march: rng() < 0.6, // military snare ghost notes in the B section
      kickFollows: rng() < 0.6, // double kick locked to the guitar
      form: [
        { p: 'A', bars: 4, cap: 0 }, { p: 'A', bars: 8, cap: 2 }, { p: 'B', bars: 8, cap: 2 }, { p: 'A', bars: 8, cap: 2 },
        { p: 'B', bars: 4, cap: 0 }, { p: 'B', bars: 8, cap: 2 }, { p: 'A', bars: 8, cap: 2 },
      ],
    };
  },

  note(s, chordDeg, steps, oct) {
    const d = chordDeg + steps, sc = s.scale;
    return s.root + 12 * oct + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  },

  step(t, spb) {
    const s = this.song, { sec, bar, step } = this.pos, part = s.form[sec];
    const B = part.p === 'B';
    if (step === 0) {
      const lv = Math.min(part.cap, this.wanted());
      if (lv > this.curLevel && this.curLevel >= 0 && lv === 2) this.crash(t);
      this.curLevel = lv;
    }
    const lv = this.curLevel;
    const prog = B ? s.progB : s.progA, riff = B ? s.riffB : s.riffA;
    const chord = prog[bar % 4];
    const lastBar = bar === part.bars - 1, nextPart = s.form[sec + 1] || s.form[1];
    const fill = lastBar && step >= 12 && lv >= 1 && nextPart.cap > 0;
    const r = riff[step];

    // drums
    if (lv >= 1) {
      if (fill) this.snare(t, 0.35 + (step - 12) * 0.15);
      else {
        const kick = lv === 2 ? (s.kickFollows ? r === 'X' || (r === 'x' && step % 2 === 0) : 'x.x...x.x.x...x.'[step] === 'x')
          : 'x.......x.x.....'[step] === 'x';
        if (kick) this.kick(t, 1);
        if (step === 4 || step === 12) this.snare(t, 1);
        else if (lv === 2 && B && s.march && '.......g.g....gg'[step] === 'g') this.snare(t, 0.25);
        if (lv === 2) this.hat(t, step % 4 === 2 ? 0.5 : step % 2 ? 0.18 : 0.32, step === 14 && bar % 2);
        else if (step % 2 === 0) this.hat(t, step % 4 ? 0.3 : 0.18, false);
      }
      if (step === 0 && bar === 0 && lv === 2 && sec > 0) this.crash(t);
    } else if (step % 4 === 2) this.hat(t, 0.1, false);

    // bass
    const root = this.note(s, chord, 0, 0);
    if (lv === 2) { if (r !== '.') this.bass(t, root, spb * (r === 'X' ? 1.8 : 0.9), 1); }
    else if (lv === 1) { if (step % 2 === 0) this.bass(t, root, spb * 1.6, 0.9); }
    else if (step === 0) this.bass(t, root, spb * 15, 0.5);

    // guitars
    if (lv === 2 && r !== '.') {
      const n = r === 'X' || r === 'x' ? root : this.note(s, chord, +r, 0);
      this.guitar(t, n, r === 'x' ? spb * 0.9 : spb * (r === 'X' ? 2.6 : 1.8), r === 'x');
    }

    // synths: pad + arpeggio when calm, brass stabs + lead in battle
    const triad = [0, 2, 4].map(k => this.note(s, chord, k, 2));
    if (lv < 2) {
      if (step === 0) this.pad(t, triad, spb * 16);
      const arp = [0, 2, 4, 7, 4, 2, 0, 2][step % 8];
      if (lv === 1 || step % 2 === 0) this.arp(t, this.note(s, chord, arp, 3), spb);
    } else {
      if (step === 0 || (B && step === 10)) this.stab(t, triad, spb * 3);
      if (B) {
        const l = s.lead[(bar % 2) * 16 + step];
        if (l) this.lead(t, this.note(s, chord, l.deg, 3), spb * l.len);
      }
    }
  },

  // ---- instruments ----

  env(g, t, a, peak, dur, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else { g.gain.setValueAtTime(peak, t + Math.max(a, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1); }
  },

  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  kick(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    this.env(g, t, 0.002, 0.9 * v, 0.32);
    o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.35);
    Sfx.hiss(this.drums, 'highpass', 2500, 2500, t, 0.012, 0.25 * v);
  },

  snare(t, v) {
    Sfx.hiss(this.drums, 'bandpass', 1900, 1500, t, 0.2, 0.55 * v, 0.6);
    Sfx.hiss(this.wet, 'bandpass', 2000, 1500, t, 0.15, 0.35 * v, 0.6);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(g, t, 0.001, 0.4 * v, 0.1);
    o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.12);
  },

  hat(t, v, open) { Sfx.hiss(this.drums, 'highpass', 8000, 7000, t, open ? 0.22 : 0.035, 0.22 * v, 0.7, 0.001); },

  crash(t) {
    Sfx.hiss(this.drums, 'highpass', 5000, 3500, t, 1.6, 0.2, 0.5, 0.002);
    Sfx.hiss(this.wet, 'highpass', 4000, 3000, t, 1.2, 0.25, 0.5, 0.002);
  },

  bass(t, m, dur, v) {
    const c = this.ctx, f = this.hz(m), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.3, dur));
    this.env(g, t, 0.005, 0.13 * v, dur, 'hold');
    for (const [type, mul] of [['sawtooth', 1], ['square', 0.5]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f * mul;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.15);
    }
    lp.connect(g); g.connect(this.out);
  },

  guitar(t, m, dur, muted) {
    const c = this.ctx, g = c.createGain();
    this.env(g, t, 0.003, muted ? 0.5 : 0.7, dur, muted ? 'exp' : 'hold');
    // power chord: root, fifth, octave, each doubled slightly out of tune
    for (const [iv, det] of [[0, -6], [0, 7], [7, -4], [7, 5], [12, 0]]) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = this.hz(m + iv); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 0.15);
    }
    if (muted) { // palm mute: darker, chunkier
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      g.connect(lp); lp.connect(this.gtr);
    } else g.connect(this.gtr);
  },

  pad(t, notes, dur) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.3);
    g.gain.setValueAtTime(0.07, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    for (const m of notes) for (const det of [-9, 9]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
    }
    lp.connect(g); g.connect(this.synth);
  },

  arp(t, m, spb) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'square'; o.frequency.value = this.hz(m);
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.env(g, t, 0.003, 0.06, spb * 1.5);
    o.connect(lp); lp.connect(g); g.connect(this.synth); o.start(t); o.stop(t + spb * 1.6);
  },

  stab(t, notes, dur) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    this.env(g, t, 0.01, 0.1, dur);
    for (const m of [...notes, notes[0] - 12]) for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    lp.connect(g); g.connect(this.synth);
  },

  lead(t, m, dur) {
    const c = this.ctx, g = c.createGain(), lp = c.createBiquadFilter(), vib = c.createOscillator(), vg = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(12, t + Math.min(dur, 0.4));
    vib.connect(vg);
    this.env(g, t, 0.02, 0.09, dur, 'hold');
    for (const [type, det] of [['square', -5], ['sawtooth', 6]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = this.hz(m); o.detune.value = det;
      vg.connect(o.detune); o.connect(lp); o.start(t); o.stop(t + dur + 0.2);
    }
    vib.start(t); vib.stop(t + dur + 0.2);
    lp.connect(g); g.connect(this.synth);
  },
};
