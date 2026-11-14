import json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); from transkribieren_api import api_key
key = api_key("OPENAI_API_KEY")   # Umgebung oder .env, wie bei transkribieren_api.py
T=json.load(open("schnitt.json"))["teile"]
idx=[i for i,t in enumerate(T) if t["quelle"]==sys.argv[1]]
def eins(i):
    x=T[i]; mp3=f"clips/c{x['quelle']}_{i:03d}.mp3"
    subprocess.run(["ffmpeg","-v","error","-y","-ss",str(x["von"]),"-to",str(x["bis"]),"-i",f"a{x['quelle']}.wav","-b:a","24k",mp3],check=True)
    for _ in range(6):
        r=subprocess.run(["curl","-s","--max-time","90","https://api.openai.com/v1/audio/transcriptions","-H",f"Authorization: Bearer {key}",
          "-F","model=whisper-1","-F","language=de","-F","prompt=Ähm, also, äh, ich, ich meine, äh, das, das ist, ähm, quasi so.","-F",f"file=@{mp3}"],capture_output=True,text=True)
        try: return i, json.loads(r.stdout)["text"].strip()
        except Exception: pass
    return i, "FEHLER"
os.makedirs("clips",exist_ok=True)
with ThreadPoolExecutor(4) as ex:
    for i,t in ex.map(eins, idx): print(f"{i:03d} [{T[i]['von']:.2f}-{T[i]['bis']:.2f}] {T[i]['name']}: {t}", flush=True)
