"""Verfeinert die Schnittliste an den Sprechbereichen. python bauen.py plan.json schnitt.json"""
import os, sys, json, wave
import numpy as np
plan = json.load(open(sys.argv[1], encoding="utf-8"))
FPS = plan.get("fps", 60)
D = plan.get("ordner", os.getcwd())
QS = list(plan["quellen"])

def lade_db(wav):
    w = wave.open(wav); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    hop = sr // 100; n = len(x) // hop
    return 20 * np.log10(np.sqrt((x[:n*hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12))

def lade_woerter(q):
    out = []
    for line in open(f"{D}/aufnahme-{q}-woerter.tsv", encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        try: out.append((float(p[0]), float(p[1]), p[2]))
        except (ValueError, IndexError): pass
    return out

db = {q: lade_db(f"a{q}.wav") for q in QS}
reg = {}
for q in QS:
    r = json.load(open(f"p{q}.json"))["regionen"]
    # isolierte Kleinstbereiche (Klicks, Atmer) verwerfen
    keep = []
    for i, (a, b) in enumerate(r):
        prev_gap = a - r[i-1][1] if i else 9
        next_gap = r[i+1][0] - b if i + 1 < len(r) else 9
        if b - a < 0.2 and prev_gap > 0.5 and next_gap > 0.5:
            continue
        keep.append((a, b))
    reg[q] = keep
woerter = {q: lade_woerter(q) for q in QS}

def tiefpunkt(q, a, b):
    i0, i1 = int(a * 100), int(b * 100)
    seg = db[q][i0:i1]
    return (i0 + int(np.argmin(seg))) / 100

def snap(t): return round(t * FPS) / FPS

def verfeinern(q, w0, w1, fest=None):
    fest = fest or {}
    rs = reg[q]
    r0 = next((r for r in rs if r[1] > w0 - 0.25), None)
    if r0[0] < w0 - 0.5:      # Schnitt mitten im Sprechbereich
        start = tiefpunkt(q, w0 - 0.35, w0 + 0.05)
    else:
        start = max(r0[0] - 0.10, w0 - 0.7)
    r1 = [r for r in rs if r[0] < w1 - 0.05][-1]
    if r1[1] > w1 + 0.6:
        ende = tiefpunkt(q, w1 - 0.05, w1 + 0.35)
    else:
        nxt = next((r for r in rs if r[0] > r1[1]), None)
        ende = r1[1] + 0.15
        if nxt: ende = min(ende, nxt[0] - 0.05)
    start = fest.get('von', start); ende = fest.get('bis', ende)
    # lange Pausen innen kürzen
    innen = [r for r in rs if r[1] > start and r[0] < ende]
    teile, a = [], start
    for x, y in zip(innen, innen[1:]):
        if y[0] - x[1] > 0.9:
            teile.append([a, x[1] + 0.25]); a = y[0] - 0.15
    teile.append([a, ende])
    return [[snap(s), snap(e)] for s, e in teile]

voiced = {q: json.load(open(f"v{q}.json"))["regionen"] for q in QS}
def ungedeckt(q, a, b):
    eff = [(s, min(e, s + 0.8)) for s, e, _ in woerter[q] if e > a and s < b]
    meld = []
    for x, y in voiced[q]:
        x, y = max(x, a), min(y, b)
        if y - x < 0.3: continue
        frei, t = 0.0, x
        pts = sorted(eff)
        cur = x
        for s, e in pts:
            if e <= cur: continue
            if s > cur: frei_start = cur; frei_len = min(s, y) - cur
            else: frei_len = 0
            if frei_len >= 0.6: meld.append((round(cur, 2), round(min(s, y), 2)))
            cur = max(cur, e)
            if cur >= y: break
        if y - cur >= 0.6: meld.append((round(cur, 2), round(y, 2)))
    return meld

out, tl = [], 0.0
for q, w0, w1, name, *rest in plan["segmente"]:
    fest = rest[0] if rest else {}
    stuecke = verfeinern(q, w0, w1, fest)
    for k, (s, e) in enumerate(stuecke):
        out.append({"quelle": q, "von": s, "bis": e, "name": name, "_ns": (fest or {}).get("straffen") is False,
                    "_fv": k == 0 and "von" in (fest or {}), "_fb": k == len(stuecke) - 1 and "bis" in (fest or {})})
        tl += e - s
    for a, b in ungedeckt(q, w0 - 0.3, w1 + 0.3):
        print(f"  ungedeckt A{q} {a:.2f}-{b:.2f}  ({name})")
# kurze Teile ohne Wörter (Füllwörter, Atmer) verwerfen
def hat_woerter(x):
    return any(e > x["von"] and s < x["bis"] for s, e, _ in woerter[x["quelle"]])
out = [x for x in out if x["bis"] - x["von"] >= 1.5 or hat_woerter(x)]
# kurze Teile mit dem Nachbarn verbinden, damit keine zwei Schnitte dicht aufeinander folgen
geaendert = True
while geaendert:
    geaendert = False
    for i in range(len(out) - 1):
        a, b = out[i], out[i + 1]
        lk = b["von"] - a["bis"]; kurz = min(a["bis"] - a["von"], b["bis"] - b["von"])
        if a["quelle"] == b["quelle"] and a["name"] == b["name"] and ((0 <= lk < 2.0 and kurz < 1.5) or (0 <= lk < 1.5 and kurz < 2.2)):
            a["bis"] = b["bis"]; a["_fb"] = b["_fb"]; del out[i + 1]; geaendert = True; break

# Clipränder und Denkpausen am Pegel des Clips selbst (technik.md, Rohschnitt): Laut ist, was 15 dB über dem
# leisesten Zehntel des Clips liegt. Anfang 0,08 s vor dem ersten lauten 10-ms-Block, Ende 0,15 s nach dem letzten,
# Pausen ab 0,6 s innerhalb eines Clips auf 0,3 s gekürzt (je 0,15 s an jeder Seite). Feste von/bis aus dem Plan bleiben.
VOR, NACH, PAUSE, REST = 0.08, 0.15, 0.6, 0.15
def straffen(x):
    # Mit "straffen": false im Plan bleibt der Clip ganz (z. B. bei Spielgeräuschen unter der Stimme, dort zerlegt die
    # Pegelschwelle den Satz in Silben)
    if x.get("_ns"): return [x]
    q, von, bis = x["quelle"], x["von"], x["bis"]
    i0, i1 = int(round(von * 100)), int(round(bis * 100))
    seg = db[q][i0:i1]
    if len(seg) < 30: return [x]
    laut = np.flatnonzero(seg > np.percentile(seg, 10) + 15)
    if not len(laut): return [x]
    # Lücken zwischen lauten Blöcken ab PAUSE sind Denkpausen
    bereiche, a = [], laut[0]
    for p, n in zip(laut, laut[1:]):
        if (n - p) / 100 >= PAUSE:
            bereiche.append((a, p + 1)); a = n
    bereiche.append((a, laut[-1] + 1))
    teile = []
    for k, (a, b) in enumerate(bereiche):
        s = (i0 + a) / 100 - (VOR if k == 0 else REST)
        e = (i0 + b) / 100 + NACH if k == len(bereiche) - 1 else (i0 + b) / 100 + REST
        if k == 0 and x["_fv"]: s = von
        if k == len(bereiche) - 1 and x["_fb"]: e = bis
        s, e = snap(max(von, s)), snap(min(bis, e))
        if e - s >= 0.1: teile.append(dict(x, von=s, bis=e))
    return teile or [x]
out = [y for x in out for y in straffen(x)]
for x in out: x.pop("_fv", None); x.pop("_fb", None); x.pop("_ns", None)
tl = sum(x["bis"] - x["von"] for x in out)
json.dump({"quellen": plan["quellen"], "fps": FPS, "teile": out}, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(out)} Teile, Länge {int(tl//60)}:{tl%60:04.1f}")
