# Wort-Zeitstempel des Transkripts (Skill transkribieren, <name>-woerter.tsv) nach voll/words.json.
#   python3 worte.py <arbeitsordner> <woerter.tsv>
import csv, json, os, sys
from projekt import arbeit
A = arbeit(sys.argv)
if len(sys.argv) < 3: sys.exit('Zweites Argument ist die woerter.tsv aus dem Transkript von voll/voll.mp4.')
W = []
for r in csv.reader(open(sys.argv[2], encoding='utf-8'), delimiter='\t'):
    try: W.append({'s': float(r[0]), 'e': float(r[1]), 'w': r[2]})
    except (ValueError, IndexError): continue   # Kopfzeile
json.dump(W, open(os.path.join(A, 'voll', 'words.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(W), 'Wörter, letztes bei', W[-1]['e'] if W else '-')
