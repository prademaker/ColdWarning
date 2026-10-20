// ColdWarning — bootstrap, menu, and main loop.
'use strict';

const Main = {
  paused: false, speed: 1, settings: null, running: false,

  init() {
    Sfx.init();
    const params = new URLSearchParams(location.search);
    this.settings = {
      faction: 'coalition', difficulty: 'normal',
      seed: Math.floor(Math.random() * 1e6), speed: 1,
    };
    this.buildMenu();
    if (params.has('autoplay') || params.has('quick')) {
      this.start(Object.assign({}, this.settings, {
        autoplay: params.has('autoplay'),
        seed: params.has('seed') ? +params.get('seed') : this.settings.seed,
        speed: params.has('speed') ? +params.get('speed') : 1,
      }));
    }
  },

  buildMenu() {
    const s = this.settings;
    const fbox = document.getElementById('factions');
    fbox.innerHTML = '';
    for (const [id, f] of Object.entries(FACTIONS)) {
      const card = document.createElement('button');
      card.className = 'faction' + (s.faction === id ? ' sel' : '');
      card.style.setProperty('--fc', f.color);
      card.innerHTML = `<div class="fname">${f.name}</div><div class="fblurb">${f.blurb}</div>`;
      card.addEventListener('click', () => { s.faction = id; this.buildMenu(); });
      fbox.appendChild(card);
    }
    const dbox = document.getElementById('difficulty');
    dbox.innerHTML = '';
    for (const [id, d] of Object.entries(DIFFICULTY)) {
      const b = document.createElement('button');
      b.className = 'opt' + (s.difficulty === id ? ' sel' : '');
      b.textContent = d.label;
      b.addEventListener('click', () => { s.difficulty = id; this.buildMenu(); });
      dbox.appendChild(b);
    }
    const sbox = document.getElementById('speed');
    sbox.innerHTML = '';
    for (const [v, label] of [[0.75, 'Slow'], [1, 'Normal'], [1.5, 'Fast']]) {
      const b = document.createElement('button');
      b.className = 'opt' + (s.speed === v ? ' sel' : '');
      b.textContent = label;
      b.addEventListener('click', () => { s.speed = v; this.buildMenu(); });
      sbox.appendChild(b);
    }
    const seed = document.getElementById('seed');
    seed.value = s.seed;
    seed.onchange = () => { s.seed = parseInt(seed.value, 10) || 1; };
    document.getElementById('reroll').onclick = () => { s.seed = Math.floor(Math.random() * 1e6); seed.value = s.seed; };
    document.getElementById('start').onclick = () => { Sfx.resume(); this.start(Object.assign({}, s)); };
  },

  start(opts) {
    this.opts = opts;
    document.getElementById('menu').hidden = true;
    document.getElementById('game').hidden = false;
    document.getElementById('end').hidden = true;
    document.getElementById('pause-overlay').hidden = true;
    new Game(opts);
    G.map.renderTerrain();
    Render.init();
    this.speed = opts.speed || 1;
    this.paused = false;
    UI.init(document.getElementById('view'));
    G.eva('Battle control online', G.player);
    if (!this.running) {
      this.running = true;
      this.last = performance.now(); this.acc = 0;
      requestAnimationFrame(t => this.frame(t));
    }
  },

  togglePause() {
    if (!G || G.over) return;
    this.paused = !this.paused;
    document.getElementById('pause-overlay').hidden = !this.paused;
  },

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (G && !document.getElementById('game').hidden) {
      if (!this.paused && !G.over) {
        this.acc += dt * this.speed;
        let steps = 0;
        while (this.acc >= TICK && steps < 8) { G.update(TICK); this.acc -= TICK; steps++; }
        if (steps >= 8) this.acc = 0;
      }
      UI.update(dt);
      Render.draw(UI.ctx, UI.cam, UI);
      UI.drawMinimap();
      if (G.over && !this.endShown) this.showEnd();
      if (!G.over) this.endShown = false;
    }
    requestAnimationFrame(t => this.frame(t));
  },

  showEnd() {
    this.endShown = true;
    const el = document.getElementById('end');
    const p = G.playerTeam, e = G.teams.find(t => t.id !== G.player);
    const mins = Math.floor(G.over.time / 60), secs = Math.floor(G.over.time % 60);
    const row = (label, a, b) => `<tr><td>${label}</td><td>${Math.round(a)}</td><td>${Math.round(b)}</td></tr>`;
    el.innerHTML = `<div class="endbox ${G.over.win ? 'win' : 'lose'}">
      <h1>${G.over.win ? 'VICTORY' : 'DEFEAT'}</h1>
      <p>${G.over.win ? 'The enemy has been eliminated. The region is secure.' : 'Our forces have been wiped out. Command has been lost.'}</p>
      <p class="time">Mission time ${mins}:${String(secs).padStart(2, '0')}</p>
      <table><tr><th></th><th style="color:${p.color}">${p.name}</th><th style="color:${e.color}">${e.name}</th></tr>
      ${row('Units built', p.stats.built, e.stats.built)}
      ${row('Units lost', p.stats.lost, e.stats.lost)}
      ${row('Kills', p.stats.kills, e.stats.kills)}
      ${row('Structures built', p.stats.structuresBuilt, e.stats.structuresBuilt)}
      ${row('Structures destroyed', p.stats.structuresKilled, e.stats.structuresKilled)}
      ${row('Credits harvested', p.stats.harvested, e.stats.harvested)}
      </table>
      <div class="endbtns"><button id="again">Play again</button><button id="tomenu">Main menu</button></div></div>`;
    el.hidden = false;
    document.getElementById('again').onclick = () => this.start(Object.assign({}, this.opts, { seed: Math.floor(Math.random() * 1e6) }));
    document.getElementById('tomenu').onclick = () => this.toMenu();
  },

  toMenu() {
    document.getElementById('game').hidden = true;
    document.getElementById('menu').hidden = false;
    document.getElementById('end').hidden = true;
    if (window.speechSynthesis) speechSynthesis.cancel();
    this.buildMenu();
  },
};

window.addEventListener('load', () => Main.init());
