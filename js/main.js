// Cold War 2: 2030 — bootstrap, menu, and main loop.
'use strict';

const Main = {
  paused: false, speed: 1, settings: null, running: false,

  init() {
    Sfx.init();
    Music.init(Sfx.ctx, Sfx.musicBus, Sfx.reverb);
    Music.onTrack = title => this.showTrack(title);
    // browsers only allow audio after a click or key press: start the menu music on the first one
    const wake = () => {
      Sfx.resume();
      if (!document.getElementById('menu').hidden) Music.play('menu');
      removeEventListener('pointerdown', wake); removeEventListener('keydown', wake);
    };
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    const params = new URLSearchParams(location.search);
    this.settings = {
      faction: 'usa', enemy: 'random', theater: 'random', difficulty: 'normal',
      mode: 'skirmish', lineup: '1v1', mapSize: 'medium',
      seed: Math.floor(Math.random() * 1e6), speed: 1,
    };
    this.buildMenu();
    if (params.has('autoplay') || params.has('quick')) {
      const p = k => params.get(k) || this.settings[k];
      this.start(Object.assign({}, this.settings, {
        autoplay: params.has('autoplay'),
        faction: p('faction'), enemy: p('enemy'), theater: p('theater'),
        mode: p('mode'), lineup: p('lineup'), mapSize: p('map'), difficulty: p('difficulty'),
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
      card.className = 'faction ' + f.side + (s.faction === id ? ' sel' : '');
      card.style.setProperty('--fc', f.color);
      const special = f.pkg === 'tech' ? 'Railgun Tank · Orbital Lance' : 'Titan Tank · Hypersonic Silo';
      card.innerHTML = `<div class="fhead"><img class="flag" src="${FLAGS[id]}" alt=""><div><div class="fname">${f.name}</div>
        <div class="ftag">${f.tagline.toUpperCase().split(' / ').join(' &nbsp;/&nbsp; ')}</div></div></div>
        <div class="funits">${['tank', 'heli', 'jet'].map(k => `<div class="fu"><img src="assets/cameos/${id}/${k}.webp" alt=""><span>${f.names[k]}</span></div>`).join('')}</div>
        <div class="fbonus">★ ${f.bonusText}</div>
        <div class="fsig">◆ ${nameOf(f.signature, id)} <span>${defOf(f.signature).desc.replace(/^\w+ only\. /, '')}</span></div>
        <div class="fspecial">${SIDES[f.side].name} bloc · ${special}</div>`;
      card.addEventListener('click', () => { s.faction = id; if (s.enemy === id) s.enemy = 'random'; this.buildMenu(); });
      fbox.appendChild(card);
    }
    const opts = (id, entries, key) => {
      const box = document.getElementById(id);
      box.innerHTML = '';
      for (const [v, label] of entries) {
        const b = document.createElement('button');
        b.className = 'opt' + (s[key] === v ? ' sel' : '');
        b.textContent = label;
        b.addEventListener('click', () => { s[key] = v; this.buildMenu(); });
        box.appendChild(b);
      }
    };
    opts('mode', [['skirmish', 'Skirmish'], ['defense', 'Defense']], 'mode');
    opts('lineup', Object.entries(LINEUPS).map(([id, l]) => [id, l.label]), 'lineup');
    opts('mapsize', Object.entries(MAP_SIZES).map(([id, m]) => [id, m.label]), 'mapSize');
    document.getElementById('lineup-box').hidden = s.mode === 'defense';
    document.getElementById('enemy-title').textContent = s.mode === 'defense' ? 'Attacker' : 'Opponent';
    const ebox = document.getElementById('enemy');
    ebox.innerHTML = '';
    for (const id of ['random', ...Object.keys(FACTIONS).filter(k => k !== s.faction)]) {
      const b = document.createElement('button');
      b.className = 'opt eopt' + (s.enemy === id ? ' sel' : '');
      b.innerHTML = id === 'random' ? '<span class="rnd">?</span>Random' : `<img src="${FLAGS[id]}" alt="">${FACTIONS[id].name}`;
      b.addEventListener('click', () => { s.enemy = id; this.buildMenu(); });
      ebox.appendChild(b);
    }
    const tbox = document.getElementById('theaters');
    tbox.innerHTML = '';
    for (const id of ['random', ...Object.keys(THEATERS)]) {
      const b = document.createElement('button');
      b.className = 'theater' + (s.theater === id ? ' sel' : '');
      if (id === 'random') b.innerHTML = '<div class="tpic rnd">?</div><span>Random</span>';
      else b.innerHTML = `<div class="tpic" style="background-image:url(assets/terrain/${THEATERS[id].art}.webp)"></div><span>${THEATERS[id].name}</span>`;
      b.addEventListener('click', () => { s.theater = id; this.buildMenu(); });
      tbox.appendChild(b);
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
    const abox = document.getElementById('audio');
    abox.innerHTML = '';
    for (const [key, label] of [['music', 'Music'], ['sfx', 'Effects'], ['voice', 'Voices']]) {
      const row = document.createElement('label');
      row.innerHTML = `<span>${label}</span><input type="range" min="0" max="100" value="${Math.round(Sfx.vol[key] * 100)}">`;
      row.querySelector('input').addEventListener('input', e => {
        Sfx.resume(); Sfx.setVolume(key, e.target.value / 100);
        if (key === 'sfx') Sfx.play('click');
      });
      abox.appendChild(row);
    }
    const seed = document.getElementById('seed');
    seed.value = s.seed;
    seed.onchange = () => { s.seed = parseInt(seed.value, 10) || 1; };
    document.getElementById('reroll').onclick = () => { s.seed = Math.floor(Math.random() * 1e6); seed.value = s.seed; };
    document.getElementById('start').onclick = () => { Sfx.resume(); this.start(Object.assign({}, s)); };
  },

  start(opts) {
    this.opts = opts;
    if (!THEATERS[opts.theater]) {
      const ids = Object.keys(THEATERS);
      opts = Object.assign({}, opts, { theater: ids[Math.floor(Math.random() * ids.length)] });
    }
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
    Sfx.ambience(opts.theater);
    Music.play('game');
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
        Music.update(dt, G.heat);
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
    Music.mode = 'end';
    const el = document.getElementById('end');
    const teams = G.teams, W = G.waves;
    const mins = Math.floor(G.over.time / 60), secs = Math.floor(G.over.time % 60);
    const row = (label, k) => `<tr><td>${label}</td>${teams.map(t => `<td>${Math.round(t.stats[k])}</td>`).join('')}</tr>`;
    const text = W ? (G.over.win ? `All ${W.total} waves repelled. The base holds.` : `The base fell during wave ${W.wave} of ${W.total}.`) :
      G.over.win ? 'The enemy has been eliminated. The region is secure.' : 'Our forces have been wiped out. Command has been lost.';
    el.innerHTML = `<div class="endbox ${G.over.win ? 'win' : 'lose'}">
      <h1>${G.over.win ? 'VICTORY' : 'DEFEAT'}</h1>
      <p>${text}</p>
      <p class="time">Mission time ${mins}:${String(secs).padStart(2, '0')}</p>
      <table><tr><th></th>${teams.map(t => `<th style="color:${t.color}">${t.name}${t.id !== G.player && G.allied(t.id, G.player) ? ' (ally)' : ''}</th>`).join('')}</tr>
      ${row('Units built', 'built')}
      ${row('Units lost', 'lost')}
      ${row('Kills', 'kills')}
      ${row('Structures built', 'structuresBuilt')}
      ${row('Structures destroyed', 'structuresKilled')}
      ${row('Credits harvested', 'harvested')}
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
    Sfx.stopAmbience();
    Music.play('menu');
    this.buildMenu();
  },

  // "now playing" card, like the radio in the old games
  showTrack(title) {
    const el = document.getElementById('track');
    el.innerHTML = `<small>NOW PLAYING</small>♫ ${title}`;
    el.hidden = false; el.classList.remove('fade'); void el.offsetWidth; el.classList.add('fade');
    clearTimeout(this.trackT);
    this.trackT = setTimeout(() => { el.hidden = true; }, 6000);
  },
};

window.addEventListener('load', () => Main.init());
