"""Soundeffekte und Musik mit ElevenLabs erzeugen. Kostet Credits: vorher der Person sagen, was du erzeugen willst.

Aufruf:
    python elevenlabs_ton.py effekt "<Beschreibung auf Englisch>" <datei.mp3> [--sekunden 2]
    python elevenlabs_ton.py musik  "<Beschreibung auf Englisch>" <datei.mp3> --sekunden 120

Ohne Ordner im Dateinamen landet die Datei in video-schnitt-profil/sounds/. Danach in sounds/README.md eintragen,
was es ist und wofür es passt, damit es im nächsten Video wieder gefunden wird.

Braucht ELEVENLABS_API_KEY in video-schnitt-profil/.env. Ändert ElevenLabs seine API (Fehler 404 oder 422),
in der offiziellen Doku nachsehen (elevenlabs.io/docs, Sound Effects und Music) und das Skript anpassen.
"""
import argparse, json, os, sys, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from transkribieren_api import api_key
from projekt import profil

BASIS = "https://api.elevenlabs.io/v1"


def anfrage(pfad, daten):
    req = urllib.request.Request(BASIS + pfad, data=json.dumps(daten).encode("utf-8"), method="POST",
                                 headers={"xi-api-key": api_key("ELEVENLABS_API_KEY"), "Content-Type": "application/json",
                                          "Accept": "audio/mpeg"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs meldet {e.code}: {e.read().decode('utf-8', 'ignore')[:500]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("art", choices=["effekt", "musik"])
    ap.add_argument("beschreibung")
    ap.add_argument("datei")
    ap.add_argument("--sekunden", type=float)
    a = ap.parse_args()

    ziel = a.datei if os.path.dirname(a.datei) else os.path.join(profil(), "sounds", a.datei)
    os.makedirs(os.path.dirname(os.path.abspath(ziel)), exist_ok=True)

    if a.art == "effekt":
        daten = {"text": a.beschreibung, "prompt_influence": 0.5}
        if a.sekunden:
            daten["duration_seconds"] = max(0.5, min(30.0, a.sekunden))
        ton = anfrage("/sound-generation", daten)
    else:
        if not a.sekunden:
            sys.exit("Bei Musik bitte --sekunden angeben.")
        ton = anfrage("/music", {"prompt": a.beschreibung, "music_length_ms": int(a.sekunden * 1000)})

    open(ziel, "wb").write(ton)
    print(ziel)


if __name__ == "__main__":
    main()
