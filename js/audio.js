// ColdWarning — synthesized sound effects and announcer voice.
'use strict';

const Sfx = {
  ctx: null, muted: false, voice: true, last: {},

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  tone(type, f0, f1, dur, vol) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },

  burst(dur, vol, freq, q = 1) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.2), t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name, vol = 1) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const gap = { gun: 60, flak: 80, pop: 50, cannon: 70, rocket: 70, boom: 90, rail: 100 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'gun': this.burst(0.06, 0.25 * vol, 3000); break;
      case 'flak': this.burst(0.08, 0.3 * vol, 2000); this.tone('square', 300, 100, 0.05, 0.05 * vol); break;
      case 'cannon': this.burst(0.25, 0.6 * vol, 900); this.tone('sine', 120, 40, 0.2, 0.3 * vol); break;
      case 'rocket': this.burst(0.35, 0.25 * vol, 1800, 3); break;
      case 'rail': this.tone('sawtooth', 1800, 200, 0.25, 0.12 * vol); this.tone('sine', 90, 40, 0.3, 0.3 * vol); break;
      case 'pop': this.burst(0.2, 0.35 * vol, 1200); break;
      case 'boom': this.burst(0.9, 0.8 * vol, 700); this.tone('sine', 80, 25, 0.7, 0.5 * vol); break;
      case 'crush': this.burst(0.12, 0.3 * vol, 500); break;
      case 'click': this.tone('square', 900, 700, 0.04, 0.06); break;
      case 'ack': this.tone('square', 600, 900, 0.06, 0.05); break;
      case 'ready': this.tone('sine', 660, 990, 0.12, 0.12); break;
      case 'place': this.burst(0.3, 0.4, 400); this.tone('square', 200, 120, 0.15, 0.08); break;
      case 'sell': this.tone('triangle', 900, 400, 0.2, 0.1); break;
      case 'capture': this.tone('square', 400, 800, 0.25, 0.1); break;
      case 'siren': {
        for (let i = 0; i < 3; i++) setTimeout(() => this.tone('sawtooth', 500, 900, 0.45, 0.08), i * 500);
        break;
      }
      case 'error': this.tone('square', 200, 150, 0.15, 0.08); break;
    }
  },

  say(text) {
    if (this.muted || !this.voice || !window.speechSynthesis) return;
    try {
      if (speechSynthesis.speaking && speechSynthesis.pending) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05; u.pitch = 0.75; u.volume = 0.8;
      const vs = speechSynthesis.getVoices();
      const v = vs.find(v => /female|zira|samantha|google uk english female/i.test(v.name)) || vs.find(v => v.lang && v.lang.startsWith('en'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  },
};
