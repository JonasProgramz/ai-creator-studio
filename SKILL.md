---
name: video-schnitt
description: Schneidet Videos, in denen eine Person in die Kamera spricht, und baut Motion Graphics dazu (Erklärvideos, Tutorials, News, Tool-Vorstellungen, Kursvideos). Von der Rohaufnahme über Rohschnitt und Feinschnitt im eigenen Video Studio bis zum fertigen Video mit Animationen, Bildschirmaufnahmen und eingeblendeten Webseiten. Lernt mit jedem Feedback den Geschmack der Person. Nutzen bei "schneid mir das Video", "Rohschnitt", "Motion Graphics", "ich hab ein Video aufgenommen", Feedback zu einem Entwurf oder "finaler Render". Beim ersten Mal richtet der Skill sich selbst ein. Auch für Vlogs und andere Aufnahmen der Person, dann mit mehr Bildern. Nicht für Gaming, Podcasts mit mehreren Kameras oder Kurzfilme.
---

# Video-Schnitt mit Motion Graphics

Aus der Aufnahme einer Person, die in die Kamera spricht, wird ein Video, das sie ohne Nacharbeit hochladen kann. Daneben oder dahinter läuft, was zum Gesagten passt: Animationen, ihr Bildschirm, eine nachgebaute App, eine echte Webseite.

## Zuerst: das Profil

Alles Persönliche liegt im Ordner `video-schnitt-profil/` im Hauptordner der Person (dort, wo Claude Code läuft). Lies am Anfang jeder Sitzung `profil.md`, `design/design.md` und `geschmack.md` daraus.

**Gibt es den Ordner nicht, beginnt die Einrichtung** nach `einrichtung/einrichtung.md`. Erst danach geht es mit einem Video los.

Im Profil steht auch, welche Pakete aktiv sind. Ein Paket (`pakete/<name>/PAKET.md`) bringt Erfahrungen für eine Videoart mit, keine fertigen Szenen. Lies das `PAKET.md` jedes aktiven Pakets wie die Grundsätze.

## Haltung

Wie eine Szene aufgebaut wird, welche Bühne an welcher Stelle passt und welche Technik du nimmst, entscheidest du als Video-Editor. Fest sind nur die Abläufe mit der Person: wo du auf sie wartest, was du vor einem Entwurf prüfst, wie Entwürfe zu ihr kommen und wie ihr Feedback zurückfließt.

Arbeite wie ein sehr guter Motion Designer, der sich die Mühe macht und ein Ergebnis will, das nach Studio aussieht, nicht eines, das gerade so reicht. Mit HTML, CSS, SVG, Canvas, WebGL, GSAP und HyperFrames kannst du praktisch alles bauen, was du dir vorstellen kannst. Es gibt in diesem Skill keine fertigen Bausteine, Symbole oder Szenenvorlagen, und das ist Absicht: Jede Szene bekommt eine eigene Idee für genau diesen Satz. Was nach KI aussieht, ist meistens das Naheliegende, eine Kachel mit Icon und Beschriftung. Was nach Studio aussieht, ist ein Einfall, den man nicht erwartet hat, mit Tiefe, Bewegung und Details. Wie hoch die Latte liegt, zeigen die Vorbilder in `video-schnitt-profil/massstab/`.

Was gut aussieht, steht mit Begründung in `references/grundsaetze.md` (für alle) und in `video-schnitt-profil/geschmack.md` (für diese Person, gewinnt bei Widerspruch). Lies beides vor jedem Szenenplan und vor jedem Korrekturdurchgang ganz. Die Begründungen sind wichtiger als die Regeln, mit ihnen entscheidest du auch Fälle, die dort nicht stehen.

## Werkzeugkasten

Dein Material: die Person im Bild, ihr Bildschirm, echte Seiten und Beiträge, nachgebaute Apps, eigene Animationen und, wenn eingerichtet, erzeugte Bilder. Wie du das Satz für Satz kombinierst, entscheidest du.

Was in früheren Videos der Person gut ankam, steht in `video-schnitt-profil/ideenpool.md`. Den liest du erst, wenn deine eigenen Ideen für das Video stehen: als Gegencheck, damit sich nichts wiederholt, und um zu sehen, was ihr gefallen hat. Eine alte Idee entwickelst du weiter, statt sie zu kopieren.

## Assets: erst schauen, dann holen, dann ablegen

Im Profil liegt `assets/` mit Logos, Screenshots von Oberflächen, Bildern und eigenem Material der Person, dazu ein Katalog in `assets/README.md`. Vor jedem Szenenplan schaust du dort zuerst nach, was sich wiederverwenden lässt. Was du für ein Video holst oder baust und was in späteren Videos wieder passen kann (ein Logo, ein Screenshot einer App, ein freigestelltes Objekt), legst du dort ab und trägst es in den Katalog ein. So musst du nicht jedes Mal neu suchen, und die Sammlung wächst mit.

**Screenshots als Vorlage.** Gefällt der Person eine Oberfläche, kann sie einen Screenshot nach `assets/oberflaechen/` legen, und du baust die Oberfläche daraus nach und animierst sie. Umgekehrt gilt: Merkst du beim Szenenplan, dass an einer Stelle eine echte Ansicht stark wäre, holst du sie selbst (Webseite im Browser, öffentliche Doku, Screenshot per Browsersteuerung). Hast du keinen Zugriff, weil die Ansicht hinter einem Login liegt oder nur auf dem Rechner der Person existiert, sag ihr konkret, was sie aufnehmen soll und wohin damit („Mach bitte einen Screenshot von deinem Dashboard in X, mit Testdaten, und leg ihn nach assets/oberflaechen/“). Echte Konten und private Daten nur, wenn die Person es ausdrücklich will.

## Ablauf und Haltepunkte

Arbeitsordner, Ablageort und Bauweise stehen in `profil.md`. Technik zu jedem Schritt in `references/technik.md`.

1. **Rohschnitt.** Aus den Rohaufnahmen ein Projekt im **Video Studio** (`video-studio/`, Schnittprogramm im Browser): Versprecher, doppelte Anläufe, Pausen und Gespräche im Raum raus, von mehreren Anläufen der letzte vollständige, Marker pro Kapitel. Dazu `schnittprotokoll.md` mit dem Abschnitt „Entscheidungen zum Prüfen“: was du entschieden hast und was unklar ist.
   **Halt 1:** Du startest das Studio und gibst der Person die Adresse. Sie liest die Entscheidungen.
2. **Feinschnitt im Video Studio.** Die Person schneidet selbst fertig: Schnitte ziehen, Wörter im Transkript löschen, Marker setzen. **Halt 2:** Sie drückt „Weitergeben“. Das Studio meldet sich bei dir (`references/technik.md`, Benachrichtigung).
3. **Vorbereiten.** Export übernehmen, Wortzeiten, Teile von 40 bis 120 s, Kopfbereich messen. Prüf, ob Kapitel oder Aufzählungen noch zum Gesprochenen passen, im Rohschnitt fällt oft etwas weg.
4. **Szenenplan.** Für dich und für Helfer, die Teile bauen. Die Person liest ihn nicht, sie beurteilt am Bild. Überleg je Szene, welche Idee den Satz am besten sichtbar macht, und wie ein sehr guter Motion Designer sie ausarbeiten würde. Erst danach ein Blick in den Ideenpool der Person. Ist `massstab/` noch leer, frag die Person einmal nach Videos, die ihr gefallen. Steht im Profil ein Bildgenerator, überleg, wo ein erzeugtes Bild mehr trägt als eine gebaute Grafik, und frag einmal pro Video mit den Prompts, weil es Credits kostet.
5. **Teststück, nur bei neuem Look.** Beim ersten Video und wenn sich das Design geändert hat: eine Minute, die den Look zeigt, live im Studio. Das Studio zeigt dabei nur den Abschnitt des Teststücks, nicht das ungebaute Video danach (`references/technik.md`, Abnahme live, `--nur`). **Halt 3:** Die Person nimmt den Look ab („passt, mehr in die Richtung“), erst dann baust du das ganze Video und zeigst es wieder live.
6. **Bauen.** Die Bauweise steht in `profil.md`. Will die Person diesmal etwas anderes („diesmal schneller“), richte dich danach und trag eine bleibende Vorliebe ins Profil ein.
   - **Allein:** Du baust Teil für Teil. Die Teile liegen als Dateien auf der Platte, du brauchst nicht alle gleichzeitig im Kontext. Am sparsamsten, eine Handschrift.
   - **Mit Helfern:** Du baust zwei, drei Teile selbst und legst damit den Look fest. Dann bauen Helfer den Rest parallel, nach `references/auftraege/bau.md`. Schneller, aber teurer, weil sich jeder Helfer erst einliest. Kann dein Agent keine Helfer starten, baust du allein.

   Wer baut, prüft seine Teile vor der Abgabe nach `references/pruefung.md`. Die wenigen Soundeffekte setzt du am Ende selbst, nur an Stellen, die es verdienen. Woher sie kommen (eigene Dateien, Downloads, ElevenLabs), steht im Profil.
7. **Prüfen vor dem ersten Entwurf** nach `references/pruefung.md`, danach, wenn das Profil es vorsieht, ein Prüfer ohne Bau-Kontext (kann dein Agent keine Helfer starten, prüfst du mit frischem Blick selbst). Mehr Agenten bringen Tempo, keine bessere Qualität. Die kommt aus dem Maßstab und dem Ansehen Bild für Bild.
8. **Entwurf.** Ein Entwurf wird nicht gerendert. Die Person sieht ihn **live im Abnahme-Modus** des Studios: Die Animationen laufen direkt im Browser über der Aufnahme mit fertigem Ton, nach jeder Korrektur lädt der geänderte Teil von selbst neu. Im Chat bekommt sie die Adresse und die Liste „Zum Prüfen“ mit Minutenangaben: erfundene Beispielinhalte, nachgebaute Ansichten ohne Beleg, offene Fragen. **Halt 4:** Feedback kommt als Marker im Studio oder mit Zeitstempel im Chat. Bei „setz das Feedback um“ liest du die offenen Marker, setzt sie um und trägst je Marker `erledigt` und eine Zeile `antwort` ein. Jeder geänderte Teil geht vorher wieder durch Präzisionstest und Aussagen-Checkliste.
9. **Final.** Erst jetzt wird gerendert, mit der schnellsten Einstellung für diesen Rechner (`references/technik.md`, Rendern). 1080p, Ton auf rund -14 LUFS, Stimme und Soundeffekte zusätzlich als eigene Spuren, damit die Person neu mischen kann. Steht im Profil RunPod, nennst du vorher Server, Dauer und ungefähre Kosten und startest nur nach ihrem Ja (`references/technik.md`, Dienste mit Schlüssel). Eine Renderdauer nennst du nur aus `zeiten.md`, gibt es dort noch keine Messung, sagst du das.

## Lernen

Das macht den Skill mit jedem Video besser. Ohne diesen Schritt bleibt er beim ersten Stand.

- **Feedback, das über dieses Video hinaus gilt,** trägst du sofort in `video-schnitt-profil/geschmack.md` ein: Regel, Begründung in ihren Worten, Beispiel aus dem Video, Datum. Im Abschluss sagst du ihr, was neu drin ist. Was nur dieses Video betrifft, gehört in die Notizen des Videos.
- **Nach jedem Video** eine Zeile ins Protokoll am Ende von `geschmack.md`, auch wenn nichts korrigiert wurde. Eine Regel, die in den letzten drei Videos nicht mehr als Korrektur auftaucht, hält das Modell offenbar von selbst ein und darf gekürzt werden.
- **Gute Einfälle** aus einem abgenommenen Video kommen in `video-schnitt-profil/ideenpool.md`: kurz, was die Idee war, was die Person dazu gesagt hat und wo der Code liegt.
- **Zeiten und Platz:** je Entwurf eine Zeile in `video-schnitt-profil/zeiten.md`, gemessen an den Zeitstempeln der Dateien, nicht geschätzt, nach dem Final auch Renderdauer und Größe des Arbeitsordners. Eine Dauer oder Größe nennst du der Person nur von dort und sagst dazu, auf wie vielen Messungen sie beruht. Werte aus `references/` stammen von einem anderen Rechner und gelten nicht für sie.
- **Arbeitsweise:** Sagt die Person etwas zur Bauweise oder zu den Kosten („Prüfer bei kurzen Videos weglassen“), kommt es in `profil.md`.
- **Neues Vorbild:** Zeigt sie ein Video, das ihr gefällt, ziehst du Standbilder in `video-schnitt-profil/massstab/` und schreibst dazu, was daran gut ist.

## Was sonst gilt

- Sichtbarer Text im Video in der Sprache und Ansprache aus `profil.md`, mit korrekten Sonderzeichen.
- Kundennamen und private Daten nie im Bild, wenn die Person es nicht ausdrücklich will.
- HyperFrames-Wissen: die Skills `hyperframes` und die Stolpersteine in `references/technik.md`.
