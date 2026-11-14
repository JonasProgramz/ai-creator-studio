import json, subprocess, os
from PIL import Image
t = json.load(open("schnitt.json", encoding="utf-8")); Q = t["quellen"]; T = t["teile"]
os.makedirs("naehte", exist_ok=True)
def bild(q, zeit, out):
    subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{zeit:.3f}","-i",Q[q],"-frames:v","1","-vf","scale=240:135",out], check=True)
paare = []
for i in range(len(T)-1):
    a, b = T[i], T[i+1]
    fa, fb = f"naehte/{i:02d}a.jpg", f"naehte/{i:02d}b.jpg"
    bild(a["quelle"], a["bis"] - 1/60, fa); bild(b["quelle"], b["von"], fb); paare.append((fa, fb))
pro = 24
for k in range(0, len(paare), pro):
    teil = paare[k:k+pro]; rows = (len(teil)+2)//3
    sheet = Image.new("RGB", (3*490, rows*140), "white")
    for j, (fa, fb) in enumerate(teil):
        x, y = (j%3)*490, (j//3)*140
        sheet.paste(Image.open(fa), (x, y)); sheet.paste(Image.open(fb), (x+245, y))
    sheet.save(f"naehte_{k//pro+1}.jpg", quality=80)
print(len(paare), "Nähte")
