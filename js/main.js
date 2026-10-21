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
      mode: 'skirmish', lineup: '1v1', mapSize: 'medium', water: 'lakes',
      seed: Math.floor(Math.random() * 1e6), speed: 1, mission: null,
    };
    this.buildMenu();
    document.getElementById('load-game').onclick = () => { Sfx.resume(); this.openSaves('load'); };
    document.getElementById('p-resume').onclick = () => this.togglePause();
    document.getElementById('p-save').onclick = () => this.openSaves('save');
    document.getElementById('p-load').onclick = () => this.openSaves('load');
    document.getElementById('p-quit').onclick = () => { this.paused = false; this.toMenu(); };
    if (params.has('mission') && missionDef(params.get('mission'))) {
      // straight into a campaign mission (handy for testing)
      this.settings.difficulty = DIFFICULTY[params.get('difficulty')] ? params.get('difficulty') : 'normal';
      this.startMission(params.get('mission'));
    } else if (params.has('autoplay') || params.has('quick')) {
      const p = k => params.get(k) || this.settings[k];
      this.start(Object.assign({}, this.settings, {
        autoplay: params.has('autoplay'),
        faction: p('faction'), enemy: p('enemy'), theater: p('theater'),
        mode: p('mode'), lineup: p('lineup'), mapSize: p('map'), water: p('water'), difficulty: p('difficulty'),
        seed: params.has('seed') ? +params.get('seed') : this.settings.seed,
        speed: params.has('speed') ? +params.get('speed') : 1,
      }));
    }
  },

  buildMenu() {
    const s = this.settings;
    const fbox = document.getElementById('factions');
    fbox.innerHTML = '';
    // Allies first, then the Axis, each under its own heading
    const brief = key => defOf(key).desc.replace(/^[\w ]+ only\. /, '');
    for (const [id, f] of Object.entries(FACTIONS).sort((a, b) => (a[1].side === 'allies' ? 0 : 1) - (b[1].side === 'allies' ? 0 : 1))) {
      if (!fbox.querySelector('.fside.' + f.side)) {
        const h = document.createElement('div');
        h.className = 'fside ' + f.side;
        h.innerHTML = `<b>${SIDES[f.side].name}</b> · ${SIDES[f.side].tagline}`;
        fbox.appendChild(h);
      }
      const card = document.createElement('button');
      card.className = 'faction ' + f.side + (s.faction === id ? ' sel' : '');
      card.style.setProperty('--fc', f.color);
      const special = f.pkg === 'tech' ? 'Railgun Tank · Orbital Lance' : 'Titan Tank · Hypersonic Silo';
      card.innerHTML = `<div class="fhead"><img class="flag" src="${FLAGS[id]}" alt=""><div><div class="fname">${f.name}</div>
        <div class="ftag">${f.tagline.toUpperCase().split(' / ').join(' &nbsp;/&nbsp; ')}</div></div></div>
        <div class="funits">${['tank', 'heli', 'jet'].map(k => `<div class="fu"><img src="assets/cameos/${cameoFaction(id)}/${k}.webp" alt=""><span>${f.names[k]}</span></div>`).join('')}</div>
        <div class="fbonus">★ ${f.bonusText}</div>
        <div class="fsig">◆ ${nameOf(f.signature, id)} <span>${brief(f.signature)}</span></div>
        <div class="fsig">■ ${nameOf(f.edge, id)} <span>${brief(f.edge)}</span></div>
        <div class="fspecial">${SIDES[f.side].name} · ${special}</div>`;
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
    opts('mode', [['skirmish', 'Skirmish'], ['defense', 'Defense'], ['campaign', 'Campaign']], 'mode');
    const camp = s.mode === 'campaign';
    for (const id of ['faction-box', 'mapsize-box', 'water-box', 'skirmish-row', 'seed-box']) document.getElementById(id).hidden = camp;
    document.getElementById('campaign').hidden = !camp;
    if (camp) this.buildCampaign();
    opts('lineup', Object.entries(LINEUPS).map(([id, l]) => [id, l.label]), 'lineup');
    opts('mapsize', Object.entries(MAP_SIZES).map(([id, m]) => [id, m.label]), 'mapSize');
    opts('water', Object.entries(MAP_WATER).map(([id, m]) => [id, m.label]), 'water');
    document.getElementById('lineup-box').hidden = s.mode !== 'skirmish';
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
    document.getElementById('start').onclick = () => {
      Sfx.resume();
      if (camp) this.startMission(s.mission); else this.start(Object.assign({}, s));
    };
  },

  // mission list on the left, the selected mission's briefing on the right
  buildCampaign() {
    const s = this.settings, list = CAMPAIGN.missions;
    if (!s.mission || !list.some((m, i) => m.id === s.mission && CampaignProgress.unlocked(i))) {
      // default to the first mission not yet won
      const i = list.findIndex((m, k) => CampaignProgress.unlocked(k) && !CampaignProgress.record(m.id));
      s.mission = list[i >= 0 ? i : 0].id;
    }
    const box = document.getElementById('c-missions');
    box.innerHTML = '';
    list.forEach((m, i) => {
      const open = CampaignProgress.unlocked(i), rec = CampaignProgress.record(m.id);
      const b = document.createElement('button');
      b.className = 'cm' + (s.mission === m.id ? ' sel' : '') + (open ? '' : ' locked');
      b.innerHTML = `<div class="cm-pic" style="background-image:url(assets/terrain/${THEATERS[m.theater].art}.webp)"><span>${i + 1}</span></div>
        <div class="cm-text"><div class="cm-title">${m.title}</div><div class="cm-place">${m.place} · ${m.date}</div>
        <div class="cm-status">${rec ? '✓ Completed · ' + this.clock(rec.time) : open ? 'Ready' : '🔒 Win the previous mission'}</div></div>`;
      if (open) b.addEventListener('click', () => { s.mission = m.id; this.buildMenu(); });
      box.appendChild(b);
    });
    const m = missionDef(s.mission), you = m.teams[0];
    const side = (pred) => m.teams.filter(pred).map(t => `<span class="c-side"><img src="${FLAGS[t.faction]}" alt="">${t.name || FACTIONS[t.faction].name}</span>`).join('');
    const allies = side((t, i) => i > 0 && t.ally === you.ally), foes = side(t => t.ally !== you.ally);
    document.getElementById('c-brief').innerHTML = `<div class="cb-head"><div class="cb-title">${m.title}</div><div class="cb-place">${m.place} · ${m.date} · ${THEATERS[m.theater].name}, ${MAP_SIZES[m.map].label.toLowerCase()} map</div></div>
      <div class="cb-sides"><span class="c-lbl">You</span><span class="c-side"><img src="${FLAGS[you.faction]}" alt="">${FACTIONS[you.faction].name}</span>
        ${allies ? '<span class="c-lbl">With</span>' + allies : ''}<span class="c-lbl">Against</span>${foes}</div>
      ${m.briefing.map(p => `<p>${p}</p>`).join('')}
      <h4>Objectives</h4><ul class="cb-goals">${m.goals.map(g => `<li>${g}</li>`).join('')}</ul>
      <div class="cb-feat">◆ ${m.features}</div>`;
  },

  clock(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); },

  startMission(id) {
    const m = missionDef(id), s = this.settings;
    if (!m) return;
    s.mode = 'campaign'; s.mission = id;
    this.start({ mission: id, faction: m.teams[0].faction, theater: m.theater, mapSize: m.map, seed: m.seed, difficulty: s.difficulty, speed: s.speed });
  },

  start(opts) {
    this.opts = opts;
    if (!THEATERS[opts.theater]) {
      const ids = Object.keys(THEATERS);
      opts = Object.assign({}, opts, { theater: ids[Math.floor(Math.random() * ids.length)] });
    }
    new Game(opts);
    this.enter();
  },

  // show the battle in G: a new one, or one just loaded (cam = where the camera was when saved)
  enter(cam) {
    const opts = G.opts;
    if (cam) this.opts = opts;
    document.getElementById('menu').hidden = true;
    document.getElementById('game').hidden = false;
    document.getElementById('end').hidden = true;
    document.getElementById('pause-overlay').hidden = true;
    this.closeDialog();
    G.map.renderTerrain();
    Render.init();
    this.speed = opts.speed || 1;
    this.paused = false;
    this.endShown = false;
    this.autoT = 0;
    UI.init(document.getElementById('view'));
    if (cam) { UI.cam.x = cam.x; UI.cam.y = cam.y; UI.clampCam(); } else if (G.mission && G.mission.focus) UI.centerOn(...G.mission.focus);
    G.eva(cam ? 'Battle control restored' : 'Battle control online', G.player);
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
    if (!this.paused) this.closeDialog();
  },

  // ---------- save / load ----------
  // the slot list, for saving (from the pause menu) or loading (pause menu or main menu)
  openSaves(mode, msg) {
    const box = document.getElementById('saves');
    const slots = Save.slots.filter(s => mode === 'load' || s !== 'auto');
    const when = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    box.innerHTML = `<div class="svbox"><h2>${mode === 'save' ? 'SAVE GAME' : 'LOAD GAME'}</h2>
      ${slots.map(slot => {
        const i = Save.info(slot);
        const go = mode === 'save' || i;
        return `<div class="sv-slot${i ? '' : ' empty'}${go ? ' go' : ''}" data-slot="${slot}">
          <div class="sv-flag">${i && FLAGS[i.faction] ? `<img src="${FLAGS[i.faction]}" alt="">` : ''}</div>
          <div class="sv-text"><div class="sv-name">${Save.slotName(slot)}${i ? ' · ' + i.what : ''}</div>
          <div class="sv-sub">${i ? `${THEATERS[i.theater] ? THEATERS[i.theater].name + ' · ' : ''}${this.clock(i.time)} played · saved ${when(i.at)}` : 'Empty'}</div></div>
          ${i ? `<button class="sv-del" data-del="${slot}" title="Delete this save">✕</button>` : ''}</div>`;
      }).join('')}
      <p class="sv-msg${msg && msg.err ? ' err' : ''}">${msg ? msg.text : ''}</p>
      <div class="sv-actions"><button id="sv-close">Back</button></div></div>`;
    box.hidden = false;
    box.querySelector('#sv-close').onclick = () => this.closeDialog();
    box.querySelectorAll('.sv-del').forEach(b => b.onclick = e => {
      e.stopPropagation();
      Save.remove(b.dataset.del);
      this.openSaves(mode, { text: Save.slotName(b.dataset.del) + ' deleted.' });
    });
    box.querySelectorAll('.sv-slot.go').forEach(el => el.onclick = async () => {
      const slot = el.dataset.slot;
      try {
        if (mode === 'save') { await Save.saveTo(slot); this.openSaves('save', { text: 'Saved to ' + Save.slotName(slot) + '.' }); }
        else await this.loadSlot(slot);
      } catch (err) { this.openSaves(mode, { text: err.message, err: true }); }
    });
  },

  closeDialog() { document.getElementById('saves').hidden = true; },

  async loadSlot(slot) {
    const r = await Save.loadFrom(slot);
    if (r.removed) G.eva(r.removed + ' units no longer in the game were left out', G.player);
  },

  async quickSave() {
    if (!Save.canSave()) return;
    try { await Save.saveTo('quick'); G.eva('Game saved', G.player); } catch (err) { G.eva(err.message, G.player); }
  },

  async quickLoad() {
    if (!Save.info('quick')) { if (G) G.eva('No quicksave yet', G.player); return; }
    try { await this.loadSlot('quick'); } catch (err) { if (G) G.eva(err.message, G.player); }
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
        // autosave every five minutes of play
        this.autoT += steps * TICK;
        if (this.autoT >= 300 && !G.over && !G.opts.autoplay) { this.autoT = 0; Save.saveTo('auto').catch(() => {}); }
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
    G.sampleStats();
    const row = (label, k) => `<tr><td>${label}</td>${teams.map(t => `<td>${Math.round(t.stats[k] || 0).toLocaleString()}</td>`).join('')}</tr>`;
    const top = t => {
      const [key] = Object.entries(t.stats.made || {}).sort((a, b) => b[1] - a[1])[0] || [];
      return key && defOf(key) ? `${nameOf(key, t.faction)} ×${t.stats.made[key]}` : '–';
    };
    const M = G.mission;
    const text = M ? G.over.text : W ? (G.over.win ? `All ${W.total} waves repelled. The base holds.` : `The base fell during wave ${W.wave} of ${W.total}.`) :
      G.over.win ? 'The enemy has been eliminated. The region is secure.' : 'Our forces have been wiped out. Command has been lost.';
    const goals = M ? `<ul class="end-goals">${M.objectives.map(o => `<li class="${o.state}${o.optional ? ' bonus' : ''}">${o.text}${o.optional ? ' <i>(bonus)</i>' : ''}</li>`).join('')}</ul>` : '';
    const next = M && G.over.win ? CAMPAIGN.missions[CAMPAIGN.missions.findIndex(m => m.id === M.def.id) + 1] : null;
    const buttons = !M ? '<button id="again">Play again</button><button id="tomenu">Main menu</button>' :
      (next ? '<button id="next">Next mission</button>' : '') + `<button id="again">${G.over.win ? 'Play again' : 'Retry'}</button><button id="tomenu">Campaign</button>`;
    el.innerHTML = `<div class="endbox ${G.over.win ? 'win' : 'lose'}">
      <h1>${M ? (G.over.win ? 'MISSION ACCOMPLISHED' : 'MISSION FAILED') : G.over.win ? 'VICTORY' : 'DEFEAT'}</h1>
      ${M ? `<div class="end-mission">${M.def.title}</div>` : ''}
      <p>${text}</p>${M && G.over.win && !next ? '<p class="end-fin">Operation Northwind complete. Thank you for playing the campaign.</p>' : ''}${goals}
      <p class="time">Mission time ${mins}:${String(secs).padStart(2, '0')}</p>
      <table><tr><th></th>${teams.map(t => `<th style="color:${t.color}">${t.name}${t.id !== G.player && G.allied(t.id, G.player) ? ' (ally)' : ''}</th>`).join('')}</tr>
      ${row('Units built', 'built')}
      ${row('Units lost', 'lost')}
      ${row('Kills', 'kills')}
      ${row('Structures built', 'structuresBuilt')}
      ${row('Structures destroyed', 'structuresKilled')}
      ${row('Structures lost', 'structuresLost')}
      ${row('Credits harvested', 'harvested')}
      ${row('Credits spent', 'spent')}
      <tr><td>Most built</td>${teams.map(t => `<td>${top(t)}</td>`).join('')}</tr>
      </table>${this.armyChart(teams)}
      <div class="endbtns">${buttons}</div></div>`;
    el.hidden = false;
    document.getElementById('again').onclick = () => this.start(M ? Object.assign({}, this.opts) : Object.assign({}, this.opts, { seed: Math.floor(Math.random() * 1e6) }));
    if (next) document.getElementById('next').onclick = () => { this.settings.mission = next.id; this.toMenu(); };
    document.getElementById('tomenu').onclick = () => this.toMenu();
  },

  // line chart of each team's army value over the match (sampled in Game.sampleStats)
  armyChart(teams) {
    const n = Math.max(...teams.map(t => (t.stats.army || []).length));
    if (n < 3) return '';
    const W = 520, H = 130, L = 46, B = 18, max = Math.max(1000, ...teams.flatMap(t => t.stats.army || []));
    const x = i => L + i / (n - 1) * (W - L - 6), y = v => 6 + (1 - v / max) * (H - B - 6);
    const lines = teams.map(t => {
      const pts = (t.stats.army || []).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${t.color}" stroke-width="2" stroke-linejoin="round"/>`;
    }).join('');
    const span = (n - 1) * STATS_EVERY, ticks = [0, 0.5, 1].map(f => `<text x="${x(f * (n - 1))}" y="${H - 3}" text-anchor="${f ? f < 1 ? 'middle' : 'end' : 'start'}">${this.clock(f * span)}</text>`).join('');
    const k = v => v >= 1000 ? Math.round(v / 1000) + 'k' : v;
    return `<div class="end-chart"><div class="end-chart-t">Army value over time</div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <line x1="${L}" y1="${y(0)}" x2="${W - 6}" y2="${y(0)}" class="ax"/><line x1="${L}" y1="${y(max)}" x2="${W - 6}" y2="${y(max)}" class="grid"/>
      <text x="${L - 6}" y="${y(max) + 4}" text-anchor="end">$${k(max)}</text><text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text>
      ${ticks}${lines}</svg></div>`;
  },

  toMenu() {
    this.closeDialog();
    document.getElementById('pause-overlay').hidden = true;
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
