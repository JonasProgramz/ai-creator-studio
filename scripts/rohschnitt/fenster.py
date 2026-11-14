"""Wörter und Pegel eines Fensters: python fenster.py a b [ohnePrompt]"""
import sys, subprocess, wave, json
import numpy as np
from nachhoeren import anfrage
a, b = float(sys.argv[1]), float(sys.argv[2])
mp3 = f"fenster_{a:.1f}.mp3"
subprocess.run(["ffmpeg","-v","error","-y","-ss",str(a),"-to",str(b),"-i","a1.wav","-b:a","64k",mp3], check=True)
r = anfrage(mp3)
print(r.get("text","").strip())
print(" ".join(f"{w['word']}@{a+w['start']:.2f}-{a+w['end']:.2f}" for w in r.get("words",[])))
w = wave.open("a1.wav"); w.setpos(int(a*16000)); x = np.frombuffer(w.readframes(int((b-a)*16000)), dtype=np.int16).astype(np.float32)/32768
n = len(x)//160; db = 20*np.log10(np.sqrt((x[:n*160].reshape(n,160)**2).mean(1)+1e-12))
# Pegel alle 50 ms (Minimum je 50 ms)
print("Pegel (min je 50ms):", " ".join(f"{a+i*0.05:.2f}:{db[i*5:(i+1)*5].min():.0f}" for i in range(n//5)))
