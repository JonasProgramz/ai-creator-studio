"""Entfernt Clips einer Quelle in einem Quellzeitbereich aus der Hauptspur und schiebt den Rest nach (Ripple).
python capcut_entfernen.py "Projektname" <quelldatei-endung> <von> <bis> [--warten]
Nur bei geschlossenem CapCut. Sichert vorher alle draft_info.json als .vor-entfernen-<zeit>."""
import sys, json, os, time, shutil, subprocess, glob
import sys as _s
ROOT = os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft") if _s.platform == "darwin" else os.path.join(os.environ.get("LOCALAPPDATA", ""), "CapCut", "User Data", "Projects", "com.lveditor.draft")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
name, quelle, von, bis = args[0], args[1], float(args[2]), float(args[3])
laeuft = lambda: subprocess.run(["pgrep", "-x", "CapCut"], capture_output=True).returncode == 0
if "--warten" in sys.argv:
    while laeuft(): time.sleep(5)
    time.sleep(5)
elif laeuft():
    sys.exit("CapCut läuft noch.")
P = f"{ROOT}/{name}"
dateien = [f"{P}/draft_info.json"] + glob.glob(f"{P}/Timelines/*/draft_info.json")
stempel = int(time.time())
for f in dateien: shutil.copy(f, f"{f}.vor-entfernen-{stempel}")
for f in dateien:
    d = json.load(open(f, encoding="utf-8"))
    mats = {m["id"]: m for m in d["materials"]["videos"]}
    haupt = next(t for t in d["tracks"] if t["type"] == "video")
    raus = []
    for s in haupt["segments"]:
        m = mats.get(s["material_id"])
        a = s["source_timerange"]["start"] / 1e6; e = a + s["source_timerange"]["duration"] / 1e6
        if m and m["path"].endswith(quelle) and a >= von - 0.05 and e <= bis + 0.05: raus.append(s)
    if not raus: sys.exit(f"keine Clips gefunden in {f}")
    tl0 = min(s["target_timerange"]["start"] for s in raus)
    tl1 = max(s["target_timerange"]["start"] + s["target_timerange"]["duration"] for s in raus)
    dauer = sum(s["target_timerange"]["duration"] for s in raus)
    if tl1 - tl0 != dauer: sys.exit(f"Clips liegen nicht am Stück auf der Timeline ({f}), nichts geändert")
    ids = {s["id"] for s in raus}
    haupt["segments"] = [s for s in haupt["segments"] if s["id"] not in ids]
    for t in d["tracks"]:
        for s in t["segments"]:
            if s["target_timerange"]["start"] >= tl1: s["target_timerange"]["start"] -= dauer
    for mk in d.get("time_marks", {}).get("mark_items", []):
        if mk["time_range"]["start"] >= tl1: mk["time_range"]["start"] -= dauer
    d["duration"] -= dauer
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"{os.path.relpath(f, P)}: {len(raus)} Clips raus bei {int(tl0/1e6//60)}:{tl0/1e6%60:05.2f}, {dauer/1e6:.2f} s kürzer, jetzt {d['duration']/1e6/60:.2f} min")
