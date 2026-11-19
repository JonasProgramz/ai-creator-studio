// Video Studio, Oberfläche. Kein Build-Schritt, keine Abhängigkeiten.
'use strict';

const $ = s => document.querySelector(s);
const FPS_VORSCHAU = 30;
let P = null;                 // projekt.json
const Q = {};                 // quelle -> { dauer, welle: Uint8Array, woerter: [[t0,t1,wort]] }
let L = { start: [], gesamt: 0 };   // Lage der Clips auf der Timeline
let kopf = 0;                 // Abspielkopf in Sekunden Timeline
let spielt = false;
let auswahl = null;           // { typ: 'clip'|'marker', id }
const rueck = [], vor = [];

// ---------- Hilfen ----------
const zeitText = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
const toast = (text) => { const e = $('#toast'); e.textContent = text; e.classList.add('an'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('an'), 2200); };
let idZaehler = 0;
const neueId = (p) => { let id; do id = p + (++idZaehler) + Math.random().toString(36).slice(2, 5); while ([...P.clips, ...P.marker].some(x => x.id === id)); return id; };
let PAD = { vor: 0, nach: 0 };   // Luft an Schnitten in Sekunden, wirkt auf Vorschau, Transkript und Export
function wirk(c) {   // Luft darf negativ sein (Schnitte enger), ein Clip bleibt aber mindestens 40 ms lang
  let v = Math.max(0, c.von - PAD.vor), b = Math.min(Q[c.quelle]?.dauer || 1e9, c.bis + PAD.nach);
  if (b - v < 0.04) { const m = (c.von + c.bis) / 2; v = m - 0.02; b = m + 0.02; }
  return [v, b];
}
const V = c => wirk(c)[0], BI = c => wirk(c)[1], D = c => BI(c) - V(c);
function farbe(name) { let h = 0; for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

function layout() {
  let t = 0; L.start = P.clips.map(c => { const s = t; t += D(c); return s; }); L.gesamt = t;
}
function anStelle(T) {           // Timeline -> Clip und Quellzeit
  if (!P.clips.length) return null;
  T = Math.max(0, Math.min(T, L.gesamt - 1e-4));
  let lo = 0, hi = P.clips.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L.start[m] <= T) lo = m; else hi = m - 1; }
  const c = P.clips[lo]; return { i: lo, clip: c, s: V(c) + (T - L.start[lo]) };
}
function markerZeit(m) {         // Quellanker -> Timeline, null wenn herausgeschnitten
  for (let i = 0; i < P.clips.length; i++) { const c = P.clips[i]; if (c.quelle === m.quelle && m.zeit >= V(c) - 1e-3 && m.zeit < BI(c)) return L.start[i] + Math.max(0, m.zeit - V(c)); }
  return null;
}

// ---------- Laden und Speichern ----------
async function laden() {
  P = await (await fetch('/api/projekt')).json();
  P.marker = P.marker || []; PAD = P.puffer || { vor: 0, nach: 0 }; pufferAnzeigen();
  $('#projektname').textContent = (P.modus === 'abnahme' ? 'Abnahme · ' : '') + (P.name || ''); document.body.classList.toggle('abnahme', P.modus === 'abnahme');
  $('#b-weiter').textContent = P.modus === 'abnahme' ? 'Feedback speichern' : 'Weitergeben';
  for (const id of Object.keys(P.quellen)) if (!Q[id]) {
    Q[id] = { dauer: 0, welle: null, woerter: [] };
    fetch(`/media/${id}/woerter`).then(r => r.json()).then(w => { Q[id].woerter = w.sort((x, y) => x[0] - y[0]); transkript(); });
  }
  layout(); transkript(); markerliste(); zeichne(); zeitAnzeige(); liveStart();
}
let speicherTimer = null, speichertLaeuft = false;
function speichern() {
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(async () => {
    speichertLaeuft = true;
    const r = await fetch('/api/projekt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(P) });
    const a = await r.json(); speichertLaeuft = false;
    if (r.status === 409) { toast('Das Projekt wurde außerhalb geändert, neu geladen'); await laden(); return; }
    P.version = a.version;
  }, 300);
}
function aenderung(fn, text, ohneSchritt) {   // jede Bearbeitung läuft hierüber: Rückgängig, Neuaufbau, Speichern
  if (!ohneSchritt) { rueck.push(JSON.stringify({ clips: P.clips, marker: P.marker, puffer: P.puffer })); if (rueck.length > 200) rueck.shift(); vor.length = 0; }
  fn(); P.clips = P.clips.filter(c => c.bis - c.von > 0.02); PAD = P.puffer || PAD;
  layout(); kopf = Math.min(kopf, L.gesamt); transkript(); markerliste(); zeichne(); zeitAnzeige(); suchen(kopf); speichern();
  if (text) toast(text);
}
function zurueck(liste, gegen) {
  if (!liste.length) return;
  gegen.push(JSON.stringify({ clips: P.clips, marker: P.marker, puffer: P.puffer }));
  const z = JSON.parse(liste.pop()); P.clips = z.clips; P.marker = z.marker; P.puffer = z.puffer; PAD = P.puffer || { vor: 0, nach: 0 }; pufferAnzeigen();
  layout(); kopf = Math.min(kopf, L.gesamt); transkript(); markerliste(); zeichne(); zeitAnzeige(); suchen(kopf); speichern();
}

// ---------- Wiedergabe: zwei Videos im Wechsel, das nächste wartet schon am Schnitt ----------
let A = $('#va'), B = $('#vb'), aktClip = -1;
A.classList.add('aktiv');
function bereite(v, clipIndex) {
  const c = P.clips[clipIndex]; if (!c) return;
  const src = `/media/${c.quelle}/proxy.mp4`;
  if (!v.src.endsWith(src)) v.src = src;
  v.dataset.clip = clipIndex; v.muted = true; v.pause();
  if (Math.abs(v.currentTime - V(c)) > 0.01) v.currentTime = V(c);
}
function suchen(T) {
  kopf = Math.max(0, Math.min(T, L.gesamt));
  const a = anStelle(kopf); if (!a) return;
  const src = `/media/${a.clip.quelle}/proxy.mp4`;
  if (!A.src.endsWith(src)) A.src = src;
  A.currentTime = a.s; aktClip = a.i; A.dataset.clip = a.i;
  A.muted = false;
  bereite(B, a.i + 1);
  if (spielt) A.play().catch(() => {});
}
function spielen(an) {
  spielt = an ?? !spielt;
  $('#ico-play').innerHTML = spielt ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>' : '<path d="M8 5.5v13l11-6.5z"/>';
  if (spielt) { if (kopf >= L.gesamt - 0.05) suchen(0); else suchen(kopf); A.play().catch(() => {}); }
  else { A.pause(); B.pause(); }
}
function takt() {
  if (spielt && aktClip >= 0) {
    const c = P.clips[aktClip];
    if (c) {
      if (A.currentTime >= BI(c) - 0.012) {
        const n = aktClip + 1;
        if (n >= P.clips.length) { kopf = L.gesamt; spielen(false); }
        else {
          // Wechsel auf das wartende Video, ohne Lücke
          const naechster = P.clips[n];
          if (Number(B.dataset.clip) !== n || Math.abs(B.currentTime - V(naechster)) > 0.15) bereite(B, n);
          B.muted = false; B.play().catch(() => {});
          B.classList.add('aktiv'); A.classList.remove('aktiv'); A.pause(); A.muted = true;
          [A, B] = [B, A]; aktClip = n; kopf = L.start[n];
          bereite(B, n + 1);
        }
      } else if (A.currentTime >= V(c) - 0.05) kopf = L.start[aktClip] + (A.currentTime - V(c));
    }
    folgen();
  }
  zeitAnzeige(); jetztWort(); liveTakt();
  if (spielt || neuZeichnen || kopf !== letzterKopf) { letzterKopf = kopf; zeichneJetzt(); }
  requestAnimationFrame(takt);
}
let letzterKopf = -1;
function zeitAnzeige() { $('#zeit').textContent = zeitText(kopf); $('#dauer').textContent = zeitText(L.gesamt); }

// ---------- Bearbeiten ----------
function teilen() {
  const a = anStelle(kopf); if (!a) return;
  if (a.s - V(a.clip) < 0.05 || BI(a.clip) - a.s < 0.05) return toast('Zu nah am Schnitt');
  aenderung(() => { const neu = { ...a.clip, id: neueId('c'), von: +(a.s + PAD.vor).toFixed(3) }; a.clip.bis = +(a.s - PAD.nach).toFixed(3); P.clips.splice(a.i + 1, 0, neu); auswahl = { typ: 'clip', id: neu.id }; }, 'Geteilt');
}
function seiteLoeschen(links) {
  const a = anStelle(kopf); if (!a) return;
  aenderung(() => { if (links) { a.clip.von = +(a.s + PAD.vor).toFixed(3); kopf = L.start[a.i]; } else a.clip.bis = +(a.s - PAD.nach).toFixed(3); }, links ? 'Links vom Abspielkopf gelöscht' : 'Rechts vom Abspielkopf gelöscht');
}
function bereichSchneiden(T0, T1) {
  if (T1 - T0 < 0.02) return;
  aenderung(() => {
    const neu = [];
    P.clips.forEach((c, i) => {
      const a = L.start[i], b = a + D(c);
      if (b <= T0 || a >= T1) return neu.push(c);
      if (T0 > a) neu.push({ ...c, bis: +(V(c) + (T0 - a) - PAD.nach).toFixed(3) });
      if (T1 < b) neu.push({ ...c, id: neueId('c'), von: +(V(c) + (T1 - a) + PAD.vor).toFixed(3) });
    });
    P.clips = neu; kopf = T0;
  }, `${(T1 - T0).toFixed(1)} s herausgeschnitten`);
}
function loeschen() {
  const sel = getSelection();
  if (sel && !sel.isCollapsed && $('#transkript').contains(sel.anchorNode)) return woerterLoeschen(sel);
  if (auswahl?.typ === 'clip' && P.modus !== 'abnahme') {
    const i = P.clips.findIndex(c => c.id === auswahl.id); if (i < 0) return;
    aenderung(() => { kopf = L.start[i]; P.clips.splice(i, 1); auswahl = null; }, 'Clip gelöscht');
  } else if (auswahl?.typ === 'marker') {
    aenderung(() => { P.marker = P.marker.filter(m => m.id !== auswahl.id); auswahl = null; }, 'Marker gelöscht');
  }
}
function markerSetzen(T0 = kopf, T1 = null) {
  const a = anStelle(T0); if (!a) return;
  const b = T1 !== null ? anStelle(T1) : null;
  let neu;
  aenderung(() => {
    neu = { id: neueId('m'), quelle: a.clip.quelle, zeit: +a.s.toFixed(3), name: '', text: '' };
    if (b && b.clip.quelle === a.clip.quelle && b.s > a.s) neu.bisZeit = +b.s.toFixed(3);
    P.marker.push(neu); auswahl = { typ: 'marker', id: neu.id };
  }, T1 !== null ? 'Bereich markiert' : 'Marker gesetzt');
  markerOeffnen(neu.id);
}
function markerOeffnen(id) {   // Marker-Liste zeigen und das Kommentarfeld des Markers fokussieren
  document.querySelector('.tabs button[data-tab="marker"]').click();
  const li = document.querySelector(`#markerliste li[data-id="${id}"]`); if (!li) return;
  li.scrollIntoView({ block: 'nearest' }); li.querySelector('textarea').focus();
}
function markerAendern(m, felder) { aenderung(() => Object.assign(m, felder)); }
function markerFarbe(m) { return m.erledigt ? '#5cc98a' : (m.text || '').trim() ? '#ff8a5c' : '#ffc94d'; }
function markerEnde(m) { if (m.bisZeit === undefined) return null; return markerZeit({ quelle: m.quelle, zeit: m.bisZeit }); }
function springeSchnitt(richtung) {
  const ks = [...L.start, L.gesamt];
  const z = richtung > 0 ? ks.find(t => t > kopf + 0.01) : [...ks].reverse().find(t => t < kopf - 0.01);
  if (z !== undefined) suchen(z);
}

// ---------- Transkript ----------
let WT = [];   // [{ t0, t1, el }] in Timeline-Zeit
function transkript() {
  const box = $('#transkript'); if (!P) return;
  const frag = document.createDocumentFragment(); WT = [];
  let letzterName = null;
  P.clips.forEach((c, i) => {
    if (c.name && c.name !== letzterName) { const k = document.createElement('span'); k.className = 'kapitel'; k.textContent = c.name; frag.appendChild(k); }
    else if (i > 0) { const n = document.createElement('span'); n.className = 'naht'; n.title = 'Schnitt'; frag.appendChild(n); }
    letzterName = c.name;
    // Wörter sind nach Zeit sortiert: per Binärsuche zum Clipanfang springen statt bei jedem Clip alle Wörter durchzugehen
    const ws = Q[c.quelle]?.woerter || [], v0 = V(c) - 0.05, b0 = BI(c);
    let lo = 0, hi = ws.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ws[m][0] < v0) lo = m + 1; else hi = m; }
    for (let k = lo; k < ws.length && ws[k][0] < b0; k++) {
      const [t0, t1, w] = ws[k];
      const e = document.createElement('span'); e.className = 'w'; e.textContent = w;
      const T0 = L.start[i] + Math.max(0, t0 - V(c)), T1 = L.start[i] + Math.min(BI(c), t1) - V(c);
      e.dataset.i = WT.length; WT.push({ t0: T0, t1: T1, el: e });
      frag.appendChild(e); frag.appendChild(document.createTextNode(' '));
    }
  });
  box.replaceChildren(frag); jetzt = -1;
}
let jetzt = -1;
function jetztWort() {
  if (!WT.length) return;
  let lo = 0, hi = WT.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (WT[m].t0 <= kopf) lo = m; else hi = m - 1; }
  const i = WT[lo].t0 <= kopf ? lo : -1;
  if (i === jetzt) return;
  if (jetzt >= 0) WT[jetzt]?.el.classList.remove('jetzt');
  jetzt = i; if (i < 0) return;
  const e = WT[i].el; e.classList.add('jetzt');
  if (spielt) { const box = $('#tab-text'), r = e.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top + 40 || r.bottom > b.bottom - 40) box.scrollTop += r.top - b.top - b.height / 3; }
}
$('#transkript').addEventListener('click', e => { if (!getSelection().isCollapsed) return; const w = e.target.closest('.w'); if (w) suchen(WT[+w.dataset.i].t0); });
function woerterLoeschen(sel) {
  const r = sel.getRangeAt(0); const ws = [...$('#transkript').querySelectorAll('.w')].filter(e => r.intersectsNode(e));
  if (!ws.length) return;
  const a = +ws[0].dataset.i, b = +ws[ws.length - 1].dataset.i;
  const T0 = Math.max(a > 0 ? WT[a - 1].t1 : 0, WT[a].t0 - 0.04);
  const T1 = b + 1 < WT.length ? Math.min(WT[b + 1].t0 - 0.04, WT[b].t1 + 0.35) : Math.min(L.gesamt, WT[b].t1 + 0.2);
  sel.removeAllRanges(); bereichSchneiden(T0, Math.max(T0 + 0.05, T1));
}

// ---------- Marker-Liste ----------
function markerliste() {
  const ul = $('#markerliste'); ul.replaceChildren();
  const liste = P.marker.map(m => ({ m, t: markerZeit(m), t1: markerEnde(m) })).sort((x, y) => (x.t ?? 1e9) - (y.t ?? 1e9));
  for (const { m, t, t1 } of liste) {
    const li = document.createElement('li'); li.dataset.id = m.id;
    li.classList.toggle('erledigt', !!m.erledigt); li.classList.toggle('gewaehlt', auswahl?.typ === 'marker' && auswahl.id === m.id);
    li.innerHTML = `<div class="mk-kopf"><i></i><input class="mk-name" placeholder="Titel"><time></time>
      <button class="mk-ok" title="Als erledigt markieren">✓</button><button class="mk-weg" title="Löschen">✕</button></div>
      <textarea class="mk-text" rows="2" placeholder="Feedback oder Notiz zu dieser Stelle …"></textarea><div class="mk-antwort" hidden></div>`;
    li.querySelector('i').style.background = markerFarbe(m);
    li.querySelector('time').textContent = t === null ? 'herausgeschnitten' : zeitText(t) + (t1 !== null ? ' bis ' + zeitText(t1) : '');
    const name = li.querySelector('.mk-name'), text = li.querySelector('.mk-text'), antw = li.querySelector('.mk-antwort');
    name.value = m.name || ''; text.value = m.text || '';
    if (m.antwort) { antw.hidden = false; antw.textContent = 'Agent: ' + m.antwort; }
    name.addEventListener('change', () => markerAendern(m, { name: name.value }));
    text.addEventListener('change', () => markerAendern(m, { text: text.value }));
    text.addEventListener('input', () => { text.style.height = 'auto'; text.style.height = text.scrollHeight + 'px'; });
    li.querySelector('.mk-ok').onclick = () => markerAendern(m, { erledigt: !m.erledigt });
    li.querySelector('.mk-weg').onclick = () => aenderung(() => { P.marker = P.marker.filter(x => x !== m); }, 'Marker gelöscht');
    li.addEventListener('click', e => { if (e.target.closest('button, input, textarea')) return; if (t !== null) suchen(t); auswahl = { typ: 'marker', id: m.id }; zeichne(); });
    ul.appendChild(li);
    requestAnimationFrame(() => { text.style.height = 'auto'; text.style.height = Math.max(44, text.scrollHeight) + 'px'; });
  }
  const offen = P.marker.filter(m => (m.text || '').trim() && !m.erledigt).length;
  document.querySelector('.tabs button[data-tab="marker"]').textContent = offen ? `Marker · ${offen} offen` : 'Marker';
}

// ---------- Timeline ----------
const cv = $('#spur'), cx = cv.getContext('2d');
let pps = 20, links = 0;      // Pixel pro Sekunde, linker Rand in Sekunden
const LINEAL = 28, SPUR_Y = 44, SPUR_H = 150;
function zoomAus(v) { pps = 2 * Math.pow(400 / 2, v / 100); }
zoomAus(+$('#zoom').value);
const xVon = t => (t - links) * pps, tVon = x => x / pps + links;
function groesse() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; cx.setTransform(d, 0, 0, d, 0, 0); }
function schrittFuer() { const ziele = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]; return ziele.find(s => s * pps >= 70) || 600; }
function folgen() { const w = cv.clientWidth; const x = xVon(kopf); if (x > w - 60 || x < 0) links = Math.max(0, kopf - 60 / pps); }

let neuZeichnen = true;
function zeichne() { neuZeichnen = true; }
function zeichneJetzt() {
  neuZeichnen = false;
  if (!P) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  cx.clearRect(0, 0, w, h);
  cx.fillStyle = '#17171a'; cx.fillRect(0, 0, w, h);
  // Lineal
  cx.fillStyle = '#1d1d21'; cx.fillRect(0, 0, w, LINEAL);
  const st = schrittFuer(); cx.font = '11px system-ui, sans-serif'; cx.textBaseline = 'middle';
  for (let t = Math.floor(links / st) * st; t < tVon(w); t += st) {
    const x = Math.round(xVon(t)) + 0.5; cx.strokeStyle = '#3a3a41'; cx.beginPath(); cx.moveTo(x, LINEAL - 8); cx.lineTo(x, LINEAL); cx.stroke();
    cx.fillStyle = '#7a7a84'; cx.fillText(zeitText(t).replace(/\.00$/, ''), x + 4, 11);
    for (let k = 1; k < 5; k++) { const xx = Math.round(xVon(t + st * k / 5)) + 0.5; cx.beginPath(); cx.moveTo(xx, LINEAL - 4); cx.lineTo(xx, LINEAL); cx.stroke(); }
  }
  // Clips
  const yH = Math.min(SPUR_H, h - SPUR_Y - 16);
  P.clips.forEach((c, i) => {
    const x0 = xVon(L.start[i]), x1 = xVon(L.start[i] + D(c));
    if (x1 < 0 || x0 > w) return;
    const hue = farbe(c.name), gewaehlt = auswahl?.typ === 'clip' && auswahl.id === c.id;
    const bx = x0 + 1, bw = Math.max(1, x1 - x0 - 2);
    cx.fillStyle = `hsl(${hue} 28% 24%)`; rund(bx, SPUR_Y, bw, yH, 5); cx.fill();
    // Tonwelle
    const welle = Q[c.quelle]?.welle;
    if (welle && bw > 2) {
      const mitte = SPUR_Y + 20 + (yH - 20) / 2, amp = (yH - 28) / 2;
      cx.fillStyle = `hsl(${hue} 45% 58%)`;
      const xa = Math.max(bx, 0), xb = Math.min(bx + bw, w);
      for (let x = Math.floor(xa); x < xb; x++) {
        const s0 = V(c) + (x - x0) / pps, s1 = s0 + 1 / pps;
        let m = 0; for (let k = Math.floor(s0 * 100), e = Math.max(k + 1, Math.ceil(s1 * 100)); k < e && k < welle.length; k++) if (welle[k] > m) m = welle[k];
        const a = Math.max(1, m / 255 * amp); cx.fillRect(x, mitte - a, 1, a * 2);
      }
    }
    // Kopfzeile mit Name
    cx.save(); rund(bx, SPUR_Y, bw, yH, 5); cx.clip();
    cx.fillStyle = `hsl(${hue} 30% 32%)`; cx.fillRect(bx, SPUR_Y, bw, 18);
    if (bw > 40) { cx.fillStyle = '#e6e6ea'; cx.font = '600 11px system-ui, sans-serif'; cx.fillText(c.name || `Clip ${i + 1}`, bx + 6, SPUR_Y + 9.5); }
    cx.restore();
    if (gewaehlt) { cx.strokeStyle = '#ffffff'; cx.lineWidth = 2; rund(bx + 1, SPUR_Y + 1, bw - 2, yH - 2, 4); cx.stroke(); cx.lineWidth = 1; }
  });
  // Ziehen: Hinweis am Rand
  // Griff an der Kante, die gerade gegriffen ist oder unter der Maus liegt
  const kante = zug?.art === 'trim' ? { i: zug.i, rand: zug.rand } : hover;
  if (kante && P.clips[kante.i]) {
    const c = P.clips[kante.i], xs = kante.rand === 'links' ? xVon(L.start[kante.i]) + 1 : xVon(L.start[kante.i] + D(c)) - 1;
    const xi = kante.rand === 'links' ? xs : xs - 6;
    cx.fillStyle = '#ffc94d'; rund(xi, SPUR_Y, 6, yH, 3); cx.fill();
    cx.fillStyle = 'rgba(23,23,26,.8)'; for (let k = -1; k <= 1; k++) cx.fillRect(xi + 2.5, SPUR_Y + yH / 2 + k * 5 - 1, 1, 2);
  }
  // Bereich, der gerade mit Umschalt gezogen wird
  if (zug?.art === 'bereich' && zug.t1 !== undefined) { const a = xVon(Math.min(zug.t0, zug.t1)), b = xVon(Math.max(zug.t0, zug.t1)); cx.fillStyle = 'rgba(255,138,92,.25)'; cx.fillRect(a, 0, b - a, SPUR_Y + yH); }
  // Marker: gelb ohne Text, orange mit offenem Feedback, grün erledigt; Bereiche als Band
  for (const m of P.marker) {
    const t = markerZeit(m); if (t === null) continue;
    const x = Math.round(xVon(t)) + 0.5, t1 = markerEnde(m), farbeM = markerFarbe(m);
    if (x > w + 10 || (t1 === null ? x < -200 : xVon(t1) < -10)) continue;
    const gew = auswahl?.typ === 'marker' && auswahl.id === m.id;
    if (t1 !== null) { const x1 = xVon(t1); cx.globalAlpha = gew ? .35 : .2; cx.fillStyle = farbeM; cx.fillRect(x, LINEAL - 4, x1 - x, SPUR_Y + yH - LINEAL + 4); cx.globalAlpha = 1; cx.fillStyle = farbeM; cx.fillRect(x, LINEAL - 4, x1 - x, 3); }
    cx.strokeStyle = farbeM; cx.globalAlpha = .55; cx.beginPath(); cx.moveTo(x, LINEAL); cx.lineTo(x, SPUR_Y + yH); cx.stroke(); cx.globalAlpha = 1;
    cx.fillStyle = gew ? '#fff' : farbeM; cx.beginPath(); cx.moveTo(x - 6, LINEAL - 16); cx.lineTo(x + 6, LINEAL - 16); cx.lineTo(x + 6, LINEAL - 6); cx.lineTo(x, LINEAL); cx.lineTo(x - 6, LINEAL - 6); cx.fill();
    const titel = m.name || (m.text || '').split('\n')[0].slice(0, 40); if (!titel) continue;
    cx.font = '600 11px system-ui, sans-serif'; const tw = cx.measureText(titel).width;
    cx.fillStyle = 'rgba(23,23,26,.85)'; cx.fillRect(x + 8, LINEAL - 18, tw + 8, 15);
    cx.fillStyle = gew ? '#fff' : farbeM; cx.fillText(titel, x + 12, LINEAL - 10.5);
  }
  rollbalken();
  // Abspielkopf
  const xk = Math.round(xVon(kopf)) + 0.5;
  cx.strokeStyle = '#ff4d4d'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(xk, 0); cx.lineTo(xk, h); cx.stroke(); cx.lineWidth = 1;
  cx.fillStyle = '#ff4d4d'; cx.beginPath(); cx.moveTo(xk - 6, 0); cx.lineTo(xk + 6, 0); cx.lineTo(xk + 6, 8); cx.lineTo(xk, 14); cx.lineTo(xk - 6, 8); cx.fill();
  // Info
  const a = anStelle(kopf);
  if (zug?.art === 'trim') { $('#info').textContent = `${zug.rand === 'links' ? 'Anfang' : 'Ende'} von Clip ${zug.i + 1}: ${zug.delta >= 0 ? '+' : ''}${zug.delta.toFixed(2)} s`; return; }
  $('#info').textContent = P.clips.length ? `${P.clips.length} Clips · Clip ${a ? a.i + 1 : '-'} · Quelle ${a ? zeitText(a.s) : ''}` : 'leer';
}
function rollbalken() {
  const w = cv.clientWidth, ende = Math.max(L.gesamt + 10, tVon(w)), sicht = w / pps;
  const g = $('#rollgriff'), spur = $('#rollbalken').clientWidth;
  g.style.width = Math.max(30, spur * Math.min(1, sicht / ende)) + 'px';
  g.style.left = (spur - g.offsetWidth) * Math.min(1, links / Math.max(1e-6, ende - sicht)) + 'px';
}
(() => {
  let zieh = null;
  $('#rollgriff').addEventListener('mousedown', e => { zieh = { x: e.clientX, links }; e.preventDefault(); });
  $('#rollbalken').addEventListener('mousedown', e => {
    if (e.target.id !== 'rollbalken') return;
    const r = e.currentTarget.getBoundingClientRect(), ende = Math.max(L.gesamt + 10, tVon(cv.clientWidth)), sicht = cv.clientWidth / pps;
    links = Math.max(0, (e.clientX - r.left) / r.width * ende - sicht / 2); zeichne();
  });
  addEventListener('mousemove', e => {
    if (!zieh) return;
    const spur = $('#rollbalken').clientWidth, g = $('#rollgriff').offsetWidth, ende = Math.max(L.gesamt + 10, tVon(cv.clientWidth)), sicht = cv.clientWidth / pps;
    links = Math.max(0, Math.min(ende - sicht, zieh.links + (e.clientX - zieh.x) / Math.max(1, spur - g) * (ende - sicht))); zeichne();
  });
  addEventListener('mouseup', () => zieh = null);
})();
function rund(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

// Maus auf der Timeline
let zug = null;
function trefferClip(x, y) {
  // Wie bei CapCut: An einer Naht greift die linke Hälfte das Ende des Clips davor, die rechte Hälfte den Anfang des Clips danach.
  const yH = Math.min(SPUR_H, cv.clientHeight - SPUR_Y - 16);
  if (y < SPUR_Y || y > SPUR_Y + yH) return null;
  const G = 9;
  for (let i = 0; i < P.clips.length; i++) {
    const x0 = xVon(L.start[i]), x1 = xVon(L.start[i] + D(P.clips[i]));
    const g = Math.min(G, (x1 - x0) / 2);
    if (x >= x0 && x < x0 + g) return { i, rand: 'links' };
    if (x <= x1 && x > x1 - g) return { i, rand: 'rechts' };
    if (x >= x0 && x < x1) return { i, rand: null };
    if (i === P.clips.length - 1 && x > x1 && x < x1 + G) return { i, rand: 'rechts' };
  }
  return null;
}
let hover = null;
function trefferMarker(x, y) {
  if (y > LINEAL + 2) return null;
  for (const m of P.marker) { const t = markerZeit(m); if (t !== null && Math.abs(xVon(t) - x) < 8 && y > LINEAL - 20) return m; }
  return null;
}
cv.addEventListener('mousemove', e => {
  if (zug) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const t = trefferClip(x, y); cv.style.cursor = t?.rand ? (t.rand === 'links' ? 'w-resize' : 'e-resize') : trefferMarker(x, y) ? 'pointer' : 'default';
  const neu = t?.rand ? { i: t.i, rand: t.rand } : null;
  if (JSON.stringify(neu) !== JSON.stringify(hover)) { hover = neu; zeichne(); }
});
cv.addEventListener('mouseleave', () => { if (hover) { hover = null; zeichne(); } });
cv.addEventListener('mousedown', e => {
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const m = trefferMarker(x, y);
  if (m) { auswahl = { typ: 'marker', id: m.id }; zug = { art: 'marker', m, vorher: JSON.stringify({ clips: P.clips, marker: P.marker, puffer: P.puffer }) }; return; }
  const t = trefferClip(x, y);
  if (t?.rand && P.modus !== 'abnahme') {
    if (spielt) spielen(false);
    const c = P.clips[t.i];
    zug = { art: 'trim', i: t.i, rand: t.rand, x0: x, von: c.von, bis: c.bis, delta: 0, randT: t.rand === 'links' ? L.start[t.i] : L.start[t.i] + D(c), vorher: JSON.stringify({ clips: P.clips, marker: P.marker, puffer: P.puffer }) };
    return;
  }
  if (t) auswahl = { typ: 'clip', id: P.clips[t.i].id }; else if (y > LINEAL) auswahl = null;
  if (e.shiftKey) { zug = { art: 'bereich', t0: Math.max(0, tVon(x)) }; return; }
  zug = { art: 'kopf' }; suchen(tVon(x));
});
addEventListener('mousemove', e => {
  if (!zug) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
  if (zug.art === 'kopf') return suchen(Math.max(0, tVon(x)));
  if (zug.art === 'bereich') { zug.t1 = Math.max(0, Math.min(L.gesamt, tVon(x))); zeichne(); return; }
  if (zug.art === 'marker') {
    const a = anStelle(Math.max(0, tVon(x))); if (a) { zug.m.quelle = a.clip.quelle; zug.m.zeit = +a.s.toFixed(3); zug.bewegt = true; markerliste(); zeichne(); }
    return;
  }
  if (zug.art === 'trim') {
    const c = P.clips[zug.i], d = (x - zug.x0) / pps, dauer = Q[c.quelle]?.dauer || 1e9;
    // Nach rechts ziehen am Anfang kürzt den Clip, nach links verlängert ihn. Am Ende umgekehrt. Alles danach rückt nach.
    if (zug.rand === 'links') { c.von = +Math.min(Math.max(0, zug.von + d), c.bis - 0.1).toFixed(3); vorschauBild(c.quelle, V(c)); zug.delta = zug.von - c.von; }
    else { c.bis = +Math.max(Math.min(dauer, zug.bis + d), c.von + 0.1).toFixed(3); vorschauBild(c.quelle, BI(c) - 0.02); zug.delta = c.bis - zug.bis; }
    layout(); zug.randT = zug.rand === 'links' ? L.start[zug.i] : L.start[zug.i] + D(c); zug.bewegt = true; zeichne(); zeitAnzeige();
  }
});
addEventListener('mouseup', () => {
  if (!zug) return;
  if (zug.art === 'bereich') { const a = Math.min(zug.t0, zug.t1 ?? zug.t0), b = Math.max(zug.t0, zug.t1 ?? zug.t0); zug = null; if (b - a > 0.2) markerSetzen(a, b); zeichne(); return; }
  if ((zug.art === 'trim' || zug.art === 'marker') && zug.bewegt) {
    rueck.push(zug.vorher); vor.length = 0; layout(); transkript(); markerliste(); speichern();
    suchen(zug.art === 'trim' ? Math.max(0, zug.randT - (zug.rand === 'rechts' ? 0.5 : 0)) : kopf);
  }
  zug = null; zeichne();
});
cv.addEventListener('dblclick', e => {
  const r = cv.getBoundingClientRect(); const m = trefferMarker(e.clientX - r.left, e.clientY - r.top); if (m) markerOeffnen(m.id);
});
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
  if (e.ctrlKey || e.metaKey) {
    const t = tVon(x); const v = Math.min(100, Math.max(0, +$('#zoom').value - Math.sign(e.deltaY) * 6));
    $('#zoom').value = v; zoomAus(v); links = Math.max(0, t - x / pps);
  } else links = Math.max(0, links + (e.deltaX || e.deltaY) / pps);
  zeichne();
}, { passive: false });
function vorschauBild(quelle, s) {
  const src = `/media/${quelle}/proxy.mp4`; if (!A.src.endsWith(src)) A.src = src;
  A.muted = true; kopfAusRand = true;
  // Beim Ziehen nur suchen, wenn die letzte Suche fertig ist, sonst stauen sich die Anfragen. Die letzte Position wird nachgeholt.
  if (A.seeking) { bildZiel = s; return; }
  bildZiel = null; A.currentTime = s;
}
let bildZiel = null;
A.addEventListener('seeked', () => { if (bildZiel !== null && zug?.art === 'trim') { const s = bildZiel; bildZiel = null; A.currentTime = s; } });
let kopfAusRand = false;

// ---------- Bedienung ----------
$('#zoom').addEventListener('input', e => { const mitte = tVon(cv.clientWidth / 2); zoomAus(+e.target.value); links = Math.max(0, mitte - cv.clientWidth / 2 / pps); zeichne(); });
$('#b-rein').onclick = () => { $('#zoom').value = Math.min(100, +$('#zoom').value + 10); $('#zoom').dispatchEvent(new Event('input')); };
$('#b-raus').onclick = () => { $('#zoom').value = Math.max(0, +$('#zoom').value - 10); $('#zoom').dispatchEvent(new Event('input')); };
// Luft je Schnitt: ein Wert in ms, verteilt auf das Ende des Clips davor und den Anfang des Clips danach
const VERTEILUNG = { gleich: [0.5, 0.5], ende: [0, 1], anfang: [1, 0] };   // [Anteil vorne am nächsten Clip, Anteil hinten am Clip davor]
function pufferAnzeigen() {
  const g = Math.round(((PAD.vor || 0) + (PAD.nach || 0)) * 1000);
  $('#pad').value = g; $('#pad-art').value = P?.puffer?.art || 'gleich';
}
let pufferTimer = null, letzterPuffer = 0;
function pufferSetzen() {
  clearTimeout(pufferTimer);
  pufferTimer = setTimeout(() => {
    const g = Math.max(-1000, Math.min(2000, +$('#pad').value || 0)) / 1000, art = $('#pad-art').value, [a, b] = VERTEILUNG[art];
    const vorN = +(g * a).toFixed(3), nachN = +(g * b).toFixed(3);
    if (vorN === PAD.vor && nachN === PAD.nach && art === (P.puffer?.art || 'gleich')) return;
    // mehrere Änderungen kurz hintereinander sind ein Schritt für Rückgängig
    const buendeln = Date.now() - letzterPuffer < 3000; letzterPuffer = Date.now();
    aenderung(() => { P.puffer = { vor: vorN, nach: nachN, art }; PAD = P.puffer; }, `Luft je Schnitt: ${Math.round(g * 1000)} ms`, buendeln);
  }, 250);
}
$('#pad').addEventListener('input', pufferSetzen); $('#pad-art').addEventListener('change', pufferSetzen);
$('#b-play').onclick = () => spielen();
$('#b-start').onclick = () => { suchen(0); links = 0; };
$('#b-ende').onclick = () => suchen(L.gesamt);
$('#b-teilen').onclick = teilen;
$('#b-links').onclick = () => seiteLoeschen(true);
$('#b-rechts').onclick = () => seiteLoeschen(false);
$('#b-loeschen').onclick = loeschen;
$('#b-marker').onclick = () => markerSetzen();
$('#b-rueck').onclick = () => zurueck(rueck, vor);
$('#b-vor').onclick = () => zurueck(vor, rueck);
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('an', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('an', t.id === 'tab-' + b.dataset.tab));
});
$('#b-hilfe').onclick = () => $('#hilfe').hidden = false;
$('#b-hilfe-zu').onclick = () => { $('#hilfe').hidden = true; try { localStorage.setItem('vs-hilfe', '1'); } catch {} };
try { if (!localStorage.getItem('vs-hilfe')) $('#hilfe').hidden = false; } catch {}

addEventListener('keydown', e => {
  if (e.target.closest('input, textarea') || !P) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return e.shiftKey ? zurueck(vor, rueck) : zurueck(rueck, vor); }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); return zurueck(vor, rueck); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (P.modus === 'abnahme' && ['s', 'q', 'w'].includes(k)) return toast('Im Abnahme-Modus wird nicht geschnitten, nur kommentiert');
  if (k === ' ') { e.preventDefault(); spielen(); }
  else if (k === 's') teilen();
  else if (k === 'q') seiteLoeschen(true);
  else if (k === 'w') seiteLoeschen(false);
  else if (k === 'm' || k === 'f') markerSetzen();
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); loeschen(); }
  else if (k === 'arrowleft') { e.preventDefault(); if (spielt) spielen(false); suchen(kopf - (e.shiftKey ? 1 : 1 / FPS_VORSCHAU)); }
  else if (k === 'arrowright') { e.preventDefault(); if (spielt) spielen(false); suchen(kopf + (e.shiftKey ? 1 : 1 / FPS_VORSCHAU)); }
  else if (k === 'arrowup') { e.preventDefault(); springeSchnitt(-1); }
  else if (k === 'arrowdown') { e.preventDefault(); springeSchnitt(1); }
  else if (k === 'home') { suchen(0); links = 0; }
  else if (k === 'end') suchen(L.gesamt);
  else if (k === '+' || k === '=') $('#b-rein').onclick();
  else if (k === '-') $('#b-raus').onclick();
  else if (k === 'escape') { auswahl = null; $('#hilfe').hidden = true; }
});

// ---------- Chat mit dem KI-Agenten ----------
let chatLaeuft = false;
function chatZeigen(wer, text) {
  const e = document.createElement('div'); e.className = 'nachricht ' + wer; e.textContent = text;
  const l = $('#chat-liste'); l.appendChild(e); l.scrollTop = l.scrollHeight;
}
function chatOrt() {
  const a = anStelle(kopf); if (!a) return '';
  const c = auswahl?.typ === 'clip' ? P.clips.findIndex(x => x.id === auswahl.id) : -1;
  return `Abspielkopf ${zeitText(kopf)} auf der Timeline, Clip ${a.i + 1} (${a.clip.id}${a.clip.name ? ', ' + a.clip.name : ''}), Quelle ${a.clip.quelle} bei ${a.s.toFixed(2)} s` + (c >= 0 ? `, ausgewählt ist Clip ${c + 1} (${P.clips[c].id})` : '');
}
function chatStatus(an) {
  chatLaeuft = an; $('#chat-status').textContent = an ? 'arbeitet' : ''; $('#chat-status').classList.toggle('an', an);
  $('#b-chat').textContent = an ? 'Stopp' : 'Senden'; $('#b-chat').classList.toggle('primaer', !an);
}
$('#chat-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (chatLaeuft) return fetch('/api/chat/stopp', { method: 'POST' });
  const text = $('#chat-text').value.trim(); if (!text) return;
  clearTimeout(speicherTimer); if (speicherTimer) { await new Promise(r => setTimeout(r, 350)); }
  $('#chat-text').value = '';
  const r = await (await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, kontext: chatOrt() }) })).json();
  if (!r.ok) toast('Der Agent arbeitet noch');
});
$('#chat-text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chat-form').requestSubmit(); } });
function chatSichtbar(an) { document.body.classList.toggle('mit-chat', an); $('#b-chat-auf').classList.toggle('an', an); try { localStorage.setItem('vs-chat', an ? '1' : '0'); } catch {} setTimeout(() => { groesse(); zeichne(); rollbalken(); }, 0); }
$('#b-chat-auf').onclick = () => chatSichtbar(!document.body.classList.contains('mit-chat'));
try { chatSichtbar(localStorage.getItem('vs-chat') === '1'); } catch { chatSichtbar(false); }
$('#b-chat-neu').onclick = async () => { const r = await (await fetch('/api/chat/neu', { method: 'POST' })).json(); if (r.ok) { $('#chat-liste').querySelectorAll('.nachricht').forEach(n => n.remove()); toast('Neues Gespräch'); } };
setInterval(() => { if (P) $('#chat-ort').textContent = zeitText(kopf) + (anStelle(kopf) ? ` · Clip ${anStelle(kopf).i + 1}` : ''); }, 250);

// ---------- Anmeldung des KI-Agenten ----------
async function anmeldungPruefen() { const a = await (await fetch('/api/anmeldung')).json(); $('#anmelden').hidden = a.angemeldet; agentZeigen(a); }
// Welcher KI-Agent im Chat arbeitet. Sind mehrere installiert, lässt er sich im Chat-Kopf wechseln.
function agentZeigen(a) {
  if (!a?.name) return;
  $('#agent-name').textContent = a.name; $('#agent-test').hidden = a.getestet !== false;
  const w = $('#agent-wahl'); w.hidden = (a.installiert || []).length < 2;
  $('#agent-name').hidden = !w.hidden;   // Bei Auswahl steht der Name schon im Feld
  w.innerHTML = (a.installiert || []).map(x => `<option value="${x.id}"${x.id === a.agent ? ' selected' : ''}>${x.name}</option>`).join('');
  if (a.hinweis) $('#anmelde-text').textContent = a.hinweis;
}
$('#agent-wahl').onchange = async e => {
  const r = await (await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.target.value }) })).json();
  if (!r.ok) { toast('Der Agent arbeitet noch'); return agentZeigen(r); }
  $('#chat-liste').querySelectorAll('.nachricht').forEach(n => n.remove()); agentZeigen(r); toast(`Neues Gespräch mit ${r.name}`); anmeldungPruefen();
};
$('#b-anmelden').onclick = async () => { $('#b-anmelden').disabled = true; await fetch('/api/anmeldung', { method: 'POST' }); };
$('#b-code').onclick = async () => { const code = $('#code').value.trim(); if (!code) return; $('#code').value = ''; await fetch('/api/anmeldung/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }); };

// ---------- Weitergeben ----------
$('#b-weiter').onclick = () => {
  if (P.modus === 'abnahme') { const n = P.marker.filter(m => (m.text || '').trim() && !m.erledigt).length; speichern(); if (n) setTimeout(() => fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art: 'feedback', offen: n }) }), 1500);
    toast(n ? `${n} Feedback gespeichert, der Agent ist benachrichtigt.` : 'Noch kein Feedback gesetzt (M oder F am Abspielkopf)'); return; }
  $('#export').hidden = false; $('#export-balken').style.width = '0'; $('#b-export-los').disabled = false;
  $('#export-text').textContent = `Der Schnitt (${zeitText(L.gesamt)}, ${P.clips.length} Clips) wird in voller Qualität gerendert und mit Schnittliste und Markern unter export/ abgelegt. Danach geht es mit den Motion Graphics weiter.`; };
$('#b-export-zu').onclick = () => $('#export').hidden = true;
$('#b-export-los').onclick = async () => { $('#b-export-los').disabled = true; await fetch('/api/export', { method: 'POST' }); $('#export-text').textContent = 'Wird gerendert …'; };

// ---------- Ereignisse vom Server ----------
function statusZeigen(st) {
  const teile = [];
  for (const [id, s] of Object.entries(st || {})) {
    if (s.dauer) Q[id] && (Q[id].dauer = s.dauer);
    if (s.original && !LIVE.an) { const [b, h] = s.original.split(','); $('#qualitaet').textContent = P?.modus === 'abnahme' ? `Entwurf in voller Qualität (${b} × ${h})` : `Vorschau 1080p · Export in Originalqualität (${b} × ${h})`; }
    if (s.fehler) teile.push(s.fehler);
    else if (s.welle === 'läuft') teile.push('Tonwelle wird berechnet …');
    else if (typeof s.proxy === 'number') teile.push(`Vorschau wird erstellt … ${s.proxy} %`);
    if (s.welle === 'bereit' && Q[id] && !Q[id].welle && !Q[id].laedt) {
      Q[id].laedt = true; fetch(`/media/${id}/welle.bin`).then(r => r.arrayBuffer()).then(b => { Q[id].welle = new Uint8Array(b); });
    }
    if (s.proxy === 'bereit' && !Q[id]?.proxyDa) { if (Q[id]) Q[id].proxyDa = true; suchen(kopf); }
  }
  $('#vorbereitung').textContent = teile.join('\n');
}
const ev = new EventSource('/api/events');
ev.addEventListener('status', e => statusZeigen(JSON.parse(e.data)));
ev.addEventListener('chat', e => { const d = JSON.parse(e.data); chatZeigen(d.wer, d.text); });
ev.addEventListener('chatstatus', e => chatStatus(JSON.parse(e.data).laeuft));
ev.addEventListener('anmeldung', e => {
  const d = JSON.parse(e.data);
  if (d.link) { $('#anmelde-code').hidden = false; $('#anmelde-link').href = d.link; }
  if (d.angemeldet === true) { $('#anmelden').hidden = true; anmeldeTab = null; toast('Der Agent ist angemeldet'); }
  if (d.angemeldet === false) { $('#anmelden').hidden = false; $('#b-anmelden').disabled = false; $('#anmelde-code').hidden = true; anmeldeTab = null; chatSichtbar(true); }
  if (d.fehler) { toast(d.fehler); $('#b-anmelden').disabled = false; }
  if (d.hinweis) { $('#anmelde-text').textContent = d.hinweis; $('#b-anmelden').disabled = false; }
});
let anmeldeTab = null;
ev.addEventListener('live', e => liveNeu(JSON.parse(e.data).teil));
ev.addEventListener('projekt', async e => {
  const d = JSON.parse(e.data); if (speichertLaeuft || d.version === P.version) return;
  const k = kopf; await laden(); suchen(Math.min(k, L.gesamt)); toast('Projekt wurde aktualisiert');
});
ev.addEventListener('export', e => {
  const d = JSON.parse(e.data);
  if (d.fortschritt !== undefined) { $('#export-balken').style.width = d.fortschritt + '%'; $('#export-text').textContent = `Wird gerendert … ${d.fortschritt} %`; }
  if (d.fertig) { $('#export-balken').style.width = '100%'; $('#export-text').textContent = `Fertig: ${d.fertig.datei} (${zeitText(d.fertig.dauer)}, ${d.fertig.clips} Clips). Der Agent ist benachrichtigt und macht weiter.`; }
  if (d.fehler) { $('#export-text').textContent = 'Fehler beim Rendern: ' + d.fehler; $('#b-export-los').disabled = false; }
});

// ---------- Live-Vorschau: Kompositionen statt gerendertem Entwurf ----------
// Taktgeber bleibt das Video (geschnittene Aufnahme mit fertigem Ton). Darüber liegt je Teil ein HyperFrames-Player,
// der stumm auf die Zeit des Videos gestellt wird. Geladen sind nur der aktuelle und der nächste Teil.
const LIVE = { an: false, teile: [], player: {}, stand: {}, skript: false };
function liveStart() {
  LIVE.an = !!P.live; LIVE.teile = P.live?.teile || [];
  document.body.classList.toggle('live', LIVE.an);
  if (LIVE.an && !LIVE.skript) { LIVE.skript = true; const s = document.createElement('script'); s.src = '/live/player.js'; document.head.appendChild(s); }
  if (LIVE.an) $('#qualitaet').textContent = `Live aus ${LIVE.teile.length} Kompositionen, nicht gerendert`;
}
// Nur dort eine Komposition zeigen, wo ein gebauter Teil liegt. Davor, dazwischen und danach läuft die Aufnahme allein.
const liveTeil = T => LIVE.teile.find(t => T >= t.von && T < t.bis);
function livePlayer(name) {
  let p = LIVE.player[name];
  if (!p) {
    p = document.createElement('hyperframes-player');
    p.setAttribute('runtime-src', '/live/runtime.js'); p.setAttribute('muted', '');
    p.setAttribute('src', `/live/t/${name}/index.html?v=${LIVE.stand[name] || 0}`);
    p.className = 'live-teil'; $('#live').appendChild(p); LIVE.player[name] = p;
  }
  return p;
}
function liveTakt() {
  if (!LIVE.an || !customElements.get('hyperframes-player')) return;
  const t = liveTeil(kopf);
  const n = LIVE.teile.find(x => x.von >= (t ? t.bis : kopf) - 0.001);   // der nächste gebaute Teil, vorgeladen
  if (n) livePlayer(n.name);
  const p = t ? livePlayer(t.name) : null;
  for (const [name, x] of Object.entries(LIVE.player)) {
    if (name !== t?.name && name !== n?.name) { x.remove(); delete LIVE.player[name]; continue; }
    x.classList.toggle('aktiv', name === t?.name);
  }
  if (!p || !p.ready) return;
  const lokal = Math.max(0, kopf - t.von);
  if (spielt) {
    if (p.paused) { p.seek(lokal); p.play(); }
    else if (Math.abs(p.currentTime - lokal) > 0.12) p.seek(lokal);   // Abweichung zum Ton nachziehen
  } else {
    if (!p.paused) p.pause();
    if (Math.abs(p.currentTime - lokal) > 0.004) p.seek(lokal);
  }
  liveMedien(p, lokal);
  // der nächste Teil wartet stumm an seinem Anfang, damit der Wechsel ohne Lücke geht
  const q = n && LIVE.player[n.name]; if (q?.ready && (!q.paused || q.currentTime > 0.01)) { q.pause(); q.seek(0); }
}
// Der Player bewegt nur die Zeitleiste. Videos in der Komposition (Kamera, eingebettete Clips) laufen deshalb hier mit:
// stumm, auf die Zeit des Teils gestellt (data-start, data-duration, data-media-start), bei Abweichung nachgezogen.
function liveMedien(p, lokal) {
  const d = p.shadowRoot?.querySelector('iframe')?.contentDocument; if (!d) return;
  for (const v of d.querySelectorAll('video[data-start]')) {
    const s = +v.dataset.start || 0, dauer = +v.dataset.duration || Infinity, ab = +v.dataset.mediaStart || 0;
    v.muted = true;
    const soll = lokal - s + ab, drin = lokal >= s && lokal < s + dauer;
    if (!drin) { if (!v.paused) v.pause(); continue; }
    if (spielt) {
      if (v.paused) { v.currentTime = soll; v.play().catch(() => {}); }
      else if (Math.abs(v.currentTime - soll) > 0.15) v.currentTime = soll;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - soll) > 0.02) v.currentTime = soll;
    }
  }
}
function liveNeu(teil) {
  for (const name of teil === '*' ? LIVE.teile.map(t => t.name) : [teil]) { LIVE.stand[name] = Date.now(); LIVE.player[name]?.remove(); delete LIVE.player[name]; }
  toast(teil === '*' ? 'Alle Teile neu geladen' : `${teil} neu geladen`);
}

// ---------- Start ----------
addEventListener('resize', () => { groesse(); zeichne(); rollbalken(); });
(async () => {
  groesse(); await laden();
  const s = await (await fetch('/api/status')).json(); statusZeigen(s.status);
  for (const n of s.chat || []) chatZeigen(n.wer, n.text); chatStatus(!!s.chatLaeuft); anmeldungPruefen();
  suchen(0); requestAnimationFrame(takt);
})();
