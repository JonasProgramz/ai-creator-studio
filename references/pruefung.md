# Prüfung vor jedem Entwurf

Ziel: Die Person beurteilt beim Entwurf nur noch Geschmack und findet keine Fehler mehr. Wie du dahin kommst, entscheidest du. Im Abschluss sagst du, was geprüft wurde und was nicht, etwa wenn du in Standbildern statt in Echtzeit geprüft hast.

## Was geprüft sein muss

- **Jedes Bild ansehen,** nicht die Quellen lesen: Einzelbilder in voller Auflösung, Kontaktbögen, Probe-Renders für Bewegung und Übergänge (Werkzeuge in `references/technik.md`). Frag bei jeder Szene, ob ein sehr guter Motion Designer sie so abgeben würde, und ob sie nach eigener Idee oder nach Standard aussieht.
- **Sauber:** keine Versehen wie verzerrte oder unscharfe Logos, ungewollt Angeschnittenes, Linien, die neben ihrem Ziel enden, unfertige Zwischenzustände. `node werkzeug.mjs praezision` findet einen Teil davon, seine Funde sind Fragen.
- **Aussagen:** Für jede Szene, was das Bild behauptet, und ob die Person genau das sagt. Ein Haken, ein Logo oder eine Zuordnung ist auch eine Aussage. Zahlen, Fristen, Preise und Anbieter belegt oder gesagt, sonst raus oder allgemeiner. Was in einem Video über Datenschutz bei KI-Anbietern erst im vierten Entwurf auffiel: ein Haken neben „Interne Infos“, obwohl nur gesagt war, ohne personenbezogene Daten sei es kein Problem; eine Faustregel, die jeder Datenart einen Weg zuordnete, obwohl nur die Richtung genannt war; Speicherdauern ohne Beleg; „87 % Rabatt“ im Bild, den es nur über den Link der Person gab.
- **Länge, Nähte, Ton:** Video so lang wie die Timeline, keine schwarzen oder eingefrorenen Bilder an den Teilgrenzen, Lautheit um -14 LUFS, kein Satz fehlt oder steht doppelt. `zusammen.py` prüft, ob alle Teile aktuell sind, nie mit `--trotzdem` abgeben.
- **Sprache im Bild:** Rechtschreibung, Sonderzeichen, Ansprache aus dem Profil.

## Zweiter Prüfer

Wenn das Profil es vorsieht, schaut danach genau ein Agent ohne deinen Bau-Kontext drüber. Er bekommt das Video oder die Probe-Renders, das Transkript mit Zeiten, die Quellen der Teile, `references/grundsaetze.md`, das Profil (`geschmack.md`, `massstab/`) und diesen Auftrag, nicht deinen Szenenplan und nicht deine Begründungen. Erprobt an einem 5-Minuten-Test: Er fand 29 Fehler und hatte zu jeder Szene einen umsetzbaren Vorschlag.

> Du bist ein sehr guter Motion Designer und schaust dir den Entwurf an, bevor er rausgeht, so gründlich, als ginge er unter deinem Namen raus. Die Maßstab-Bilder zeigen, was die Person sehr gut findet. Liefere Fehler mit Zeitstempel und Sicherheit (erfinde nichts), und zu jeder Szene, die nach Standard statt nach eigener Idee aussieht, eine bessere Idee. Sag am Ende, was dich am ganzen Video am meisten stört und was du nicht prüfen konntest.

Seine Funde prüfst du am Bild nach, bevor du korrigierst. Vorschläge übernimmst du, wo sie die Szene heben, und machst es besser, wo dir mehr einfällt. Bilder, die nur ein Generator liefern kann, schlägst du der Person mit Prompt vor, weil jede Generierung Credits kostet.
