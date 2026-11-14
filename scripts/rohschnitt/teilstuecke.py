"""Jeden Clip an kurzen Stillen (>=0.1 s unter -55 dB) in Teilstücke zerlegen, jedes einzeln transkribieren,
Neuanfänge suchen: Stück, dessen Anfang das nächste Stück wiederholt, oder abgebrochene Wörter."""
import json, subprocess, sys, wave, re, os
import numpy as np
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nachhoeren import anfrage
C = json.load(open(sys.argv[1], encoding="utf-8"))["clips"]
db = {}
for q in sorted({c["quelle"] for c in C}):   # Tonspuren a<q>.wav im Arbeitsordner
    w=wave.open(f"a{q}.wav"); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
    n=len(x)//160; db[q]=20*np.log10(np.sqrt((x[:n*160].reshape(n,160)**2).mean(1)+1e-12))
jobs=[]
for ci,c in enumerate(C):
    d=db[c["quelle"]]; a,b=int(c["von"]*100),int(c["bis"]*100); s=d[a:b]
    if np.percentile(s, 50) > -35 and np.percentile(s, 5) > -45: continue   # Ton unter der Stimme (Spiel), dort keine echten Stillen
    still=s< -45; teile=[]; st=0; j=0
    while j<len(s):
        if still[j]:
            k=j
            while k<len(s) and still[k]: k+=1
            if k-j>=7 and j>0 and k<len(s): teile.append((st,j)); st=k
            j=k
        else: j+=1
    teile.append((st,len(s)))
    for (u,v) in teile:
        if v-u>=8: jobs.append((ci, c["quelle"], (a+u)/100, (a+v)/100))
os.makedirs("ts",exist_ok=True)
def eins(jb):
    ci,q,u,v=jb; mp3=f"ts/{q}_{u:.2f}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(max(0,u-0.05)),"-to",str(v+0.05),"-i",f"a{q}.wav","-b:a","64k",mp3],check=True)
    for _ in range(3):
        try: return jb, anfrage(mp3).get("text","").strip()
        except Exception: pass
    return jb, "FEHLER"
with ThreadPoolExecutor(8) as ex: res=list(ex.map(eins,jobs))
norm=lambda t:[re.sub(r"[^\wäöüß]","",w.lower()) for w in t.split()]
out=[]
for ci in sorted({r[0][0] for r in res}):
    st=[r for r in res if r[0][0]==ci]
    out.append(f"## {ci:03d} " + " | ".join(f"{u:.2f}:{t}" for (_,_,u,v),t in st))
open(sys.argv[2],"w",encoding="utf-8").write("\n".join(out)+"\n")
# Verdachtsfälle
for ci in sorted({r[0][0] for r in res}):
    st=[r for r in res if r[0][0]==ci]
    for k in range(len(st)-1):
        a=[w for w in norm(st[k][1]) if w]; b=[w for w in norm(st[k+1][1]) if w]
        if not a or not b: continue
        hit = (a[:2]==b[:2] and len(a)>=2) or (len(a)<=3 and a==b[:len(a)]) or st[k][1].rstrip().endswith("-") or (a[-1:]==b[:1] and a[-1] not in ("und","die","der","das"))
        if hit: print(f"{ci:03d} Q{st[k][0][1]} {st[k][0][2]:.2f}: «{st[k][1]}»  ->  {st[k+1][0][2]:.2f}: «{st[k+1][1]}»")
print(len(jobs),"Teilstücke")
