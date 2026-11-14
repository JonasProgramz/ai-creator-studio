"""Beleg zuschneiden und die gemessenen Textstellen mitnehmen.
  python zuschnitt.py <beleg> <teil> <kurz> [x y w h] [--breite B]
Liest ../belege/<beleg>.png und .json, schneidet das Rechteck (Bildpixel, ohne Angabe: ganzes Bild), skaliert
optional auf Breite B und schreibt <teil>/media/<kurz>.jpg sowie den Eintrag STELLEN['<kurz>'] in <teil>/media/stellen.js:
{w, h, stellen: {Wortlaut: [[[x,y,w,h] je Zeile], ... je Treffer]}, medien: [[x,y,w,h,typ,src]]}, alles in Pixeln des Zuschnitts.
Treffer, die nicht ganz im Zuschnitt liegen, fallen weg. Danach in der Komposition: <script src="media/stellen.js"></script>
und die Belegkarte mit data-beleg="<kurz>", Unterstreichung mit b.unter('Wortlaut', t)."""
import json, os, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
a = [x for x in sys.argv[1:] if not x.startswith('--')]
breite = int(sys.argv[sys.argv.index('--breite') + 1]) if '--breite' in sys.argv else None
if breite: a.remove(str(breite))
beleg, teil, kurz = a[:3]
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'belege')
im = Image.open(os.path.join(B, beleg + '.png')).convert('RGB')
J = json.load(open(os.path.join(B, beleg + '.json'), encoding='utf-8'))
x, y, w, h = map(int, a[3:7]) if len(a) >= 7 else (0, 0, im.width, im.height)
voll = im
def tinte(r):
    """Kasten senkrecht auf die sichtbare Tinte zuschneiden. Manche Schriften haben im Textkasten viel Luft über und unter
    den Buchstaben (Überschriften), dann lag die Unterstreichung weit unter der Schrift (07.11.2026)."""
    import numpy as np
    x0, y0, ww, hh = [int(round(v)) for v in r[:4]]
    if ww < 4 or hh < 6: return r
    g = np.asarray(voll.crop((x0, y0, x0 + ww, y0 + hh)).convert('L'), dtype=np.int16)
    grund = np.median(np.concatenate([g[0], g[-1]]))
    zeilen = np.where((np.abs(g - grund) > 60).mean(1) > 0.004)[0]
    if len(zeilen) < 2: return r
    t0, t1 = int(zeilen[0]), int(zeilen[-1]) + 1
    if t1 - t0 > 0.9 * hh: return r
    return [r[0], y0 + t0, r[2], t1 - t0] + list(r[4:])
for wl in J['stellen']: J['stellen'][wl] = [[tinte(r) for r in tr] for tr in J['stellen'][wl]]
im = im.crop((x, y, x + w, y + h)); k = 1.0
if breite and breite < w: k = breite / w; im = im.resize((breite, round(h * k)), Image.LANCZOS)
ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), teil, 'media'); os.makedirs(ziel, exist_ok=True)
im.save(os.path.join(ziel, kurz + '.jpg'), quality=93)
def rein(r): return r[0] >= x - 2 and r[1] >= y - 2 and r[0] + r[2] <= x + w + 2 and r[1] + r[3] <= y + h + 2
def um(r): return [round((r[0] - x) * k, 1), round((r[1] - y) * k, 1), round(r[2] * k, 1), round(r[3] * k, 1)] + list(r[4:])
st = {}
for wl, treffer in J['stellen'].items():
    t2 = [[um(r) for r in tr] for tr in treffer if tr and all(rein(r) for r in tr)]
    if t2: st[wl] = t2
md = [um(m) for m in J['medien'] if rein(m)]
eintrag = {'w': im.width, 'h': im.height, 'quelle': J['quelle'], 'stellen': st, 'medien': md}
p = os.path.join(ziel, 'stellen.js')
alt = open(p, encoding='utf-8').read() if os.path.exists(p) else 'window.STELLEN = window.STELLEN || {};\n'
zeilen = [l for l in alt.splitlines() if not l.startswith("STELLEN['" + kurz + "']")]
zeilen.append("STELLEN['" + kurz + "'] = " + json.dumps(eintrag, ensure_ascii=False) + ';')
open(p, 'w', encoding='utf-8').write('\n'.join(zeilen) + '\n')
print(f'{teil}/media/{kurz}.jpg {im.width}x{im.height}, Stellen: ' + ', '.join(f'{k2} ({len(v)})' for k2, v in st.items()))
