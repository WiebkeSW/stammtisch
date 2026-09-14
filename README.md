# Stammtisch — Behelfslösung

Ein digitaler Gastraum für bis zu 15 Leute: Tische statt Kachelwand, Ton pro
Tisch, Bierdeckel als Gesprächsgedächtnis. Läuft **ohne eigenen Server**.

**Live:** https://wiebkesw.github.io/stammtisch/

## Wie kommen die anderen rein?

Sie öffnen den Link, tippen ihren Namen, wählen ein Getränk, klicken
*Reinkommen* und erlauben einmal das Mikrofon. Kein Konto, keine Installation.
Läuft auf Laptop und Handy, in Chrome, Edge, Firefox und Safari.

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

## Warum das ohne Server geht

Die Browser verbinden sich direkt miteinander (WebRTC). Ein fremder Dienst wird
nur gebraucht, damit sich zwei Browser überhaupt erst mal *finden* — dafür
nutzen wir öffentliche Nostr-Relais über die Bibliothek
[Trystero](https://github.com/dmotz/trystero). Sobald der Kontakt steht, läuft
der Ton direkt von Laptop zu Laptop.

Und der Grund, warum das für 15 Leute reicht: **Ton gilt pro Tisch.** Jeder
verbindet sich nur mit den höchstens vier anderen an seinem Tisch, nicht mit
allen vierzehn. Genau die Idee, die den Abend wie eine Kneipe anfühlen lässt,
macht ihn technisch billig.

Das Gemurmel der Nachbartische wird **nicht übertragen**, sondern in jedem
Browser lokal erzeugt: von fernen Tischen kommt nur eine Zahl („wie laut wird
dort gerade geredet"), daraus baut die Seite selbst ein Rauschen. Man hört,
*dass* geredet wird, nie *was*. Das spart Bandbreite und ist nebenbei die
saubere Lösung fürs Mithören.

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
`raumId`, die drei Tischfragen und die Namensvorschläge. Block kopieren, eigenen
Schlüssel vergeben, fertig:

```
index.html?runde=fruehjahr27
```

Die `raumId` bestimmt, wer sich trifft — wie ein Kneipenname. Nicht zu kurz
wählen, sonst landet zufällig jemand anders im Raum.

## Was die Behelfslösung kann

- Alle sehen sich live sitzen, aufstehen und umziehen
- Ton geht nur an den eigenen Tisch; beim Tischwechsel wechselt er mit
- Gemurmel der Nachbartische (lokal erzeugt) plus sichtbarer Ring am Tisch,
  an dem gerade geredet wird
- Getränkewahl, sichtbar am Platz
- Bierdeckel pro Tisch, den alle am Tisch fortschreiben
- Stuhl-Streit wird aufgelöst: wer zuerst saß, sitzt

## Was noch fehlt — und einen Server braucht

| fehlt | warum |
|---|---|
| Bierdeckel überdauern den Abend | ohne Server gibt es keinen Ort, an dem sie liegen bleiben — aktuell leben sie, solange jemand im Raum ist |
| verlässliches Finden | die öffentlichen Relais sind fremde Infrastruktur und können langsam oder weg sein |
| Tische größer als fünf | direkte Verbindungen werden ab ~6 Leuten pro Tisch schwer |
| Video | bewusst weggelassen, kostet ein Vielfaches der Bandbreite |

Die Oberfläche bleibt dabei, wie sie ist — mit eigenem Server wird nur unten
drunter getauscht.

## Vor dem Vorführen

- [ ] Zu zweit auf **zwei Geräten** durchspielen: reinkommen, Mikrofon an,
      Tisch wechseln, hört man sich?
- [ ] Einmal zu dritt: einer bleibt am anderen Tisch, hört man ihn nur als
      Gemurmel?
- [ ] Firmenlaptops prüfen — manche Netze blockieren direkte Verbindungen.
      Wenn das passiert, ist das das Argument für einen eigenen Server
      (TURN-Dienst), nicht ein Fehler der Idee.
