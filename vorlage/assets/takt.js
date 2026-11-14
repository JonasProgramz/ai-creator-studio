// Neutakten eines fertigen Teils auf einen geänderten Schnitt.
// window.TAKT = [[alteZeit, neueZeit], ...] (Zeiten ab Teilanfang, aus gleichen Wörtern beider Fassungen).
// neuTakten(tl) verschiebt jede Startposition, die als Zahl an die Hauptzeitleiste geht, stückweise linear
// auf die neue Zeit. Dauern bleiben gleich, Unterzeitleisten bleiben unberührt (nur ihre Startposition wandert).
function taktZeit(t) {
  const A = window.TAKT; if (!A || !A.length || typeof t !== 'number') return t;
  if (t <= A[0][0]) return Math.max(0, t + (A[0][1] - A[0][0]));
  for (let i = 1; i < A.length; i++) {
    if (t <= A[i][0]) { const [a0, b0] = A[i - 1], [a1, b1] = A[i]; return a1 === a0 ? b1 : b0 + (t - a0) * (b1 - b0) / (a1 - a0); }
  }
  const [a, b] = A[A.length - 1]; return t + (b - a);
}
function neuTakten(tl) {
  const stelle = { to: 2, from: 2, set: 2, fromTo: 3, call: 2, add: 1, addLabel: 1 };
  for (const [m, i] of Object.entries(stelle)) {
    const orig = tl[m].bind(tl);
    tl[m] = (...a) => { if (typeof a[i] === 'number') a[i] = taktZeit(a[i]); return orig(...a); };
  }
}
