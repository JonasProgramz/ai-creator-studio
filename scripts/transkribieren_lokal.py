"""Transkribiert Audio oder Video lokal mit faster-whisper, mit Wort-Zeitstempeln. Kostenlos, nichts verlässt den Rechner.

Aufruf:
    python transkribieren_lokal.py <input> [ziel.md] [--sprache de|en|auto] [--modell large-v3|medium|small]

Ergebnis wie bei transkribieren_api.py:
    <ziel>.md           lesbares Transkript, Absätze mit [mm:ss]
    <ziel>-woerter.tsv  start, ende, wort (eine Zeile pro Wort)

Mit Nvidia-Grafikkarte (CUDA) läuft large-v3 schneller als Echtzeit. Auf dem Prozessor ist medium ein guter
Kompromiss, large-v3 braucht dort etwa so lang wie die Aufnahme oder länger.
Braucht: pip install faster-whisper
"""
import io, os, sys

ABSATZ_SEKUNDEN = 45


def stempel(sek):
    m, s = divmod(int(sek), 60)
    return f"{m:02d}:{s:02d}"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    opt = {a.split("=")[0]: a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--") and "=" in a}
    src = args[0]
    ziel = args[1] if len(args) > 1 else os.path.splitext(src)[0] + ".md"
    basis = os.path.splitext(ziel)[0]
    sprache = opt.get("--sprache", "auto")
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper fehlt: pip install faster-whisper")
    try:
        import ctranslate2
        gpu = ctranslate2.get_cuda_device_count() > 0
    except Exception:
        gpu = False
    def lauf(gpu):
        modell = opt.get("--modell", "large-v3" if gpu else "medium")
        print(f"Modell {modell} auf {'Grafikkarte' if gpu else 'Prozessor'} ...", flush=True)
        m = WhisperModel(modell, device="cuda" if gpu else "cpu", compute_type="float16" if gpu else "int8")
        segs, info = m.transcribe(src, language=None if sprache == "auto" else sprache, word_timestamps=True, vad_filter=False)
        woerter, absaetze, aktuell, start = [], [], [], 0.0
        for seg in segs:
            for w in seg.words or []:
                woerter.append((w.start, w.end, w.word.strip()))
            if seg.start - start > ABSATZ_SEKUNDEN and aktuell:
                absaetze.append((start, " ".join(aktuell))); aktuell, start = [], seg.start
            aktuell.append(seg.text.strip())
            print(f"\r{stempel(seg.end)}", end="", flush=True)
        if aktuell:
            absaetze.append((start, " ".join(aktuell)))
        print()
        return woerter, absaetze, info
    try:
        woerter, absaetze, info = lauf(gpu)
    except RuntimeError as e:
        if not gpu:
            raise
        # Unter Windows fehlen oft die CUDA-Bibliotheken (cublas, cudnn), obwohl eine Nvidia-Karte da ist
        print(f"\nGrafikkarte nicht nutzbar ({str(e)[:80]}), weiter auf dem Prozessor. Schneller: pip install nvidia-cublas-cu12 nvidia-cudnn-cu12", flush=True)
        woerter, absaetze, info = lauf(False)
    with io.open(basis + "-woerter.tsv", "w", encoding="utf-8") as f:
        f.write("start\tende\twort\n")
        for a, b, t in woerter:
            f.write(f"{a:.2f}\t{b:.2f}\t{t}\n")
    with io.open(basis + ".md", "w", encoding="utf-8") as f:
        f.write(f"# Transkript: {os.path.basename(src)}\n\nSprache {info.language}, {len(woerter)} Wörter. "
                f"Wort-Zeitstempel in `{os.path.basename(basis)}-woerter.tsv`.\n\n")
        for st, txt in absaetze:
            f.write(f"**[{stempel(st)}]** {txt}\n\n")
    print(f"fertig: {basis}-woerter.tsv")


if __name__ == "__main__":
    main()
