# Grundstile

Vier fertige Designs für den schnellen Start. Jeder Stil ist ein Ordner mit `tokens.css` (Farben, Schriften, Hintergrund) und den Schriftdateien, das Bild daneben zeigt Grund, Flächen, Farben und Schriften. Wie Szenen aussehen, legt ein Stil nicht fest. Bei der Einrichtung wird der Ordnerinhalt nach `video-schnitt-profil/design/` kopiert und kann danach frei angepasst werden.

| Stil | Wirkung | Schriften | Hintergrund | Passt zu |
|---|---|---|---|---|
| `nacht` | tiefes Nachtblau, leuchtendes Blau, blaue Flächen mit weißer Schrift | Sora, Space Grotesk, IBM Plex Mono | feines Netz | Software, KI, Technik |
| `glut` | warmes Dunkelbraun, Orange, sandfarbene Flächen mit dunkler Schrift | Bricolage Grotesque, DM Mono | waagerechte Linien | Business, Marketing, Geschichten |
| `papier` | helles Leinen, Tannengrün, Serifen-Überschriften | Instrument Sans, Fraunces, DM Mono | ruhig mit Körnung | Lernen, Beratung, Gesundheit, Handwerk |
| `klar` | kühles Hellgrau, Indigo, dunkle Kopfleisten | Manrope, IBM Plex Mono | feines Netz | Produkte, Startups, Tools |

**Hintergrund unabhängig wählen:** `hintergruende.css` hat Netz, Linien, Korn, ruhig und eigenes Bild, je für dunkle und helle Stile. Den passenden Block ans Ende der `tokens.css` hängen.

**Schriften:** alle unter der SIL Open Font License 1.1 (über Fontsource von Google Fonts), dürfen frei genutzt und mit Videos veröffentlicht werden. Eine andere Schrift: woff2-Datei in den Ordner, `@font-face` mit `font-family: Text` (oder `Zahl`, `Mono`) darauf zeigen lassen. Für Überschriften in einer zweiten Schrift reicht es, nur das Gewicht 800 von `Text` auf deren Datei zu legen (so macht es `papier`).

**Flächen heben sich ab.** Eine Fläche, die auf dem Grund liegt (Kopfleiste, Zahlenkarte, Kachel), bekommt nie fast dieselbe Farbe wie der Grund. Auf dunklem Grund ist sie hell oder kräftig farbig, auf hellem Grund dunkel. Dunkel auf Dunkel sieht schnell nach KI aus und ist schwer zu lesen. Dafür gibt es `--sheet`, `--sheet-ink` und `--sheet-akzent` (Akzent auf der Fläche, etwa ein Balken).
