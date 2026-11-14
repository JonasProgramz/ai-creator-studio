# Video Studio

Ein leichtes Schnittprogramm im Browser für den Feinschnitt. Der KI-Agent macht den Rohschnitt, du prüfst ihn hier und verschiebst Schnitte, wie du es aus CapCut kennst, dann gibst du ihn weiter an die Motion Graphics. Ohne Installation eines Schnittprogramms, ohne Konto, alles lokal.

## Was es kann

- Vorschau über alle Schnitte hinweg ohne Ruckler (zwei Videos im Wechsel, das nächste wartet schon am Schnitt)
- Timeline mit Tonwelle, Kapitelnamen und Markern, Zoom mit Strg+Mausrad
- Clipränder ziehen zum Kürzen und Verlängern, die Vorschau zeigt dabei das Randbild
- Teilen (S), links oder rechts vom Abspielkopf löschen (Q, W), Clip löschen (Entf), Rückgängig
- Transkript neben dem Bild: Wort anklicken springt hin, Wörter markieren und Entf schneidet sie heraus
- Marker und Feedback: M oder F am Abspielkopf, Umschalt und Ziehen für einen Bereich, jeweils mit Kommentar. Offen orange, erledigt grün mit der Antwort des Agenten. Der Agent setzt es um, wenn du „setz das Feedback um“ sagst
- Abnahme-Modus für fertige Entwürfe: ansehen und kommentieren statt schneiden, das Feedback bleibt über alle Entwürfe erhalten
- Live-Abnahme ohne Render: Die HyperFrames-Kompositionen laufen direkt im Studio über der Aufnahme mit fertigem Ton. Ändert der Agent einen Teil, lädt nur dieser Teil neu. Gerendert wird erst, wenn alles passt
- Chat mit dem KI-Agenten links: Der Agent ändert den Schnitt in `projekt.json`, das Studio lädt sofort neu. Der Chat läuft über den KI-Agenten der Person mit ihrem eigenen Abo, ohne API-Schlüssel: Claude Code, Codex oder Hermes (getestet), Antigravity CLI `agy`, Gemini CLI oder OpenCode (noch ungetestet). Welcher, legt `--agent` fest, sonst `"agent"` in `projekt.json`, sonst der erste installierte. Sind mehrere installiert, lässt er sich im Chat-Kopf wechseln (`agenten.mjs`). Der Agent darf im Projektordner nur lesen und Dateien ändern, keine Befehle ausführen
- Änderungen des Agenten im Terminal an `projekt.json` erscheinen ebenfalls sofort im Studio
- „Weitergeben“ rendert den Schnitt in voller Qualität nach `export/voll.mp4`, dazu `export/cuts.json` und `export/marker.json`
- Benachrichtigung: Nach „Weitergeben“ (fertig oder Fehler) und nach „Feedback speichern“ schreibt das Studio `signal.json` in den Projektordner. `node warten.mjs <projektordner>` wartet auf das nächste Signal und endet dann. Der Agent startet es im Hintergrund und wird so benachrichtigt, ohne dass du Bescheid geben musst

## Voraussetzungen

Node 20 oder neuer, ffmpeg und ffprobe im Pfad. Für den Chat einen der Agenten im Pfad (`claude`, `codex`, `hermes`, `agy`, `gemini` oder `opencode`). Claude Code und Codex lassen sich aus dem Studio anmelden („Agent anmelden“), die anderen richtet man einmal im Terminal ein, der Chat zeigt dazu einen Hinweis.

## Benutzung

```bash
# Rohschnitt als Projekt anlegen (Format der yt-schnitt-Skripte)
node studio.mjs import schnitt.json mein-projekt --woerter 1=aufnahme-woerter.tsv --name "Mein Video"

# Fertigen Entwurf zur Abnahme öffnen (Feedback bleibt beim nächsten Entwurf im selben Ordner erhalten)
node studio.mjs abnahme entwurf-2.mp4 abnahme-ordner --woerter transkript-woerter.tsv

# Entwurf live zur Abnahme öffnen, ohne Render. <arbeitsordner> enthält voll/voll.mp4, voll/ton.wav (optional),
# studio/teile.json ([{name, von, bis}]) und studio/<teil>/index.html mit HyperFrames unter studio/node_modules
node studio.mjs abnahme abnahme-ordner --live <arbeitsordner> --woerter transkript-woerter.tsv
# Nur gebaute Teile werden eingeblendet. Fehlen Teile am Anfang oder Ende, oder beschränkt --nur auf einzelne
# Teile (Teststück), zeigt das Studio nur diesen Abschnitt, Wörter werden mit zugeschnitten
node studio.mjs abnahme teststueck-ordner --live <arbeitsordner> --nur v01-hook --woerter transkript-woerter.tsv

# Studio starten, öffnet sich unter http://localhost:4747
node studio.mjs mein-projekt
```

Beim ersten Start erzeugt das Studio eine Vorschau in 1080p mit vielen Vollbildern (für flüssiges Springen an den Schnitten, der Export rendert aus dem Original) und die Tonwelle der Aufnahme (in `mein-projekt/.studio/`). Das dauert je nach Länge einige Minuten, danach startet es sofort.

## Projektformat

Siehe `vorlage/CLAUDE.md`. Diese Datei landet beim Import im Projektordner, damit der Agent dort den Schnitt ändern kann.

## Stand

Version 0.1, erster Test am Video „22 Dinge, die Claude kann“ (November 2026). Offen: mehrere Spuren, Bildschirmaufnahme parallel zur Kamera.
