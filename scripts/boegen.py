# Kontaktbögen aus einem fertigen Video zum Prüfen, je Bogen 4x4 Bilder mit Zeitstempel.
#   python3 boegen.py <video.mp4> [--alle 4] [--um 61.2,118.4] [--breite 480] [--ziel ordner]
#   --alle N     ein Bild alle N Sekunden über das ganze Video (Standard 4)
#   --um t,...   statt dessen je fünf Bilder von t-1 bis t+1 s, zum Beispiel an den Nähten zwischen den Teilen
#   --breite B   Bildbreite im Bogen. 480 reicht für Aufbau und Lücken, Text liest man erst ab 960.
#   --ziel       Standard ist ein Ordner im Temp-Verzeichnis, damit keine Bilder im Projekt landen
# Bögen ersetzen kein Ansehen in Echtzeit: Bewegung, Tempo und Ton sieht man darauf nicht.
import argparse, os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
ap = argparse.ArgumentParser(); ap.add_argument('video'); ap.add_argument('--alle', type=float, default=4.0)
ap.add_argument('--um'); ap.add_argument('--breite', type=int, default=480); ap.add_argument('--ziel')
o = ap.parse_args()
name = os.path.splitext(os.path.basename(o.video))[0]
z = o.ziel or os.path.join(tempfile.gettempdir(), 'boegen-' + name); shutil.rmtree(z, ignore_errors=True); os.makedirs(z)
tmp = tempfile.mkdtemp()
if o.um: T = [max(0, float(t) + d) for t in o.um.split(',') for d in (-1, -.5, 0, .5, 1)]
else:
    L = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', o.video], capture_output=True, text=True).stdout)
    T = [o.alle / 2 + i * o.alle for i in range(int(L // o.alle))]   # Mitte jedes Abschnitts, nicht die Blende am Rand
B = []
for i, t in enumerate(T):
    p = os.path.join(tmp, f'{i:05d}.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', o.video, '-frames:v', '1', '-vf', f'scale={o.breite}:-2', '-q:v', '4', p], check=True)
    if os.path.exists(p): B.append((t, p))
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', max(18, o.breite // 18))
except OSError: font = ImageFont.load_default()
w, h = Image.open(B[0][1]).size
for k in range(0, len(B), 16):
    s = Image.new('RGB', (4 * w + 12, 4 * h + 12), (90, 90, 90)); d = ImageDraw.Draw(s)
    for j, (t, p) in enumerate(B[k:k + 16]):
        x, y = (j % 4) * (w + 4), (j // 4) * (h + 4); s.paste(Image.open(p), (x, y))
        lab = f'{int(t // 60)}:{t % 60:04.1f}'; tw = d.textlength(lab, font=font)
        d.rectangle((x + 6, y + 6, x + 16 + tw, y + 12 + font.size), fill=(0, 0, 0)); d.text((x + 11, y + 8), lab, fill='white', font=font)
    s.save(os.path.join(z, f'bogen-{k // 16 + 1:03d}.jpg'), quality=82)
shutil.rmtree(tmp); print((len(B) + 15) // 16, 'Bögen in', z)
