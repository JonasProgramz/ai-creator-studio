# Ton fürs fertige Video: Stimme aus dem Schnitt auf rund -14 LUFS, dazu die Soundeffekte. Musik nur, wenn das Profil sie vorsieht.
#   python3 effekte.py <arbeitsordner>
# Effekte kommen aus studio/<teil>/effekte.json (Zeiten ab Teilanfang, so schreiben sie die Agenten beim Bauen)
# und optional aus voll/effekte.json (Zeiten auf der ganzen Timeline). Format je Eintrag:
#   {"t": 12.40, "datei": "whoosh-soft-01.mp3", "db": -16}
#   t    Sekunde, an der der Klang einsetzt (die Stille am Dateianfang rechnet das Skript heraus)
#   db   Spitze des Effekts relativ zur Spitze der Stimme, Richtwerte in references/grundsaetze.md unter „Ton“
# Schreibt voll/stimme.wav, voll/effekte.wav und voll/ton.wav (Summe, die zusammen.py ins Video legt). Alle drei haben
# denselben Pegel, Stimme und Effekte lassen sich also im Schnittprogramm neu mischen.
import json, os, subprocess, sys
import numpy as np, soundfile as sf
from projekt import arbeit, profil, lautheit
from teile import teile

A = arbeit(sys.argv); SR = 48000; V = os.path.join(A, 'voll')
SFX = os.path.join(profil(), 'sounds')   # eigene Soundeffekte der Person, Dateinamen wie in effekte.json
def lade(p, filt=None):
    a = ['ffmpeg', '-v', 'error', '-i', p] + (['-af', filt] if filt else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(a, capture_output=True, check=True).stdout, np.float32).astype(np.float64)

E_ = []
if os.path.exists(os.path.join(V, 'effekte.json')): E_ += json.load(open(os.path.join(V, 'effekte.json'), encoding='utf-8'))
T, _, _ = teile(A)
for name, a, b in T:
    f = os.path.join(A, 'studio', name, 'effekte.json')
    if not os.path.exists(f): continue
    for e in json.load(open(f, encoding='utf-8')):
        if not 0 <= e['t'] < b - a: print(f'{name}: liegt außerhalb des Teils', e); continue
        E_.append({**e, 't': a + e['t'], 'teil': name})
stimme = lade(os.path.join(V, 'voll.mp4'), lautheit(os.path.join(V, 'voll.mp4')))
spitze = np.percentile(np.abs(stimme), 99.9)   # robuste Spitze, einzelne Ausreißer zählen nicht
fx = np.zeros_like(stimme)
for e in sorted(E_, key=lambda e: e['t']):
    s = lade(os.path.join(SFX, e['datei']))
    vorn = np.argmax(np.abs(s) > 10 ** (-50 / 20))   # Stille am Anfang, wie im Katalog gemessen
    s = s[vorn:] / (np.max(np.abs(s)) or 1) * spitze * 10 ** (e['db'] / 20)
    i = int(round(e['t'] * SR))
    if i >= len(fx): print('liegt hinter dem Ende:', e); continue
    n = min(len(s), len(fx) - i); fx[i:i + n] += s[:n]
mix = stimme + fx
k = max(np.max(np.abs(mix)) / 0.84, 1.0)   # Spitze unter -1,5 dB, gleicher Faktor für alle drei Spuren
for name, x in (('stimme', stimme), ('effekte', fx), ('ton', mix)):
    sf.write(os.path.join(V, f'{name}.wav'), (x / k).astype(np.float32), SR, subtype='FLOAT')
print(len(E_), 'Effekte, Länge', round(len(mix) / SR, 2), 's', '(leiser um Faktor %.2f, damit nichts übersteuert)' % k if k > 1 else '')
