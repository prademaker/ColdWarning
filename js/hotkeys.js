// Cold War 2: 2030 — keyboard layout: build tab and build item letters, and the reference card.
'use strict';

// one letter per build tab, shown on the tab
const TAB_KEYS = { structure: 'B', defense: 'G', infantry: 'C', vehicle: 'V', air: 'J', naval: 'K' };

// letters a build button can get, in order. Everything else on the keyboard is a command.
const BUILD_KEYS = 'QWERTYUIOL';

// Letters for the items on one build tab. An item keeps the key it has in config when that key is
// a build letter and still free on this tab; the rest take the next free letter in order.
function buildHotkeys(list) {
  const out = {}, used = new Set();
  for (const key of list) {
    const k = defOf(key).key;
    if (k && BUILD_KEYS.includes(k) && !used.has(k)) { out[key] = k; used.add(k); }
  }
  for (const key of list) {
    if (out[key]) continue;
    const k = [...BUILD_KEYS].find(c => !used.has(c));
    if (k) { out[key] = k; used.add(k); }
  }
  return out;
}

// the reference card in the menu and the pause screen (F1 in game)
const HOTKEY_HELP = [
  { title: 'Units', rows: [
    ['Left-click / drag', 'Select units'],
    ['Right-click', 'Move, attack, board, garrison, harvest'],
    ['A then click · Ctrl+right-click', 'Attack-move'],
    ['S', 'Stop'],
    ['D', 'Deploy MCV · dig in / get up · unload transport · empty garrison'],
    ['Double-click', 'Select all of that type on screen'],
    ['Ctrl+double-click', 'Select all of that type on the map'],
    ['Ctrl+A', 'Select every combat unit'],
    ['.', 'Next idle unit (Shift+. selects all idle units)'],
  ] },
  { title: 'Control groups', rows: [
    ['Ctrl+1–9', 'Make a group from the selection'],
    ['Ctrl+Shift+1–9', 'Add the selection to a group'],
    ['1–9', 'Select a group (press twice to jump to it)'],
    ['Shift+1–9', 'Add a group to the selection'],
  ] },
  { title: 'Building', rows: [
    [Object.values(TAB_KEYS).join(' · '), 'Base · Defense · Infantry · Armor · Air · Navy tabs'],
    ['Tab / Shift+Tab', 'Next / previous tab'],
    [BUILD_KEYS.split('').join(' · '), 'Build the item with that letter on the current tab'],
    ['Shift+letter', 'Queue five units'],
    ['Z / X', 'Sell / repair mode'],
    ['F', 'Fire the superweapon'],
  ] },
  { title: 'Camera and radar', rows: [
    ['H', 'Jump to your base (again for the next Command Center)'],
    ['Space', 'Jump to the latest alert (again for older ones)'],
    ['Arrows · screen edge · middle-drag', 'Scroll'],
    ['Minimap click / drag', 'Move the camera'],
    ['Minimap right-click', 'Move selected units there (Ctrl: attack-move)'],
  ] },
  { title: 'Game', rows: [
    ['Esc', 'Cancel placing or targeting, then deselect'],
    ['P', 'Pause, save and load'],
    ['F5 / F9', 'Quicksave / quickload'],
    ['M / N', 'Mute / next music track'],
    ['F1 or ?', 'This list'],
  ] },
];
