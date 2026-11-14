import json, wave, subprocess, sys
import numpy as np
sys.path.insert(0, ".")
from nachhoeren import anfrage
sj = json.load(open("schnitt.json", encoding="utf-8")); t = sj["teile"]
x = {}
for q in sj["quellen"]:
    w = wave.open(f"a{q}.wav"); x[q] = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
sr = 16000; teile = []; naehte = []; pos = 0.0
for p in t:
    seg = x[p["quelle"]][int(p["von"]*sr):int(p["bis"]*sr)].copy()
    f = int(0.01*sr); seg[:f] *= np.linspace(0,1,f); seg[-f:] *= np.linspace(1,0,f)
    teile.append(seg); pos += len(seg)/sr; naehte.append(pos)
y = np.concatenate(teile).astype(np.int16)
w = wave.open("schnitt_ton.wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(y.tobytes()); w.close()
subprocess.run(["ffmpeg","-v","error","-y","-i","schnitt_ton.wav","-b:a","64k","schnitt_ton.mp3"], check=True)
r = anfrage("schnitt_ton.mp3")
json.dump(r, open("schnitt_ton.json","w",encoding="utf-8"), ensure_ascii=False)
ws = r["words"]; out=[]; ni=0
for wd in ws:
    while ni < len(naehte) and wd["start"] >= naehte[ni]:
        out.append(" ‖"); ni += 1
    out.append(" " + wd["word"])
print("".join(out))
