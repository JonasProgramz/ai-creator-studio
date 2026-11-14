# Einrichtung beim ersten Mal

Die Person hat noch kein Profil. Am Ende liegt `video-schnitt-profil/` (aus `profil-vorlage/`) in ihrem Hauptordner, alles ist installiert, und sie hat ein Teststück in ihrem Look gesehen und abgenommen. Das Gespräch führst du, kurz, in ihrer Sprache, ohne Fachwörter, eine Frage nach der anderen. Was sie nicht weiß, entscheidest du mit einer sinnvollen Vorgabe und sagst es.

## Installieren

Prüf und installiere, was fehlt: Node ab 20, Python ab 3.10 mit `numpy` und `soundfile`, ffmpeg und ffprobe, `faster-whisper` (mit CUDA, wenn eine Nvidia-Grafikkarte da ist), `npm install` in `vorlage/` und der Chrome von HyperFrames. Vor dem Installieren eines Paketmanagers fragen. Danach kurz testen.

## Was am Ende im Profil stehen muss

- **Ihre Videos:** Art, Länge, Publikum, ob und wie sie im Bild ist, Blickrichtung beim Zeigen, wie oft Bildschirm und Apps vorkommen. → `profil.md`
- **Vorbilder.** Das Wichtigste, nimm dir Zeit dafür: zwei, drei Videos anderer, deren Animationen sie richtig gut findet. Erklär ihr, dass du daran jede Szene misst. Standbilder an starken Stellen nach `massstab/`, dazu, was daran gut ist. Hat sie keine, frag beim ersten Video noch einmal. → `massstab/`
- **Design:** ihr eigenes (auch von ihrer Website ausgelesen), im Gespräch neu erstellt oder einer der vier Grundstile in `einrichtung/grundstile/`, dazu ein Hintergrund (`hintergruende.css` hat Netz, Linien, Korn, ruhig, eigenes Bild). Zeig vor dem Festlegen Stilproben (Anleitung unten). Schriften nur mit freier Lizenz. Das Design legt Farben, Schriften und Grund fest, nicht, wie Szenen aussehen. → `design/`
- **KI-Agent:** Trag ohne Frage ein, welcher Agent du selbst bist (`claude` für Claude Code, `codex`, `hermes`, `antigravity` für die Antigravity CLI `agy`, `gemini` für die Gemini CLI, `opencode`). Das Video Studio startet damit seinen Chat. Arbeitet die Person mit einem anderen Agenten, nimm den nächstliegenden und sag ihr, dass der Chat im Studio nur mit diesen sechs geht. Wer Antigravity nur als App nutzt, braucht für den Chat zusätzlich die Kommandozeile `agy`. → `profil.md`
- **Pakete,** die sie nutzen will, je ein Satz aus dem Kopf von `PAKET.md`. → `profil.md`
- **Tempo oder Sparsamkeit,** und daraus die Bauweise: allein, allein mit Prüfer oder mit Helfern und Prüfer. Der Skill läuft auch in anderen Agenten als Claude Code, frag deshalb nie nach dem Abo eines Anbieters. Wie lange es bei ihr dauert, weißt du erst nach dem ersten Video, sag das ehrlich. → `profil.md`
- **Ton:** Soundeffekte und Musik aus eigenen Dateien, freien Downloads (sie lädt selbst, wegen der Lizenz), über ElevenLabs oder gar nicht. → `profil.md`
- **Bilder erzeugen,** als Angebot: wo ein Bild mehr trägt als eine gebaute Grafik, über einen Bildgenerator, den sie schon nutzt oder nutzen will. Ohne geht alles auch. → `profil.md`
- **Rendern:** auf ihrem Rechner oder bei RunPod (ein starker Rechner, den man minutenweise mietet, du nennst vorher Dauer und Kosten). Bei einem schwachen Rechner eher empfehlen. → `profil.md`
- **Ablage:** Ort für fertige Videos und für den Arbeitsordner. Der braucht grob das Doppelte bis Dreifache der Aufnahme, nach dem ersten Video misst du ihren echten Wert. → `profil.md`
- **Verbindungen und Schlüssel:** Dienste wie ElevenLabs, Bildgeneratoren oder RunPod verbindet sie als MCP oder mit Schlüssel, was ihr lieber ist. Schau zuerst, was schon verbunden ist. Schlüssel kommen nach `video-schnitt-profil/.env` (Vorlage `.env.beispiel`), die schreibt sie selbst hinein, nie in den Chat. Du prüfst nur, ob die Zeile gefüllt ist, und zeigst nie den Wert. Die `.gitignore` im Profil hält die `.env` aus jedem Git-Repo.

## Teststück

Aus einer echten Aufnahme der Person (eine Minute reicht) baust du zwei, drei Szenen im neuen Look, nach dem normalen Ablauf ab Schritt 3, und zeigst nur diesen Abschnitt live im Studio. Das ist der erste Eindruck, gib dir richtig Mühe. Ihr Feedback geht in `geschmack.md` und `design/`. Erst wenn sie zufrieden ist, ist die Einrichtung fertig.

## Stilprobe rendern

`einrichtung/stilprobe/index.html` zeigt Grund, Flächen, Farben und Schriften eines Designs in einem Bild. In einen Temp-Ordner kopieren, `vorlage/assets/` als `assets/` dazu, darüber die Dateien des Stils (oder von `video-schnitt-profil/design/`), für einen anderen Hintergrund den Block aus `hintergruende.css` an `assets/tokens.css` hängen. Dann `node <vorlage>/node_modules/hyperframes/bin/hyperframes.mjs snapshot . --at 0.5 --describe false`. Prüf das Bild selbst, bevor du es zeigst.

## Am Ende

Fass kurz zusammen, was im Profil steht, und erklär zwei Dinge: Den Asset-Ordner (`video-schnitt-profil/assets/`), in dem du Logos, Screenshots und Bilder sammelst und wiederverwendest und in den sie selbst etwas legen kann. Und dass sie dir jederzeit Screenshots oder Links von Oberflächen und Animationen schicken kann, die ihr gefallen. Dann: „Nimm dein nächstes Video auf und sag mir, wo die Datei liegt.“
