"""Stille Abschnitte (<-55 dB, >=0.12 s) in Fenstern: python stille.py a b [a b ...]"""
import sys, wave
import numpy as np
w = wave.open("a1.wav"); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)/32768
n = len(x)//160; db = 20*np.log10(np.sqrt((x[:n*160].reshape(n,160)**2).mean(1)+1e-12))
a = sys.argv[1:]
for i in range(0, len(a), 2):
    t0, t1 = float(a[i]), float(a[i+1]); s = db[int(t0*100):int(t1*100)] < -55
    out, j = [], 0
    while j < len(s):
        if s[j]:
            k = j
            while k < len(s) and s[k]: k += 1
            if k - j >= 12: out.append(f"{t0+j/100:.2f}-{t0+k/100:.2f}")
            j = k
        else: j += 1
    print(f"{t0}-{t1}: " + "  ".join(out))
