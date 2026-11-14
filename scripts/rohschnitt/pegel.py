"""Sprechbereiche aus dem Pegel: python pegel.py a.wav out.json"""
import sys, json, wave
import numpy as np
w = wave.open(sys.argv[1]); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * 0.01)
n = len(x) // hop
rms = np.sqrt((x[:n*hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
db = 20 * np.log10(rms)
db_s = np.convolve(db, np.ones(5)/5, mode="same")
floor = np.percentile(db_s, 10); peak = np.percentile(db_s, 95)
thr = float(sys.argv[3]) if len(sys.argv) > 3 else floor + max(10, (peak - floor) * 0.3)
sp = db_s > thr
regs, i = [], 0
while i < n:
    if sp[i]:
        j = i
        while j < n and sp[j]: j += 1
        regs.append([i/100, j/100]); i = j
    else: i += 1
merged = []
for r in regs:
    if merged and r[0] - merged[-1][1] < 0.18: merged[-1][1] = r[1]
    else: merged.append(r)
merged = [r for r in merged if r[1] - r[0] >= 0.06]
json.dump({"floor": float(floor), "peak": float(peak), "thr": float(thr), "regionen": merged}, open(sys.argv[2], "w"))
print(f"floor {floor:.1f} dB, peak {peak:.1f} dB, schwelle {thr:.1f} dB, {len(merged)} Sprechbereiche")
