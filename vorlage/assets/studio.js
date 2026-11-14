// Studio: der technische Kern für eine Komposition. Alle Zeiten in Sekunden ab Dateianfang.
// Hier steht nur, was jedes Video braucht und was man leicht falsch macht: die Kamera mit sicherem Kopf-Ausschnitt,
// der Grund, die Bildschirmaufnahme mit Zoom und ein paar Helfer, die in HyperFrames deterministisch laufen müssen.
// Wie Szenen aussehen und sich bewegen, baust du selbst mit GSAP, HTML, CSS, SVG, Canvas oder was die Stelle braucht.
//
// Aufbau im HTML (siehe _start/index.html):
//   <div id="ground"><div class="muster"></div><div class="warm"></div><div class="cone"></div><div class="vig"></div></div>
//   <div id="cam"><div id="camframe"></div><div id="camclip"><div id="camvid"><video ...></video></div></div></div>
//
// Alle Aufrufe in zeitlicher Reihenfolge schreiben. Ein paar Helfer (app().spot) merken sich ihren Zustand beim Aufbau.
(function () {
  const W = 1920, H = 1080;
  // Kopfbereich über den ganzen Dreh im 1920x1080-Raum der Webcam (scripts/kopf.py schreibt assets/kopf.js).
  // Jeder Ausschnitt enthält diesen Bereich komplett, damit Kopf und Haare nie angeschnitten sind.
  const HEAD = window.STUDIO_HEAD || { x0: 760, x1: 1290, y0: 60, y1: 640 };
  const AIR = { side: 0.07, top: 0.012 };  // Luft um den Kopf, Anteil der Ausschnittbreite und -höhe
  // Augenlinie: Im Ausschnitt sitzen die Augen höchstens bei EYE_MAX der Höhe von oben.
  const EYE = window.STUDIO_EYE || 420, EYE_MAX = 0.37;

  // Kamera-Zustände: Rechteck auf der Bühne (x, y, w, h), gewünschte Höhe des Ausschnitts im Video (vh, kleiner = näher),
  // Eckenradius r und Breite des Rahmens p. Das sind nur Beispiele: Leg eigene Zustände an, wo die Szene es braucht
  // (B.STATES.meiner = {...}), auch bildfüllend. Der Kopf bleibt in jedem Ausschnitt ganz.
  const STATES = {
    klein_ur: { x: 1544, y: 592, w: 336, h: 448, vh: 900,  r: 24, p: 0 },  // klein hochkant unten rechts
    klein_or: { x: 1544, y: 40,  w: 336, h: 448, vh: 900,  r: 24, p: 0 },  // oben rechts
    klein_ul: { x: 40,   y: 592, w: 336, h: 448, vh: 900,  r: 24, p: 0 },  // unten links
    klein_ol: { x: 40,   y: 40,  w: 336, h: 448, vh: 900,  r: 24, p: 0 },  // oben links
    gross_r:  { x: 1120, y: 140, w: 640, h: 800, vh: 1080, r: 34, p: 0 },  // groß in der rechten Hälfte
    gross_l:  { x: 160,  y: 140, w: 640, h: 800, vh: 1080, r: 34, p: 0 },  // groß in der linken Hälfte
  };
  // Ältere Namen, damit alte Teile weiterlaufen
  STATES.ecke_r = STATES.klein_ur; STATES.ecke_l = STATES.klein_ul; STATES.oben_r = STATES.klein_or; STATES.gross_k = STATES.gross_r;
  // Fläche für eine Bildschirmaufnahme neben der kleinen Kamera rechts (16:9, nichts verdeckt)
  const SCR = { x: 56, y: 161, w: 1456, h: 819 };

  // Ausschnitt im Video: so nah wie gewünscht, aber nie enger als der Kopfbereich mit Luft
  function crop(st) {
    const A = st.w / st.h;
    const needW = (HEAD.x1 - HEAD.x0) / (1 - 2 * AIR.side);
    const needH = (HEAD.y1 - HEAD.y0) / (1 - AIR.top - 0.03);
    const needEye = (EYE - HEAD.y0) / (EYE_MAX - AIR.top);
    let vh = Math.min(Math.max(st.vh, needW / A, needH, needEye), H, W / A);
    const vw = vh * A;
    let vx = (HEAD.x0 + HEAD.x1) / 2 - vw / 2, vy = HEAD.y0 - AIR.top * vh;
    vx = Math.max(0, Math.min(W - vw, vx)); vy = Math.max(0, Math.min(H - vh, vy));
    return { vx, vy, vw, vh };
  }

  function view(s) {
    const st = typeof s === 'string' ? STATES[s] : s;
    const { vx, vy, vh } = crop(st);
    const sc = st.h / vh;
    const px = v => v.toFixed(2) + 'px';
    return {
      vid: { x: st.x - vx * sc, y: st.y - vy * sc, scale: sc },
      // Ausschnitt als CSS-Variablen: ein clip-path mit "round" überblendet GSAP nicht stufenlos
      clip: { '--ct': px(st.y), '--cr': px(W - st.x - st.w), '--cb': px(H - st.y - st.h), '--cl': px(st.x), '--cq': px(st.r) },
      frame: { x: st.x - st.p, y: st.y - st.p, width: st.w + 2 * st.p, height: st.h + 2 * st.p, borderRadius: st.r + st.p },
    };
  }

  window.makeStudio = function (compId, duration, opts = {}) {
    const T = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();   // Wert aus tokens.css
    const tl = gsap.timeline({ paused: true });
    const q = s => (typeof s === 'string' ? document.querySelector(s) : s);
    const qa = (s, root) => (typeof s === 'string' ? (root || document).querySelectorAll(s) : s);
    const B = { tl, T, STATES, SCR, view };

    // ---- Grund: Muster wandert ganz langsam, der Lichtkegel folgt Haltepunkten (B.cone) ----
    // Gut für Erklärvideos mit ruhigem Grund. Abschalten mit makeStudio(..., { grund: false }), etwa wenn der Teil
    // einen eigenen Hintergrund baut. #ground lässt sich dann auch ganz weglassen oder überdecken.
    if (opts.grund !== false) tl.fromTo('#ground', { '--gx': '0px', '--gy': '0px' }, { '--gx': (duration * 1.4).toFixed(1) + 'px', '--gy': (-duration * 0.9).toFixed(1) + 'px', duration, ease: 'none' }, 0);
    // pts: [[t, x, y], ...]; zwischen zwei Punkten gleitet der Kegel weich
    B.cone = function (pts) {
      tl.set('#ground', { '--cx': pts[0][1] + 'px', '--cy': pts[0][2] + 'px' }, 0);
      for (let i = 1; i < pts.length; i++) {
        const [t0, x0, y0] = pts[i - 1], [t1, x1, y1] = pts[i];
        tl.fromTo('#ground', { '--cx': x0 + 'px', '--cy': y0 + 'px' }, { '--cx': x1 + 'px', '--cy': y1 + 'px', duration: Math.max(0.01, t1 - t0), ease: 'sine.inOut', immediateRender: false }, t0);
      }
    };

    // ---- Kamera ----
    const v0 = view(opts.cam || 'klein_ur');
    tl.set('#camvid', { ...v0.vid, transformOrigin: '0 0' }, 0);
    tl.set('#camclip', v0.clip, 0);
    tl.set('#camframe', v0.frame, 0);
    B.cam = {
      // Fließender Wechsel in einen Zustand (Name oder eigenes Rechteck). blur: kurze Unschärfe während der Fahrt, 0 = keine
      to(state, t, d = 0.8, ease = 'power2.inOut', blur = 3) {
        const n = view(state);
        if (blur) {
          tl.fromTo('#cam', { filter: 'blur(0px)' }, { filter: `blur(${blur}px)`, duration: d * 0.45, ease: 'power2.in', immediateRender: false }, t);
          tl.to('#cam', { filter: 'blur(0px)', duration: d * 0.55, ease: 'power2.out' }, t + d * 0.45);
        }
        tl.to('#camvid', { ...n.vid, duration: d, ease }, t);
        tl.to('#camclip', { ...n.clip, duration: d, ease }, t);
        tl.to('#camframe', { ...n.frame, duration: d, ease }, t);
      },
      // Harter Schnitt in einen Zustand
      cut(state, t) {
        const n = view(state);
        tl.set('#camvid', n.vid, t); tl.set('#camclip', n.clip, t); tl.set('#camframe', n.frame, t);
      },
      // Kamera ganz weg und wieder da (Vollbild ohne Person)
      aus(t, d = 0.5) { tl.to('#cam', { autoAlpha: 0, duration: d, ease: 'power2.in' }, t); },
      an(state, t, d = 0.5) { B.cam.cut(state, t); tl.fromTo('#cam', { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power2.out', immediateRender: false }, t); },
      ausSofort() { tl.set('#cam', { autoAlpha: 0 }, 0); },
    };

    // ---- Helfer, die in HyperFrames deterministisch sein müssen ----
    // Tippen: Zeichen erscheinen nacheinander über tl.set, nie über Echtzeit. Für mehrere Zeilen je Zeile ein Element.
    B.type = function (sel, t0, t1, o = {}) {
      const el = q(sel), text = el.textContent; el.textContent = '';
      const chars = [...text].map(c => { const s = document.createElement('span'); s.textContent = c; s.style.opacity = 0; el.appendChild(s); return s; });
      const step = (t1 - t0) / chars.length;
      chars.forEach((s, i) => tl.set(s, { opacity: 1 }, t0 + i * step));
      if (o.caret !== false) {
        const caret = document.createElement('i'); caret.className = 'caret'; el.appendChild(caret);
        tl.set(caret, { opacity: 0 }, 0); tl.set(caret, { opacity: 1 }, t0); tl.set(caret, { opacity: 0 }, t1 + (o.hold ?? 0.6));
      }
    };
    // Zähler: Zahl läuft von from nach to. o.fmt(v) formatiert, Standard mit Tausenderpunkt.
    B.count = function (sel, t, from, to, d = 1.2, o = {}) {
      const el = q(sel), obj = { v: from };
      const fmt = o.fmt || (v => (o.prefix || '') + Math.round(v).toLocaleString('de-DE') + (o.suffix || ''));
      el.textContent = fmt(from);
      tl.to(obj, { v: to, duration: d, ease: o.ease || 'power2.inOut', onUpdate: () => { el.textContent = fmt(obj.v); } }, t);
    };
    // SVG-Pfad zeichnen: Strichlänge als Attribut, der Versatz läuft über das Attribut-Plugin
    B.draw = function (sel, t, d = 0.5, ease = 'power2.inOut') {
      qa(sel).forEach(p => {
        const len = Math.ceil(p.getTotalLength()) + 2;
        p.setAttribute('stroke-dasharray', `${len} ${len}`);
        tl.fromTo(p, { attr: { 'stroke-dashoffset': len } }, { attr: { 'stroke-dashoffset': 0 }, duration: d, ease }, t);
      });
    };

    // ---- Bildschirmaufnahme im Fenster ----
    // win: Fenster (.appwin) an o.x, o.y mit Größe o.w x o.h; zoom: Ebene darin (.zoom, 1920x1080), die das
    // Bildschirmvideo und alles in Videokoordinaten trägt. Rechtecke r = {x, y, w, h} in Videokoordinaten 1920x1080.
    B.app = function (win, zoom, o) {
      const ww = o.w, wh = o.h, FULL = { x: 0, y: 0, w: 1920, h: 1080 };
      const fit = r => { r = r === 'all' || !r ? FULL : r; const s = Math.min(ww / r.w, wh / r.h); return { x: (ww - r.w * s) / 2 - r.x * s, y: (wh - r.h * s) / 2 - r.y * s, scale: s }; };
      const z = q(zoom);
      tl.set(z, { ...fit(FULL), transformOrigin: '0 0' }, 0);
      const hole = document.createElement('div'); hole.className = 'hole'; z.appendChild(hole);
      const ring = document.createElement('div'); ring.className = 'ring'; z.appendChild(ring);
      tl.set([hole, ring], { opacity: 0 }, 0);
      let spotOn = false, cur = FULL;
      const box = (r, pad) => ({ left: r.x - pad, top: r.y - pad, width: r.w + 2 * pad, height: r.h + 2 * pad });
      const A = {
        fit, hole, ring,
        // Zoom auf ein Rechteck, optional mit kurzer Unschärfe
        to(r, t, d = 0.42, blur = 5, ease = 'power3.inOut') {
          cur = r === 'all' || !r ? FULL : r;
          if (blur) {
            tl.fromTo(z, { filter: 'blur(0px)' }, { filter: `blur(${blur}px)`, duration: d * 0.45, ease: 'power2.in', immediateRender: false }, t);
            tl.to(z, { filter: 'blur(0px)', duration: d * 0.55, ease: 'power2.out' }, t + d * 0.45);
          }
          tl.to(z, { ...fit(cur), duration: d, ease }, t);
        },
        // Langsame Fahrt
        pan(r, t, d = 1.4) { cur = r === 'all' || !r ? FULL : r; tl.to(z, { ...fit(cur), duration: d, ease: 'power2.inOut' }, t); },
        // Rest abdunkeln, das Rechteck bleibt hell, mit Rahmen (so.ring === false ohne)
        spot(r, t, so = {}) {
          const pad = so.pad ?? 8;
          if (!spotOn) {
            tl.set(hole, box(r, pad), t); tl.to(hole, { opacity: 1, duration: 0.35 }, t);
            if (so.ring !== false) { tl.set(ring, box(r, pad + 6), t); tl.fromTo(ring, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'expo.out', immediateRender: false }, t + 0.05); }
            spotOn = true;
          } else {
            tl.to(hole, { ...box(r, pad), duration: 0.45, ease: 'power3.inOut' }, t);
            if (so.ring !== false) tl.to(ring, { ...box(r, pad + 6), opacity: 1, duration: 0.45, ease: 'power3.inOut' }, t);
            else tl.to(ring, { opacity: 0, duration: 0.2 }, t);
          }
        },
        spotOff(t) { tl.to([hole, ring], { opacity: 0, duration: 0.3 }, t); spotOn = false; },
        // Punkt im Video (vx, vy) bei Zoom auf r in Bühnenkoordinaten, für eigene Elemente außerhalb der Zoom-Ebene
        pt(vx, vy, r) { const f = fit(r || cur); return { x: o.x + f.x + vx * f.scale, y: o.y + f.y + vy * f.scale }; },
        place(sel, vx, vy, r, t = 0, dx = 0, dy = 0) { const p = A.pt(vx, vy, r); tl.set(sel, { left: p.x + dx, top: p.y + dy }, t); },
      };
      return A;
    };

    B.done = function () {
      tl.set({}, {}, duration);
      window.__timelines = window.__timelines || {};
      window.__timelines[compId] = tl;
    };
    return B;
  };

  window.STUDIO_VIEW = view;
  window.STUDIO_CROP = s => crop(typeof s === 'string' ? STATES[s] : s);
  window.STUDIO_STATES = STATES;
})();
