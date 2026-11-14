# Alle Teile zu einem Video zusammensetzen: Bild aus den gerenderten Teilen der Reihe nach, jeder bildgenau auf
# seine Länge auf der Timeline gekürzt, Ton durchgehend aus voll/ton.wav (mit Effekten) oder sonst aus voll/voll.mp4.
#   python3 zusammen.py <arbeitsordner> vorschau [--nach <ziel.mp4>]   aus studio/output/vorschau-<teil>.mp4 (fps aus projekt.json)
#   python3 zusammen.py <arbeitsordner> final [--nach <ziel.mp4>]      aus studio/output/<teil>.mp4 (final_fps), dazu stimme.wav und
#                                                                       effekte.wav als eigene Spuren daneben
# --nach kopiert das Ergebnis zusätzlich dorthin, zum Beispiel als Entwurf in den Video-Ordner.
# Bricht ab, wenn ein Teil fehlt, älter ist als irgendeine seiner Quellen oder nicht so lang ist wie auf der Timeline.
# Ein abgebrochener Render hat sonst still den alten Stand ins Video gesetzt (Claude Desktop App, 31.10.2026).
import os, shutil, subprocess, sys
from projekt import arbeit, lautheit, dauer
from teile import teile

A = arbeit(sys.argv); T, _, P = teile(A)
art = sys.argv[2] if len(sys.argv) > 2 else 'vorschau'
pre, fps = ('vorschau-', P['fps']) if art == 'vorschau' else ('', P['final_fps'])
ST = os.path.join(A, 'studio'); OUT = os.path.join(ST, 'output'); V = os.path.join(A, 'voll')
OHNE = {'.hyperframes', 'snapshots', 'assets'}   # Kopien und Prüfbilder zählen nicht als Quelle
def neuste(p):
    if os.path.isfile(p): return os.path.getmtime(p)
    m = 0
    for r, ds, fs in os.walk(p):
        ds[:] = [d for d in ds if d not in OHNE]
        m = max([m] + [os.path.getmtime(os.path.join(r, f)) for f in fs])
    return m
files, alt = [], []
for n, a, b in T:
    f = os.path.join(OUT, f'{pre}{n}.mp4'); files.append(f)
    if not os.path.exists(f): alt.append(f'{n} (fehlt)'); continue
    if os.path.getmtime(f) < max(neuste(os.path.join(ST, n)), neuste(os.path.join(ST, 'assets'))): alt.append(f'{n} (älter als die Quelle)')
    elif dauer(f) < (b - a) - 1.5 / fps: alt.append(f'{n} (zu kurz: {dauer(f):.2f} statt {b - a:.2f} s)')
ton = os.path.join(V, 'ton.wav')
if os.path.exists(ton):
    q = [os.path.join(V, 'voll.mp4'), os.path.join(V, 'effekte.json')] + [os.path.join(ST, n, 'effekte.json') for n, _, _ in T]
    if os.path.getmtime(ton) < max(os.path.getmtime(x) for x in q if os.path.exists(x)): alt.append('voll/ton.wav (effekte.py neu laufen lassen)')
if alt and '--trotzdem' not in sys.argv: sys.exit('Nicht aktuell: ' + ', '.join(alt) + '\nErst neu erzeugen. Nur bewusst mit --trotzdem.')
ende = T[-1][2]
cmd, fc = ['ffmpeg', '-y', '-v', 'error'], ''
for i, (f, (n, a, b)) in enumerate(zip(files, T)):
    cmd += ['-i', f]; fc += f'[{i}:v]trim=end_frame={round(b * fps) - round(a * fps)},setpts=PTS-STARTPTS[v{i}];'
fc += ''.join(f'[v{i}]' for i in range(len(files))) + f'concat=n={len(files)}:v=1:a=0[v]'
if os.path.exists(ton): src, af = ton, 'anull'   # effekte.py hat schon auf -14 LUFS gebracht
else: src = os.path.join(V, 'voll.mp4'); af = lautheit(src)
ziel = os.path.join(OUT, f"{P['name']}-{art}.mp4")
cmd += ['-i', src, '-filter_complex', fc, '-map', '[v]', '-map', f'{len(files)}:a', '-c:v', 'libx264', '-crf', '18' if art == 'vorschau' else '14',
        '-preset', 'medium', '-pix_fmt', 'yuv420p', '-af', af, '-ac', '2', '-c:a', 'aac', '-b:a', '256k', '-t', f'{ende:.4f}', ziel]
subprocess.run(cmd, check=True); print(ziel)
if art == 'final' and os.path.exists(ton):
    for s in ('stimme', 'effekte'):
        shutil.copy(os.path.join(V, f'{s}.wav'), os.path.join(OUT, f"{P['name']}-{s}.wav"))
    print('Stimme und Effekte als eigene Spuren daneben, gleicher Pegel wie im Video.')
if '--nach' in sys.argv:
    z = sys.argv[sys.argv.index('--nach') + 1]; shutil.copy(ziel, z); print('kopiert nach', z)
