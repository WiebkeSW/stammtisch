/* ============================================================================
   runden.js — die Konfiguration des Stammtischs.

   Das hier ist die EINZIGE Datei, die eine neue Gruppe anfassen muss.
   Kopiere den Block unter RUNDEN, gib ihm einen eigenen Schlüssel und eine
   eigene raumId — fertig ist der Stammtisch einer anderen Kohorte.

   Welche Runde geladen wird, steht in der Adresse:
     index.html?runde=wbg
   Ohne Angabe wird STANDARD_RUNDE genommen.
   ========================================================================== */

export const STANDARD_RUNDE = 'wbg';

export const RUNDEN = {

  wbg: {
    titel: 'Stammtisch der Weiterbildungsgruppe',
    /* Der Raumschlüssel steht bewusst NICHT hier, sondern im geteilten Link:
         index.html?raum=<euer-schluessel>
       Dieser Code liegt öffentlich — ein Schlüssel in der Datei wäre keiner.
       Ohne ?raum landet man im offenen Probierraum unten (PROBIERRAUM). */
    tische: {
      rot:   {label: 'Roter Tisch',  frage: 'Was habt ihr seit dem Kurs wirklich eingesetzt — und was ist liegengeblieben?'},
      blau:  {label: 'Blauer Tisch', frage: 'Ich komme bei Automatisierungen immer bis zur Hälfte. Wie macht ihr das fertig?'},
      gruen: {label: 'Grüner Tisch', frage: null}
    },
    /* Optionale Vorschläge für die Namensauswahl. Leer lassen, wenn der Code
       öffentlich liegt — dann tippt jeder seinen Namen selbst ein. */
    gaeste: []
  },

  /* Beispiel: so sieht eine zweite Kohorte aus. Nichts weiter zu tun. */
  fruehjahr27: {
    titel: 'Stammtisch Kohorte Frühjahr 2027',
    tische: {
      rot:   {label: 'Roter Tisch',  frage: 'Erste eigene Automatisierung — woran seid ihr hängengeblieben?'},
      blau:  {label: 'Blauer Tisch', frage: 'Wie überzeugt man eine Chefin, die schon zwei Tools abgeschafft hat?'},
      gruen: {label: 'Grüner Tisch', frage: 'Wer hat Lust auf eine gemeinsame Übungsrunde zwischendurch?'}
    },
    gaeste: []
  }
};

/* Wer den Link ohne ?raum= öffnet, landet hier. Gedacht zum Ausprobieren —
   für den echten Stammtisch immer einen eigenen Schlüssel im Link mitgeben. */
export const PROBIERRAUM = 'stammtisch-probierraum';

/* ---------------------------------------------------------------------------
   Ab hier ist alles Einrichtung des Gastraums — die ändert sich pro Gruppe nicht.
   --------------------------------------------------------------------------- */

export const TISCHE = {
  tresen: {label: 'Tresen',        farbe: '#E0982B', tief: '#B87A1C'},
  rot:    {label: 'Roter Tisch',   farbe: '#D6453C', tief: '#A32F28', x: 70, y: 30},
  blau:   {label: 'Blauer Tisch',  farbe: '#2B7FB8', tief: '#1B5D8C', x: 27, y: 71},
  gruen:  {label: 'Grüner Tisch',  farbe: '#5A9E45', tief: '#3F7530', x: 73, y: 75}
};

/* Feste Stühle an den Tischen. Der Tresen hat keine — dort steht man,
   deshalb werden die Plätze dort zur Laufzeit ausgerechnet. */
export const STUEHLE = [
  {id: 'rot-1',   zone: 'rot',   x: 70.0, y: 10.8},
  {id: 'rot-2',   zone: 'rot',   x: 80.9, y: 24.1},
  {id: 'rot-3',   zone: 'rot',   x: 76.8, y: 45.5},
  {id: 'rot-4',   zone: 'rot',   x: 63.2, y: 45.5},
  {id: 'rot-5',   zone: 'rot',   x: 59.1, y: 24.1},

  {id: 'blau-1',  zone: 'blau',  x: 27.0, y: 51.8},
  {id: 'blau-2',  zone: 'blau',  x: 37.9, y: 65.1},
  {id: 'blau-3',  zone: 'blau',  x: 33.8, y: 86.5},
  {id: 'blau-4',  zone: 'blau',  x: 20.2, y: 86.5},
  {id: 'blau-5',  zone: 'blau',  x: 16.1, y: 65.1},

  {id: 'gruen-1', zone: 'gruen', x: 73.0, y: 55.8},
  {id: 'gruen-2', zone: 'gruen', x: 83.9, y: 69.1},
  {id: 'gruen-3', zone: 'gruen', x: 79.8, y: 90.5},
  {id: 'gruen-4', zone: 'gruen', x: 66.2, y: 90.5},
  {id: 'gruen-5', zone: 'gruen', x: 62.1, y: 69.1}
];

export const GETRAENKE = [
  {id: 'helles',  name: 'Helles',  farbe: '#E0982B'},
  {id: 'rotwein', name: 'Rotwein', farbe: '#8A2B3F'},
  {id: 'spezi',   name: 'Spezi',   farbe: '#5A3620'},
  {id: 'schorle', name: 'Schorle', farbe: '#D2C14A'},
  {id: 'tee',     name: 'Tee',     farbe: '#C07A2E'},
  {id: 'kaffee',  name: 'Kaffee',  farbe: '#43291A'},
  {id: 'wasser',  name: 'Wasser',  farbe: '#7FB4C8'}
];
