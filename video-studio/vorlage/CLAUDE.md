# Video-Studio-Projekt

Dieser Ordner ist ein Schnittprojekt für das Video Studio. Der Nutzer schneidet im Browser fein, du kannst den Schnitt hier direkt ändern. Das Studio merkt jede Änderung an `projekt.json` und lädt sie sofort neu.

## projekt.json

```json
{
  "name": "…", "fps": 60, "breite": 1920,
  "quellen": { "1": { "pfad": "D:/…/aufnahme.mp4", "woerter": "woerter/1.tsv" } },
  "clips":  [ { "id": "c1", "quelle": "1", "von": 19.81, "bis": 50.95, "name": "Hook" } ],
  "marker": [ { "id": "m1", "quelle": "1", "zeit": 19.81, "name": "Hook" } ],
  "version": 7
}
```

- **clips** stehen in der Reihenfolge der Timeline. `von` und `bis` sind Sekunden in der Quelle. Die Länge eines Clips ist `bis - von`, die Timeline ergibt sich aus der Summe. Lücken gibt es nicht.
- **name** ist das Kapitel, zu dem der Clip gehört. Clips mit gleichem Namen bilden einen Abschnitt.
- **marker** hängen an einer Stelle der Quelle (`quelle`, `zeit`), nicht an der Timeline. Sie wandern mit, wenn davor geschnitten wird.
- **version** nicht ändern. Das Studio zählt sie hoch.
- **woerter/<quelle>.tsv** hat die Wortzeiten der ganzen Aufnahme (Spalten Start, Ende, Wort, in Sekunden der Quelle). Damit findest du Sätze und andere Anläufe.

## So änderst du den Schnitt

- Stelle finden: Im Text des Nutzers steht unten `[Video Studio: …]` mit Abspielkopf und Clip, falls er aus dem Studio fragt. Sonst Zeit auf der Timeline in Quellzeit umrechnen (Summe der Cliplängen davor).
- Schnittpunkte in Pausen legen, nicht mitten ins Wort. Die Wortzeiten von Whisper liegen bis 0,3 s daneben. Wer es genau braucht, misst den Pegel mit ffmpeg.
- Einen anderen Anlauf nehmen: in `woerter/1.tsv` alle Stellen des Satzes suchen, meist ist der letzte vollständige der beste, und `von`/`bis` des Clips darauf setzen.
- Neue Clips bekommen eine neue, eindeutige `id`.
- Nach der Änderung kurz sagen, was du geändert hast, mit Timeline-Zeit.

## Feedback umsetzen

Marker mit `text` sind Feedback des Nutzers zu dieser Stelle, mit `bisZeit` gilt es für einen Bereich (Quellzeit `zeit` bis `bisZeit`). Ein Projekt mit `"modus": "abnahme"` ist ein fertiger Entwurf: dort wird nicht geschnitten, das Feedback betrifft das Video dahinter (Motion Graphics, Ton, Schnitt). Sagt der Nutzer „setz das Feedback um“:

1. Alle Marker mit `text` und ohne `"erledigt": true` der Reihe nach lesen. Bei einem Entwurf die Zeit auf die Teile des Videos umrechnen (Quellzeit = Zeit im Entwurf).
2. Umsetzen, wo die Quellen liegen (beim Schnitt in diesem Projekt, bei Motion Graphics in den Teilen des Studios).
3. Im Marker `"erledigt": true` und `"antwort": "<ein Satz, was du geändert hast>"` eintragen. Nicht Umsetzbares bleibt offen, mit `antwort`, warum.

Der nächste Entwurf wird mit `node studio.mjs abnahme <entwurf.mp4> <dieser ordner>` geladen, die Marker bleiben dabei erhalten.

## Weitergeben

Der Knopf „Weitergeben“ rendert den Schnitt nach `export/voll.mp4` und schreibt `export/cuts.json` (je Clip Platz auf der Timeline in Bildern, Quelle, Startbild) und `export/marker.json`. Damit geht es mit den Motion Graphics weiter.
