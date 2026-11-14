# Profil

Füllt Claude bei der Einrichtung aus und pflegt es danach. Du kannst alles hier selbst ändern oder Claude sagen, was anders sein soll.

## Videos

- **Art:** (z. B. Erklärvideos zu KI-Tools für Selbstständige, 10 bis 20 Minuten)
- **Im Bild:** (Webcam am Schreibtisch, sitzend, Raum im Hintergrund)
- **Blick beim Zeigen:** (nach links auf den Bildschirm, Kamera dann rechts)
- **Bildschirm und Apps:** (oft, selten)
- **Sprache im Bild:** Deutsch
- **Ansprache:** du
- **Bildrate fertiges Video:** wie die Aufnahme

## Design

- **Herkunft:** (eigenes Design, im Gespräch erstellt oder Grundstil „…“)
- Dateien: `design/tokens.css`, `design/design.md`

## Pakete

- (z. B. `erklaervideo`: Erklärvideo-Stil von Julian Ivanov, `walkthrough`: Walkthrough-Stil für Bildschirmvideos) oder keine

## Arbeitsweise

- **KI-Agent:** (claude | codex | hermes | antigravity | gemini | opencode), trägt der Agent bei der Einrichtung selbst ein, das Video Studio nutzt ihn für seinen Chat
- **Tempo:** schneller, verbraucht mehr | sparsamer, dauert länger
- **Bauweise:** allein | allein mit Prüfer | Helfer mit Prüfer
- **Rechner:** (Prozessor-Threads, Arbeitsspeicher, Grafikkarte)
- **Finaler Render:** auf diesem Rechner | RunPod, vorher immer Dauer und Kosten nennen

## Dienste

Je Dienst: als MCP-Verbindung oder mit Schlüssel. Schlüssel stehen in `.env` in diesem Ordner, nie hier.

- **Transkription:** lokal | API
- **Bilder erzeugen:** nein | (Anbieter), per MCP | Schlüssel
- **Ton erzeugen:** nein | ElevenLabs, per MCP | Schlüssel
- **Rendern:** dieser Rechner | RunPod, per MCP | Schlüssel

## Ton

- **Soundeffekte:** nein | eigene Dateien | freie Downloads | ElevenLabs
- **Musik:** nein | eigene Dateien | freie Downloads | ElevenLabs

## Orte

- **Arbeitsordner:** `~/video-schnitt-arbeit/` (je Video ein Unterordner, braucht grob das Doppelte bis Dreifache der Aufnahme, gemessene Werte in `zeiten.md`)
- **Fertige Videos:** (Ordner)
- **Quellen der Animationen sichern nach:** (Ordner, optional)
- **Assets:** `assets/` in diesem Profil, Katalog in `assets/README.md`

## Vorlieben zur Arbeitsweise

Was die Person zur Bauweise, zu Kosten oder zum Ablauf gesagt hat, mit Datum.
