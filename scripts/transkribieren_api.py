"""Transkribiert Audio/Video mit whisper-1 ueber OpenRouter (Standard) oder OpenAI, mit Wort-Zeitstempeln.

Aufruf:
    python transkribieren_api.py <input> [ziel-ordner-oder-datei.md] [--sprache de|en|auto] [--openai]

Standard ist OpenRouter (OPENROUTER_API_KEY). Mit --openai laeuft dasselbe Modell
direkt ueber OpenAI (OPENAI_API_KEY).

Ergebnis:
    <ziel>.md          lesbares Transkript, Absaetze mit [mm:ss]
    <ziel>-woerter.tsv start, ende, wort  (eine Zeile pro Wort)

Braucht ffmpeg im PATH und OPENROUTER_API_KEY (bzw. OPENAI_API_KEY) als Umgebungsvariable oder in video-schnitt-profil/.env.
"""

import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request

MODEL = "whisper-1"          # einziges Modell mit Wort-Zeitstempeln
ANBIETER = {
    "openai": ("OPENAI_API_KEY", "https://api.openai.com/v1/audio/transcriptions", MODEL),
    "openrouter": ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/audio/transcriptions",
                   "openai/" + MODEL),
}
MAX_BYTES = 24 * 1024 * 1024  # API-Limit sind 25 MB, etwas Luft lassen
ABSATZ_SEKUNDEN = 45          # so lang wird ein Absatz im lesbaren Transkript


def api_key(name, pflicht=True):
    """Schlüssel aus der Umgebung, sonst aus video-schnitt-profil/.env, sonst aus einer .env im aktuellen Ordner oder darüber."""
    key = os.environ.get(name)
    if key:
        return key.strip()
    kandidaten = []
    if os.environ.get("VIDEO_PROFIL"):
        kandidaten.append(os.path.join(os.environ["VIDEO_PROFIL"], ".env"))
    p = os.getcwd()
    while True:
        kandidaten.append(os.path.join(p, "video-schnitt-profil", ".env"))
        kandidaten.append(os.path.join(p, ".env"))
        q = os.path.dirname(p)
        if q == p:
            break
        p = q
    here = os.path.abspath(__file__)
    for _ in range(6):
        here = os.path.dirname(here)
        kandidaten.append(os.path.join(here, ".env"))
    for env in kandidaten:
        if os.path.isfile(env):
            for line in io.open(env, encoding="utf-8", errors="ignore"):
                if line.strip().startswith(name + "="):
                    wert = line.split("=", 1)[1].strip().strip("\"'")
                    if wert:
                        return wert
    if not pflicht:
        return None
    sys.exit(f"{name} nicht gefunden. Trag den Schlüssel in video-schnitt-profil/.env ein (Zeile {name}=...).")


def to_audio(src, workdir):
    """Audiospur als mono 16 kHz MP3, klein genug fuer die API."""
    out = os.path.join(workdir, "audio.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
         "-c:a", "libmp3lame", "-b:a", "64k", out],
        check=True, capture_output=True,
    )
    return out


def split(audio, workdir):
    """Bei zu grossen Dateien in Stuecke schneiden. Gibt (pfad, offset) zurueck."""
    if os.path.getsize(audio) <= MAX_BYTES:
        return [(audio, 0.0)]
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio],
        check=True, capture_output=True, text=True).stdout.strip())
    teile = int(os.path.getsize(audio) // MAX_BYTES) + 1
    laenge = dur / teile
    stuecke = []
    for i in range(teile):
        p = os.path.join(workdir, f"teil{i}.mp3")
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio, "-ss", str(i * laenge), "-t", str(laenge),
             "-c", "copy", p],
            check=True, capture_output=True)
        stuecke.append((p, i * laenge))
    return stuecke


def transcribe(path, key, sprache, url, modell):
    grenze = "----boundary7f3a"
    felder = [("model", modell), ("response_format", "verbose_json"),
              ("timestamp_granularities[]", "word"), ("timestamp_granularities[]", "segment")]
    if sprache and sprache != "auto":
        felder.append(("language", sprache))

    body = b""
    for name, wert in felder:
        body += (f"--{grenze}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n"
                 f"{wert}\r\n").encode("utf-8")
    body += (f"--{grenze}\r\nContent-Disposition: form-data; name=\"file\"; "
             f"filename=\"{os.path.basename(path)}\"\r\n"
             "Content-Type: audio/mpeg\r\n\r\n").encode("utf-8")
    body += io.open(path, "rb").read() + f"\r\n--{grenze}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        url, data=body,
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": f"multipart/form-data; boundary={grenze}"})
    for versuch in range(5):
        try:
            with urllib.request.urlopen(req, timeout=1800) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            antwort = e.read().decode("utf-8", errors="ignore")
            if "insufficient_quota" in antwort:
                sys.exit("Kein API-Guthaben mehr. Aufladen oder den anderen Anbieter nehmen (ohne bzw. mit --openai).\n" + antwort)
            if e.code == 429 and versuch < 4:
                warte = 60 * (2 ** versuch)
                print(f"Rate-Limit (429), warte {warte}s ...", flush=True)
                time.sleep(warte)
            else:
                raise
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            # Mac-Python mit LibreSSL bricht ab und zu mit „EOF occurred in violation of protocol“ ab (28.10.2026)
            if versuch < 4:
                time.sleep(5 * (versuch + 1))
            else:
                raise


def stempel(sek):
    m, s = divmod(int(sek), 60)
    h, m = divmod(m, 60)
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sprache = "auto"
    for a in sys.argv[1:]:
        if a.startswith("--sprache"):
            sprache = a.split("=", 1)[1] if "=" in a else "auto"
    if not args:
        sys.exit(__doc__)

    src = args[0]
    ziel = args[1] if len(args) > 1 else os.path.dirname(os.path.abspath(src))
    if os.path.isdir(ziel):
        ziel = os.path.join(ziel, os.path.splitext(os.path.basename(src))[0] + ".md")
    basis = os.path.splitext(ziel)[0]

    anbieter = "openai" if "--openai" in sys.argv else "openrouter"
    key_name, url, modell = ANBIETER[anbieter]
    key = api_key(key_name)
    with tempfile.TemporaryDirectory() as workdir:
        audio = to_audio(src, workdir)
        woerter, segmente, dauer = [], [], 0.0
        for teil, offset in split(audio, workdir):
            print(f"schicke {os.path.basename(teil)} an die API ...", flush=True)
            d = transcribe(teil, key, sprache, url, modell)
            for w in d.get("words", []):
                w["start"] += offset
                w["end"] += offset
                woerter.append(w)
            for s in d.get("segments", []):
                s["start"] += offset
                s["end"] += offset
                segmente.append(s)
            dauer = max(dauer, offset + d.get("duration", 0.0))

    with io.open(basis + "-woerter.tsv", "w", encoding="utf-8") as f:
        f.write("start\tende\twort\n")
        for w in woerter:
            f.write(f"{w['start']:.2f}\t{w['end']:.2f}\t{w['word']}\n")

    absaetze, puffer, start = [], [], None
    for s in segmente:
        if start is None:
            start = s["start"]
        puffer.append(s["text"].strip())
        if s["end"] - start >= ABSATZ_SEKUNDEN:
            absaetze.append((start, " ".join(puffer)))
            puffer, start = [], None
    if puffer:
        absaetze.append((start, " ".join(puffer)))

    with io.open(ziel, "w", encoding="utf-8") as f:
        f.write(f"# Transkript: {os.path.basename(src)}\n\n")
        f.write(f"Laufzeit {stempel(dauer)}, {len(woerter)} Wörter. "
                f"Wort-Zeitstempel in `{os.path.basename(basis)}-woerter.tsv`.\n\n")
        for st, txt in absaetze:
            f.write(f"**[{stempel(st)}]** {txt}\n\n")

    print(f"fertig: {ziel}")
    print(f"fertig: {basis}-woerter.tsv")


if __name__ == "__main__":
    main()
