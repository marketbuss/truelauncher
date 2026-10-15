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
const PKG = require('../package.json');
const REPO = 'marketbuss/truelauncher';

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
const TABS = ['★ TOP', ...CATS];
const st = { cat: 1, sel: { 0: 0, 1: 0, 2: 0, 3: 0, q: 0, scan: 0 }, scroll: 0, status: '', blink: true, flash: 0, input: null, booting: true, query: null, scan: null,
  sys: { cpu: 0, bat: null, proc: null }, update: null };

// ---------- panneau système ----------
let cpuPrev = os.cpus().map(c => c.times);
function sampleCpu() {
  const now = os.cpus().map(c => c.times);
  let idle = 0, total = 0;
  now.forEach((t, i) => {
    const p = cpuPrev[i] || t;
    const d = k => t[k] - p[k];
    idle += d('idle');
    total += d('user') + d('nice') + d('sys') + d('irq') + d('idle');
  });
  cpuPrev = now;
  if (total > 0) st.sys.cpu = Math.round(100 * (1 - idle / total));
}
let sysChild = null;
// batterie + nb de process : PowerShell en arrière-plan (lent, donc rarement et sans bloquer)
function sampleWin() {
  if (!IS_WIN) return;
  if (sysChild) return; // mesure précédente encore en cours
  sysChild = require('child_process').execFile('powershell.exe', ['-NoProfile', '-Command',
    "[string](Get-CimInstance Win32_Battery).EstimatedChargeRemaining + '|' + (Get-Process).Count"],
  { windowsHide: true, timeout: 8000 }, (err, stdout) => {
    sysChild = null;
    if (err) return;
    const num = s => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };
    const [bat, proc] = String(stdout).trim().split('|');
    st.sys.bat = num(bat); // null sur un PC fixe
    st.sys.proc = num(proc);
  });
}
const gauge = (pct, n = 6) => {
  const f = Math.round(pct / 100 * n);
  return (pct >= 85 ? rgb(255, 80, 80) : HI) + '▰'.repeat(f) + DARK + '▱'.repeat(n - f);
};
function sysLine(W) {
  const t = new Date().toLocaleTimeString('fr-FR');
  const mem = 100 * (1 - os.freemem() / os.totalmem());
  const gb = b => (b / 1024 ** 3).toFixed(1);
  const up = os.uptime(), h = Math.floor(up / 3600), m = Math.floor(up % 3600 / 60);
  const sep = DARK + ' │ ' + R;
  const parts = [
    HI + '⏱ ' + t + R,
    DIM + 'CPU ' + gauge(st.sys.cpu) + MID + ` ${String(st.sys.cpu).padStart(2)}%` + R,
    DIM + 'RAM ' + gauge(mem) + MID + ` ${gb(os.totalmem() - os.freemem())}/${gb(os.totalmem())}G` + R,
  ];
  if (st.sys.bat !== null) parts.push(DIM + 'BAT ' + MID + st.sys.bat + '%' + R);
  if (st.sys.proc !== null) parts.push(DIM + 'PROC ' + MID + st.sys.proc + R);
  parts.push(DIM + 'UP ' + MID + `${h}h${String(m).padStart(2, '0')}` + R);
  // retire des blocs à droite si le terminal est trop étroit
  while (parts.length > 1 && [...strip(parts.join(sep))].length > W - 2) parts.pop();
  return center(parts.join(sep), W);
}
const mk = () => st.scan ? 'scan' : st.query !== null ? 'q' : st.cat; // clé de sélection du mode courant
const allItems =() => CATS.flatMap(c => cfg[c]);
const ownerOf = it => cfg[CATS.find(c => cfg[c].includes(it))];
// favoris d'abord, puis les plus lancés, puis les plus récents
const topItems = () => allItems().filter(it => it.fav || it.launches)
  .sort((a, b) => (b.fav | 0) - (a.fav | 0) || (b.launches || 0) - (a.launches || 0) || (b.last || 0) - (a.last || 0));
function items() {
  if (st.scan) return st.scan;
  if (st.query !== null) {
    const q = st.query.toLowerCase();
    return allItems().filter(it => it.name.toLowerCase().includes(q));
  }
  return st.cat === 0 ? topItems() : cfg[CATS[st.cat - 1]];
}

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
  L.push(center(DIM + '░▒▓' + MID + ' SYSTEM READY ' + DIM + '// ' + MID + `${allItems().length} ENTREE(S)` + DIM + ` // v${PKG.version}` + ' ▓▒░' + R, W));
  L.push(sysLine(W));
  L.push('');

  // onglets / barre de recherche / mode scan
  if (st.scan) L.push(center(BAR + B + HI + ' ◉ SCAN ' + R + MID + `  ${st.scan.filter(s => s.on).length}/${st.scan.length} coche(s)  ` + DIM + 'espace cocher · * tout · ⏎ ajouter · esc annuler' + R, W));
  else if (st.query !== null) L.push(center(BAR + B + HI + ' / ' + R + HI + ' ' + st.query + (st.blink ? '█' : ' ') + R + DIM + '   esc pour fermer' + R, W));
  else L.push(center(TABS.map((c, i) => i === st.cat
    ? BAR + B + HI + ` ▶ ${c} ◀ ` + R
    : DIM + `  ${c}  ` + R).join(DARK + '│' + R), W));
  const boxW = Math.min(W - 4, 76);
  const pad = ' '.repeat(Math.max(0, Math.floor((W - boxW) / 2)));
  L.push(pad + DIM + '┌' + '─'.repeat(boxW - 2) + '┐' + R);

  const list = items();
  const vis = Math.max(3, Math.min(12, H - L.length - 6));
  const sel = st.sel[mk()];
  if (sel < st.scroll) st.scroll = sel;
  if (sel >= st.scroll + vis) st.scroll = sel - vis + 1;
  const inner = boxW - 4;
  for (let k = 0; k < vis; k++) {
    const i = st.scroll + k;
    let row;
    if (!list.length && k === Math.floor(vis / 2) - 1) {
      const msg = st.query !== null ? 'AUCUN RESULTAT' : st.cat === 0 ? 'VIDE : [f] favori ou lance un truc' : 'VIDE : [a] fichier / [d] dossier / [s] scan';
      row = center(DIM + msg.slice(0, inner) + R, inner);
    } else if (i < list.length) {
      const it = list[i];
      const mark = st.scan ? (it.on ? '[x] ' : '[ ] ') : it.fav ? '★ ' : '  ';
      const extra = st.scan ? `  (${it.src})` : st.cat === 0 && it.launches ? `  ×${it.launches}` : '';
      const name = it.name.slice(0, inner - 12 - extra.length);
      const num = String(i + 1).padStart(2, '0');
      if (i === sel) {
        const on = st.flash % 2 === 0;
        const cur = st.blink ? '█' : ' ';
        row = BAR + (on ? B + HI : DIM) + ` > ${num} ${mark}${name}` + DIM + extra + (on ? HI : DIM) + ' ' + cur + R;
        row += BAR + ' '.repeat(Math.max(0, inner - name.length - mark.length - extra.length - 8)) + R;
      } else row = DIM + `   ${num} ` + HI + mark + MID + name + DIM + extra + R;
    } else row = '';
    const len = [...strip(row)].length;
    L.push(pad + DIM + '│ ' + R + row + ' '.repeat(Math.max(0, inner - len)) + DIM + ' │' + R);
  }
  const pos = list.length ? `${sel + 1}/${list.length}` : '0/0';
  L.push(pad + DIM + '└' + '─'.repeat(boxW - 4 - pos.length) + ' ' + MID + pos + DIM + ' ┘' + R);

  // statut / saisie
  if (st.input) L.push(pad + HI + B + st.input.label + ' ' + R + HI + st.input.value + (st.blink ? '█' : ' ') + R);
  else if (st.status) L.push(pad + MID + st.status + R);
  else if (st.update) L.push(pad + BAR + B + HI + ` ▲ MISE A JOUR v${st.update} DISPO ` + R + DIM + '  appuie sur ' + HI + 'u' + DIM + ' pour installer' + R);
  else L.push('');
  L.push('');
  const k = (key, txt) => HI + key + ' ' + DIM + txt + R;
  L.push(center([k('←→', 'onglet'), k('↑↓', 'choisir'), k('⏎', 'lancer'), k('/', 'chercher'), k('f', 'favori')].join('  '), W));
  L.push(center([k('s', 'scan'), k('a', 'fichier'), k('d', 'dossier'), k('r', 'renommer'), k('x', 'retirer'), k('q', 'quitter')].join('  '), W));

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
  const it = items()[st.sel[mk()]];
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
        it.launches = (it.launches || 0) + 1;
        it.last = Date.now();
        saveConfig(cfg);
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
      const target = cfg[CATS[Math.max(0, st.cat - 1)]]; // depuis ★ TOP : va dans JEUX
      target.push({ name, path: p });
      st.sel[mk()] = Math.max(0, items().length - 1);
      saveConfig(cfg);
      st.status = `> AJOUTE : ${name}`;
    });
  };
  const picked = pickPath(folder);
  if (picked || IS_WIN) done(picked);
  else ask('CHEMIN :', '', v => done(v));
}

// ---------- scan auto ----------
const readSafe = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const lsSafe = d => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
const GAME_RE = /roblox|minecraft|fortnite|riot|valorant|league of legends|battle\.net|ubisoft|ea app|rockstar|steam|epic games|gog galaxy|xbox/i;
const JUNK_RE = /uninstall|d[ée]sinstall|readme|lisez|help|aide|manual|manuel|license|licence|website|site web|release notes|documentation|support center/i;

function scanSteam() {
  const found = [];
  const roots = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam'];
  const libs = new Set();
  roots.forEach(r => {
    if (!fs.existsSync(r)) return;
    libs.add(r);
    for (const m of readSafe(path.join(r, 'steamapps', 'libraryfolders.vdf')).matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, '\\'));
  });
  libs.forEach(lib => {
    const dir = path.join(lib, 'steamapps');
    lsSafe(dir).filter(e => /^appmanifest_\d+\.acf$/.test(e.name)).forEach(e => {
      const txt = readSafe(path.join(dir, e.name));
      const id = (txt.match(/"appid"\s+"(\d+)"/) || [])[1];
      const name = (txt.match(/"name"\s+"([^"]+)"/) || [])[1];
      if (id && name && !/redistributable|steam linux runtime|proton|steamvr/i.test(name) && id !== '228980')
        found.push({ name, path: `steam://rungameid/${id}`, cat: 'JEUX', src: 'Steam', on: true });
    });
  });
  return found;
}

function scanEpic() {
  const dir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  return lsSafe(dir).filter(e => e.name.endsWith('.item')).map(e => {
    try {
      const j = JSON.parse(readSafe(path.join(dir, e.name)));
      return j.DisplayName && j.AppName && { name: j.DisplayName, path: `com.epicgames.launcher://apps/${j.AppName}?action=launch&silent=true`, cat: 'JEUX', src: 'Epic', on: true };
    } catch { return null; }
  }).filter(Boolean);
}

function scanShortcuts() {
  const home = os.homedir(), appdata = process.env.APPDATA || '', pdata = process.env.ProgramData || 'C:\\ProgramData';
  const dirs = [
    [path.join(home, 'Desktop'), 'Bureau'], [path.join(home, 'OneDrive', 'Desktop'), 'Bureau'],
    [path.join(home, 'OneDrive', 'Bureau'), 'Bureau'], ['C:\\Users\\Public\\Desktop', 'Bureau'],
    [path.join(appdata, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'Demarrer'],
    [path.join(pdata, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'Demarrer'],
  ];
  const found = [];
  const walk = (d, src, depth) => lsSafe(d).forEach(e => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (depth < 2) walk(p, src, depth + 1); return; }
    if (!/\.(lnk|url)$/i.test(e.name)) return;
    const name = e.name.replace(/\.(lnk|url)$/i, '');
    if (JUNK_RE.test(name)) return;
    const game = GAME_RE.test(name) || /steam:\/\/|com\.epicgames/i.test(readSafe(p).slice(0, 2000));
    found.push({ name, path: p, cat: game ? 'JEUX' : 'APPS', src, on: game });
  });
  dirs.forEach(([d, src]) => walk(d, src, 0));
  return found;
}

function scan() {
  if (!IS_WIN) { st.status = '! scan dispo seulement sous Windows'; return render(); }
  st.status = '> scan en cours...';
  render();
  const known = new Set(allItems().flatMap(it => [it.path.toLowerCase(), it.name.toLowerCase()]));
  const seen = new Set();
  const res = [...scanSteam(), ...scanEpic(), ...scanShortcuts()].filter(s => {
    const k = s.name.toLowerCase();
    if (known.has(k) || known.has(s.path.toLowerCase()) || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => (b.on | 0) - (a.on | 0) || a.name.localeCompare(b.name));
  if (!res.length) { st.status = '> rien de nouveau trouve'; return render(); }
  st.scan = res;
  st.sel.scan = 0; st.scroll = 0;
  st.status = `> ${res.length} trouve(s) — jeux pre-coches`;
  render();
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
  if (key.name === 'up') { if (n) st.sel[mk()] = (st.sel[mk()] - 1 + n) % n; return render(); }
  if (key.name === 'down') { if (n) st.sel[mk()] = (st.sel[mk()] + 1) % n; return render(); }

  if (st.scan) {
    const it = st.scan[st.sel.scan];
    if (key.name === 'space' && it) it.on = !it.on;
    else if (str === '*') { const all = st.scan.every(s => s.on); st.scan.forEach(s => { s.on = !all; }); }
    else if (key.name === 'return') {
      const picked = st.scan.filter(s => s.on);
      picked.forEach(s => cfg[s.cat].push({ name: s.name, path: s.path }));
      saveConfig(cfg);
      st.scan = null;
      st.status = `> ${picked.length} ENTREE(S) AJOUTEE(S)`;
    } else if (key.name === 'escape') { st.scan = null; st.status = '> scan annule'; }
    return render();
  }

  if (st.query !== null) {
    if (key.name === 'return') return launch();
    if (key.name === 'escape') st.query = null;
    else if (key.name === 'backspace') st.query = st.query.slice(0, -1);
    else if (str && !key.ctrl && str >= ' ') st.query += str;
    st.sel.q = 0; st.scroll = 0;
    return render();
  }

  switch (key.name) {
    case 'left': st.cat = (st.cat + TABS.length - 1) % TABS.length; st.scroll = 0; st.status = ''; break;
    case 'right': case 'tab': st.cat = (st.cat + 1) % TABS.length; st.scroll = 0; st.status = ''; break;
    case 'return': return launch();
    case 's': return scan();
    case 'u': if (st.update) return runUpdate(); break;
    case 'f': {
      const it = items()[st.sel[mk()]];
      if (it) { it.fav = !it.fav; saveConfig(cfg); st.status = it.fav ? `> ★ FAVORI : ${it.name}` : `> favori retire : ${it.name}`; }
      break;
    }
    default:
      if (str === '/') { st.query = ''; st.sel.q = 0; st.scroll = 0; st.status = ''; }
      break;
    case 'a': return add(false);
    case 'd': return add(true);
    case 'r': {
      const it = items()[st.sel[mk()]];
      if (it) return ask('RENOMMER :', it.name, v => { if (v) { it.name = v; saveConfig(cfg); st.status = '> renomme'; } });
      break;
    }
    case 'x': case 'delete': {
      const it = items()[st.sel[mk()]];
      if (it) {
        const owner = ownerOf(it);
        owner.splice(owner.indexOf(it), 1); saveConfig(cfg); st.status = `> RETIRE : ${it.name}`; st.sel[mk()] = Math.max(0, st.sel[mk()] - 1); }
      break;
    }
    case 'q': case 'escape': return quit();
  }
  render();
}

function quit() {
  out.write(R + '\x1b[?25h\x1b[?1049l');
  if (sysChild) sysChild.kill(); // évite un crash libuv si PowerShell tourne encore
  process.exit(0);
}

// ---------- mise à jour ----------
const newer = (a, b) => { // a > b ?
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
async function checkUpdate() {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/main/package.json`, { signal: AbortSignal.timeout(5000) });
    const { version } = await res.json();
    if (version && newer(version, PKG.version)) { st.update = version; if (!st.booting) render(); }
  } catch { /* hors ligne : on ignore */ }
}
function runUpdate() {
  out.write(R + '\x1b[?25h\x1b[?1049l');
  process.stdin.setRawMode(false);
  console.log(`${HI}> mise a jour vers v${st.update}...${R}\n`);
  const r = require('child_process').spawnSync(`npm install -g github:${REPO}`, { shell: true, stdio: 'inherit' });
  console.log(r.status === 0
    ? `\n${HI}> truelauncher v${st.update} installe ! relance-le.${R}`
    : `\n${rgb(255, 80, 80)}! echec de la mise a jour (code ${r.status}).${R}`);
  process.exit(r.status || 0);
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
checkUpdate();
sampleWin();
setInterval(sampleCpu, 1000);
setInterval(sampleWin, 15000);

matrixIntro(() => revealTitle(() => {
  st.booting = false;
  render();
  setInterval(() => { st.blink = !st.blink; render(); }, 500);
}));
