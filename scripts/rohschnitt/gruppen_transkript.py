"""Transkribiert eine Aufnahme Sprechgruppe für Sprechgruppe mit Füllwort-Prompt und Pegelwerten, statt am Stück.
Bei langen Stillen erfindet Whisper am Stück sonst Sätze. python gruppen_transkript.py q von bis luecke out.json"""
import json, subprocess, os, sys, wave
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from nachhoeren import anfrage
Q, A, B, L, OUT = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
w = wave.open(f"a{Q}.wav"); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
n = len(x) // 160; db = 20 * np.log10(np.sqrt((x[:n*160].reshape(n, 160) ** 2).mean(1) + 1e-12))
r = [x for x in json.load(open(f"p{Q}.json"))["regionen"] if x[1] > A and x[0] < B]
gr = []
for a, b in r:
    if gr and a - gr[-1][1] < L and b - gr[-1][0] < 45: gr[-1][1] = b
    else: gr.append([a, b])
os.makedirs(f"gr{Q}", exist_ok=True)
def eins(g):
    a, b = g; s = db[int(a*100):int(b*100)]; p95 = float(np.percentile(s, 95))
    if p95 < -30: return {"von": a, "bis": b, "p95": p95, "text": "", "words": []}
    t0 = max(0, a - 0.4); t1 = b + 0.4
    mp3 = f"gr{Q}/g{a:08.2f}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(t0),"-to",str(t1),"-i",f"a{Q}.wav","-b:a","64k",mp3], check=True)
    res = anfrage(mp3)
    return {"von": a, "bis": b, "p95": p95, "text": res.get("text","").strip(),
            "words": [(round(t0+w["start"],2), round(t0+w["end"],2), w["word"]) for w in res.get("words",[])]}
with ThreadPoolExecutor(6) as ex: erg = list(ex.map(eins, gr))
json.dump(erg, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
mm = lambda t: f"{int(t//60)}:{t%60:04.1f}"
for g in erg:
    if g["text"]: print(f"[{g['von']:.2f}-{g['bis']:.2f} | {mm(g['von'])}] {g['text']}")
