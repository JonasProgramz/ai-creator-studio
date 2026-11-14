"""Transkribiert a{q}.wav in überlappenden 5-Minuten-Stücken. python stuecke.py q"""
import sys, json, subprocess, os
from concurrent.futures import ThreadPoolExecutor
q = sys.argv[1]
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); from transkribieren_api import api_key
key = api_key("OPENAI_API_KEY")   # Umgebung oder .env, wie bei transkribieren_api.py
dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"a{q}.wav"],capture_output=True,text=True).stdout)
L, OV = 90, 6
starts = [i*L for i in range(int(dur//L)+1)]
os.makedirs("st", exist_ok=True)
def eins(s):
    mp3 = f"st/a{q}_{s:05d}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(s),"-t",str(L+OV),"-i",f"a{q}.wav","-b:a","20k",mp3],check=True)
    for _ in range(4):
        r = subprocess.run(["curl","-s","--retry","3","--max-time","900","https://api.openai.com/v1/audio/transcriptions","-H",f"Authorization: Bearer {key}",
            "-F","model=whisper-1","-F","language=de","-F","response_format=verbose_json","-F","timestamp_granularities[]=word",
            "-F","prompt=Ähm, also, äh, ich, ich meine, äh, das, das ist, ähm, quasi so.","-F",f"file=@{mp3}"],capture_output=True,text=True)
        try:
            j = json.loads(r.stdout); return s, j["words"]
        except Exception: print("retry", s, r.stdout[:200], file=sys.stderr)
    raise SystemExit(f"fehlgeschlagen {s}")
with ThreadPoolExecutor(int(os.environ.get("PAR","2"))) as ex: res = sorted(ex.map(eins, starts))
out = []
for s, ws in res:
    for w in ws:
        a = s + w["start"]
        if a < s + (OV/2 if s else 0) and s: continue      # Überlappung vorne dem vorigen Stück lassen
        if a >= s + L + OV/2: continue
        out.append((a, s + w["end"], w["word"]))
with open(f"aufnahme-{q}-woerter.tsv","w") as f:
    for a,e,w in out: f.write(f"{a:.2f}\t{e:.2f}\t{w}\n")
print(q, len(out), "Wörter")
