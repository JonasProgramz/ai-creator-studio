#!/usr/bin/env node
// Werkzeug für den Studio-Ordner eines Langvideos (Skill yt-schnitt). Ruft die HyperFrames-CLI direkt über Node auf,
// weil npx an Sonderzeichen im Pfad (z.B. "&") scheitert.
//
//   node werkzeug.mjs neu <teil>                  index.html aus _start anlegen, Dauer aus <teil>/worte.txt
//   node werkzeug.mjs check <ordner>              Lint plus Browser-Prüfung
//   node werkzeug.mjs bilder <ordner> <t1,t2,..>  Standbilder nach <ordner>/snapshots/
//   node werkzeug.mjs praezision [<ordner> ...]   Präzisionstest (Kamera, Rand, Text, Verzerrung, Drehung, Kästen), ohne Ordner alle Teile
//   node werkzeug.mjs schnell <ordner>            schneller Probe-Render eines Teils, 10 fps, output/schnell-<ordner>.mp4
//   node werkzeug.mjs vorschau <ordner> [...]     Vorschau 1080p mit fps aus ../projekt.json, output/vorschau-<ordner>.mp4
//   node werkzeug.mjs render <ordner> [...]       final in 1080p mit final_fps aus ../projekt.json (Standard 60), output/<ordner>.mp4,
//                                                 mehrere Teile gleichzeitig, mit Grafikkarte, falls da
//   node werkzeug.mjs alle                        alle eigenen Ordner final rendern (wie render)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HF = path.join(ROOT, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
// Zwischenspeicher der Renders (Einzelbilder aus den Videos, schnell 30 GB und mehr) neben den Arbeitsordner statt in den
// System-Temp-Ordner, sonst läuft unter Windows C: voll und der Render bricht mit "No space left on device" ab
// (Claude Apps, 26.11.2026). Überschreiben mit STUDIO_TMP.
const TMP = process.env.STUDIO_TMP || path.join(ROOT, '..', 'tmp');
fs.mkdirSync(TMP, { recursive: true });
const TMPENV = { TEMP: TMP, TMP: TMP, TMPDIR: TMP };
const SKIP = new Set(['assets', '_start', 'node_modules', 'output', 'katalog', 'logos']);
const [cmd, ...args] = process.argv.slice(2);
const PJ = path.join(ROOT, '..', 'projekt.json');
const PROJ = fs.existsSync(PJ) ? JSON.parse(fs.readFileSync(PJ, 'utf8')) : {};
const FPS = String(PROJ.fps || 30), FINAL_FPS = String(PROJ.final_fps || 60);

function fail(msg) { console.error(msg); process.exit(1); }

function hf(argv, env = {}) {
  if (!fs.existsSync(HF)) fail('HyperFrames fehlt. Erst "npm install" in diesem Ordner ausführen.');
  const r = spawnSync(process.execPath, [HF, ...argv], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...TMPENV, ...env } });
  if (r.status !== 0) fail(`hyperframes ${argv[0]} ist fehlgeschlagen.`);
}

function dir(name) {
  if (!name) fail('Ordnername fehlt.');
  const d = path.resolve(ROOT, name);
  if (!fs.existsSync(path.join(d, 'index.html'))) fail(`Keine index.html in ${name}.`);
  return d;
}

// HyperFrames braucht die Assets im Kompositionsordner, deshalb vor jedem Lauf frisch kopieren.
// Geändert wird nur assets/ im Projektordner, nie die Kopien.
function syncAssets(d) {
  const from = path.join(ROOT, 'assets'), to = path.join(d, 'assets');
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function own() {
  return fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.') && fs.existsSync(path.join(ROOT, e.name, 'index.html')))
    .map(e => e.name).sort();
}

// Schnellste gemessene Einstellung (Test 06.11., 11.11.2026, 16 Threads, RTX 5080): mehrere Teile gleichzeitig mit je 4 Workern,
// Kodieren über die Grafikkarte. 4:49 Video in 266 s statt 307 s. Mehr Worker pro Teil oder "auto" waren langsamer.
// Überschreiben mit STUDIO_GRUPPEN, STUDIO_WORKERS, STUDIO_GPU=0/1.
function gpuDa() {
  if (process.env.STUDIO_GPU) return process.env.STUDIO_GPU === '1';
  if (process.platform === 'darwin') return true;   // VideoToolbox
  return spawnSync('nvidia-smi', ['-L'], { stdio: 'ignore' }).status === 0;   // NVENC
}
const GPU = gpuDa();
const GRUPPEN = +(process.env.STUDIO_GRUPPEN || Math.min(4, Math.max(1, Math.round(os.cpus().length / 5))));
function renderLauf(name) {
  const d = dir(name); syncAssets(d);
  fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
  const out = path.join('output', path.basename(d) + '.mp4');
  const a = ['render', path.relative(ROOT, d), '-o', out, '--fps', FINAL_FPS, '--resolution', 'landscape', '--quality', 'high',
    '--workers', process.env.STUDIO_WORKERS || '4', '--quiet', ...(GPU ? ['--gpu'] : [])];
  console.log(`== ${name} -> ${out}`);
  return new Promise((ok, nein) => {
    const p = spawn(process.execPath, [HF, ...a], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...TMPENV, HF_CAPTURE_PARALLEL_STREAM: 'true', NODE_OPTIONS: '--max-old-space-size=8192' } });
    p.on('close', c => c === 0 ? ok() : nein(new Error(`Render von ${name} ist fehlgeschlagen.`)));
  });
}
async function render(namen) {
  if (!fs.existsSync(HF)) fail('HyperFrames fehlt. Erst "npm install" in diesem Ordner ausführen.');
  const start = Date.now(), offen = [...namen], fehler = [];
  console.log(`${namen.length} Teil(e), ${Math.min(GRUPPEN, namen.length)} gleichzeitig, Kodieren ${GPU ? 'über die Grafikkarte' : 'über den Prozessor'}`);
  await Promise.all(Array.from({ length: Math.min(GRUPPEN, namen.length) }, async () => {
    while (offen.length) { const n = offen.shift(); await renderLauf(n).catch(e => fehler.push(e.message)); }
  }));
  if (fehler.length) fail(fehler.join('\n'));
  console.log(`Fertig in ${Math.round((Date.now() - start) / 1000)} s`);
}

// Vorschau mit der Bildrate der Aufnahme und normalisiertem Ton, rund drei Minuten pro 40 s Video
function vorschau(name) {
  const d = dir(name); syncAssets(d);
  fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
  const roh = path.join('output', 'roh-' + path.basename(d) + '.mp4'), out = path.join('output', 'vorschau-' + path.basename(d) + '.mp4');
  console.log(`== ${name} -> ${out}`);
  hf(['render', path.relative(ROOT, d), '-o', roh, '--fps', FPS, '--quality', 'high', '--workers', process.env.STUDIO_WORKERS || '5', '--quiet'],
     { HF_CAPTURE_PARALLEL_STREAM: 'true', NODE_OPTIONS: '--max-old-space-size=8192' });
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', roh, '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-c:a', 'aac', '-b:a', '192k', out], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) fail('ffmpeg ist fehlgeschlagen.');
  fs.rmSync(path.join(ROOT, roh));
}

switch (cmd) {
  case 'neu': {
    const name = args[0];
    if (!name) fail('Aufruf: node werkzeug.mjs neu <teil>');
    const d = path.join(ROOT, name), w = path.join(d, 'worte.txt');
    if (fs.existsSync(path.join(d, 'index.html'))) fail(`${name}/index.html gibt es schon.`);
    if (!fs.existsSync(w)) fail(`Erst worte.txt anlegen (scripts/teile.py <arbeit> worte ${name}).`);
    const sec = Number(fs.readFileSync(w, 'utf8').match(/Dauer ([0-9.]+) s/)[1]).toFixed(4);
    const id = name.replace(/[^a-zA-Z0-9]/g, '');
    const html = fs.readFileSync(path.join(ROOT, '_start', 'index.html'), 'utf8')
      .replaceAll('__ID__', id).replaceAll('__DAUER__', sec).replaceAll('__FPS__', FPS);
    fs.writeFileSync(path.join(d, 'index.html'), html); syncAssets(d);
    console.log(`Angelegt: ${name}/index.html (Komposition ${id}, ${sec} s)`);
    break;
  }
  case 'check': {
    const d = dir(args[0]); syncAssets(d);
    const rel = path.relative(ROOT, d);
    hf(['lint', rel]); hf(['check', rel, '--no-browser-gpu']);   // ohne GPU, sonst bricht check bei parallelen Läufen nach 120 s ab
    break;
  }
  case 'bilder': {
    const d = dir(args[0]); syncAssets(d);
    if (!args[1]) fail('Zeitpunkte fehlen, z.B. 2,8.5,14');
    hf(['snapshot', path.relative(ROOT, d), '--at', args[1], '--describe', 'false']);
    console.log(`Bilder liegen in ${path.join(args[0], 'snapshots')}`);
    break;
  }
  case 'praezision': {
    const teile = args.length ? args : own();
    let fehler = 0;
    for (const t of teile) { dir(t); const r = spawnSync(process.execPath, [path.join(ROOT, 'praezision.mjs'), t], { cwd: ROOT, stdio: 'inherit' }); if (r.status !== 0) fehler++; }
    if (fehler) fail(`${fehler} Teil(e) konnten nicht geprüft werden.`);
    break;
  }
  case 'schnell': {
    const d = dir(args[0]); syncAssets(d);
    fs.mkdirSync(path.join(ROOT, 'output'), { recursive: true });
    const out = path.join('output', 'schnell-' + path.basename(d) + '.mp4');
    hf(['render', path.relative(ROOT, d), '-o', out, '--fps', '10', '--quality', 'draft', '--workers', '3', '--quiet']);
    console.log(`Probe: ${out}`);
    break;
  }
  case 'vorschau':
    if (!args.length) fail('Welche Ordner? node werkzeug.mjs vorschau <ordner> [...]');
    args.forEach(vorschau);
    break;
  case 'render':
    if (!args.length) fail('Welche Ordner? node werkzeug.mjs render <ordner> [...]');
    await render(args);
    break;
  case 'alle':
    await render(own());
    break;
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
