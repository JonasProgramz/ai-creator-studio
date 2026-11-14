"""Legt aus schnitt.json ein neues CapCut-Projekt an (Vorlage: ein leerer Entwurf in CapCut, Name in CAPCUT_VORLAGE, Standard „vorlage“, nicht löschen). python capcut_projekt.py schnitt.json "Projektname" """
import sys, json, copy, uuid, os, time, subprocess
import sys as _s
ROOT = os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft") if _s.platform == "darwin" else os.path.join(os.environ.get("LOCALAPPDATA", ""), "CapCut", "User Data", "Projects", "com.lveditor.draft")
VORLAGE = f"{ROOT}/{os.environ.get('CAPCUT_VORLAGE', 'vorlage')}"   # leerer Entwurf in CapCut, Name per CAPCUT_VORLAGE
schnitt = json.load(open(sys.argv[1], encoding="utf-8")); name = sys.argv[2]
ziel = f"{ROOT}/{name}"
if os.path.exists(ziel): sys.exit(f"Gibt es schon: {ziel}")
U = lambda: str(uuid.uuid4()).upper()
us = lambda t: int(round(t * 1_000_000))

tpl = json.load(open(f"{VORLAGE}/draft_info.json", encoding="utf-8"))
m0 = tpl["materials"]; seg0 = tpl["tracks"][0]["segments"][0]
idx = {x["id"]: (k, x) for k, l in m0.items() if isinstance(l, list) for x in l if isinstance(x, dict) and "id" in x}
proto_video = copy.deepcopy(idx[seg0["material_id"]][1])
proto_extra = [(idx[r][0], copy.deepcopy(idx[r][1])) for r in seg0["extra_material_refs"]]

def dauer(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                                capture_output=True, text=True, check=True).stdout.strip())
quellen = {}
for q, p in schnitt["quellen"].items():
    quellen[q] = {"pfad": p, "dauer": dauer(p), "local_id": str(uuid.uuid4()), "groesse": os.path.getsize(p)}

d = copy.deepcopy(tpl)
for k, l in d["materials"].items():
    if isinstance(l, list): d["materials"][k] = []
mats = d["materials"]
segs, pos, marken = [], 0, []
for i, t in enumerate(schnitt["teile"]):
    q = quellen[t["quelle"]]
    v = copy.deepcopy(proto_video)
    v.update(id=U(), unique_id=uuid.uuid4().hex, path=q["pfad"], material_name=os.path.basename(q["pfad"]),
             duration=us(q["dauer"]), width=1920, height=1080, local_material_id=q["local_id"], has_audio=True)
    mats["videos"].append(v)
    refs = []
    for typ, proto in proto_extra:
        x = copy.deepcopy(proto); x["id"] = U()
        if typ == "material_animations": x["animations"] = []
        if typ == "speeds": x.update(speed=1.0, curve_speed=None)
        mats[typ].append(x); refs.append(x["id"])
    s = copy.deepcopy(seg0)
    dur = us(t["bis"]) - us(t["von"])
    s.update(id=U(), material_id=v["id"], extra_material_refs=refs,
             source_timerange={"start": us(t["von"]), "duration": dur},
             target_timerange={"start": pos, "duration": dur},
             render_timerange={"start": 0, "duration": 0},
             speed=1.0, volume=1.0, last_nonzero_volume=1.0, keyframe_refs=[], common_keyframes=[],
             clip={"scale": {"x": 1.0, "y": 1.0}, "rotation": 0.0, "transform": {"x": 0.0, "y": 0.0},
                   "flip": {"vertical": False, "horizontal": False}, "alpha": 1.0},
             uniform_scale={"on": True, "value": 1.0}, render_index=0, track_render_index=0, visible=True)
    if t.get("marke"): marken.append({"id": U(), "title": t["marke"], "time_range": {"start": pos, "duration": 0}, "color": "#00c1cd"})
    segs.append(s); pos += dur

tl_id = U()
spur = copy.deepcopy(tpl["tracks"][0]); spur.update(id=U(), segments=segs)
d.update(id=tl_id, duration=pos, fps=float(schnitt.get("fps", 30)), tracks=[spur],
         canvas_config={"ratio": "original", "width": 1920, "height": 1080, "background": None},
         time_marks={"id": U(), "mark_items": marken}, keyframe_graph_list=[], relationships=[])
d["keyframes"] = {k: [] for k in d["keyframes"]}

os.makedirs(f"{ziel}/Timelines/{tl_id}")
for p in (f"{ziel}/draft_info.json", f"{ziel}/Timelines/{tl_id}/draft_info.json"):
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
jetzt_us = int(time.time() * 1_000_000)
json.dump({"config": {"color_space": -1, "hdr_vivid": False, "mixed_track_mode_on": False, "render_index_track_mode_on": False, "use_float_render": False},
           "create_time": jetzt_us, "id": U(), "main_timeline_id": tl_id,
           "timelines": [{"create_time": jetzt_us, "id": tl_id, "is_marked_delete": False, "name": "Zeitleiste 01", "update_time": jetzt_us}],
           "update_time": jetzt_us, "version": 0}, open(f"{ziel}/Timelines/project.json", "w", encoding="utf-8"))
json.dump({"dockItems": [{"dockIndex": 0, "ratio": 1, "timelineIds": [tl_id], "timelineNames": ["Zeitleiste 01"]}], "layoutOrientation": 1},
          open(f"{ziel}/timeline_layout.json", "w", encoding="utf-8"))

mi = json.load(open(f"{VORLAGE}/draft_meta_info.json", encoding="utf-8"))
proto_dm = copy.deepcopy(mi["draft_materials"][0]["value"][0])
dm = []
for q in quellen.values():
    e = copy.deepcopy(proto_dm)
    e.update(id=q["local_id"], file_Path=q["pfad"], extra_info=os.path.basename(q["pfad"]), duration=us(q["dauer"]),
             width=1920, height=1080, metetype="video", type=0, roughcut_time_range={"duration": us(q["dauer"]), "start": 0})
    dm.append(e)
for g in mi["draft_materials"]:
    g["value"] = dm if g["type"] == 0 else []
draft_id = U()
mi.update(draft_fold_path=ziel, draft_id=draft_id, draft_name=name, draft_root_path=ROOT, draft_cover="draft_cover.jpg",
          tm_draft_create=jetzt_us, tm_draft_modified=jetzt_us, tm_duration=pos,
          draft_timeline_materials_size_=sum(q["groesse"] for q in quellen.values()), draft_segment_extra_info=[], draft_materials_copied_info=[])
json.dump(mi, open(f"{ziel}/draft_meta_info.json", "w", encoding="utf-8"), ensure_ascii=False)
json.dump({"draft_materials": [], "draft_virtual_store": [
    {"type": 0, "value": [{"creation_time": 0, "display_name": "", "filter_type": 0, "id": "", "import_time": 0, "import_time_us": 0, "material_color_tag": "", "sort_sub_type": 0, "sort_type": 0, "subdraft_filter_type": 0}]},
    {"type": 1, "value": [{"child_id": q["local_id"], "parent_id": ""} for q in quellen.values()]},
    {"type": 2, "value": []}]}, open(f"{ziel}/draft_virtual_store.json", "w", encoding="utf-8"))
sek = int(time.time())
open(f"{ziel}/draft_settings", "w").write(f"[General]\ndraft_create_time={sek}\ndraft_last_edit_time={sek}\nreal_edit_seconds=0\nreal_edit_keys=0\ncloud_last_modify_platform=mac\n")
for f in ("draft_agency_config.json", "draft_biz_config.json"):
    open(f"{ziel}/{f}", "wb").write(open(f"{VORLAGE}/{f}", "rb").read())

from capcut_eintragen import laeuft, eintragen
if laeuft():
    print("CapCut läuft, Eintrag in die Projektliste folgt mit: python capcut_eintragen.py --warten \"" + name + "\"")
else:
    eintragen([name])
print(f"angelegt: {ziel}\n{len(segs)} Clips, {pos/1e6/60:.2f} min")
