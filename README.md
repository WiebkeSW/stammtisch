# Stammtisch — Behelfslösung

Ein digitaler Gastraum für bis zu 15 Leute: Tische statt Kachelwand, Ton pro
Tisch, Bierdeckel als Gesprächsgedächtnis. Läuft **ohne eigenen Server**.

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

## Veröffentlichen (GitHub Pages)

1. Diesen Ordner (`raum/`) in ein Repository legen, z. B. `stammtisch`.
2. Im Repository: *Settings → Pages → Source: Deploy from a branch*, Branch
   `main`, Ordner `/` (oder `/docs`, dann die Dateien dorthin legen).
3. Nach ein, zwei Minuten liegt der Raum unter
   `https://<konto>.github.io/stammtisch/`.

Wichtig: Mikrofon funktioniert nur über **HTTPS** oder auf `localhost`.
GitHub Pages liefert HTTPS, das passt also.

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
