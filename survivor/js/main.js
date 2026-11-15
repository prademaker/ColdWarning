/* Last Lantern: input, screens and the frame loop. */
(function () {
  'use strict';
  var LL = window.LL, $ = function (id) { return document.getElementById(id); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  var game = new LL.Game(), view = new LL.Renderer($('stage')), skin, state = 'menu';
  var input = { x: 0, y: 0 }, keys = {}, touch = null;

  /* ---- skin */
  function setSkin(id) {
    skin = LL.SKINS[id] || LL.SKINS.neon; store.set('ll.skin', skin.id);
    var s = document.documentElement.style, u = skin.ui;
    ['text', 'dim', 'panel', 'accent', 'hp', 'xp', 'track', 'edge', 'font'].forEach(function (k) { s.setProperty('--' + k, u[k]); });
    s.setProperty('--bg', skin.bg);
    Array.prototype.forEach.call($('skinRow').children, function (b) { b.setAttribute('aria-pressed', b.dataset.id === skin.id ? 'true' : 'false'); });
  }
  LL.SKIN_ORDER.forEach(function (id) {
    var b = document.createElement('button'); b.type = 'button'; b.dataset.id = id; b.textContent = LL.SKINS[id].name;
    b.addEventListener('click', function () { setSkin(id); }); $('skinRow').appendChild(b);
  });
  var q = /[?&]skin=(\w+)/.exec(location.search);
  setSkin((q && q[1]) || store.get('ll.skin') || 'neon');

  /* ---- screens */
  function show(next) {
    state = next;
    ['menu', 'levelup', 'pause', 'over'].forEach(function (id) { $(id).hidden = id !== next; });
    $('hud').hidden = next === 'menu';
    if (next !== 'play') endTouch();
  }
  function clock(t) { t = Math.floor(t); return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); }
  function start() { game.reset(); show('play'); }
  function chip(o) { return '<span class="chip"><i style="background:' + LL.col(skin, o.def.col) + '"></i>' + o.def.name + ' ' + o.lvl + '</span>'; }
  function pause() { if (state !== 'play') return; $('loadout').innerHTML = game.weapons.concat(game.passives).map(chip).join(''); show('pause'); }
  function levelUp() {
    var box = $('cards'); box.textContent = '';
    game.choices().forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'card';
      b.innerHTML = '<span class="sw"></span><span class="nm"></span><span class="lv"></span><span class="tx"></span>';
      b.children[0].style.background = LL.col(skin, c.col);
      b.children[1].textContent = c.name; b.children[2].textContent = c.isNew ? 'NEW' : c.lvl ? 'LV ' + c.lvl : ''; b.children[3].textContent = c.text;
      b.addEventListener('click', function () { game.take(c); game.pending--; show('play'); });
      box.appendChild(b);
    });
    show('levelup');
  }
  function gameOver() {
    var best = +store.get('ll.best') || 0, rec = game.t > best;
    if (rec) store.set('ll.best', String(Math.floor(game.t)));
    $('summary').innerHTML = 'Survived <b>' + clock(game.t) + '</b>' + (rec ? ' (new best)' : '') + '<br>Level ' + game.lvl + ' · ' + game.kills + ' monsters defeated';
    show('over');
  }
  function menu() { var best = +store.get('ll.best') || 0; $('best').textContent = best ? 'Best run ' + clock(best) : ''; show('menu'); }

  $('playBtn').addEventListener('click', start); $('againBtn').addEventListener('click', start);
  $('pauseBtn').addEventListener('click', pause); $('resumeBtn').addEventListener('click', function () { show('play'); });
  $('quitBtn').addEventListener('click', menu); $('menuBtn').addEventListener('click', menu);
  /* an app must pause itself when it leaves the foreground (call, notification, app switcher) */
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
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

  /* ---- loop */
  window.addEventListener('resize', function () { view.resize(); });
  view.resize();
  var last = performance.now(), hudT = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === 'play') {
      readInput(); game.update(dt, input);
      if (game.over) gameOver(); else if (game.pending > 0) levelUp();
    }
    view.draw(game, skin);
    if ((hudT -= dt) <= 0) {
      hudT = 0.1;
      $('xpfill').style.width = Math.min(100, game.xp / game.next * 100) + '%';
      $('lvl').textContent = 'LV ' + game.lvl; $('timer').textContent = clock(game.t); $('kills').textContent = game.kills + ' KO';
    }
    requestAnimationFrame(frame);
  }
  menu();
  requestAnimationFrame(frame);
  LL.debug = { game: game, show: show, state: function () { return state; } };
})();
