/* Last Foxhole: sound effects synthesised with Web Audio, so the app ships no audio files. */
(function (root) {
  'use strict';
  var LL = root.LL, ac = null, master = null, last = {}, noiseBuf = null;
  var A = LL.Audio = { on: true };
  /* browsers and iOS only allow sound after a tap, so this is called from the first button press */
  A.unlock = function () {
    try {
      if (!ac) {
        var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
        ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
    } catch (e) { ac = null; }
  };
  A.suspend = function () { try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) {} };
  function tone(f0, f1, dur, type, vol, delay) {
    var t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    var t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  function arp(notes, step, type, vol) { for (var i = 0; i < notes.length; i++) tone(notes[i], notes[i], step * 1.6, type, vol, i * step); }
  var SFX = {
    hit: [0.06, function () { noise(0.04, 0.05, 2400); }],
    shot: [0.07, function () { noise(0.06, 0.07, 5200); tone(190, 70, 0.05, 'square', 0.03); }],
    kill: [0.05, function () { tone(230, 90, 0.09, 'triangle', 0.07); }],
    gem: [0.04, function () { tone(900 + Math.random() * 500, 1500, 0.06, 'sine', 0.045); }],
    pick: [0.05, function () { tone(520, 1040, 0.14, 'triangle', 0.1); }],
    hurt: [0.15, function () { tone(170, 60, 0.22, 'sawtooth', 0.14); noise(0.12, 0.1, 900); }],
    level: [0.3, function () { arp([523, 659, 784, 1047], 0.07, 'triangle', 0.1); }],
    chest: [0.3, function () { arp([392, 523, 659, 784, 1047, 1319], 0.08, 'triangle', 0.1); }],
    evolve: [0.3, function () { arp([330, 494, 659, 988, 1319], 0.09, 'sawtooth', 0.06); }],
    boss: [1, function () { tone(72, 48, 1.1, 'sawtooth', 0.2); tone(108, 72, 1.1, 'sawtooth', 0.1); }],
    bomb: [0.2, function () { noise(0.55, 0.3, 1400); tone(110, 30, 0.5, 'sine', 0.25); }],
    boom: [0.1, function () { noise(0.25, 0.14, 900); }],
    click: [0.03, function () { tone(440, 520, 0.05, 'triangle', 0.06); }],
    lose: [1, function () { arp([330, 262, 196, 147], 0.2, 'triangle', 0.12); }],
    win: [1, function () { arp([523, 659, 784, 1047, 784, 1047, 1319], 0.12, 'triangle', 0.12); }]
  };
  A.play = function (name) {
    if (!A.on || !ac || ac.state !== 'running') return;
    var s = SFX[name], now = ac.currentTime; if (!s || (last[name] && now - last[name] < s[0])) return;
    last[name] = now; try { s[1](); } catch (e) {}
  };
})(typeof window !== 'undefined' ? window : this);
