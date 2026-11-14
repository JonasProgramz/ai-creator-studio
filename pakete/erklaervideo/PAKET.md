# Paket: Erklärvideo-Stil von Julian Ivanov

Kurz für die Einrichtung: So baut Julian seine Erklärvideos zu KI-Tools auf, mit nachgebauten Apps, echten Belegen aus Posts und Artikeln und aufwendigen eigenen Animationen. Passt zu fast allen Erklär-, Tutorial- und Tool-Videos.

Das sind Julians Erfahrungen dazu, was in solchen Videos trägt: Aufbau, Belege, Umgang mit Apps. Wie eine Szene aussieht, legen sie nicht fest, das entscheidest du jedes Mal neu. Die Regeln ergänzen `references/grundsaetze.md` und gelten, solange das Paket im Profil aktiv ist. Der eigene Geschmack der Person (`video-schnitt-profil/geschmack.md`) gewinnt bei Widerspruch. Julians Farben und Schriften gehören nicht zum Paket, das Design kommt immer aus dem Profil.

Bewusst nicht dabei: Julians Animationen, Code, Bilder oder eine Sammlung seiner Einfälle. Die Szenen erfindest du für jedes Video neu, der Maßstab sind die Vorbilder der Person.

Abkürzungen: **5S** = 5 Stufen von Claude, **CD** = Claude Desktop App, **CUC** = Claude-Use-Cases, **DS** = KI-Datenschutz-Matrix (alle Oktober und November 2026).

## Person und Bildschirm

**Der Inhalt hat den Fokus.** Sobald es etwas zu sehen gibt, ist Julian klein in einer Ecke. Groß ist er dort, wo es nichts zu zeigen gibt und der Zuschauer jemanden braucht, dem er zuhört: am Anfang und an Übergängen, insgesamt selten. Weil die Zuschauer wegen des Inhalts da sind. (5S, CD)

**Kamera ruhig.** Sie wechselt nur, wenn sie sonst etwas verdeckt, oder am Themenwechsel. Weil ständiges Springen unruhig macht. (5S)

**Bildschirm erst ganz, dann hinein.** Eine Bildschirmaufnahme steht erst als ganzes Fenster da, dann geht es auf die Stelle. Weil der Zuschauer sonst nicht weiß, wo er ist. (CD)

## Apps zeigen

**Die App im Vollbild ist die Bühne.** In Videos über eine App läuft sie rund 80 % der Zeit nachgebaut im Vollbild, abgedunkelt, mit schwebenden Flächen, Etiketten, Zoom und Live-Abläufen: Prompt tippt sich ein, die KI antwortet, Haken, Status, der Mauszeiger klickt wirklich. Kein Fenster und kein Extra-Hintergrund als Dauerzustand. Weil der Zuschauer die App wiedererkennen und sich darin zurechtfinden soll. (CD)

**Echte Oberfläche statt Chatbox.** Jede Chatbox ist das echte Interface des Tools, nachgebaut, mit dem echten Logo statt eines Knotens mit Namen. Es muss nicht pixelgenau sein, man muss es sofort erkennen. Weil die Zuschauer die App aus ihrem Alltag kennen. (5S)

**Aufbau wie im Original, Inhalte erfunden.** Vor jedem Menü, Dialog oder jeder Karte den passenden Screenshot ansehen. Belege in dieser Reihenfolge: Aufnahmen und Screenshots der Person, offizielle Doku, Changelogs, Beiträge des Herstellers. Gibt es nichts, plausibel nachbauen und auf die Liste „Zum Prüfen“ setzen. Keine Screenshots vom echten Rechner der Person per Bildschirmsteuerung, da stehen echte Daten drin. (CD)

**Maskottchen nach Vorlage.** Hat ein Tool eine bekannte Figur, sieht sie aus wie im Original. Ein falsches Maskottchen fällt sofort auf. Das Logo ist kein Maskottchen. (CD)

## Belege aus Posts, Artikeln und Videos

**Das Medium lang, der Post kurz.** Die Bilder und Videos aus einem Post kommen groß und ohne den Post drumherum, sobald darüber gesprochen wird. Der Post selbst als Text ist die Quelle und steht kurz, rund 5 bis 10 s. Spricht die Person länger über einen Fall, wechseln echte Medien und eigene Animationen. Julian: „Da kannst du anstelle des Posts einfach das Bild zeigen, das reicht, weil man das Bild sonst viel zu kurz sieht.“ (CUC)

**Ein Post steht ruhig.** Nicht zwischen Abschnitten eines Posts hin und her zoomen. Gezoomt wird nur an den wirklich wichtigen Stellen, höchstens einmal. Julian: „nur ab und zu bei den signifikanten Stellen“. (CUC)

**Unterstreichungen sitzen exakt.** Die Linie liegt genau unter den Wörtern, die gesagt werden, über ihre ganze Breite. Deshalb nie geschätzte Koordinaten: Textstellen beim Aufnehmen des Belegs aus der Seite messen (`vorlage/stellen.mjs`, `references/technik.md`). (CUC)

**Fremdsprachige Posts nur einmal kurz.** Einen Post, den die Zuschauer nicht lesen können, einmal als Quelle zeigen, danach trägt eine eigene Animation in ihrer Sprache. Julian: „Das bringt ja nichts, das noch mal zu zeigen.“ (CUC)

**Je mehr echtes Material, desto besser.** Was die Leute selbst gepostet haben (Bilder, Videos, Screenshots, weitere Posts im Thread), kommt möglichst alles ins Video. Julian: „Je mehr du zeigst, desto besser.“ (CUC)

**Verweise auf YouTube-Videos mit echtem Thumbnail und Titel,** kein Screenshot aus dem Video (`https://i.ytimg.com/vi/<id>/maxresdefault.jpg`). Julian: „Nimm am besten das Thumbnail von dem Video zur Vorschau und nicht irgend so einen Screenshot.“ (CUC)

## Eigene Animationen

**Tiefe und Details statt schlicht.** Julian zu einem ersten Entwurf: „deutlich mehr Details und Tiefe mit in die Abbildungen und in die Animationen, mach das Ganze noch interessanter, halt dich nicht zu krampfhaft an vorherige Vorgaben, wenn du es besser und schöner machen kannst“. Aber: Generierte 3D-Grafiken als Ersatz für echtes Material waren ihm später „zu übertrieben“. Aufwand gehört in die eigenen Grafiken, nicht an die Stelle von Belegen. (CUC)

**Ein Hauptdarsteller, der reist.** Bei abstrakten Themen hilft ein Objekt, das durch mehrere Szenen wandert und sich verwandelt, etwa eine Kundenmail, die vom Betrieb ins Rechenzentrum fliegt. Weil der Zuschauer dann einer Geschichte folgt statt einzelnen Folien. (Test vom 06.11.2026)

**Fortschritt kurz zeigen.** Bei Listenvideos hilft an jedem neuen Punkt ein kurzer Blick darauf, wo man gerade ist, ein paar Sekunden, nicht länger. Kommt das Thema direkt nach der Einleitung, entfällt er. Bei Julian war das ein Fahrplan mit Linie, ein Kachelraster mit Zahlen wirkte wie eine Vorlage. (CD, 5S)

**Spannung bei Stufen.** Zeigt das Video eine Reihe von Stufen oder Punkten, verraten die noch nicht besprochenen ihren Namen noch nicht, auch im Einstieg nicht. Weil das die Zuschauer im Video hält. (5S)

## Wie Julian prüft

Er schaut jeden Entwurf ganz und gibt Feedback mit Zeitstempel. Am häufigsten korrigiert hat er: Bild passt nicht genau zum Wort, Logos verschoben oder gequetscht, zu wenig Tiefe, Posts zu lange als Text, zu viele Soundeffekte. Diese Punkte vor jedem Entwurf besonders prüfen.
