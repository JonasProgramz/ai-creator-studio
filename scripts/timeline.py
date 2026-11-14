# Einen fertigen Schnitt aus CapCut lesen (optional, nur wenn die Person in CapCut schneidet) und als ein Video mit durchgehendem Ton zusammensetzen.
#   python3 timeline.py <arbeitsordner> [--ohne-video]
# Schreibt voll/cuts.json (je Clip: Platz auf der Timeline in Bildern, Quelle, Startbild in der Quelle),
# voll/voll.mp4 (Webcam und Ton) und, wenn projekt.json eine Bildschirmaufnahme nennt, voll/scr.mp4 mit denselben
# Schnitten, auf 1920x1080 eingepasst (Mac-Aufnahmen in 16:10 bekommen dunkle Ränder).
# Danach voll.mp4 transkribieren (Skill transkribieren) und mit worte.py in voll/words.json umwandeln.
import json, os, subprocess, sys
from projekt import arbeit, lade, capcut_ordner, bildschirm

A = arbeit(sys.argv); P = lade(A); F = P['fps']
d = os.path.join(capcut_ordner(P['capcut']), 'draft_info.json')
if not os.path.exists(d): d = d.replace('draft_info.json', 'draft_content.json')   # CapCut unter Windows
d = json.load(open(d, encoding='utf-8'))
mat = {v['id']: v for v in d['materials']['videos']}
spur = [t for t in d['tracks'] if t['type'] == 'video'][0]   # Hauptspur, darüber liegende Spuren ignorieren
t, cuts = 0, []
for s in sorted(spur['segments'], key=lambda x: x['target_timerange']['start']):
    if (s.get('speed') or 1.0) != 1.0: sys.exit('Clip mit geänderter Geschwindigkeit, das unterstützt timeline.py nicht.')
    v = mat[s['material_id']]
    fs = round(s['source_timerange']['start'] / 1e6 * F); fn = round(s['source_timerange']['duration'] / 1e6 * F)
    cuts.append({'f': t, 't': t / F, 'n': fn, 'd': fn / F, 'src': v['path'], 'fs': fs, 'cam': fs / F, 'vol': s.get('volume', 1.0)})
    t += fn
os.makedirs(os.path.join(A, 'voll'), exist_ok=True)
json.dump(cuts, open(os.path.join(A, 'voll', 'cuts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(f'{len(cuts)} Clips, {t / F:.2f} s, CapCut sagt {d["duration"] / 1e6:.2f} s')
leise = [i for i, c in enumerate(cuts) if c['vol'] == 0]
if leise: print('Achtung, stumm geschaltete Clips:', leise)
if '--ohne-video' in sys.argv: sys.exit()

def baue(ziel, scr=False):
    cmd, fc = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'], ''
    for i, c in enumerate(cuts):
        q, ss = c['src'], c['cam']
        if scr:
            b = bildschirm(P, c['src'])
            # Eingesetzte Filme ohne eigene Bildschirmaufnahme: der Clip selbst ist das Bild
            if not b and not P.get('ohne_bildschirm_selbst'): b = {'datei': c['src'], 'versatz': 0.0}
            if not b: sys.exit(f"Keine Bildschirmaufnahme zu {c['src']}")
            q, ss = b['datei'], c['cam'] + b.get('versatz', 0.0)
            if ss < 0: sys.exit(f'Clip {i} beginnt vor dem Anfang der Bildschirmaufnahme, Versatz prüfen.')
        cmd += ['-ss', f'{ss:.4f}', '-t', f"{c['d'] + 0.5:.4f}", '-i', q]
        # erst auf die Bildrate des Projekts bringen, dann Bilder zählen: Bildschirmaufnahmen haben oft 60 fps oder variable Raten
        v = f'fps={F},trim=end_frame={c["n"]},setpts=PTS-STARTPTS'
        if not scr and P.get('breite'): v += f",scale={P['breite']}:-2:flags=lanczos"   # z.B. 2560x1440 der Kamera auf 1920x1080
        # scr_breite: größere Bildschirmspur für scharfe Zooms (z. B. 2560 aus einer 4K-Aufnahme)
        sw = P.get('scr_breite', 1920); sh = sw * 9 // 16
        if scr: v += f',scale={sw}:{sh}:force_original_aspect_ratio=decrease:flags=lanczos,pad={sw}:{sh}:(ow-iw)/2:(oh-ih)/2:color=0x161311,setsar=1'
        fc += f'[{i}:v]{v}[v{i}];'
        if not scr: fc += f"[{i}:a]atrim=end={c['d']:.5f},asetpts=PTS-STARTPTS,volume={c['vol']}[a{i}];"
    n = len(cuts)
    fc += ''.join(f'[v{i}]' + ('' if scr else f'[a{i}]') for i in range(n)) + f'concat=n={n}:v=1:a={0 if scr else 1}[v]' + ('' if scr else '[a]')
    open(ziel + '.fc', 'w', encoding='utf-8').write(fc)
    cmd += ['-/filter_complex', ziel + '.fc', '-map', '[v]'] + ([] if scr else ['-map', '[a]', '-c:a', 'aac', '-b:a', '256k'])
    cmd += ['-r', str(F), '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-g', str(F), '-pix_fmt', 'yuv420p', ziel]
    subprocess.run(cmd, check=True); os.remove(ziel + '.fc'); print(ziel)

baue(os.path.join(A, 'voll', 'voll.mp4'))
if P.get('bildschirm'): baue(os.path.join(A, 'voll', 'scr.mp4'), scr=True)
