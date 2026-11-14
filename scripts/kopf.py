# Wo bewegt sich der Kopf der Person im ganzen Dreh? Daraus rechnet studio.js jeden Kamera-Ausschnitt so, dass Kopf,
# Haare und Kinn nie angeschnitten sind und die Augen höher als mittig sitzen. Für jeden neuen Dreh einmal laufen lassen.
#   python3 kopf.py <arbeitsordner> [bilder_pro_sekunde, Standard 0.5]
# Koordinaten im 1920x1080-Raum der Kamera-Ebene von studio.js, die Webcam muss 16:9 sein (Auflösung egal).
# Liest voll/voll.mp4, schreibt studio/assets/kopf.js (STUDIO_HEAD, STUDIO_EYE) und voll/kopf/ mit den vier
# extremsten Bildern je Richtung. Die ansehen: Sitzt die Box mal auf Mund oder Kinn, ist der Wert falsch.
import glob, json, os, shutil, subprocess, sys
import cv2, numpy as np
from projekt import arbeit

A = arbeit(sys.argv); fps = sys.argv[2] if len(sys.argv) > 2 else '0.5'
w, h = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
                                os.path.join(A, 'voll', 'voll.mp4')], capture_output=True, text=True).stdout.strip().split(','))
if abs(w / h - 16 / 9) > .01: sys.exit(f'Webcam ist {w}x{h}, nicht 16:9. studio.js rechnet mit 16:9, erst anpassen.')
K = os.path.join(A, 'voll', 'kopf'); shutil.rmtree(K, ignore_errors=True); os.makedirs(os.path.join(K, 'f'))
subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(A, 'voll', 'voll.mp4'), '-vf', f'fps={fps},scale=960:-2', '-q:v', '4',
                os.path.join(K, 'f', '%05d.jpg')], check=True)
casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
R = []
for p in sorted(glob.glob(os.path.join(K, 'f', '*.jpg'))):
    fs = casc.detectMultiScale(cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2GRAY), scaleFactor=1.08, minNeighbors=6, minSize=(90, 90))
    if len(fs) == 0: continue
    x, y, w, h = [2 * v for v in max(fs, key=lambda f: f[2] * f[3])]   # Bilder sind 960 breit, Kamera-Ebene 1920
    R.append({'f': p, 'x': x, 'y': y, 'w': w, 'h': h})
if not R: sys.exit('Kein Gesicht gefunden.')
# Fehltreffer raus: Boxen, die deutlich kleiner oder größer als üblich sind oder weit weg vom üblichen Platz liegen.
# Danach Perzentil 1 und 99, damit einzelne verrutschte Boxen den Bereich nicht aufblähen.
mw = np.median([r['w'] for r in R]); mx = np.median([r['x'] + r['w'] / 2 for r in R]); my = np.median([r['y'] + r['h'] / 2 for r in R])
R = [r for r in R if .7 < r['w'] / mw < 1.35 and abs(r['x'] + r['w'] / 2 - mx) < 1.5 * mw and abs(r['y'] + r['h'] / 2 - my) < mw]
# Die Haar-Box reicht etwa von den Augenbrauen bis unter den Mund: Haare und Kinn dazurechnen.
# Zuschläge abgeglichen mit dem von Hand gemessenen Dreh vom 30.10.2026 (Haare ab y 30, Kinn bis 770, Augen bei 420).
for r in R:
    r.update(top=r['y'] - .25 * r['h'], bot=r['y'] + 1.12 * r['h'], left=r['x'] - .15 * r['w'], right=r['x'] + 1.15 * r['w'], eye=r['y'] + .47 * r['h'])
g = lambda k, q: float(np.percentile([r[k] for r in R], q))
head = {'x0': round(max(0, g('left', 1))), 'x1': round(min(1920, g('right', 99))), 'y0': round(max(0, g('top', 1))), 'y1': round(min(1080, g('bot', 99)))}
eye = round(g('eye', 50))
for k, rev in (('top', False), ('left', False), ('right', True), ('bot', True)):
    for i, r in enumerate(sorted(R, key=lambda r: r[k], reverse=rev)[:4]): shutil.copy(r['f'], os.path.join(K, f'extrem-{k}-{i}.jpg'))
shutil.rmtree(os.path.join(K, 'f'))
os.makedirs(os.path.join(A, 'studio', 'assets'), exist_ok=True)
open(os.path.join(A, 'studio', 'assets', 'kopf.js'), 'w').write(
    f'// Kopfbereich im Dreh (1920x1080), gemessen mit kopf.py aus {len(R)} Bildern.\nwindow.STUDIO_HEAD = {json.dumps(head)};\nwindow.STUDIO_EYE = {eye};\n')
print(len(R), 'Bilder mit Gesicht', head, 'Augen bei', eye, '| Box im Median: x', round(mx), 'y', round(my), 'Breite', round(mw))
