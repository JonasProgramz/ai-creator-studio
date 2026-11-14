# Das Video in Teile von rund 40 bis 120 s schneiden, Grenzen am gesprochenen Wort, auf ganze Bilder gerundet.
#   python3 teile.py <arbeitsordner> liste            Grenzen anzeigen
#   python3 teile.py <arbeitsordner> worte [teil ...] studio/<teil>/worte.txt (jedes Wort mit Zeit ab Teilanfang)
#   python3 teile.py <arbeitsordner> json             studio/teile.json (Grenzen für die Live-Vorschau im Video Studio)
#   python3 teile.py <arbeitsordner> medien [teil ...] studio/<teil>/media/cam.mp4, dazu scr.mp4, falls voll/scr.mp4 da ist
# Nach jeder Änderung an den Grenzen worte und medien neu erzeugen und die betroffenen Teile neu rendern.
# Die Teile stehen in projekt.json unter "teile": [name, erste Wörter des Teils], der erste mit null. Optional als drittes
# die Grenze in Sekunden, wenn sie genau dort bleiben soll (nach einem eingesetzten Nachdreh, damit der Teil danach synchron bleibt).
import json, os, re, subprocess, sys
from projekt import arbeit, lade

def teile(A):
    P = lade(A); F = P['fps']
    W = json.load(open(os.path.join(A, 'voll', 'words.json'), encoding='utf-8'))
    cuts = json.load(open(os.path.join(A, 'voll', 'cuts.json'), encoding='utf-8'))
    ende = (cuts[-1]['f'] + cuts[-1]['n']) / F
    ws = [re.sub(r'\W', '', w['w']).lower() for w in W]
    def find(ph):
        p = [re.sub(r'\W', '', x).lower() for x in ph.split()]
        hits = [i for i in range(len(ws)) if ws[i:i + len(p)] == p]
        if len(hits) != 1: sys.exit(f'„{ph}“ kommt {len(hits)}-mal vor, bitte eindeutige Stelle wählen.')
        return hits[0]
    gr = []
    for n, ph, *fest in P['teile']:
        if ph is None: gr.append(0.0); continue
        if fest: gr.append(fest[0]); continue   # feste Grenze in Sekunden, z. B. wenn ein Nachdreh davor eingesetzt wurde
        i = find(ph)   # Grenze mitten in die Pause, bei langer Pause kurz vor dem Wort
        t = (W[i - 1]['e'] + W[i]['s']) / 2 if W[i]['s'] - W[i - 1]['e'] < .5 else W[i]['s'] - .12
        gr.append(round(t * F) / F)
    gr.append(ende)
    return [(P['teile'][i][0], gr[i], gr[i + 1]) for i in range(len(P['teile']))], W, P

if __name__ == '__main__':
    A = arbeit(sys.argv); T, W, P = teile(A)
    was = sys.argv[2] if len(sys.argv) > 2 else 'liste'; nur = set(sys.argv[3:])
    if was == 'json':   # studio/teile.json für die Live-Vorschau im Video Studio
        z = os.path.join(A, 'studio', 'teile.json')
        json.dump([{'name': n, 'von': round(a, 4), 'bis': round(b, 4)} for n, a, b in T], open(z, 'w', encoding='utf-8'), indent=1)
        print(z); sys.exit(0)
    for name, a, b in T:
        if was == 'liste': print(f'{name:18s} {a:8.2f} {b:8.2f} {b - a:6.1f}'); continue
        if nur and name not in nur: continue
        d = os.path.join(A, 'studio', name); os.makedirs(os.path.join(d, 'media'), exist_ok=True)
        if was == 'worte':
            x = [f"{w['w']}@{w['s'] - a:.2f}" for w in W if a - .05 <= w['s'] < b - .03]
            L = [' '.join(x[i:i + 14]) for i in range(0, len(x), 14)]
            open(os.path.join(d, 'worte.txt'), 'w', encoding='utf-8').write(f'# {name}: {a:.4f} bis {b:.4f} auf der Timeline, Dauer {b - a:.4f} s.\n' + '\n'.join(L) + '\n')
        if was == 'medien':
            for q, z, ton in (('voll.mp4', 'cam.mp4', True), ('scr.mp4', 'scr.mp4', False)):
                src = os.path.join(A, 'voll', q)
                if not os.path.exists(src): continue
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.4f}', '-i', src, '-t', f'{b - a:.4f}', '-c:v', 'libx264', '-crf', '15',
                                '-preset', 'medium', '-g', str(P['fps']), '-pix_fmt', 'yuv420p'] + (['-c:a', 'aac', '-b:a', '192k'] if ton else ['-an']) +
                               [os.path.join(d, 'media', z)], check=True)
            print(name)
