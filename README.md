# Video-Schnitt mit Claude

Ein Skill für Claude Code, der aus deiner Aufnahme ein fertiges Video mit Motion Graphics macht. Am meisten holt er aus Videos, in denen du in die Kamera sprichst und etwas erklärst: Erklärvideos, Tutorials, News, Tool-Vorstellungen, Kursvideos. Das Thema ist egal. Vlogs und andere Aufnahmen von dir schneidet er genauso, dann arbeitet Claude mehr mit Bildern.

## So läuft es

1. Du nimmst dein Video auf und sagst Claude, wo die Datei liegt.
2. Claude macht den Rohschnitt: Versprecher, Pausen und doppelte Anläufe raus. Du schaust ihn dir im **Video Studio** an, einem Schnittprogramm im Browser, und schneidest fertig.
3. Claude baut die Animationen, prüft sie Bild für Bild und zeigt dir den Entwurf live im Video Studio, ohne Wartezeit fürs Rendern.
4. Du setzt Feedback als Marker direkt im Video. Claude setzt es um, der Entwurf aktualisiert sich.
5. Wenn alles passt, rendert Claude das fertige Video.

Jedes Feedback, das über ein Video hinaus gilt, landet in deinem Profil. Nach drei, vier Videos kennt der Skill deinen Geschmack.

## Einrichten

Öffne Claude Code in deinem Hauptordner und sag:

> Installier mir den Skill von https://github.com/JonasProgramz/ai-creator-studio nach .claude/skills/video-schnitt und richte ihn ein.

Claude holt ihn dann mit `git clone https://github.com/JonasProgramz/ai-creator-studio .claude/skills/video-schnitt`. Starte danach Claude Code neu, damit es den Skill kennt, und sag:

> Ich will mein erstes Video mit dem Skill video-schnitt schneiden.

Claude installiert, was fehlt, und fragt dich dann ein paar Dinge: was für Videos du machst, welche Videos anderer dir gefallen, welches Design du willst (eigenes, neu erstellt oder einer von vier Grundstilen), ob es lieber schnell oder sparsam laufen soll, ob Soundeffekte, Musik und Bilder dazukommen und wo gerendert wird. Daraus entsteht dein Profil im Ordner `video-schnitt-profil/`. Danach baut Claude ein Teststück von einer Minute in deinem Look.

## Tipps

- **Asset-Ordner nutzen.** Claude legt Logos, Screenshots und Bilder, die es für ein Video holt, in `video-schnitt-profil/assets/` ab und verwendet sie in späteren Videos wieder. Leg dort selbst hinein, was Claude nutzen soll: dein Logo, Fotos von dir oder deinem Produkt, Screenshots.
- **Oberfläche gefällt dir?** Mach einen Screenshot, gib ihn Claude, und Claude baut sie nach und animiert sie.
- **Claude fragt nach Material.** Wo eine echte Ansicht das Video stärker macht, holt Claude sie selbst. Liegt sie hinter einem Login oder nur auf deinem Rechner, sagt Claude dir genau, was du aufnehmen sollst.
- **Vorbilder zeigen.** Das bringt am meisten. Gib Claude bei der Einrichtung zwei, drei Videos, deren Animationen du richtig gut findest, und später jedes neue, das dir auffällt. Daran misst Claude jede Szene.
- **Ton und Bilder erzeugen lassen.** Mit ElevenLabs erzeugt Claude Soundeffekte und Musik passend zum Video, mit einem Bildgenerator wie Higgsfield, Kie.ai oder fal.ai Bilder. Verbinden kannst du beides als MCP oder mit Schlüssel. Beides ist optional und kostet beim Anbieter Credits, Claude fragt vorher.
- **Schlüssel gehören in die `.env`.** Was nicht per MCP verbunden ist, braucht einen Schlüssel. Claude legt die Datei in deinem Profil an, du trägst die Schlüssel selbst ein. Sie bleibt auf deinem Rechner.

## Updates

Sag Claude „Hol das neueste Update für video-schnitt“. Claude macht `git pull` im Skill-Ordner. Dein Profil liegt außerhalb und bleibt unberührt.

## Was du brauchst

- Claude Code oder einen anderen Coding-Agenten. Bei der Einrichtung wählst du, ob es schneller oder sparsamer laufen soll. Wie lange es bei dir dauert, misst der Skill selbst mit.
- Einen Rechner mit mindestens 16 GB Arbeitsspeicher. Mehr Prozessorkerne machen den finalen Render schneller, eine Grafikkarte hilft beim Transkribieren und Kodieren.
- Freien Platz für grob das Doppelte bis Dreifache deiner Aufnahme. Nach dem ersten Video kennt der Skill deinen echten Wert.
- Optional: ein Konto bei RunPod, wenn dein Rechner für den finalen Render zu langsam ist. Claude nennt vorher Dauer und Kosten.

## Was drin ist

| Ordner | Inhalt |
|---|---|
| `SKILL.md` | Ablauf, Haltepunkte, Lernschleife |
| `references/` | Grundsätze für gute Videos, Technik, Prüfung, Aufträge für Helfer |
| `einrichtung/` | Ablauf der Einrichtung, vier Grundstile mit Vorschau, Stilprobe |
| `profil-vorlage/` | Vorlage für dein Profil, mit Asset-Ordner |
| `pakete/erklaervideo/` | Erklärvideo-Stil von Julian Ivanov: Erfahrungen zu Aufbau, Belegen und Apps (optional) |
| `pakete/walkthrough/` | Walkthrough-Stil von Julian Ivanov: Bildschirm im Vollbild, Person als Kreis, Zoom nur zum Lesen (optional) |
| `scripts/` | Rohschnitt, Transkription (lokal oder über API), Teile, Ton, Zusammensetzen |
| `vorlage/` | Startpunkt für die Animationen eines Videos (HyperFrames) |
| `video-studio/` | Schnittprogramm im Browser für Feinschnitt und Abnahme |

## Ehrlich vorab

- Das erste Video wird gut, nicht sehr gut. Sehr gut wird es mit deinem Feedback.
- Andere Agenten oder Modelle können den Skill grundsätzlich lesen. Bei Motion Graphics hängt die Qualität aber stark am Modell, getestet ist er mit Claude.
- Generierte Bilder (z. B. 3D-Objekte) kosten bei den meisten Diensten Credits. Claude fragt vorher.
