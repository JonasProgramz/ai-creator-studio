# Gemeinsame Einstellungen aller Skripte. Jedes Video hat einen Arbeitsordner außerhalb des Skill- und Profilordners
# (Medien gehen nicht ins Git), darin projekt.json, voll/ und studio/. Beispiel für projekt.json:
#
# {
#   "name": "claude-desktop",                          Dateinamen der fertigen Videos
#   "fps": 30,                                          Bildrate der Aufnahme und der Vorschau
#   "final_fps": 60,                                    optional, Bildrate des finalen Renders (Standard 60)
#   "breite": 1920,                                     optional, Kamera beim Zusammensetzen auf diese Breite bringen (2560x1440 -> 1920x1080)
#   "kamera_ausschnitt": {"aufnahme.mp4": "752:423:1768:965"},  optional, Kamera aus einem OBS-Bild mit Bildschirm und Kamera in der Ecke (16:9, w:h:x:y)
#   "capcut": "Claude Desktop App - Rohschnitt",        fertiger Schnitt (Projektname in CapCut, nur falls mit CapCut geschnitten)
#   "bildschirm": {"datei": "/Pfad/screen.mov", "versatz": 1.4},
#   "teile": [["v01-hook", null], ["v02-tabs", "Kurze Einordnung"]]
# }
#
# "bildschirm" ist optional und meint eine getrennt aufgenommene Bildschirmaufnahme. versatz: Zeit in der
# Bildschirmdatei = Zeit in der Webcam-Datei + versatz (hat die Bildschirmaufnahme früher begonnen, ist er positiv).
# Gibt es mehrere Webcam-Dateien mit je eigener Bildschirmaufnahme, ist "bildschirm" eine Liste mit
# {"webcam": "<Dateiname der Webcam-Datei>", "datei": ..., "versatz": ...}.
# "teile": Name und die ersten Wörter, an denen der Teil beginnt, der erste mit null.
import json, os, subprocess, sys

def arbeit(argv):
    if len(argv) < 2: sys.exit('Erstes Argument ist der Arbeitsordner mit projekt.json.')
    a = os.path.abspath(os.path.expanduser(argv[1]))
    if not os.path.exists(os.path.join(a, 'projekt.json')): sys.exit(f'Keine projekt.json in {a}')
    return a

def lade(a):
    p = json.load(open(os.path.join(a, 'projekt.json'), encoding='utf-8'))
    p.setdefault('fps', 30); p.setdefault('final_fps', 60)
    return p

def bildschirm(P, webcam):
    """Bildschirmaufnahme und Versatz zu einer Webcam-Datei, oder None."""
    b = P.get('bildschirm')
    if not b: return None
    if isinstance(b, dict): return b
    for x in b:
        if os.path.basename(x['webcam']) == os.path.basename(webcam): return x
    return None

def capcut_ordner(name):
    if sys.platform == 'darwin':
        base = os.path.expanduser('~/Movies/CapCut/User Data/Projects/com.lveditor.draft')
    else:
        base = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft')
    return os.path.join(base, name)

def profil():
    """Ordner video-schnitt-profil/ der Person: VIDEO_PROFIL, sonst vom aktuellen Ordner aufwärts gesucht."""
    if os.environ.get('VIDEO_PROFIL'): return os.environ['VIDEO_PROFIL']
    p = os.getcwd()
    while not os.path.isdir(os.path.join(p, 'video-schnitt-profil')):
        q = os.path.dirname(p)
        if q == p: sys.exit('Profil nicht gefunden: video-schnitt-profil/ im Hauptordner anlegen (Einrichtung) oder VIDEO_PROFIL setzen.')
        p = q
    return os.path.join(p, 'video-schnitt-profil')

def lautheit(src, ziel=-14.0):
    """ffmpeg-Filter, der src auf rund -14 LUFS bringt: Mono, anheben, einzelne Spitzen sanft begrenzen.
    loudnorm allein landete bei einer Sprechstimme bei -16 bis -17 LUFS, weil kurze laute Silben die Anhebung bremsen,
    und der Begrenzer kostet selbst wieder Lautheit. Deshalb einmal messen, anwenden, nachmessen, Verstärkung korrigieren
    (Dreh vom 30.10.2026: Eingang -25 LUFS, fertiges Video -14,5 LUFS, Spitze -3,7 dB)."""
    def miss(f):
        m = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', src, '-vn', '-af', f + ',ebur128', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
        return float(m[m.rindex('I:'):].split()[1])
    # Erst Mono, sonst arbeitet der Begrenzer je Kanal und die Summe übersteuert trotzdem.
    kette = lambda g: f'aformat=channel_layouts=mono,volume={g:.2f}dB,alimiter=limit=0.79:attack=5:release=60:level=false'
    g = ziel - miss('aformat=channel_layouts=mono')
    for _ in range(2): g += ziel - miss(kette(g))
    return kette(g)

def dauer(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True).stdout or 0)
