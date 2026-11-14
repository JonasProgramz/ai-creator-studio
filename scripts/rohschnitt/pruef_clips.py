"""Jeden Clip aus projekt.json einzeln mit Füllwort-Prompt transkribieren, Wörter mit Quellzeit, Pegel an den Rändern und Lücken."""
import json, subprocess, sys, wave, os
import numpy as np
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nachhoeren import anfrage
P = json.load(open(sys.argv[1], encoding="utf-8"))
C = P["clips"] if "clips" in P else P["teile"]
db = {}
for q in sorted({c["quelle"] for c in C}):   # Tonspuren a<q>.wav im Arbeitsordner
    w = wave.open(f"a{q}.wav"); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    n = len(x) // 160; db[q] = 20 * np.log10(np.sqrt((x[:n*160].reshape(n, 160) ** 2).mean(1) + 1e-12))
os.makedirs("pc", exist_ok=True)
def eins(ic):
    i, c = ic; q = c["quelle"]
    mp3 = f"pc/{i:03d}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(c["von"]),"-to",str(c["bis"]),"-i",f"a{q}.wav","-b:a","64k",mp3],check=True)
    r = {}
    for _ in range(3):
        try: r = anfrage(mp3); break
        except Exception: pass
    d = db[q]; a, b = int(c["von"]*100), int(c["bis"]*100)
    seg = d[a:b]
    rand_a = float(d[a:a+3].max()); rand_b = float(d[b-3:b].max())
    # Lücken: Stille (< -50 dB) ab 0.35 s im Clip
    leise = seg < -50; luecken = []; j = 0
    while j < len(leise):
        if leise[j]:
            k = j
            while k < len(leise) and leise[k]: k += 1
            if (k - j) >= 35 and j > 0 and k < len(leise): luecken.append(f"{c['von']+j/100:.2f}+{(k-j)/100:.2f}")
            j = k
        else: j += 1
    ws = " ".join(f"{w['word']}@{c['von']+w['start']:.2f}" for w in r.get("words", []))
    return i, c, r.get("text","").strip(), ws, rand_a, rand_b, luecken
with ThreadPoolExecutor(6) as ex: res = list(ex.map(eins, enumerate(C)))
with open(sys.argv[2], "w", encoding="utf-8") as f:
    for i, c, t, ws, ra, rb, l in res:
        f.write(f"{i:03d} Q{c['quelle']} [{c['von']:.2f}-{c['bis']:.2f}] Rand {ra:.0f}/{rb:.0f} dB  Lücken {l}\n   {t}\n   {ws}\n")
print("fertig")
