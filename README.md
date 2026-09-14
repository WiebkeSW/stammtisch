# Stammtisch — Behelfslösung

Ein digitaler Gastraum für bis zu 15 Leute: Tische statt Kachelwand, Ton pro
Tisch, Bierdeckel als Gesprächsgedächtnis. Läuft **ohne eigenen Server**.

**Live:** https://wiebkesw.github.io/stammtisch/

## Wie kommen die anderen rein?

Sie öffnen den Link, tippen ihren Namen, wählen ein Getränk, klicken
*Reinkommen* — das Mikrofon wird automatisch angefragt, kein separater Button
zu suchen. Wer ablehnt oder kein Mikrofon hat, ist trotzdem voll dabei und
schreibt am Tisch mit. Kein Konto, keine Installation. Läuft auf Laptop und
Handy, in Chrome, Edge, Firefox und Safari.

**Wichtig: den Raumschlüssel im Link mitgeben.** Der steht bewusst nicht im
Code — dieser liegt ja öffentlich. Alle mit demselben `?raum=` landen im selben
Lokal:

```
https://wiebkesw.github.io/stammtisch/?raum=<euer-schluessel>
```

Schlüssel frei wählbar, aber lang und nicht zu erraten (z. B.
`wbg-stammtisch-7h2qm`). Nur diesen Link teilen. Ohne `?raum=` landet man im
offenen Probierraum, in den theoretisch jeder kann.

Wer im Stammtisch das Mikrofon anhat, sollte **nicht gleichzeitig in einem
Teams- oder Zoom-Call sitzen** — das koppelt und pfeift.

## Zweiter Test (2026-09-14) — was schiefging und was sich geändert hat

Beim ersten Live-Test mit 7 Leuten: den Mikrofon-Button fand niemand sofort,
bei einigen ging der Ton gar nicht — man sah zwar (über die Pegel-Anzeige),
dass jemand sprach, hörte aber nichts. Grund: Die erste Fassung hat den Ton
bei jedem Tischwechsel neu ausgehandelt (nur an den eigenen Tisch senden).
Genau bei dieser Neuaushandlung lief es manchmal nur in eine Richtung durch.

**Umgebaut nach dem Vorbild von Gather.town / SpatialChat:** Ton geht jetzt
**immer an alle im Raum**, ein einziges Mal verbunden, nie neu verhandelt.
Die Tischzugehörigkeit bestimmt nur noch die *Lautstärke beim Zuhören* —
eigener Tisch klar und laut, andere Tische leise und dumpf gefiltert (echtes
Gemurmel, keine Worte verständlich). Kein Renegotiation-Risiko mehr.

Weitere Änderungen aus dem Feedback:

- **Mikrofon startet automatisch** beim Reinkommen (eine Nutzergeste reicht
  für Berechtigung und AudioContext zugleich). Läuft es nicht, erscheint
  sofort ein Schreibmodus-Hinweis statt eines stillen Fehlschlags.
- **Sichtbare Verbindungsdiagnose:** Sendet jemand sein Mikrofon, aber wir
  haben noch keinen Ton von ihm bekommen, erscheint ein gelbes ⚠ an seinem
  Avatar. Kommt Ton an: grünes 🔊. Kein stilles Scheitern mehr.
- **Bierdeckel = Live-Chat am Tisch**, direkt unter dem Raum statt weit unten
  auf der Seite. Jede Zeile, die man tippt, ist sofort für den ganzen Tisch
  sichtbar — auch am Tresen. Das ist der Fallback, wenn Mikrofon oder Ohr
  gerade nicht mitspielen, und zugleich das Gedächtnis des Abends.
- **Durcheinanderreden:** automatisches, unauffälliges Leiserdrehen der
  leiseren Stimme, wenn zwei Leute am selben Tisch gleichzeitig sprechen —
  wie im echten Gespräch, ohne dass jemand stummgeschaltet wird. Zusätzlich
  ein **optionaler Redestein** pro Tisch: wer ihn hält, ist klar zu hören,
  alle anderen deutlich leiser; eine Warteliste zeigt, wer als Nächstes dran
  ist. Ein Tisch schaltet das nur ein, wenn er es chaotisch findet.
- **Einführungstour**, vier Schritte, beim ersten Besuch, überspringbar.

## Warum das ohne Server geht

Die Browser verbinden sich direkt miteinander (WebRTC). Ein fremder Dienst wird
nur gebraucht, damit sich zwei Browser überhaupt erst mal *finden* — dafür
nutzen wir öffentliche Nostr-Relais über die Bibliothek
[Trystero](https://github.com/dmotz/trystero). Sobald der Kontakt steht, läuft
der Ton direkt von Laptop zu Laptop, ein einziges Mal verbunden.

## Veröffentlichen (schon erledigt)

Liegt als GitHub Pages unter `WiebkeSW/stammtisch`, Branch `main`, Ordner `/`.
Jeder Push auf `main` ist nach ein, zwei Minuten live.

Mikrofon funktioniert nur über **HTTPS** oder auf `localhost` — GitHub Pages
liefert HTTPS, das passt also.

## Örtlich testen

```bash
python -m http.server 8787 --directory raum
```

Dann `http://localhost:8787` in zwei Browserfenstern öffnen. Für einen echten
Tontest **zwei Geräte** nehmen — zwei Fenster auf demselben Rechner teilen sich
ein Mikrofon und koppeln.

## Eine andere Gruppe einrichten

Alles, was eine Gruppe ausmacht, steht in [`runden.js`](runden.js): Titel,
die drei Tischfragen und optionale Namensvorschläge. Block kopieren, fertig:

```
index.html?runde=fruehjahr27&raum=eigener-schluessel
```

## Was die Behelfslösung kann

- Alle sehen sich live sitzen, aufstehen und umziehen
- Ton geht an alle im Raum; Lautstärke regelt die Nähe — kein Neuverbinden
  beim Tischwechsel mehr
- Echtes Gemurmel der Nachbartische (leise, dumpf gefiltert) statt Kunstton
- Automatisches Leiserdrehen bei Durcheinanderreden, plus optionaler Redestein
- Sichtbare Verbindungsdiagnose pro Person (🔊 / ⚠)
- Bierdeckel-Chat live am Tisch, auch am Tresen, auch ohne Mikrofon
- Getränkewahl, sichtbar am Platz
- Stuhl-Streit wird aufgelöst: wer zuerst saß, sitzt
- Einführungstour beim ersten Besuch

## Noch nicht gebaut

- **Kartentisch** (Idee einer Teilnehmerin) — ein vierter Tisch zum
  Kartenspielen. Niedrige Priorität, technisch ein eigener Zonentyp mit
  eigenem Mini-Spiel; kommt, wenn Zeit ist.

## Was noch fehlt — und einen Server braucht

| fehlt | warum |
|---|---|
| Bierdeckel überdauern den Abend | ohne Server gibt es keinen Ort, an dem sie liegen bleiben — aktuell leben sie, solange jemand im Raum ist |
| verlässliches Finden | die öffentlichen Relais sind fremde Infrastruktur und können langsam oder weg sein |
| Tische größer als fünf | direkte Verbindungen werden ab ~6 Leuten pro Tisch schwer |
| Video | bewusst weggelassen, kostet ein Vielfaches der Bandbreite |

Die Oberfläche bleibt dabei, wie sie ist — mit eigenem Server wird nur unten
drunter getauscht.

## Vor dem nächsten Vorführen

- [ ] Zu zweit auf **zwei echten Geräten** durchspielen: reinkommen (Mikrofon
      automatisch), Tisch wechseln, hört man sich in beide Richtungen?
- [ ] Einmal zu dritt: einer bleibt am anderen Tisch, klingt er nur als
      Gemurmel (leise, dumpf, keine Worte verständlich)?
- [ ] Zwei Leute gleichzeitig reden lassen — duckt sich die leisere Stimme
      merklich? Redestein einmal ausprobieren.
- [ ] Firmenlaptops prüfen — manche Netze blockieren direkte Verbindungen.
      Wenn das passiert, ist das das Argument für einen eigenen Server
      (TURN-Dienst), nicht ein Fehler der Idee.
