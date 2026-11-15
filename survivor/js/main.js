/* Last Lantern: input, screens, save data and the frame loop. */
(function () {
  'use strict';
  var LL = window.LL, D = LL.DATA, A = LL.Audio, $ = function (id) { return document.getElementById(id); };

  /* ---- save data: lives on the device only, nothing is sent anywhere */
  var save = { coins: 0, up: {}, best: 0, wins: 0, sound: true };
  try { var raw = JSON.parse(localStorage.getItem('ll.save') || '{}'); for (var k in raw) save[k] = raw[k]; } catch (e) {}
  function persist() { try { localStorage.setItem('ll.save', JSON.stringify(save)); } catch (e) {} }

  var game = new LL.Game(), view = new LL.Renderer($('stage')), skin, state = 'menu';
  var input = { x: 0, y: 0 }, keys = {}, touch = null, buildKey = '';

  var q = /[?&]skin=(\w+)/.exec(location.search);
  skin = LL.SKINS[(q && q[1]) || 'real'] || LL.SKINS.real;
  (function () {
    var s = document.documentElement.style, u = skin.ui;
    ['text', 'dim', 'panel', 'accent', 'hp', 'xp', 'track', 'edge', 'font'].forEach(function (n) { s.setProperty('--' + n, u[n]); });
    s.setProperty('--bg', skin.bg);
  })();
  function icon(id, colKey) { return LL.iconURL(id, LL.col(skin, colKey)); }

  /* ---- sound */
  function setSound(on) { save.sound = A.on = on; persist(); $('soundBtn').textContent = $('soundBtn2').textContent = 'Sound: ' + (on ? 'on' : 'off'); }
  [$('soundBtn'), $('soundBtn2')].forEach(function (b) { b.addEventListener('click', function () { A.unlock(); setSound(!save.sound); A.play('click'); }); });
  setSound(save.sound !== false);
  document.addEventListener('pointerdown', A.unlock, { passive: true });

  /* ---- screens */
  var SCREENS = ['menu', 'shop', 'levelup', 'chest', 'pause', 'over'];
  function show(next) {
    state = next;
    SCREENS.forEach(function (id) { $(id).hidden = id !== next; });
    $('hud').hidden = next === 'menu' || next === 'shop';
    if (next !== 'play') endTouch();
  }
  function clock(t) { t = Math.floor(t); return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
  function start() { A.unlock(); A.play('click'); game.reset(save.up); buildKey = ''; $('bossbar').hidden = true; $('banner').hidden = true; show('play'); }
  function resume() { if (game.over) return finish(); if (game.pending > 0) return levelUp(); if (game.chests > 0) return openChest(); show('play'); }

  function card(c, tag) {
    var b = document.createElement(tag || 'button'); if (!tag) b.type = 'button';
    b.className = 'card' + (c.isEvo ? ' evo' : '');
    b.innerHTML = '<img alt=""><span class="nm"></span><span class="lv"></span><span class="tx"></span>';
    b.children[0].src = icon(c.icon || c.id, c.col);
    b.children[1].textContent = c.name; b.children[2].textContent = c.tagText || (c.isEvo ? 'EVOLUTION' : c.isNew ? 'NEW' : c.lvl ? 'LV ' + c.lvl : ''); b.children[3].textContent = c.text;
    return b;
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
  function bank() { var c = Math.floor(game.coins); game.coins = 0; save.coins += c; return c; }
  function finish() {
    var rec = game.t > save.best, c = bank();
    if (rec) save.best = Math.floor(game.t);
    if (game.won) save.wins++;
    persist();
    $('overTitle').textContent = game.won ? 'Dawn breaks' : 'The light went out';
    $('summary').innerHTML = (game.won ? 'You outlasted the night in <b>' : 'Survived <b>') + clock(game.t) + '</b>' + (rec && !game.won ? ' (new best)' : '') +
      '<br>Level ' + game.lvl + ' · ' + game.kills + ' monsters slain<br>' + c + ' coins banked';
    A.play(game.won ? 'win' : 'lose'); show('over');
  }
  function menu() {
    $('best').textContent = (save.best ? 'Best run ' + clock(save.best) : '') + (save.wins ? ' · ' + save.wins + (save.wins === 1 ? ' dawn seen' : ' dawns seen') : '');
    $('shopBtn').textContent = 'Upgrades (' + save.coins + ' coins)'; show('menu');
  }
  function shop() {
    var box = $('shopList'); box.textContent = ''; $('purse').textContent = save.coins + ' coins';
    Object.keys(D.shop).forEach(function (id) {
      var it = D.shop[id], lv = save.up[id] || 0, maxed = lv >= it.max, cost = it.cost * (lv + 1);
      var b = card({ id: id, icon: D.shopIcon[id], col: 'accent', name: it.name, text: it.per, tagText: maxed ? 'MAX' : lv + '/' + it.max + ' · ' + cost + ' coins' });
      b.disabled = maxed || save.coins < cost;
      b.addEventListener('click', function () { if (save.coins < cost) return; save.coins -= cost; save.up[id] = lv + 1; persist(); A.play('pick'); shop(); });
      box.appendChild(b);
    });
    show('shop');
  }

  $('playBtn').addEventListener('click', start); $('againBtn').addEventListener('click', start);
  $('shopBtn').addEventListener('click', function () { A.play('click'); shop(); }); $('shopBack').addEventListener('click', menu);
  $('pauseBtn').addEventListener('click', pause); $('resumeBtn').addEventListener('click', function () { A.unlock(); show('play'); });
  $('quitBtn').addEventListener('click', function () { bank(); persist(); menu(); }); $('menuBtn').addEventListener('click', menu);
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
  LL.debug = { game: game, show: show, resume: resume, save: save, state: function () { return state; } };
})();
