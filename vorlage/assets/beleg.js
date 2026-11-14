// Beleg: ein Screenshot (Post, Artikel, Webseite) in einem Ausschnitt, mit Zoom, Scroll und gemessenen Textstellen.
// Nur Technik: Wie der Beleg aussieht und wie Markierungen aussehen, baust du selbst.
// Nach studio.js laden, bei gemessenen Stellen danach media/stellen.js (aus stellen.mjs und zuschnitt.py).
//
//   <div id="b1" data-beleg="x-post"><div class="fenster"><div class="ebene"><img src="media/x-post.png"></div></div></div>
//   const b = makeBeleg(B, '#b1', { fenster: '.fenster', ebene: '.ebene' });
//   b.zoom(rect, t, d)          Zoom auf ein Rechteck {x, y, w, h} in Bildpixeln (pad: Rand als Anteil, Standard 0,06)
//   b.alles(t, d)               zurück zur ganzen Breite
//   b.scroll(y, t, d)           bei voller Breite nach unten fahren, y in Bildpixeln
//   b.stelle('Wortlaut', n)     gemessene Zeilen-Rechtecke einer Textstelle (n = welcher Treffer)
//   b.umriss('Wortlaut', n)     ein Rechteck um alle Zeilen der Stelle
//   b.zu('Wortlaut', t, o)      Zoom auf die Stelle mit Rand
//   b.setze(el, rect, o)        eigenes Element (Markierung, Linie, Licht) in Bildkoordinaten auf ein Rechteck legen,
//                               es liegt in der Zoom-Ebene und wandert mit. o.pad, o.unter (nur unter die Zeile, Höhe o.h)
//   b.massstab()                aktueller Zoomfaktor, um Strichstärken auszugleichen
(function () {
  window.makeBeleg = function (B, sel, o = {}) {
    const tl = B.tl, q = s => (typeof s === 'string' ? document.querySelector(s) : s);
    const el = q(sel), win = el.querySelector(o.fenster || '.fenster'), zoom = el.querySelector(o.ebene || '.ebene');
    const img = zoom.querySelector('img, video');
    zoom.style.position = 'absolute'; zoom.style.left = '0'; zoom.style.top = '0'; zoom.style.transformOrigin = '0 0';
    zoom.setAttribute('data-layout-allow-overflow', '');
    const S = el.dataset.beleg && window.STELLEN ? window.STELLEN[el.dataset.beleg] : null;
    if (el.dataset.beleg && !S) console.warn('Keine gemessenen Stellen für', el.dataset.beleg);
    if (S && !img.dataset.w) { img.dataset.w = S.w; img.dataset.h = S.h; }
    const W = win.clientWidth, H = win.clientHeight;
    const nw = +img.dataset.w || img.naturalWidth || img.videoWidth || 1920, nh = +img.dataset.h || img.naturalHeight || img.videoHeight || 1080;
    img.style.width = nw + 'px'; img.style.height = nh + 'px'; img.style.display = 'block';
    const s0 = W / nw;
    const ALLES = { x: 0, y: 0, w: nw, h: Math.min(nh, H / s0), pad: 0 };
    let cur = ALLES;
    const fit = r => {
      const s = Math.min(W / r.w, H / r.h) * (1 - (r.pad ?? 0.06));
      let tx = (W - r.w * s) / 2 - r.x * s, ty = (H - r.h * s) / 2 - r.y * s;
      tx = Math.min(0, Math.max(W - nw * s, tx)); ty = Math.min(0, Math.max(H - nh * s, ty));
      if (nw * s < W) tx = (W - nw * s) / 2;
      return { x: tx, y: ty, scale: s };
    };
    tl.set(zoom, fit(ALLES), 0);
    const b = {
      el, win, zoom, nw, nh, W, H, fit,
      zoom(r, t, d = 0.6, ease = 'power3.inOut') { cur = r; tl.to(zoom, { ...fit(r), duration: d, ease }, t); return t + d; },
      alles(t, d = 0.6) { return b.zoom(ALLES, t, d); },
      scroll(y, t, d = 1.6) { cur = { x: 0, y, w: nw, h: H / s0, pad: 0 }; tl.to(zoom, { x: 0, y: -y * s0, scale: s0, duration: d, ease: 'power2.inOut' }, t); },
      massstab() { return fit(cur).scale; },
      stelle(wl, n = 0) {
        const tr = S && S.stellen[wl];
        if (!tr || !tr[n]) { console.warn('Stelle nicht gemessen:', wl); return null; }
        return tr[n].map(r => ({ x: r[0], y: r[1], w: r[2], h: r[3] }));
      },
      umriss(wl, n = 0) {
        const zs = b.stelle(wl, n); if (!zs) return null;
        const x0 = Math.min(...zs.map(r => r.x)), y0 = Math.min(...zs.map(r => r.y));
        const x1 = Math.max(...zs.map(r => r.x + r.w)), y1 = Math.max(...zs.map(r => r.y + r.h));
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      },
      zu(wl, t, o = {}) {
        const u = b.umriss(wl, o.n || 0); if (!u) return t;
        const rx = o.rand ?? Math.max(120, u.w * 0.6, (nw * 0.6 - u.w) / 2), ry = o.randY ?? rx * 0.6;
        return b.zoom({ x: u.x - rx, y: u.y - ry, w: u.w + 2 * rx, h: u.h + 2 * ry, pad: 0 }, t, o.d ?? 0.8);
      },
      setze(m, r, o = {}) {
        m = q(m); if (m.parentNode !== zoom) zoom.appendChild(m);
        const pad = o.pad ?? 0;
        m.style.position = 'absolute';
        m.style.left = (r.x - pad) + 'px'; m.style.width = (r.w + 2 * pad) + 'px';
        if (o.unter) { m.style.top = (r.y + r.h + (o.abstand ?? 0)) + 'px'; m.style.height = (o.h ?? Math.max(4, r.h * 0.1)) + 'px'; }
        else { m.style.top = (r.y - pad) + 'px'; m.style.height = (r.h + 2 * pad) + 'px'; }
        return m;
      },
    };
    return b;
  };
})();
