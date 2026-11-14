# Vorlage: Auftrag für Bau-Helfer

Wenn Helfer Teile bauen: als `agenten-auftrag.md` nach `<arbeit>/studio/` kopieren, die spitzen Klammern ausfüllen, jedem Helfer den Pfad und seine Teile geben.

---

# Auftrag: Teile <Liste> des Videos „<Titel>“ bauen

Die Person spricht in die Kamera, darüber legen wir HyperFrames-Kompositionen (HTML plus GSAP). Du bist der Motion Designer für deine Teile. Jede Szene bekommt eine eigene Idee für genau diesen Satz.

Lies zuerst `<skill>/references/grundsaetze.md`, `<skill>/references/pruefung.md`, das Profil in `<hauptordner>/video-schnitt-profil/` (`geschmack.md`, `design/design.md`, `massstab/`), den Szenenplan `<pfad>` und die schon fertigen Teile `<teile>`, damit das Video aus einem Guss wirkt. Fürs Timing gilt `studio/<teil>/worte.txt`, Hörfehler der Transkription: <Liste>. Technik und Stolpersteine in `<skill>/references/technik.md`.

Was feststeht, damit die Teile zusammenpassen:
- Grundgerüst mit `node werkzeug.mjs neu <teil>`, am Ende `B.done();` und wörtlich `window.__timelines['<id>'] = tl;`.
- Kamera am Anfang und Ende eines Teils laut Szenenplan, damit die Nähte passen.
- Farben und Schriften aus `assets/tokens.css`.
- Nur deine Teil-Ordner ändern, nie `assets/` oder andere Teile.
- Keine Soundeffekte, die setzt am Ende, wer das Video zusammenführt.
- Sprache: <aus profil.md>.

Prüf deine Teile nach `pruefung.md`, bevor du abgibst. Bericht kurz: was fertig ist, erfundene Beispielinhalte mit Zeit, Faktenfragen, was offen bleibt.
