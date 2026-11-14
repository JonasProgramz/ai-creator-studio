"""Transkribiert verdächtige Stellen neu, mit Füllwort-Prompt. python nachhoeren.py stellen.txt"""
import sys, os, io, json, subprocess, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); from transkribieren_api import api_key
key = api_key("OPENAI_API_KEY")   # Umgebung oder .env, wie bei transkribieren_api.py
URL = "https://api.openai.com/v1/audio/transcriptions"
PROMPT = "Ähm, also, äh, ich, ich meine, äh, das, das ist, ähm, quasi so, also, äh."

def anfrage(path):
    g = "----b7f3a"
    felder = [("model", "whisper-1"), ("response_format", "verbose_json"),
              ("timestamp_granularities[]", "word"), ("language", "de"), ("prompt", PROMPT)]
    body = b""
    for n, w in felder:
        body += f"--{g}\r\nContent-Disposition: form-data; name=\"{n}\"\r\n\r\n{w}\r\n".encode()
    body += f"--{g}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"x.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n".encode()
    body += open(path, "rb").read() + f"\r\n--{g}--\r\n".encode()
    req = urllib.request.Request(URL, data=body, headers={"Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={g}"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return json.loads(r.read().decode())

if __name__ == "__main__":
  for line in open(sys.argv[1], encoding="utf-8"):
      p = line.split()
      if len(p) < 3: continue
      q, a, b = p[0], float(p[1]), float(p[2])
      t0, t1 = (a, b) if len(p) > 3 else (max(0, a - 2.0), b + 1.0)
      mp3 = f"snip_{q}_{a:.0f}.mp3"
      subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t0), "-to", str(t1), "-i", f"a{q}.wav", "-b:a", "64k", mp3], check=True)
      r = anfrage(mp3)
      ws = " ".join(f"{w['word']}@{t0 + w['start']:.2f}" for w in r.get("words", []))
      print(f"A{q} {a:.2f}-{b:.2f}: {r.get('text','').strip()}\n    {ws}\n", flush=True)
