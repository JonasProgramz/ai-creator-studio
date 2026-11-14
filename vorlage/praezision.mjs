#!/usr/bin/env node
// Präzisionstest für einen Teil: spult die Komposition im Browser in kleinen Schritten durch und meldet Stellen, die oft
// aus Versehen entstehen. Jeder Fund ist eine Frage, kein Verbot: Ist es gewollt (ein Bild, das bewusst aus dem Rand läuft,
// eine Karte, die bewusst über eine andere ragt), bekommt das Element data-praezision="aus" und bleibt so. Feedback zu einem Entwurf: „Logos verschoben, verdreht, zu klein, zerdrückt,
// Dinge nicht genau dort, wo sie sein müssen.“ Der Test findet die messbaren Fälle, das Ansehen in voller Auflösung ersetzt er nicht.
//
//   node praezision.mjs <teil> [schritt]      Standard 0,5 s. Aufruf meist über: node werkzeug.mjs praezision <teil>
//
// Gemeldet wird, jeweils mit Zeitbereich und Element:
//   kamera     sichtbares Element liegt unter der Kamera (mit 20 px Luft)
//   rand       sichtbares Element ragt über den Bildrand oder näher als 24 px heran
//   text       Text läuft halb aus seiner Karte (ganz außerhalb gilt als gewollte Beschriftung)
//   verzerrt   Bild wird gestaucht oder gestreckt (Seitenverhältnis weicht über 3 % ab, ohne object-fit)
//   ragt       Karte oder Kachel liegt fast ganz in einem größeren Kasten, ragt aber knapp über dessen Rand
//   eng        Karte oder Kachel liegt im Kasten, klebt aber an dessen Rand (unter 12 px Luft)
//   verdeckt   Text wird von einer anderen Karte überdeckt, die nicht zu ihm gehört
// Halb eingeblendete Elemente (Deckkraft unter 0,6) und Elemente in Bewegung zählen nicht, gemeldet wird erst ab zwei
// aufeinanderfolgenden Treffern. Bewusste Ausnahmen bekommen data-praezision="aus" am Element.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [name, schritt = '0.5'] = process.argv.slice(2);
if (!name) { console.error('Aufruf: node praezision.mjs <teil> [schritt]'); process.exit(1); }
const html = path.join(ROOT, name, 'index.html');
if (!fs.existsSync(html)) { console.error(`Keine index.html in ${name}.`); process.exit(1); }
fs.cpSync(path.join(ROOT, 'assets'), path.join(ROOT, name, 'assets'), { recursive: true });

// Chrome aus dem HyperFrames-Cache, egal welche Version
function chrome() {
  const base = path.join(os.homedir(), '.cache', 'hyperframes', 'chrome');
  const found = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (/^chrome-headless-shell(\.exe)?$/.test(e.name)) found.push(p);
  } };
  if (fs.existsSync(base)) walk(base);
  if (!found.length) { console.error('Kein Chrome im HyperFrames-Cache. Einmal "node werkzeug.mjs check <teil>" laufen lassen.'); process.exit(1); }
  return found.sort().pop();
}

const b = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
await p.goto(pathToFileURL(html).href, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 800));
const dauer = await p.evaluate(() => { const t = Object.values(window.__timelines || {})[0]; return t ? t.duration() : 0; });
if (!dauer) { console.error('Keine Timeline gefunden (window.__timelines). Skriptfehler? Erst "check" laufen lassen.'); await b.close(); process.exit(1); }

const funde = new Map();   // Schlüssel: art|element  ->  Liste der Zeiten
const dt = Number(schritt);
for (let t = 0.05; t < dauer; t += dt) {
  const r = await p.evaluate((t, dt) => {
    const tl = Object.values(window.__timelines)[0];
    tl.seek(t, false);
    const W = 1920, H = 1080, out = [];
    const cs = el => getComputedStyle(el);
    const deck = el => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const s = cs(e); if (s.display === 'none' || s.visibility === 'hidden') return 0; o *= Number(s.opacity); } return o; };
    const aus = el => !!el.closest('[data-praezision="aus"], #cam, #ground, .hf-ignore');
    const name = el => {
      if (el.id) return '#' + el.id;
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      const c = (el.className && el.className.baseVal === undefined ? el.className : '').toString().split(' ').filter(Boolean)[0];
      const host = el.closest('[id]');
      return (host ? '#' + host.id + ' ' : '') + (c ? '.' + c : el.tagName.toLowerCase()) + (txt ? ' „' + txt + '“' : '');
    };
    // sichtbares Rechteck: an Vorfahren mit overflow hidden abgeschnitten
    const sicht = el => {
      let r = el.getBoundingClientRect(); let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const s = cs(e); if (s.overflow === 'visible' && s.clipPath === 'none') continue;
        const q = e.getBoundingClientRect(); x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom);
      }
      return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
    };
    const schnitt = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    // Kamera aus den Clip-Variablen
    const cc = document.getElementById('camclip'); let cam = null;
    if (cc) { const s = cs(cc), v = k => parseFloat(s.getPropertyValue(k)) || 0;
      const x0 = v('--cl'), y0 = v('--ct'), x1 = W - v('--cr'), y1 = H - v('--cb');
      if (x1 - x0 > 50 && deck(cc) > 0.5) cam = { x0: x0 - 20, y0: y0 - 20, x1: x1 + 20, y1: y1 + 20 }; }
    const els = [...document.querySelectorAll('main *')].filter(el => !aus(el) && !['SCRIPT', 'STYLE', 'VIDEO', 'AUDIO'].includes(el.tagName));
    const sichtbar = els.filter(el => deck(el) >= 0.6);
    const blatt = el => el.children.length === 0 || el.tagName === 'IMG';   // bei SVGs zählen die einzelnen Formen, nicht die ganze Zeichenfläche
    const weich = s => { const m = s.filter.match(/blur\(([\d.]+)px\)/); return !!m && Number(m[1]) > 0.5; };   // blur(0px) nach dem Einblenden zählt nicht
    // Karte: deckende Fläche (Hintergrund mindestens 85 % deckend, nicht weichgezeichnet). Leuchtflächen und Verläufe zählen nicht.
    const karte = el => { const s = cs(el); if (weich(s)) return false;
      const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/); if (!m) return false; const v = m[1].split(',').map(Number);
      return (v.length < 4 || v[3] >= 0.85) && !(v.length === 4 && v[3] === 0); };
    for (const el of sichtbar) {
      const r = sicht(el); if (!r) continue;
      const w = r.x1 - r.x0, h = r.y1 - r.y0; if (w * h < 120) continue;
      const gross = w > W * 0.9 && h > H * 0.9;
      if (!gross && blatt(el)) {
        if (cam && schnitt(r, cam) > 0.02 * w * h) out.push(['kamera', name(el)]);
        if (r.x0 < 24 || r.y0 < 24 || r.x1 > W - 24 || r.y1 > H - 24) out.push(['rand', name(el)]);
      }
      if (el.tagName === 'IMG' && el.naturalWidth && cs(el).objectFit === 'fill') {
        const a = el.clientWidth / el.clientHeight, n = el.naturalWidth / el.naturalHeight;
        if (el.clientHeight && Math.abs(a / n - 1) > 0.03) out.push(['verzerrt', name(el)]);
      }
    }
    // Karten und Kacheln, die über den Rand eines größeren Kastens ragen (halb drin, halb draußen). Der Kasten muss kein
    // Vorfahr sein, oft liegen Kacheln als Geschwister darüber. Abzeichen unter 130 px dürfen auf Ecken sitzen.
    // Kasten: Fläche mit Hintergrund ab 20 % Deckkraft oder sichtbarem Rahmen (auch halbtransparente Gruppenkästen), keine Leuchtfläche
    const kasten = el => { const s = cs(el); if (weich(s) || s.backgroundImage.includes('radial')) return false;
      const m = s.backgroundColor.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(',').map(Number) : [0, 0, 0, 0];
      return (v.length < 4 || v[3] >= 0.2) || (parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none'); };
    const kk = sichtbar.filter(el => karte(el)).map(el => ({ el, r: sicht(el) })).filter(o => o.r);
    const kast = sichtbar.filter(el => kasten(el)).map(el => ({ el, r: sicht(el) })).filter(o => o.r);
    for (const a of kk) {
      const aw = a.r.x1 - a.r.x0, ah = a.r.y1 - a.r.y0, aa = aw * ah; if (aw < 130 && ah < 130) continue;
      for (const k of kast) {
        if (k === a || k.el.contains(a.el) && cs(k.el).overflow !== 'visible' || a.el.contains(k.el)) continue;
        const ka = (k.r.x1 - k.r.x0) * (k.r.y1 - k.r.y0); if (ka < aa * 1.5 || ka > W * H * 0.5) continue;
        const f = schnitt(a.r, k.r) / aa;
        if (f > 0.6 && f < 0.99) out.push(['ragt', name(a.el) + ' über ' + name(k.el)]);   // fast ganz drin, aber knapp über den Rand
        else if (f >= 0.99 && aw < 0.9 * (k.r.x1 - k.r.x0)) {   // ganz drin, klebt aber am Rand (unter 12 px Luft). Kopfleisten über die volle Breite sind gewollt.
          const g = Math.min(a.r.x0 - k.r.x0, k.r.x1 - a.r.x1, a.r.y0 - k.r.y0, k.r.y1 - a.r.y1);
          if (g < 12) out.push(['eng', name(a.el) + ' am Rand von ' + name(k.el)]);
        }
      }
    }
    // Text: läuft aus seiner Karte, oder eine fremde Karte liegt darüber
    const karten = sichtbar.filter(el => karte(el) && sicht(el));
    for (const el of sichtbar) {
      const tn = [...el.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!tn) continue;
      const rg = document.createRange(); rg.selectNodeContents(tn); const tr = rg.getBoundingClientRect();
      if (tr.width < 4) continue;
      const t0 = { x0: tr.left, y0: tr.top, x1: tr.right, y1: tr.bottom };
      let k = el; while (k && !(karte(k) && k !== el)) k = k.parentElement;
      if (k && k.tagName !== 'MAIN') { const q = k.getBoundingClientRect(), qr = { x0: q.left, y0: q.top, x1: q.right, y1: q.bottom };
        const f = schnitt(t0, qr) / ((t0.x1 - t0.x0) * (t0.y1 - t0.y0));   // ganz draußen ist eine gewollte Beschriftung, halb draußen ein Fehler
        if (f > 0.05 && f < 0.97) out.push(['text', name(el)]); }
      for (const c of karten) {
        if (c.contains(el) || el.contains(c) || c === k) continue;
        const cr = sicht(c); const ca = (cr.x1 - cr.x0) * (cr.y1 - cr.y0); if (ca > W * H * 0.5) continue;
        // nur Karten, die im Stapel über dem Text liegen
        const mx = (Math.max(t0.x0, cr.x0) + Math.min(t0.x1, cr.x1)) / 2, my = (Math.max(t0.y0, cr.y0) + Math.min(t0.y1, cr.y1)) / 2;
        if (schnitt(t0, cr) > 0.15 * (t0.x1 - t0.x0) * (t0.y1 - t0.y0)) { const top = document.elementFromPoint(mx, my); if (top && c.contains(top) && !el.contains(top)) out.push(['verdeckt', name(el) + ' unter ' + name(c)]); }
      }
    }
    return out;
  }, t, dt);
  for (const [art, el] of r) { const k = art + '|' + el; if (!funde.has(k)) funde.set(k, []); funde.get(k).push(Math.round(t * 100) / 100); }
}
await b.close();

// Treffer zu Zeitbereichen zusammenfassen, Einzeltreffer (Bewegung) verwerfen, gedreht erst ab 1 s
const zeilen = [];
for (const [k, ts] of funde) {
  const [art, el] = k.split('|');
  const bereiche = []; let a = ts[0], z = ts[0], n = 1;
  for (const t of ts.slice(1)) { if (t - z <= dt * 1.5) { z = t; n++; } else { bereiche.push([a, z, n]); a = z = t; n = 1; } }
  bereiche.push([a, z, n]);
  const gut = bereiche.filter(([a, z, n]) => n >= 2 && (art !== 'gedreht' || z - a >= 1));
  if (gut.length) zeilen.push([gut[0][0], art, el, gut.map(([a, z]) => a.toFixed(1) + ' bis ' + z.toFixed(1)).join(', ')]);
}
zeilen.sort((x, y) => x[0] - y[0]);
if (!zeilen.length) console.log(`${name}: keine Funde (${dauer.toFixed(1)} s in Schritten von ${dt} s).`);
else { console.log(`${name}: ${zeilen.length} Funde. Jeden an einem Einzelbild in voller Auflösung ansehen, beheben oder bewusst mit data-praezision="aus" markieren.`);
  for (const [, art, el, bs] of zeilen) console.log(`  ${art.padEnd(9)} ${bs} s  ${el}`); }
