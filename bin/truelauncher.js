#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');

const CONFIG = path.join(os.homedir(), '.truelauncher.json');
const CATS = ['JEUX', 'APPS', 'SCRIPTS'];
const IS_WIN = process.platform === 'win32';
const out = process.stdout;

// ---------- couleurs ----------
const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const bgRgb = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const R = '\x1b[0m', B = '\x1b[1m';
const HI = rgb(57, 255, 106), MID = rgb(31, 165, 74), DIM = rgb(15, 90, 38), DARK = rgb(8, 48, 20);
const BAR = bgRgb(6, 36, 15);
const GRAD = [rgb(190, 255, 205), rgb(95, 255, 140), rgb(34, 214, 90), rgb(15, 143, 58)];

// ---------- police pixel 5x7 ----------
const FONT = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100', '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100', '_': '00000 00000 00000 00000 00000 00000 11111',
};

// Rend un texte en pixel art (demi-blocs : 2 lignes de pixels par ligne de terminal)
function pixelText(text, reveal = Infinity) {
  const glyphs = [...text.toUpperCase()].map(c => (FONT[c] || FONT['?']).split(' '));
  const lines = [];
  for (let r = 0; r < 7; r += 2) {
    let line = '';
    glyphs.forEach((g, i) => {
      for (let c = 0; c < 5; c++) {
        const col = i * 6 + c;
        const top = g[r][c] === '1' && col < reveal;
        const bot = r + 1 < 7 && g[r + 1][c] === '1' && col < reveal;
        line += top && bot ? '█' : top ? '▀' : bot ? '▄' : ' ';
      }
      line += ' ';
    });
    lines.push(line.replace(/ $/, ''));
  }
  return lines;
}

// ---------- config ----------
function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    CATS.forEach(c => { cfg[c] = Array.isArray(cfg[c]) ? cfg[c] : []; });
    return cfg;
  } catch {
    const cfg = {
      title: 'TRUELAUNCHER',
      JEUX: [],
      APPS: IS_WIN ? [
        { name: 'Bloc-notes', path: 'notepad.exe' },
        { name: 'Calculatrice', path: 'calc.exe' },
        { name: 'Explorateur', path: 'explorer.exe' },
      ] : [],
      SCRIPTS: [],
    };
    saveConfig(cfg);
    return cfg;
  }
}
function saveConfig(cfg) { fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2)); }

// ---------- état ----------
const cfg = loadConfig();
const st = { cat: 0, sel: [0, 0, 0], scroll: 0, status: '', blink: true, flash: 0, input: null, booting: true };
const items = () => cfg[CATS[st.cat]];

// ---------- dessin ----------
const strip = s => s.replace(/\x1b\[[0-9;]*m/g, '');
const center = (s, w) => ' '.repeat(Math.max(0, Math.floor((w - [...strip(s)].length) / 2))) + s;

function render(reveal = Infinity) {
  const W = out.columns || 80, H = out.rows || 24;
  const L = [];
  L.push('');
  const title = cfg.title || 'TRUELAUNCHER';
  if (title.length * 6 - 1 <= W) pixelText(title, reveal).forEach((l, i) => L.push(center(B + GRAD[i] + l + R, W)));
  else L.push(center(B + HI + [...title.toUpperCase()].join(' ') + R, W)); // terminal trop étroit
  L.push(center(DIM + '░▒▓' + MID + ' SYSTEM READY ' + DIM + '// ' + MID + `${items().length} ENTREE(S)` + DIM + ' ▓▒░' + R, W));
  L.push('');

  // onglets
  const tabs = CATS.map((c, i) => i === st.cat
    ? BAR + B + HI + ` ▶ ${c} ◀ ` + R
    : DIM + `   ${c}   ` + R).join(DARK + ' │ ' + R);
  L.push(center(tabs, W));
  const boxW = Math.min(W - 4, 76);
  const pad = ' '.repeat(Math.max(0, Math.floor((W - boxW) / 2)));
  L.push(pad + DIM + '┌' + '─'.repeat(boxW - 2) + '┐' + R);

  const list = items();
  const vis = Math.max(3, Math.min(12, H - L.length - 6));
  const sel = st.sel[st.cat];
  if (sel < st.scroll) st.scroll = sel;
  if (sel >= st.scroll + vis) st.scroll = sel - vis + 1;
  const inner = boxW - 4;
  for (let k = 0; k < vis; k++) {
    const i = st.scroll + k;
    let row;
    if (!list.length && k === Math.floor(vis / 2) - 1) row = center(DIM + 'VIDE : [a] fichier / [d] dossier'.slice(0, inner) + R, inner);
    else if (i < list.length) {
      const name = list[i].name.slice(0, inner - 8);
      const num = String(i + 1).padStart(2, '0');
      if (i === sel) {
        const on = st.flash % 2 === 0;
        const cur = st.blink ? '█' : ' ';
        row = BAR + (on ? B + HI : DIM) + ` > ${num}  ${name} ` + cur + R;
        row += BAR + ' '.repeat(Math.max(0, inner - name.length - 9)) + R;
      } else row = DIM + `   ${num}  ` + MID + name + R;
    } else row = '';
    const len = [...strip(row)].length;
    L.push(pad + DIM + '│ ' + R + row + ' '.repeat(Math.max(0, inner - len)) + DIM + ' │' + R);
  }
  const pos = list.length ? `${sel + 1}/${list.length}` : '0/0';
  L.push(pad + DIM + '└' + '─'.repeat(boxW - 4 - pos.length) + ' ' + MID + pos + DIM + ' ┘' + R);

  // statut / saisie
  if (st.input) L.push(pad + HI + B + st.input.label + ' ' + R + HI + st.input.value + (st.blink ? '█' : ' ') + R);
  else L.push(pad + MID + (st.status || '') + R);
  L.push('');
  const k = (key, txt) => HI + key + ' ' + DIM + txt + R;
  L.push(center([k('←→', 'onglet'), k('↑↓', 'choisir'), k('⏎', 'lancer'), k('a', 'fichier'),
    k('d', 'dossier'), k('r', 'renommer'), k('x', 'retirer'), k('q', 'quitter')].join('  '), W));

  out.write('\x1b[H' + L.slice(0, H).map(l => l + '\x1b[K').join('\n') + '\x1b[J');
}

// ---------- intro matrix ----------
function matrixIntro(done) {
  const W = out.columns || 80, H = out.rows || 24;
  const chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789ABCDEF';
  const drops = Array.from({ length: W }, () => -Math.floor(Math.random() * H));
  let frame = 0;
  const t = setInterval(() => {
    let s = '\x1b[H';
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const d = drops[x] - y;
        if (d === 0) s += HI + chars[Math.random() * chars.length | 0];
        else if (d > 0 && d < 8) s += (d < 3 ? MID : d < 5 ? DIM : DARK) + chars[Math.random() * chars.length | 0];
        else s += ' ';
      }
      s += '\n';
    }
    out.write(s + R);
    drops.forEach((_, i) => { drops[i] += 1 + (Math.random() < 0.3); });
    if (++frame > 22 || !st.booting) { clearInterval(t); out.write('\x1b[2J'); done(); }
  }, 35);
}

function revealTitle(done) {
  const total = (cfg.title || 'TRUELAUNCHER').length * 6;
  let col = 0;
  const t = setInterval(() => {
    col += 3;
    render(col);
    if (col >= total || !st.booting) { clearInterval(t); done(); }
  }, 16);
}

// ---------- actions ----------
function launch() {
  const it = items()[st.sel[st.cat]];
  if (!it) return;
  st.flash = 1;
  const t = setInterval(() => {
    st.flash++;
    render();
    if (st.flash > 6) {
      clearInterval(t);
      st.flash = 0;
      try {
        const cwd = path.isAbsolute(it.path) && fs.existsSync(path.dirname(it.path)) ? path.dirname(it.path) : undefined;
        const opts = { cwd, detached: true, stdio: 'ignore' };
        const p = IS_WIN
          ? spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${it.path}"`], { ...opts, windowsVerbatimArguments: true })
          : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [it.path], opts);
        p.on('error', e => { st.status = '! ERREUR : ' + e.message; render(); });
        p.unref();
        st.status = `> LANCE : ${it.name}`;
      } catch (e) { st.status = '! ERREUR : ' + e.message; }
      render();
    }
  }, 60);
}

function pickPath(folder) {
  if (!IS_WIN) return null;
  const ps = folder
    ? "$d=New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description='truelauncher : choisir un dossier'; if($d.ShowDialog($f) -eq 'OK'){ $d.SelectedPath }"
    : "$d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='truelauncher : choisir un fichier'; $d.Filter='Lancables|*.exe;*.lnk;*.url;*.bat;*.cmd;*.ps1;*.py;*.pyw;*.js|Tous|*.*'; if($d.ShowDialog($f) -eq 'OK'){ $d.FileName }";
  const script = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.Form -Property @{TopMost=$true}; " + ps;
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch { return null; }
}

function ask(label, initial, cb) { st.input = { label, value: initial, cb }; render(); }

function add(folder) {
  st.status = folder ? '> selection du dossier...' : '> selection du fichier...';
  render();
  const done = p => {
    if (!p) { st.status = '> annule'; return render(); }
    ask('NOM :', path.basename(p).replace(/\.(exe|lnk|url|bat|cmd)$/i, ''), name => {
      if (!name) { st.status = '> annule'; return; }
      items().push({ name, path: p });
      st.sel[st.cat] = items().length - 1;
      saveConfig(cfg);
      st.status = `> AJOUTE : ${name}`;
    });
  };
  const picked = pickPath(folder);
  if (picked || IS_WIN) done(picked);
  else ask('CHEMIN :', '', v => done(v));
}

// ---------- clavier ----------
function onKey(str, key = {}) {
  if (key.ctrl && key.name === 'c') return quit();
  if (st.booting) { st.booting = false; return; }

  if (st.input) {
    const inp = st.input;
    if (key.name === 'return') { st.input = null; inp.cb(inp.value.trim()); }
    else if (key.name === 'escape') { st.input = null; st.status = '> annule'; }
    else if (key.name === 'backspace') inp.value = inp.value.slice(0, -1);
    else if (str && !key.ctrl && str >= ' ') inp.value += str;
    return render();
  }

  const n = items().length;
  switch (key.name) {
    case 'left': st.cat = (st.cat + 2) % 3; st.scroll = 0; st.status = ''; break;
    case 'right': case 'tab': st.cat = (st.cat + 1) % 3; st.scroll = 0; st.status = ''; break;
    case 'up': if (n) st.sel[st.cat] = (st.sel[st.cat] - 1 + n) % n; break;
    case 'down': if (n) st.sel[st.cat] = (st.sel[st.cat] + 1) % n; break;
    case 'return': return launch();
    case 'a': return add(false);
    case 'd': return add(true);
    case 'r': {
      const it = items()[st.sel[st.cat]];
      if (it) return ask('RENOMMER :', it.name, v => { if (v) { it.name = v; saveConfig(cfg); st.status = '> renomme'; } });
      break;
    }
    case 'x': case 'delete': {
      const [it] = items().splice(st.sel[st.cat], 1);
      if (it) { saveConfig(cfg); st.status = `> RETIRE : ${it.name}`; st.sel[st.cat] = Math.max(0, st.sel[st.cat] - 1); }
      break;
    }
    case 'q': case 'escape': return quit();
  }
  render();
}

function quit() {
  out.write(R + '\x1b[?25h\x1b[?1049l');
  process.exit(0);
}

// ---------- démarrage ----------
if (!process.stdin.isTTY) { console.error('truelauncher doit etre lance dans un terminal.'); process.exit(1); }
if (process.argv.includes('--config')) { console.log(CONFIG); process.exit(0); }

out.write('\x1b[?1049h\x1b[?25l\x1b[2J');
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', onKey);
process.on('exit', () => out.write(R + '\x1b[?25h\x1b[?1049l'));
out.on('resize', () => { out.write('\x1b[2J'); if (!st.booting) render(); });

matrixIntro(() => revealTitle(() => {
  st.booting = false;
  render();
  setInterval(() => { st.blink = !st.blink; render(); }, 500);
}));
