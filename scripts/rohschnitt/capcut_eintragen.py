"""Trägt fertige Projektordner in CapCuts Projektliste ein (root_meta_info.json). Nur bei geschlossenem CapCut,
sonst überschreibt CapCut die Liste beim nächsten Speichern. python capcut_eintragen.py "Projektname" [...]
Mit --warten wartet das Skript, bis CapCut geschlossen ist."""
import sys, json, copy, os, time, shutil, subprocess
import sys as _s
ROOT = os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft") if _s.platform == "darwin" else os.path.join(os.environ.get("LOCALAPPDATA", ""), "CapCut", "User Data", "Projects", "com.lveditor.draft")

def laeuft():
    return subprocess.run(["pgrep", "-x", "CapCut"], capture_output=True).returncode == 0

def eintragen(namen):
    rm_pfad = f"{ROOT}/root_meta_info.json"
    shutil.copy(rm_pfad, f"{rm_pfad}.vor-eintrag-{int(time.time())}")
    rm = json.load(open(rm_pfad, encoding="utf-8"))
    vorlage = next(x for x in rm["all_draft_store"] if x["draft_name"] == os.environ.get("CAPCUT_VORLAGE", "vorlage"))
    for name in reversed(namen):
        ziel = f"{ROOT}/{name}"
        if any(x["draft_fold_path"] == ziel for x in rm["all_draft_store"]):
            print(f"steht schon drin: {name}"); continue
        mi = json.load(open(f"{ziel}/draft_meta_info.json", encoding="utf-8"))
        e = copy.deepcopy(vorlage)
        e.update(draft_cover=f"{ziel}/draft_cover.jpg", draft_fold_path=ziel, draft_id=mi["draft_id"], draft_json_file=f"{ziel}/draft_info.json",
                 draft_name=name, draft_new_version="", draft_timeline_materials_size=mi["draft_timeline_materials_size_"],
                 tm_draft_create=mi["tm_draft_create"], tm_draft_modified=mi["tm_draft_modified"], tm_duration=mi["tm_duration"])
        rm["all_draft_store"].insert(0, e)
        print(f"eingetragen: {name}")
    json.dump(rm, open(rm_pfad, "w", encoding="utf-8"), ensure_ascii=False)

if __name__ == "__main__":
    namen = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--warten" in sys.argv:
        while laeuft(): time.sleep(5)
        time.sleep(5)
    elif laeuft():
        sys.exit("CapCut läuft noch. Erst schließen oder mit --warten aufrufen.")
    eintragen(namen)
