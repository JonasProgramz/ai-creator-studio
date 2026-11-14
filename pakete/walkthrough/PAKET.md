# Paket: Walkthrough-Stil von Julian Ivanov

Kurz für die Einrichtung: So schneidet Julian Videos, in denen er fast die ganze Zeit etwas auf seinem Bildschirm zeigt, etwa Praxistests, Tool-Vergleiche oder das Durchklicken eines Ergebnisses. Der Bildschirm steht im Vollbild, die Person sitzt als runder Ausschnitt in einer Ecke, Grafiken kommen nur dort, wo man etwas sonst nicht sieht. Ruhiger und schneller gebaut als ein Erklärvideo.

Das sind Julians Erfahrungen aus seinem Praxistest zu Claude Fable 5.2 (November 2026, zwei Entwürfe mit Feedback). Wie eine einzelne Einblendung aussieht, legen sie nicht fest, das entscheidest du jedes Mal neu. Die Regeln ergänzen `references/grundsaetze.md` und gelten, solange das Paket im Profil aktiv ist. Der eigene Geschmack der Person (`video-schnitt-profil/geschmack.md`) gewinnt bei Widerspruch. Julians Farben und Schriften gehören nicht zum Paket, das Design kommt immer aus dem Profil. Mit dem Paket `erklaervideo` zusammen gilt dieses hier für die Strecken, in denen die Person ihren Bildschirm zeigt.

## Bild

**Bildschirm im Vollbild, kein Extra-Hintergrund.** Die Aufnahme füllt das Bild, ohne Fenster, Rahmen oder gestalteten Grund drumherum. Julian: „Es soll weiterhin clean aussehen, und es ist halt mehr so ein Walkthrough-Video … Es muss jetzt nicht so sein wie diese Erklärvideos, wo man dann auch so einen krassen Hintergrund benötigt.“

**Die Person als Kreis in der Ecke.** Ein runder Ausschnitt der Kamera, unten in der Ecke, die im Profil steht. Text, den ein Zoom zeigt, endet vor dem Kreis, sonst verdeckt die Person genau das, worüber sie spricht.

**Kreis in drei Größen.** Groß am Anfang, damit man die Person gut sieht, klein bei Einblendungen und Abbildungen, sonst mittel. Bei Julian waren das bei 1920 px Breite rund 560, 340 und 400 px, 340 als Dauergröße war ihm „zu klein“. Gewechselt wird mit einer ruhigen Bewegung, nicht mit einem Sprung.

**Kopf mittig im Kreis.** Waagerecht genau in der Mitte, die Person sieht schon wenige Pixel Versatz („bitte meinen Kopf zentral!! der ist leicht links“). Den Ausschnitt deshalb je Aufnahme per Gesichtserkennung setzen und direkt aus der Originalaufnahme schneiden, nicht aus einer verkleinerten Kopie, damit er auch groß scharf bleibt.

## Zoom

**Zoom nur, wo Text schwer lesbar ist.** Kein Zoom, nur damit sich etwas bewegt, auch nicht im Hook. Julian zu einem Zoom auf die Startseite: „unnötiger Zoom, braucht man nicht“.

**Bei einem Plan von Kasten zu Kasten.** Erklärt die Person eine Übersicht mit mehreren Schritten (Making-of, Ablaufplan, Liste), fährt der Zoom zu genau dem Kasten, den sie gerade nennt, und von dort zum nächsten. Die Kamera-Ecke bleibt dabei, wo sie ist.

**Zooms aus der scharfen Quelle.** Liegt die Bildschirmaufnahme in höherer Auflösung vor als das Video, wird aus ihr gezoomt (`scr_breite` in `projekt.json`), sonst wird kleiner Text beim Zoom matschig.

## Einblendungen

**Nur, was man sonst nicht sieht.** Grafiken kommen dort, wo die Person etwas nennt, das nicht auf dem Bildschirm steht: Benchmarks und Zahlen, Kosten und Dauer, zwei Bereiche, um die es geht, eine Abwägung, ein Rückblick. Was schon im Bild zu lesen ist, bekommt keine zusätzliche Grafik.

**Eigene Grafiken, keine Icon-Kacheln.** Eine Aufzählung wird eine kleine Szene, die sich bewegt, oder ein echtes Standbild aus dem Material. Kacheln aus Symbol und Beschriftung hat Julian ausdrücklich verboten (`references/grundsaetze.md`).

**Kurz stehen lassen.** Eine Karte steht so lange wie der Satz, zu dem sie gehört, dann geht sie. Julian hat im ersten Entwurf zwei Stellen markiert, an denen Karten „zu lange“ blieben, eine Kostenangabe und eine Folge von Ablaufkarten.

**Lesbare Namen dürfen bleiben.** Auf öffentlichen Plattformen wie X müssen Namen und Profilbilder nicht unkenntlich gemacht werden. Abgedeckt werden nur private Kommentare oder Nachrichten.

## Eingesetzte Filme

**Fertige Filme laufen unverändert und ohne Kamera.** Setzt die Person ein fertiges Ergebnis (einen Film, ein Erklärvideo) ein, verschwindet der Kreis, nichts liegt darüber, und die Strecke wird nicht durch HyperFrames gerendert, sondern direkt aus der Quelle geschnitten (`references/technik.md`).
