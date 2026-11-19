#!/usr/bin/env node
// Video Studio: Feinschnitt eines Rohschnitts im Browser.
//
//   node studio.mjs <projektordner> [--port 4747]          Studio starten (legt Proxy und Tonwelle an, falls nötig)
//   node studio.mjs import <schnitt.json> <projektordner> [--woerter <quelle>=<datei.tsv> ...] [--name <name>]
//                                                          Rohschnitt (Format der yt-schnitt-Skripte) als Projekt anlegen
//
// Links im Studio ist ein Chat mit dem KI-Agenten des Nutzers (Claude Code, Codex, Hermes …, siehe agenten.mjs), der den Schnitt in projekt.json ändern kann.
//   --agent <claude|codex|hermes|antigravity|gemini|opencode> legt den Agenten fest, sonst "agent" in projekt.json, sonst der erste installierte.
// Ein Projekt ist ein Ordner mit projekt.json. Der Export („Weitergeben“) schreibt export/voll.mp4, export/cuts.json
// und export/marker.json im Format, das der Schritt Motion Graphics erwartet.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AGENTEN, waehle, installierte, finde, brauchtShell } from './agenten.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

function anleitungKopieren(ordner) {
  // Dieselbe Anleitung unter den Namen, die die Agenten lesen: Claude Code CLAUDE.md, Codex und OpenCode AGENTS.md, Gemini GEMINI.md
  for (const n of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) { const z = path.join(ordner, n); if (!fs.existsSync(z)) fs.copyFileSync(path.join(HIER, 'vorlage', 'CLAUDE.md'), z); }
}

// ---------- Import eines Rohschnitts ----------
if (args[0] === 'import') {
  const [, schnittPfad, ordner] = args;
  if (!schnittPfad || !ordner) { console.error('Aufruf: node studio.mjs import <schnitt.json> <projektordner> [--woerter 1=datei.tsv]'); process.exit(1); }
  const s = JSON.parse(fs.readFileSync(schnittPfad, 'utf8'));
  fs.mkdirSync(path.join(ordner, 'woerter'), { recursive: true });
  const quellen = {};
  for (const [id, p] of Object.entries(s.quellen)) quellen[id] = { pfad: p.replace(/\\/g, '/') };
  for (let i = 0; i < args.length; i++) if (args[i] === '--woerter') {
    const [id, datei] = args[i + 1].split('=');
    const ziel = `woerter/${id}.tsv`;
    fs.copyFileSync(datei, path.join(ordner, ziel)); quellen[id].woerter = ziel;
  }
  let n = 0, m = 0;
  const clips = s.teile.map(t => ({ id: 'c' + (++n), quelle: String(t.quelle), von: +t.von.toFixed(3), bis: +t.bis.toFixed(3), name: t.name || '' }));
  const marker = s.teile.filter(t => t.marke).map(t => ({ id: 'm' + (++m), quelle: String(t.quelle), zeit: +t.von.toFixed(3), name: t.marke }));
  const projekt = { name: opt('--name', path.basename(path.resolve(ordner))), fps: s.fps || 60, breite: s.breite || 1920, quellen, clips, marker, version: 1 };
  fs.writeFileSync(path.join(ordner, 'projekt.json'), JSON.stringify(projekt, null, 1));
  anleitungKopieren(ordner);
  console.log(`Projekt angelegt: ${clips.length} Clips, ${marker.length} Marker in ${ordner}`);
  process.exit(0);
}

// ---------- Entwurf als Abnahme-Projekt anlegen ----------
// Mit --live <arbeitsordner> statt einer MP4: Die Kompositionen in <arbeitsordner>/studio laufen live im Browser,
// ohne Render. Taktgeber ist die geschnittene Aufnahme mit dem fertigen Ton (voll/voll.mp4 plus voll/ton.wav, falls da).
if (args[0] === 'abnahme') {
  const liveArbeit = opt('--live');
  const video = liveArbeit ? null : args[1], ordner = liveArbeit ? args[1] : args[2];
  if ((!video && !liveArbeit) || !ordner) { console.error('Aufruf: node studio.mjs abnahme <entwurf.mp4> <projektordner> [--woerter datei.tsv] [--name <name>]\n       node studio.mjs abnahme <projektordner> --live <arbeitsordner> [--nur teil1,teil2] [--woerter datei.tsv] [--name <name>]'); process.exit(1); }
  fs.mkdirSync(path.join(ordner, 'woerter'), { recursive: true });
  let pfad, live = null;
  if (liveArbeit) {
    const A = path.resolve(liveArbeit), st = path.join(A, 'studio'), tj = path.join(st, 'teile.json');
    if (!fs.existsSync(tj)) { console.error(`${tj} fehlt. Erst: python3 scripts/teile.py <arbeitsordner> json`); process.exit(1); }
    const roh = path.join(A, 'voll', 'voll.mp4'), ton = path.join(A, 'voll', 'ton.wav');
    pfad = path.join(path.resolve(ordner), '.studio', 'live-takt.mp4');
    fs.mkdirSync(path.dirname(pfad), { recursive: true });
    // Nur gebaute Teile zeigen (mit index.html). --nur a,b beschränkt auf diese Teile, etwa fürs Teststück.
    const alle = JSON.parse(fs.readFileSync(tj, 'utf8'));
    const nur = opt('--nur') ? opt('--nur').split(',').map(x => x.trim()) : null;
    let teile = alle.filter(t => fs.existsSync(path.join(st, t.name, 'index.html')) && (!nur || nur.includes(t.name)));
    if (!teile.length) { console.error('Kein gebauter Teil gefunden' + (nur ? ' für --nur ' + nur.join(',') : '') + '.'); process.exit(1); }
    // Fehlen Teile am Anfang oder Ende, zeigt das Studio nur den gebauten Abschnitt, nicht das ungebaute Video drumherum
    const von = Math.min(...teile.map(t => t.von)), bis = Math.max(...teile.map(t => t.bis));
    const ganz = von <= alle[0].von + 0.01 && bis >= alle.at(-1).bis - 0.01;
    const tonArgs = fs.existsSync(ton) ? ['-i', ton, '-map', '0:v', '-map', '1:a'] : [];
    if (ganz) {
      // Bild nur kopieren, Ton mit Effekten einsetzen: dauert Sekunden, nicht Minuten
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', roh, ...tonArgs, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', pfad]);
    } else {
      // Abschnitt bildgenau ausschneiden (neu kodiert, damit der Schnitt nicht am Keyframe hängt)
      const zeit = ['-ss', von.toFixed(3), '-to', bis.toFixed(3)];
      execFileSync('ffmpeg', ['-y', '-v', 'error', ...zeit, '-i', roh, ...(tonArgs.length ? [...zeit, ...tonArgs] : []),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', pfad]);
      teile = teile.map(t => ({ ...t, von: +(t.von - von).toFixed(3), bis: +(t.bis - von).toFixed(3) }));
    }
    pfad = pfad.replace(/\\/g, '/');
    live = { studio: st.replace(/\\/g, '/'), teile, versatz: ganz ? 0 : +von.toFixed(3) };
    if (!ganz) console.log(`Nur der gebaute Abschnitt ${von.toFixed(1)} bis ${bis.toFixed(1)} s (${teile.map(t => t.name).join(', ')}).`);
  } else pfad = path.resolve(video).replace(/\\/g, '/');
  const dauer = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', pfad]).toString());
  const quelle = { pfad };
  const w = opt('--woerter');
  if (w) {
    // Bei einem Abschnitt die Wörter auf den Abschnitt zuschneiden und verschieben
    const vs = live?.versatz || 0;
    let zeilen = fs.readFileSync(w, 'utf8').split(/\r?\n/).filter(Boolean);
    if (vs) zeilen = zeilen.map(z => z.split('\t')).filter(f => +f[0] >= vs && +f[0] < vs + dauer)
      .map(f => [(+f[0] - vs).toFixed(3), (+f[1] - vs).toFixed(3), ...f.slice(2)].join('\t'));
    fs.writeFileSync(path.join(ordner, 'woerter', '1.tsv'), zeilen.join('\n') + '\n'); quelle.woerter = 'woerter/1.tsv';
  }
  // Marker eines früheren Abnahme-Projekts im selben Ordner bleiben erhalten, damit erledigtes Feedback sichtbar bleibt
  const altPfad = path.join(ordner, 'projekt.json'); const alt = fs.existsSync(altPfad) ? JSON.parse(fs.readFileSync(altPfad, 'utf8')) : null;
  const projekt = { name: opt('--name', liveArbeit ? path.basename(path.resolve(liveArbeit)) + ' live' : path.basename(video, path.extname(video))), modus: 'abnahme', fps: 60, breite: 1920,
    quellen: { 1: quelle }, clips: [{ id: 'c1', quelle: '1', von: 0, bis: +dauer.toFixed(3), name: '' }], marker: alt?.marker || [], version: (alt?.version || 0) + 1 };
  if (live) projekt.live = live;
  fs.writeFileSync(altPfad, JSON.stringify(projekt, null, 1));
  // Welle und Proxy des vorigen Entwurfs verwerfen, sonst zeigt die Timeline die alte Tonwelle
  fs.rmSync(path.join(ordner, '.studio', '1'), { recursive: true, force: true });
  anleitungKopieren(ordner);
  console.log(`Abnahme-Projekt angelegt: ${projekt.name}${live ? ', live aus ' + live.teile.length + ' Teilen' : ''}, ${(dauer / 60).toFixed(1)} min, ${projekt.marker.length} Marker übernommen`);
  process.exit(0);
}

// ---------- Studio ----------
const ORDNER = path.resolve(args[0] || '.');
const PORT = +opt('--port', 4747);
const PJ = path.join(ORDNER, 'projekt.json');
const CACHE = path.join(ORDNER, '.studio');
if (!fs.existsSync(PJ)) { console.error(`Kein projekt.json in ${ORDNER}`); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });

const lies = () => JSON.parse(fs.readFileSync(PJ, 'utf8'));
let eigeneVersion = 0, zuletzt = fs.readFileSync(PJ, 'utf8');
const schreibe = (p) => { const tmp = PJ + '.tmp'; zuletzt = JSON.stringify(p, null, 1); fs.writeFileSync(tmp, zuletzt); fs.renameSync(tmp, PJ); eigeneVersion = p.version; };

// Server-Sent Events an alle offenen Fenster
const hoerer = new Set();
const sende = (typ, daten) => { const z = `event: ${typ}\ndata: ${JSON.stringify(daten)}\n\n`; for (const r of hoerer) r.write(z); };

// Änderungen von außen (Claude Code im Terminal, Editor) erkennen und das Studio neu laden lassen
let watchTimer = null;
fs.watch(ORDNER, (ev, datei) => {
  if (datei !== 'projekt.json') return;
  clearTimeout(watchTimer);
  // Fremde Änderung (Claude, Editor): Version hochzählen, damit das Studio neu lädt und alte Stände nicht drüberschreibt
  watchTimer = setTimeout(() => {
    try {
      const roh = fs.readFileSync(PJ, 'utf8'); if (roh === zuletzt) return;
      const p = JSON.parse(roh); p.version = Math.max(p.version || 0, eigeneVersion) + 1; schreibe(p); sende('projekt', { version: p.version });
    } catch {}
  }, 200);
});

// ---------- Vorbereiten: Dauer, Proxy, Tonwelle ----------
const status = {};   // quelle -> { dauer, proxy: 'bereit' | Prozent, welle }
function dauerVon(datei) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei]).toString().trim());
}
function ffmpeg(argsF, beiFortschritt, gesamt) {
  return new Promise((ok, fehler) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', '-nostats', ...argsF]);
    let rest = '', err = '';
    p.stdout.on('data', d => {
      rest += d; const zeilen = rest.split('\n'); rest = zeilen.pop();
      for (const z of zeilen) if (z.startsWith('out_time_us=') && beiFortschritt) beiFortschritt(Math.min(1, parseInt(z.slice(12)) / 1e6 / gesamt));
    });
    p.stderr.on('data', d => err += d);
    p.on('close', c => c === 0 ? ok() : fehler(new Error(err || 'ffmpeg Fehler ' + c)));
  });
}
async function vorbereiten() {
  const p = lies();
  for (const [id, q] of Object.entries(p.quellen)) {
    const dir = path.join(CACHE, id); fs.mkdirSync(dir, { recursive: true });
    const st = status[id] = status[id] || {};
    if (!fs.existsSync(q.pfad)) { st.fehler = 'Datei nicht gefunden: ' + q.pfad; sende('status', status); continue; }
    st.dauer = dauerVon(q.pfad);
    try { st.original = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'csv=p=0', q.pfad]).toString().trim(); } catch {}
    const welle = path.join(dir, 'welle.bin');
    if (!fs.existsSync(welle)) {
      st.welle = 'läuft'; sende('status', status);
      // 100 Werte pro Sekunde: Spitze in 10-ms-Fenstern, auf 0 bis 255 gebracht (Wurzel, damit leise Stellen sichtbar bleiben)
      const pcm = await new Promise((ok, fehler) => {
        const teile = []; const pr = spawn('ffmpeg', ['-v', 'error', '-i', q.pfad, '-vn', '-ac', '1', '-ar', '8000', '-f', 's16le', '-']);
        pr.stdout.on('data', d => teile.push(d)); pr.on('close', c => c === 0 ? ok(Buffer.concat(teile)) : fehler(new Error('Tonwelle')));
      });
      const n = Math.floor(pcm.length / 2 / 80), out = Buffer.alloc(n);
      for (let i = 0; i < n; i++) { let m = 0; for (let k = 0; k < 80; k++) { const v = Math.abs(pcm.readInt16LE((i * 80 + k) * 2)); if (v > m) m = v; } out[i] = Math.min(255, Math.round(Math.sqrt(m / 32768) * 255)); }
      fs.writeFileSync(welle, out);
    }
    st.welle = 'bereit';
    const proxy = path.join(dir, 'vorschau-1080.mp4');
    if (p.modus === 'abnahme') { st.proxy = 'bereit'; sende('status', status); continue; }
    if (!fs.existsSync(proxy)) {
      st.proxy = 0; sende('status', status);
      // Vorschau in 1080p mit 30 fps und einem Vollbild alle 0,33 s, damit das Springen an Schnitten schnell geht.
      // Das Original direkt zu zeigen ginge nicht flüssig: Kameraaufnahmen haben oft nur alle paar Sekunden ein Vollbild (bei einer Webcam gemessen: 4,2 s).
      await ffmpeg(['-y', '-i', q.pfad, '-vf', 'scale=-2:1080:flags=lanczos', '-r', '30', '-g', '10', '-keyint_min', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', proxy + '.tmp.mp4'], f => { st.proxy = Math.round(f * 100); sende('status', status); }, st.dauer);
      fs.renameSync(proxy + '.tmp.mp4', proxy);
    }
    st.proxy = 'bereit'; sende('status', status);
  }
}

// ---------- Chat mit dem KI-Agenten (vom Nutzer freigegeben, 09.11.2026, mehrere Agenten seit 14.11.2026) ----------
// Startet den Agenten ohne Terminal im Projektordner. Die Sitzung bleibt über mehrere Nachrichten erhalten,
// bei Agenten ohne Fortsetzen schickt das Studio die letzten Nachrichten als Verlauf mit.
const chatDatei = path.join(CACHE, 'chat.json');
let chat = fs.existsSync(chatDatei) ? JSON.parse(fs.readFileSync(chatDatei, 'utf8')) : { sitzung: null, verlauf: [] };
let chatProzess = null;
const chatSpeichern = () => fs.writeFileSync(chatDatei, JSON.stringify(chat, null, 1));
function chatEintrag(wer, text) { chat.verlauf.push({ wer, text }); sende('chat', { wer, text }); }
function agentProjekt() { try { return JSON.parse(fs.readFileSync(PJ, 'utf8')).agent; } catch { return undefined; } }
let AGENT = waehle(opt('--agent') || agentProjekt() || chat.agent);
const A = () => AGENTEN[AGENT];
console.log(`KI-Agent im Chat: ${A().name}${A().getestet ? '' : ' (noch nicht getestet)'}`);
const ohneFarben = s => String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\[[0-9;]*m/g, '');
function startenAgent(args, stdinText, stdinOffen = false) {
  const bin = A().bin, shell = brauchtShell(bin);
  // Mit Shell (npm-Agenten unter Windows) die Argumente selbst quoten
  const a = shell ? args.map(x => /^[\w.=\-]+$/.test(x) ? x : '"' + String(x).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"') : args;
  const p = spawn(finde(bin) || bin, a, { cwd: ORDNER, windowsHide: true, shell, stdio: [stdinText != null || stdinOffen ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
  if (stdinText != null) { p.stdin.on('error', () => {}); p.stdin.end(stdinText); }
  return p;
}
function chatSenden(text, kontext) {
  if (chatProzess) return false;
  const ag = A();
  let prompt = `${text}\n\n[Video Studio: ${kontext}]`;
  if (ag.anleitungNennen) prompt = `Du hilfst im Video Studio beim Schnitt. Das Projekt liegt in diesem Ordner (${ORDNER}). Lies zuerst AGENTS.md dort, sie erklärt projekt.json. Änderungen am Schnitt machst du direkt in projekt.json, das Studio lädt sie sofort neu.

` + prompt;
  if (!ag.fortsetzen) {
    const frueher = chat.verlauf.filter(v => ['du', 'agent', 'claude'].includes(v.wer)).slice(-10);
    if (frueher.length) prompt = 'Bisheriges Gespräch im Video Studio:\n' + frueher.map(v => (v.wer === 'du' ? 'Nutzer: ' : 'Du: ') + v.text).join('\n') + '\n\nNeue Nachricht:\n' + prompt;
  }
  chatEintrag('du', text); chatSpeichern();
  const { args: av } = ag.aufruf(prompt, ag.fortsetzen ? chat.sitzung : null, ORDNER);
  const p = startenAgent(av, ag.ueberStdin ? prompt : null);
  chatProzess = p; sende('chatstatus', { laeuft: true });
  let rest = '', alles = '', err = '';
  p.stdout.on('data', d => {
    if (!ag.stream) { alles += d; return; }
    rest += d; const zeilen = rest.split('\n'); rest = zeilen.pop();
    for (const z of zeilen) {
      let e; try { e = JSON.parse(z); } catch { continue; }
      for (const x of ag.zeile(e)) {
        if (x.sitzung && !chat.sitzung) chat.sitzung = x.sitzung;
        if (x.text) chatEintrag('agent', x.text);
        if (x.werkzeug) sende('chat', { wer: 'werkzeug', text: x.werkzeug });
        // Fehler nur einmal zeigen: Agenten schreiben ihn oft schon als Antworttext
        if (x.fehler && chat.verlauf.at(-1)?.text !== x.fehler.trim()) chatEintrag('fehler', x.fehler.trim());
      }
    }
  });
  p.stderr.on('data', d => err += d);
  p.on('error', e => { chatProzess = null; chatEintrag('fehler', `${ag.name} nicht gefunden. Ist der Agent installiert und im Pfad? (${e.message})`); sende('chatstatus', { laeuft: false }); });
  p.on('close', code => {
    chatProzess = null;
    const antwort = (ag.aufraeumen || (s => s.trim()))(ohneFarben(alles));
    if (!ag.stream && antwort) chatEintrag('agent', antwort);
    const fehler = ohneFarben(err).trim();
    if (code !== 0 && fehler && !chat.verlauf.at(-1)?.text?.includes(fehler.slice(0, 40))) chatEintrag('fehler', fehler.slice(-400));
    if (/authenticate|not logged in|login/i.test(chat.verlauf.at(-1)?.text || '')) sende('anmeldung', { angemeldet: false });
    chatSpeichern(); sende('chatstatus', { laeuft: false });
    try { const roh = fs.readFileSync(PJ, 'utf8'); if (roh !== zuletzt) { const pj = JSON.parse(roh); pj.version = Math.max(pj.version || 0, eigeneVersion) + 1; schreibe(pj); sende('projekt', { version: pj.version }); } } catch {}
  });
  return true;
}
// Agent wechseln (Auswahl im Chat-Kopf, wenn mehrere installiert sind). Ein neues Gespräch beginnt.
function agentWechseln(id) {
  if (!AGENTEN[id] || chatProzess) return false;
  AGENT = id; chat = { sitzung: null, verlauf: [], agent: id }; chatSpeichern(); return true;
}
function agentInfo() {
  return { agent: AGENT, name: A().name, getestet: A().getestet, hinweis: A().hinweis || null,
    installiert: installierte().map(k => ({ id: k, name: AGENTEN[k].name })) };
}
// Anmeldung aus dem Studio heraus: startet den Login-Befehl des Agenten, gibt den Link ans Studio
// und reicht einen Code, den der Nutzer im Studio einfügt, an die Anmeldung weiter.
// Agenten ohne Login-Befehl (Hermes, Gemini, OpenCode) bekommen einen Hinweis, wie sie einmal im Terminal eingerichtet werden.
let anmeldung = null;
function angemeldet() { try { return A().angemeldet(); } catch { return false; } }
function anmeldungStarten() {
  if (anmeldung) return;
  if (!A().anmelden) { sende('anmeldung', { hinweis: A().hinweis || `${A().name} einmal im Terminal einrichten.` }); return; }
  const p = startenAgent(A().anmelden, null, true); p.stdin.on('error', () => {});
  anmeldung = p; let text = '';
  // stdin offen lassen, damit ein eingefügter Code weitergereicht werden kann
  const lesen = d => { text += d; const m = ohneFarben(text).match(/https:\/\/\S+/); if (m) sende('anmeldung', { link: m[0] }); };
  p.stdout.on('data', lesen); p.stderr.on('data', lesen);
  p.on('error', e => { anmeldung = null; sende('anmeldung', { fehler: `${A().name} nicht gefunden. Ist der Agent installiert? (${e.message})` }); });
  p.on('close', () => { anmeldung = null; sende('anmeldung', { angemeldet: angemeldet() }); });
}

// ---------- Export („Weitergeben“) ----------
let exportLaeuft = false;
// Signal an den Agenten: signal.json im Projektordner. Der Agent wartet nach dem Start des Studios im Hintergrund auf eine neue Zeit darin.
function signal(art, daten = {}) { fs.writeFileSync(path.join(ORDNER, 'signal.json'), JSON.stringify({ art, zeit: Date.now(), ...daten }, null, 1)); }
// Luft an Schnitten (projekt.puffer, Sekunden) erweitert jeden Clip vorne und hinten, ohne die Schnitte selbst zu ändern
const wirksam = (p, c) => { const pad = p.puffer || { vor: 0, nach: 0 }, dauer = status[c.quelle]?.dauer || 1e9; return { von: Math.max(0, c.von - pad.vor), bis: Math.min(dauer, c.bis + pad.nach) }; };
function zeitAufTimeline(p, m) {
  let t = 0;
  for (const c of p.clips) {
    const w = wirksam(p, c);
    if (c.quelle === m.quelle && m.zeit >= w.von - 0.001 && m.zeit < w.bis) return t + Math.max(0, m.zeit - w.von);
    t += w.bis - w.von;
  }
  return null;
}
async function exportieren() {
  const p = lies(), F = p.fps, B = p.breite || 1920;
  const dir = path.join(ORDNER, 'export'); fs.mkdirSync(dir, { recursive: true });
  let f = 0; const cuts = [];
  for (const c of p.clips) {
    const w = wirksam(p, c), fs0 = Math.round(w.von * F), n = Math.round((w.bis - w.von) * F);
    cuts.push({ f, t: f / F, n, d: n / F, src: p.quellen[c.quelle].pfad, fs: fs0, cam: fs0 / F, vol: c.vol ?? 1.0, name: c.name || '' });
    f += n;
  }
  fs.writeFileSync(path.join(dir, 'cuts.json'), JSON.stringify(cuts, null, 0));
  const gesamt = f / F;
  const a = ['-y']; let fc = '';
  cuts.forEach((c, i) => {
    a.push('-ss', c.cam.toFixed(4), '-t', (c.d + 0.5).toFixed(4), '-i', c.src);
    fc += `[${i}:v]fps=${F},trim=end_frame=${c.n},setpts=PTS-STARTPTS,scale=${B}:-2:flags=lanczos[v${i}];`;
    // 5 ms Blende an jedem Rand gegen Knackser an den Schnitten
    fc += `[${i}:a]atrim=end=${c.d.toFixed(5)},asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=${Math.max(0, c.d - 0.005).toFixed(5)}:d=0.005,volume=${c.vol}[a${i}];`;
  });
  fc += cuts.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${cuts.length}:v=1:a=1[v][a]`;
  const fcDatei = path.join(CACHE, 'export.fc'); fs.writeFileSync(fcDatei, fc);
  a.push('-/filter_complex', fcDatei, '-map', '[v]', '-map', '[a]', '-r', String(F), '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-g', String(F), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '256k', path.join(dir, 'voll.mp4'));
  await ffmpeg(a, x => sende('export', { fortschritt: Math.round(x * 100) }), gesamt);
  const kapitel = (p.marker || []).map(m => ({ name: m.name, t: zeitAufTimeline(p, m) })).filter(k => k.t !== null).sort((x, y) => x.t - y.t);
  fs.writeFileSync(path.join(dir, 'marker.json'), JSON.stringify(kapitel, null, 1));
  return { datei: path.join(dir, 'voll.mp4'), dauer: gesamt, clips: cuts.length };
}

// ---------- HTTP ----------
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.webm': 'video/webm' };

// ---------- Live-Vorschau: Kompositionen direkt aus dem Studio-Ordner, ohne Render ----------
function liveDatei(req, res, teil, rest) {
  const st = lies().live?.studio; if (!st) { res.writeHead(404); return res.end(); }
  // assets/ immer aus dem gemeinsamen Ordner, die Kopien in den Teilen sind nur für den Render und oft veraltet
  const basis = rest.startsWith('assets/') ? path.join(st, 'assets') : path.join(st, teil);
  const ziel = path.resolve(basis, rest.startsWith('assets/') ? rest.slice(7) : rest);
  if (!ziel.startsWith(path.resolve(st))) { res.writeHead(403); return res.end(); }
  if (/\.(mp4|mov|m4v)$/i.test(ziel)) return video(req, res, ziel);
  return datei(res, ziel);
}
function hfDatei(res, name) {
  const st = lies().live?.studio || '';
  return datei(res, path.join(st, 'node_modules', 'hyperframes', 'dist', name), 'text/javascript; charset=utf-8');
}
// Ändert Claude einen Teil, lädt das Studio nur diesen Teil neu
let liveTimer = {};
function liveBeobachten() {
  const st = lies().live?.studio; if (!st || !fs.existsSync(st)) return;
  try {
    fs.watch(st, { recursive: true }, (ev, d) => {
      if (!d) return; const teile = d.split(/[\\/]/);
      if (['output', 'node_modules', '.hyperframes', 'snapshots'].some(x => teile.includes(x))) return;
      const teil = teile[0] === 'assets' ? '*' : teile[0];
      clearTimeout(liveTimer[teil]); liveTimer[teil] = setTimeout(() => sende('live', { teil }), 800);   // Windows meldet eine Änderung oft mehrfach
    });
  } catch (e) { console.error('Live-Beobachtung nicht möglich:', e.message); }
}
function datei(res, pfad, typ) {
  if (!fs.existsSync(pfad)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': typ || TYPEN[path.extname(pfad)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(pfad).pipe(res);
}
function video(req, res, pfad) {
  if (!fs.existsSync(pfad)) { res.writeHead(404); return res.end(); }
  const g = fs.statSync(pfad).size, r = req.headers.range;
  if (!r) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': g, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(pfad).pipe(res); }
  // Offene Anfragen („bytes=X-“) nur in Stücken von 4 MB beantworten und den Lesestrom beim Abbruch schließen. Sonst hält
  // bei langen Aufnahmen jede Suche eine Verbindung bis zum Dateiende offen, Chrome erlaubt aber nur sechs je Server,
  // und nach ein paar Schnitten warten Video und Speichern sekundenlang auf eine freie.
  const [a, b] = r.replace('bytes=', '').split('-'); const s = parseInt(a), e = Math.min(b ? parseInt(b) : g - 1, s + 4 * 1024 * 1024 - 1, g - 1);
  res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${s}-${e}/${g}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 });
  const st = fs.createReadStream(pfad, { start: s, end: e }); res.on('close', () => st.destroy()); st.pipe(res);
}
const body = req => new Promise(ok => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const json = (res, x, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(x)); };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
  try {
    if (p === '/') return datei(res, path.join(HIER, 'ui', 'index.html'));
    if (p.startsWith('/ui/')) return datei(res, path.join(HIER, 'ui', path.basename(p)));
    if (p === '/api/projekt' && req.method === 'GET') return json(res, lies());
    if (p === '/api/projekt' && req.method === 'PUT') {
      const neu = await body(req), alt = lies();
      if (neu.version !== alt.version) return json(res, { fehler: 'veraltet', version: alt.version }, 409);
      neu.version = alt.version + 1; schreibe(neu); return json(res, { version: neu.version });
    }
    if (p === '/api/status') return json(res, { status, exportLaeuft, chat: chat.verlauf, chatLaeuft: !!chatProzess });
    if (p === '/api/chat' && req.method === 'POST') { const b = await body(req); return json(res, { ok: chatSenden(String(b.text || ''), String(b.kontext || '')) }); }
    if (p === '/api/anmeldung' && req.method === 'GET') return json(res, { angemeldet: angemeldet(), laeuft: !!anmeldung, ...agentInfo() });
    if (p === '/api/agent' && req.method === 'GET') return json(res, agentInfo());
    if (p === '/api/agent' && req.method === 'POST') { const b = await body(req); return json(res, { ok: agentWechseln(String(b.id || '')), ...agentInfo() }); }
    if (p === '/api/anmeldung' && req.method === 'POST') { anmeldungStarten(); return json(res, { ok: true }); }
    if (p === '/api/anmeldung/code' && req.method === 'POST') { const b = await body(req); if (anmeldung) anmeldung.stdin.write(String(b.code || '').trim() + String.fromCharCode(10)); return json(res, { ok: !!anmeldung }); }
    if (p === '/api/chat/stopp' && req.method === 'POST') { chatProzess?.kill(); return json(res, { ok: true }); }
    if (p === '/api/chat/neu' && req.method === 'POST') { if (!chatProzess) { chat = { sitzung: null, verlauf: [], agent: AGENT }; chatSpeichern(); } return json(res, { ok: !chatProzess }); }
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': ok\n\n'); hoerer.add(res); req.on('close', () => hoerer.delete(res)); return;
    }
    let m;
    if ((m = p.match(/^\/media\/([^/]+)\/proxy\.mp4$/))) { const pj = lies(); return video(req, res, pj.modus === 'abnahme' ? pj.quellen[m[1]].pfad : path.join(CACHE, m[1], 'vorschau-1080.mp4')); }
    if (p === '/live/player.js') return hfDatei(res, 'hyperframes-player.global.js');
    if (p === '/live/runtime.js') return hfDatei(res, 'hyperframe.runtime.iife.js');
    if ((m = p.match(/^\/live\/t\/([^/]+)\/(.+)$/))) return liveDatei(req, res, m[1], m[2]);
    if ((m = p.match(/^\/media\/([^/]+)\/welle\.bin$/))) return datei(res, path.join(CACHE, m[1], 'welle.bin'), 'application/octet-stream');
    if ((m = p.match(/^\/media\/([^/]+)\/woerter$/))) {
      const q = lies().quellen[m[1]]; if (!q?.woerter) return json(res, []);
      const zeilen = fs.readFileSync(path.join(ORDNER, q.woerter), 'utf8').split(/\r?\n/).filter(Boolean);
      return json(res, zeilen.map(z => z.split('\t')).filter(x => !isNaN(parseFloat(x[0]))).map(([a, b, t]) => [+a, +b, t]));
    }
    if (p === '/api/signal' && req.method === 'POST') { const b = await body(req); signal(b.art === 'feedback' ? 'feedback' : 'hinweis', { offen: b.offen }); return json(res, { ok: true }); }
    if (p === '/api/export' && req.method === 'POST') {
      if (exportLaeuft) return json(res, { fehler: 'läuft schon' }, 409);
      exportLaeuft = true; sende('export', { fortschritt: 0 });
      exportieren().then(r => { sende('export', { fertig: r }); signal('export', r); }).catch(e => { sende('export', { fehler: e.message.slice(-500) }); signal('fehler', { fehler: e.message.slice(-500) }); }).finally(() => exportLaeuft = false);
      return json(res, { ok: true });
    }
    res.writeHead(404); res.end();
  } catch (e) { json(res, { fehler: e.message }, 500); }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Video Studio läuft: http://localhost:${PORT}  (Projekt ${ORDNER})`);
  liveBeobachten();
  vorbereiten().catch(e => { console.error(e); sende('status', { fehler: e.message }); });
});
