// Belege neu aufnehmen und dabei die genaue Lage von Textstellen und Bildern messen.
// Start: im Studio-Ordner des Videos: node stellen.mjs stellen.json [name ...]
// stellen.json: [{name, url, typ: "x"|"seite", stellen: ["Wortlaut", ...], voll?: true, warte?: ms, breite?: px}]
// Ergebnis in ../belege/: <name>.png (X: nur der Post; Seite: ganze Seite) und <name>.json mit
//   groesse [w,h] in Bildpixeln, stellen {Wortlaut: [[x,y,w,h], ...] je Zeile}, medien [[x,y,w,h,"img"|"video",src]].
// Alle Rechtecke in Pixeln der PNG (Dichte 2). Unterstreichungen nur aus diesen Rechtecken setzen.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

// Chrome von HyperFrames suchen (wird bei der ersten Nutzung von HyperFrames geladen), CHROME_PFAD überschreibt
import os from 'node:os'; import path from 'node:path';
function chromePfad() {
  if (process.env.CHROME_PFAD) return process.env.CHROME_PFAD;
  const basis = path.join(os.homedir(), '.cache', 'hyperframes', 'chrome', 'chrome-headless-shell');
  const name = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  // neueste Version zuerst
  const suche = d => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => y.name.localeCompare(x.name, undefined, { numeric: true })) : []) { const p = path.join(d, e.name); if (e.isFile() && e.name === name) return p; if (e.isDirectory()) { const t = suche(p); if (t) return t; } } return null; };
  const p = suche(basis); if (!p) { console.error('Chrome von HyperFrames nicht gefunden. Einmal "npx hyperframes browser ensure" ausführen oder CHROME_PFAD setzen.'); process.exit(1); }
  return p;
}
const exe = chromePfad();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const OUT = process.env.BELEGE_OUT || '../belege';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cssX = `
[data-testid="BottomBar"], #layers [role="dialog"], #layers [data-testid="sheetDialog"],
[data-testid="BottomBar"] ~ div, [data-testid="mask"], #layers > div:has([role="dialog"]),
[role="region"][aria-label*="ookie" i], [role="dialog"], .x-hide { display: none !important; }
`;
const cssSeite = `
[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],#onetrust-consent-sdk,.qc-cmp2-container,
[id*="sp_message" i],iframe[title*="consent" i],.fc-consent-root,#didomi-host,[class*="modal-backdrop" i],
[class*="newsletter-modal" i],[class*="paywall" i],#__tcfapiLocator,[aria-label*="cookie" i]
{ display: none !important; visibility: hidden !important; }
html, body { overflow: auto !important; position: static !important; height: auto !important; }
`;
const ablehnTexte = ['reject all', 'alle ablehnen', 'ablehnen', 'decline', 'only necessary', 'necessary only', 'reject', 'deny'];

async function ablehnen(p) {
  for (const f of p.frames()) {
    try {
      await f.evaluate((texte) => {
        const els = [...document.querySelectorAll('button, [role="button"]')];
        for (const t of texte) {
          const el = els.find(e => { const s = (e.innerText || '').trim().toLowerCase(); return s === t || (s.length < 40 && s.includes(t) && !s.includes('accept')); });
          if (el) { el.click(); return; }
        }
      }, ablehnTexte);
    } catch {}
  }
}

async function xAusblenden(p) {
  await p.evaluate(() => {
    const texte = ['Log in or sign up for X', 'Scan to get the app', 'Don’t miss what’s happening', "Don't miss what's happening", 'New to X?'];
    for (const h of document.querySelectorAll('h2,h3,span,div')) {
      if (h.children.length === 0 && texte.some(t => h.textContent.trim().startsWith(t))) {
        const sec = h.closest('section') || h.closest('[role="dialog"]') || h.closest('aside') || h.parentElement?.parentElement;
        if (sec && !sec.querySelector('article')) sec.classList.add('x-hide');
      }
    }
  });
}

// Misst im Browser: Textstellen (über alle Textknoten, Leerraum normalisiert, ohne Groß/Klein) und Medien.
async function messen(p, wurzel, stellen) {
  return await p.evaluate((wurzel, stellen) => {
    const root = wurzel ? document.querySelector(wurzel) : document.body;
    const base = root.getBoundingClientRect();
    const ox = wurzel ? base.left : -window.scrollX, oy = wurzel ? base.top : -window.scrollY;
    const knoten = []; let text = '';
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; const s = n.textContent;
      if (!s) continue;
      const el = n.parentElement; if (el && getComputedStyle(el).display === 'none') continue;
      knoten.push({ n, a: text.length }); text += s;
    }
    // normalisierter Text mit Rückverweis auf die Rohposition
    let norm = '', map = [];
    for (let i = 0; i < text.length; i++) {
      let c = text[i].replace(/[\s\u00a0]/, ' ').toLowerCase();
      c = c.replace(/[’‘]/, "'").replace(/[“”]/, '"');
      if (c === ' ' && norm.endsWith(' ')) continue;
      norm += c; map.push(i);
    }
    const wo = (i) => { let k = knoten.length - 1; while (k > 0 && knoten[k].a > i) k--; return [knoten[k].n, i - knoten[k].a]; };
    const erg = {};
    for (const st of stellen) {
      const q = st.replace(/\s+/g, ' ').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
      const treffer = []; let von = 0;
      while (true) {
        const i = norm.indexOf(q, von); if (i < 0) break;
        const [n0, o0] = wo(map[i]); const [n1, o1] = wo(map[i + q.length - 1]);
        const r = document.createRange(); r.setStart(n0, o0); r.setEnd(n1, o1 + 1);
        // Rechtecke je Zeile zusammenfassen
        const zeilen = [];
        // Nur Text messen, Wort für Wort: so zählen weder Kästen umschließender Elemente (Zeilenabstand bei Überschriften)
        // noch Leerzeichen am Zeilenende mit (beides ließ Unterstreichungen zu tief oder zu lang werden, 07.11.2026)
        const boxen = [];
        const k0 = knoten.findIndex(k => k.n === n0), k1 = knoten.findIndex(k => k.n === n1);
        for (let k = k0; k <= k1; k++) {
          const tn = knoten[k].n, s0 = k === k0 ? o0 : 0, s1 = k === k1 ? o1 + 1 : tn.textContent.length;
          const t = tn.textContent; let a = s0;
          while (a < s1) {
            while (a < s1 && /\s/.test(t[a])) a++;
            let e = a; while (e < s1 && !/\s/.test(t[e])) e++;
            if (e > a) { const w = document.createRange(); w.setStart(tn, a); w.setEnd(tn, e); boxen.push(...w.getClientRects()); }
            a = e;
          }
        }
        for (const b of boxen) {
          if (b.width < 1 || b.height < 1) continue;
          const z = zeilen.find(z => Math.abs(z.y - b.top) < b.height * 0.5);
          if (z) { z.x0 = Math.min(z.x0, b.left); z.x1 = Math.max(z.x1, b.right); z.y1 = Math.max(z.y1, b.bottom); }
          else zeilen.push({ y: b.top, x0: b.left, x1: b.right, y1: b.bottom });
        }
        treffer.push(zeilen.map(z => [z.x0 - ox, z.y - oy, z.x1 - z.x0, z.y1 - z.y]));
        (window.__ctx = window.__ctx || []).push(st + ' => …' + norm.slice(Math.max(0, i - 50), i + q.length + 50) + '…');
        von = i + 1;
      }
      erg[st] = treffer;
    }
    const medien = [];
    for (const m of root.querySelectorAll('img, video')) {
      const b = m.getBoundingClientRect(); if (b.width < 120 || b.height < 80) continue;
      medien.push([b.left - ox, b.top - oy, b.width, b.height, m.tagName.toLowerCase(), (m.currentSrc || m.src || m.poster || '').slice(0, 200)]);
    }
    return { ctx: window.__ctx || [], stellen: erg, medien, breite: base.width, hoehe: wurzel ? base.height : document.documentElement.scrollHeight };
  }, wurzel, stellen);
}

const skal = (r, k) => r.map(v => typeof v === 'number' ? Math.round(v * k) : v);

async function xPost(p, j) {
  await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  try { await p.goto(j.url, { waitUntil: 'networkidle2', timeout: 60000 }); } catch {}
  await sleep(3500);
  await p.addStyleTag({ content: cssX });
  await p.waitForSelector('article', { timeout: 20000 });
  await sleep(1500); await xAusblenden(p);
  const id = (j.url.match(/status\/(\d+)/) || [])[1];
  await p.evaluate((id) => {
    for (const a of document.querySelectorAll('article')) if (a.querySelector('a[href$="/status/' + id + '"], a[href*="/status/' + id + '/"]')) { a.id = 'beleg-wurzel'; return; }
    document.querySelector('article').id = 'beleg-wurzel';
  }, id);
  await p.evaluate(() => document.querySelector('#beleg-wurzel').scrollIntoView({ block: 'start' }));
  await sleep(1500); await p.addStyleTag({ content: cssX }); await xAusblenden(p);
  const m = await messen(p, '#beleg-wurzel', j.stellen || []);
  const art = await p.$('#beleg-wurzel');
  await art.screenshot({ path: `${OUT}/${j.name}.png` });
  return m;
}

async function seite(p, j) {
  const B = j.breite || 1440;
  await p.setViewport({ width: B, height: 900, deviceScaleFactor: 2 });
  try { await p.goto(j.url, { waitUntil: 'networkidle2', timeout: 60000 }); } catch {}
  await sleep(2500 + (j.warte || 0));
  await ablehnen(p); await sleep(1200);
  await p.addStyleTag({ content: cssSeite }).catch(() => {});
  if (j.css) await p.addStyleTag({ content: j.css }).catch(() => {});
  // große feste Ebenen (Dialoge, Abdunklung) entfernen
  await p.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const c = getComputedStyle(el); if ((c.position === 'fixed' || c.position === 'sticky') && el.offsetWidth * el.offsetHeight > innerWidth * innerHeight * 0.3) el.remove(); } document.body.style.overflow = 'auto'; document.documentElement.style.overflow = 'auto'; });
  // Lazy-Bilder laden
  await p.evaluate(async () => { for (let y = 0; y < Math.min(document.documentElement.scrollHeight, 30000); y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await sleep(1000);
  const h = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
  const hoehe = Math.min(Math.max(h, 900), j.maxHoehe || 16000);
  await p.setViewport({ width: B, height: hoehe, deviceScaleFactor: 2 });
  await sleep(1500); await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
  const m = await messen(p, null, j.stellen || []);
  await p.screenshot({ path: `${OUT}/${j.name}.png`, fullPage: false });
  m.hoehe = hoehe;
  return m;
}

const [datei, ...nur] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(datei, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const b = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--lang=en-US,en'] });
for (const j of jobs) {
  if (nur.length && !nur.includes(j.name)) continue;
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,de;q=0.8' });
  try {
    const m = j.typ === 'x' ? await xPost(p, j) : await seite(p, j);
    const out = { quelle: j.url, groesse: [Math.round(m.breite * 2), Math.round(m.hoehe * 2)], stellen: {}, medien: m.medien.map(r => skal(r, 2)) };
    const fehlt = [];
    for (const [k, v] of Object.entries(m.stellen)) { out.stellen[k] = v.map(t => t.map(r => skal(r, 2))); if (!v.length) fehlt.push(k); }
    fs.writeFileSync(`${OUT}/${j.name}.json`, JSON.stringify(out, null, 1));
    if (process.env.CTX) for (const c of m.ctx || []) console.log('   ', c.slice(0, 220));
    console.log('ok', j.name, out.groesse.join('x'), fehlt.length ? 'FEHLT: ' + fehlt.join(' | ') : '');
  } catch (e) { console.log('FEHLER', j.name, e.message.slice(0, 200)); }
  await p.close();
}
await b.close();
