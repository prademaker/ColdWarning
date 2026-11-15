/* Last Foxhole: input, screens, save data and the frame loop. */
(function () {
  'use strict';
  var LL = window.LL, D = LL.DATA, A = LL.Audio, P = LL.Progress, $ = function (id) { return document.getElementById(id); };

  /* ---- save data: lives on the device only, nothing is sent anywhere */
  var save = { coins: 0, up: {}, best: 0, wins: 0, sound: true, gore: true, cls: 'rifleman' };
  try { var raw = JSON.parse(localStorage.getItem('ll.save') || '{}'); for (var k in raw) save[k] = raw[k]; } catch (e) {}
  P.defaults(save);
  function persist() { try { localStorage.setItem('ll.save', JSON.stringify(save)); } catch (e) {} }

  var game = new LL.Game(), view = new LL.Renderer($('stage')), skin = LL.SKINS.real, state = 'menu';
  var input = { x: 0, y: 0 }, keys = {}, touch = null, buildKey = '';
  (function () {
    var s = document.documentElement.style, u = skin.ui;
    ['text', 'dim', 'panel', 'accent', 'hp', 'xp', 'track', 'edge', 'font'].forEach(function (n) { s.setProperty('--' + n, u[n]); });
    s.setProperty('--bg', skin.bg);
  })();
  function icon(id, colKey) { return LL.iconURL(id, LL.col(skin, colKey)); }
  var portraits = {};
  function portrait(cls) { return portraits[cls] || (portraits[cls] = LL.heroSprite(cls, 96).toDataURL()); }

  /* ---- settings */
  function setSound(on) { save.sound = A.on = on; persist(); $('soundBtn').textContent = $('soundBtn2').textContent = 'Sound: ' + (on ? 'on' : 'off'); }
  [$('soundBtn'), $('soundBtn2')].forEach(function (b) { b.addEventListener('click', function () { A.unlock(); setSound(!save.sound); A.play('click'); }); });
  setSound(save.sound !== false);
  /* blood can be switched off; wrecks and explosions stay */
  function setGore(on) { save.gore = game.gore = on; persist(); $('goreBtn').textContent = $('goreBtn2').textContent = 'Blood and gore: ' + (on ? 'on' : 'off'); }
  [$('goreBtn'), $('goreBtn2')].forEach(function (b) { b.addEventListener('click', function () { A.unlock(); setGore(!save.gore); A.play('click'); }); });
  setGore(save.gore !== false);
  document.addEventListener('pointerdown', A.unlock, { passive: true });

  /* ---- screens */
  var SCREENS = ['menu', 'classes', 'shop', 'record', 'levelup', 'chest', 'pause', 'over'];
  function show(next) {
    state = next;
    SCREENS.forEach(function (id) { $(id).hidden = id !== next; });
    $('hud').hidden = next === 'menu' || next === 'shop' || next === 'classes' || next === 'record';
    if (next !== 'play') endTouch();
    if (next !== 'play' && next !== 'pause') $(next).scrollTop = 0;
  }
  function clock(t) { t = Math.floor(t); return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
  function num(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+$)/g, ','); }
  function start(cls) {
    A.unlock(); A.play('click');
    if (D.classes[cls] && P.unlocked(save, 'classes', cls)) save.cls = cls;
    if (!P.unlocked(save, 'classes', save.cls)) save.cls = 'rifleman';
    persist();
    game.reset(save.up, save.cls, P.runOptions(save, save.cls)); buildKey = ''; $('bossbar').hidden = true; $('banner').hidden = true;
    if (game.night > 1) banner('Night ' + game.night);
    show('play');
  }
  function resume() { if (game.over) return finish(); if (game.pending > 0) return levelUp(); if (game.chests > 0) return openChest(); show('play'); }

  function card(c, tag) {
    var b = document.createElement(tag || 'button'); if (!tag) b.type = 'button';
    b.className = 'card' + (c.isEvo ? ' evo' : '') + (c.cls ? ' ' + c.cls : '');
    b.innerHTML = '<img alt=""><span class="nm"></span><span class="lv"></span><span class="tx"></span>';
    b.children[0].src = c.img || icon(c.icon || c.id, c.col);
    b.children[1].textContent = c.name; b.children[2].textContent = c.tagText || (c.isEvo ? 'FINAL FORM' : c.isNew ? 'NEW' : c.lvl ? 'LV ' + c.lvl : ''); b.children[3].textContent = c.text;
    if (c.bar != null) { var m = document.createElement('span'); m.className = 'mbar'; m.innerHTML = '<i style="width:' + Math.round(c.bar * 100) + '%"></i>'; b.appendChild(m); }
    return b;
  }
  function line(html) { var d = document.createElement('div'); d.className = 'line'; d.innerHTML = html; return d; }
  function rankBar(nameEl, fillEl, noteEl) {
    var r = P.rank(save);
    $(nameEl).textContent = r.name; $(fillEl).style.width = (r.need ? r.into / r.need * 100 : 100) + '%';
    $(noteEl).textContent = r.need ? num(r.into) + ' / ' + num(r.need) + ' service XP' : 'Highest rank';
    return r;
  }

  function levelUp() {
    var box = $('cards'); box.textContent = '';
    game.choices().forEach(function (c) {
      var b = card(c);
      b.addEventListener('click', function () { A.play(c.isEvo ? 'evolve' : 'click'); game.take(c); game.pending--; resume(); });
      box.appendChild(b);
    });
    $('rerollBtn').textContent = 'Reroll (' + game.rerolls + ' left)'; $('rerollBtn').disabled = game.rerolls <= 0;
    if (state !== 'levelup') A.play('level');
    show('levelup');
  }
  $('rerollBtn').addEventListener('click', function () { if (game.rerolls > 0) { game.rerolls--; A.play('click'); levelUp(); } });
  function openChest() {
    var box = $('loot'); box.textContent = ''; game.chests--;
    var got = game.openChest(), evo = false;
    got.forEach(function (c) { if (c.isEvo) evo = true; box.appendChild(card(c, 'div')); });
    A.play(evo ? 'evolve' : 'chest'); show('chest');
  }
  $('chestBtn').addEventListener('click', function () { A.play('click'); resume(); });

  function chip(o) { return '<span class="chip' + (o.evo ? ' evo' : '') + '"><img alt="" src="' + icon(o.id, o.def.col) + '">' + (o.evo ? o.def.evo.name : o.def.name + ' ' + o.lvl) + '</span>'; }
  function pause() { if (state !== 'play') return; $('loadout').innerHTML = game.weapons.concat(game.passives).map(chip).join(''); show('pause'); }

  /* ---- end of a run: bank scrap and service XP, then the debrief */
  function finish(quit) {
    var c = Math.floor(game.coins); game.coins = 0; save.coins += c;
    var rec = game.t > save.best; if (rec) save.best = Math.floor(game.t);
    if (game.won) save.wins++;
    var out = P.finish(save, game, c);
    persist();
    $('overTitle').textContent = game.won ? 'Relief arrives at dawn' : quit ? 'Withdrawn' : 'Position overrun';
    $('summary').innerHTML = (game.won ? 'You held the line for <b>' : 'Held out for <b>') + clock(game.t) + '</b>' + (rec && !game.won ? ' (new best)' : '') +
      '<br>' + game.cls.name + (game.night > 1 ? ' · Night ' + game.night : '') + ' · level ' + game.lvl + '<br>' + num(game.kills) + ' enemies down · ' + c + ' scrap · +' + num(out.xp) + ' service XP';
    rankBar('overRank', 'overFill', 'overNote');
    var box = $('debrief'); box.textContent = '';
    out.ranks.forEach(function (n) { box.appendChild(line('<b>Promoted</b> to ' + n)); });
    out.unlocks.forEach(function (u) { box.appendChild(line('<b>Unlocked</b> ' + u)); });
    if (out.night) box.appendChild(line('<b>Unlocked</b> Night ' + out.night + ': a harder fight with better pay'));
    if (out.mastery) box.appendChild(line('<b>' + game.cls.name + ' mastery ' + out.mastery + '</b> ' + out.perks.join(', ')));
    out.medals.forEach(function (m) { box.appendChild(line('<b>Medal: ' + m.name + '</b> ' + m.desc + ' +' + m.scrap + ' scrap')); });
    A.play(game.won ? 'win' : out.ranks.length || out.medals.length ? 'chest' : 'lose'); show('over');
  }
  function menu() {
    var r = rankBar('rankName', 'rankFill', 'rankNote'), nxt = r.idx < P.RANKS.length - 1 ? P.unlocksAt(r.idx + 1) : [];
    if (nxt.length) $('rankNote').textContent += ' · next: ' + nxt[0].replace(/^\w+: /, '');
    $('shopBtn').textContent = 'Quartermaster (' + num(save.coins) + ' scrap)';
    var got = Object.keys(save.medals).length;
    $('recordBtn').textContent = 'Service record (' + got + '/' + P.MEDALS.length + ' medals)';
    show('menu');
  }
  function shop() {
    var box = $('shopList'), rank = P.rank(save).idx; box.textContent = ''; $('purse').textContent = num(save.coins) + ' scrap';
    Object.keys(D.shop).forEach(function (id) {
      var it = D.shop[id], lv = save.up[id] || 0, maxed = lv >= it.max, cost = it.cost * (lv + 1), locked = (it.rank || 0) > rank;
      var b = card({ id: id, icon: D.shopIcon[id], col: 'accent', name: it.name, text: it.per, cls: locked ? 'locked' : '', tagText: locked ? P.RANKS[it.rank].toUpperCase() : maxed ? 'MAX' : lv + '/' + it.max + ' · ' + cost + ' scrap' });
      b.disabled = locked || maxed || save.coins < cost;
      b.addEventListener('click', function () { if (save.coins < cost) return; save.coins -= cost; save.up[id] = lv + 1; persist(); A.play('pick'); shop(); });
      box.appendChild(b);
    });
    show('shop');
  }
  function classes() {
    var box = $('classList'); box.textContent = '';
    $('nightName').textContent = 'Night ' + save.nightSel; $('nightText').textContent = P.nightText(save.nightSel) + (save.night < P.MAX_NIGHT && save.nightSel === save.night ? ' Win to unlock Night ' + (save.night + 1) + '.' : '');
    $('nightDown').disabled = save.nightSel <= 1; $('nightUp').disabled = save.nightSel >= save.night;
    Object.keys(D.classes).forEach(function (id) {
      var c = D.classes[id], w = D.weapons[c.start], open = P.unlocked(save, 'classes', id), m = P.mastery(save, id);
      var b = card({ id: id, img: portrait(id), name: c.name, cls: open ? (id === save.cls ? 'got' : '') : 'locked', bar: open ? (m.need ? m.into / m.need : 1) : null,
        text: open ? c.desc + ' Starts with ' + w.name + (c.also ? ' and ' + D.weapons[c.also].name : '') + '.' : 'Reach the rank of ' + P.RANKS[P.reqRank('classes', id)] + ' to enlist this soldier.',
        tagText: open ? c.role.toUpperCase() + ' · M' + m.lvl : 'LOCKED' });
      b.disabled = !open;
      b.addEventListener('click', function () { start(id); });
      box.appendChild(b);
    });
    show('classes');
  }
  $('nightDown').addEventListener('click', function () { if (save.nightSel > 1) { save.nightSel--; A.play('click'); classes(); } });
  $('nightUp').addEventListener('click', function () { if (save.nightSel < save.night) { save.nightSel++; A.play('click'); classes(); } });
  function record() {
    var r = rankBar('recRank', 'recFill', 'recNote'), st = save.stats, box, nxt = [], i;
    for (i = r.idx + 1; i < P.RANKS.length && nxt.length < 3; i++) P.unlocksAt(i).forEach(function (u) { if (nxt.length < 3) nxt.push(u + ' (' + P.RANKS[i] + ')'); });
    $('recNext').textContent = nxt.length ? 'Coming up: ' + nxt.join(' · ') : 'Everything is unlocked.';
    $('recStats').innerHTML = num(st.kills) + ' enemies down · ' + st.runs + ' runs · ' + st.wins + ' won<br>' + st.bosses + ' bosses destroyed · ' + clock(st.time) + ' in the field · highest night ' + save.night;
    box = $('recMast'); box.textContent = '';
    Object.keys(D.classes).forEach(function (id) {
      var m = P.mastery(save, id), open = P.unlocked(save, 'classes', id);
      box.appendChild(card({ id: id, img: portrait(id), name: D.classes[id].name, cls: open ? '' : 'locked', bar: m.need ? m.into / m.need : 1, tagText: 'MASTERY ' + m.lvl,
        text: !open ? 'Locked until ' + P.RANKS[P.reqRank('classes', id)] + '.' : m.lvl >= P.MAX_MASTERY ? 'Fully mastered.' : 'Next: ' + P.PERKS[m.lvl + 1] + '.' }, 'div'));
    });
    box = $('recMedals'); box.textContent = '';
    $('recMedalHead').textContent = 'Medals ' + Object.keys(save.medals).length + '/' + P.MEDALS.length;
    P.MEDALS.forEach(function (m) {
      var got = !!save.medals[m.id];
      box.appendChild(card({ id: m.id, icon: 'spark', col: got ? 'accent' : '#5a5a4a', name: m.name, text: m.desc, cls: got ? 'got' : 'locked', tagText: got ? 'EARNED' : '+' + m.scrap + ' SCRAP' }, 'div'));
    });
    show('record');
  }

  $('playBtn').addEventListener('click', function () { A.unlock(); A.play('click'); classes(); }); $('againBtn').addEventListener('click', function () { start(); });
  $('classBack').addEventListener('click', menu); $('recordBack').addEventListener('click', menu);
  $('shopBtn').addEventListener('click', function () { A.play('click'); shop(); }); $('shopBack').addEventListener('click', menu);
  $('recordBtn').addEventListener('click', function () { A.play('click'); record(); });
  $('pauseBtn').addEventListener('click', pause); $('resumeBtn').addEventListener('click', function () { A.unlock(); show('play'); });
  $('quitBtn').addEventListener('click', function () { finish(true); }); $('menuBtn').addEventListener('click', menu);
  /* an app must pause itself and go quiet when it leaves the foreground (call, notification, app switcher) */
  document.addEventListener('visibilitychange', function () { if (document.hidden) { pause(); A.suspend(); } });
  window.addEventListener('blur', pause);

  /* ---- input: a joystick that appears wherever the thumb lands, plus keys for desktop testing */
  var stage = $('stage'), stick = $('stick'), knob = $('knob'), MAXR = 48;
  function endTouch() { touch = null; stick.hidden = true; }
  stage.addEventListener('pointerdown', function (e) {
    if (state !== 'play' || touch) return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; knob.style.transform = ''; stick.hidden = false;
    e.preventDefault();
  });
  stage.addEventListener('pointermove', function (e) {
    if (!touch || e.pointerId !== touch.id) return;
    var dx = e.clientX - touch.x, dy = e.clientY - touch.y, d = Math.hypot(dx, dy);
    if (d > MAXR) { dx *= MAXR / d; dy *= MAXR / d; }
    touch.dx = dx / MAXR; touch.dy = dy / MAXR; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { stage.addEventListener(n, function (e) { if (touch && e.pointerId === touch.id) endTouch(); }); });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('keydown', function (e) { keys[e.code] = true; if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'play') pause(); else if (state === 'pause') show('play'); } });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  function readInput() {
    var x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (touch) { x = touch.dx; y = touch.dy; }
    input.x = x; input.y = y;
  }

  /* ---- HUD */
  function banner(text) { var b = $('banner'); b.hidden = true; b.textContent = text; void b.offsetWidth; b.hidden = false; }
  function hud() {
    $('xpfill').style.width = Math.min(100, game.xp / game.next * 100) + '%';
    $('lvl').textContent = 'LV ' + game.lvl; $('timer').textContent = clock(game.t); $('kills').textContent = game.kills; $('coins').textContent = Math.floor(game.coins);
    var b = game.boss; $('bossbar').hidden = !b;
    if (b) { $('bossname').textContent = b.def.name; $('bossfill').style.width = Math.max(0, b.hp / b.maxHp * 100) + '%'; }
    var key = game.weapons.concat(game.passives).map(function (o) { return o.id + o.lvl + (o.evo ? 'e' : ''); }).join();
    if (key !== buildKey) {
      buildKey = key;
      $('slots').innerHTML = game.weapons.concat(game.passives).map(function (o) { return '<span class="' + (o.evo ? 'evo' : '') + '"><img alt="" src="' + icon(o.id, o.def.col) + '"><b>' + (o.evo ? '★' : o.lvl) + '</b></span>'; }).join('');
    }
  }
  function sounds(ev) {
    if (ev.shot) A.play('shot');
    if (ev.hurt) A.play('hurt'); if (ev.kill) A.play('kill'); else if (ev.hit) A.play('hit');
    if (ev.gem) A.play('gem'); if (ev.pick && ev.pick !== 'bomb') A.play('pick'); if (ev.bomb) A.play('bomb'); if (ev.boom) A.play('boom');
    if (ev.boss) A.play('boss'); if (ev.bossDown) A.play('chest'); if (ev.banner) banner(ev.banner);
  }

  /* ---- loop */
  window.addEventListener('resize', function () { view.resize(); });
  view.resize();
  var last = performance.now(), hudT = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === 'play') {
      readInput(); game.ev = {}; game.update(dt, input); sounds(game.ev);
      if (game.over) finish(); else if (game.pending > 0) levelUp(); else if (game.chests > 0) openChest();
    }
    view.draw(game, skin);
    if ((hudT -= dt) <= 0) { hudT = 0.1; hud(); }
    requestAnimationFrame(frame);
  }
  menu();
  requestAnimationFrame(frame);
  LL.debug = { game: game, show: show, resume: resume, save: save, menu: menu, state: function () { return state; } };
})();
