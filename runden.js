/* ============================================================================
   runden.js — die Konfiguration des Stammtischs.

   Das hier ist die EINZIGE Datei, die eine neue Gruppe anfassen muss.
   Kopiere den Block unter RUNDEN, gib ihm einen eigenen Schlüssel — fertig ist
   der Stammtisch einer anderen Kohorte.

   Welche Runde geladen wird, steht in der Adresse:
     index.html?runde=wbg
   Ohne Angabe wird STANDARD_RUNDE genommen.
   ========================================================================== */

export const STANDARD_RUNDE = 'wbg';

export const RUNDEN = {

  wbg: {
    titel: 'Stammtisch Kohorte 4',
    /* Der Raumschlüssel steht bewusst NICHT hier, sondern im geteilten Link:
         index.html?raum=<euer-schluessel>
       Dieser Code liegt öffentlich — ein Schlüssel in der Datei wäre keiner.
       Ohne ?raum landet man im offenen Probierraum unten (PROBIERRAUM). */
    tische: {
      tisch: {label: 'Der Stammtisch', frage: 'Was habt ihr seit dem Kurs wirklich eingesetzt — und was ist liegengeblieben?'}
    },
    /* Optionale Vorschläge für die Namensauswahl. Leer lassen, wenn der Code
       öffentlich liegt — dann tippt jeder seinen Namen selbst ein. */
    gaeste: []
  },

  /* Beispiel: so sieht eine zweite Kohorte aus. Nichts weiter zu tun. */
  fruehjahr27: {
    titel: 'Stammtisch Kohorte Frühjahr 2027',
    tische: {
      tisch: {label: 'Der Stammtisch', frage: 'Erste eigene Automatisierung — woran seid ihr hängengeblieben?'}
    },
    gaeste: []
  }
};

/* Wer den Link ohne ?raum= öffnet, landet hier. Gedacht zum Ausprobieren —
   für den echten Stammtisch immer einen eigenen Schlüssel im Link mitgeben. */
export const PROBIERRAUM = 'stammtisch-probierraum';

/* ---------------------------------------------------------------------------
   Ab hier ist alles Einrichtung des Gastraums — die ändert sich pro Gruppe nicht.
   Alle Maße in Prozent des Raums.
   --------------------------------------------------------------------------- */

/* Zwei Zonen: der große Stammtisch (sitzen) und die Kuchentheke (stehen, wie
   ein Vorraum — wer dort steht, hört den Tisch nur als Gemurmel). */
export const TISCHE = {
  theke: {label: 'Kuchentheke',     farbe: '#D9A441', tief: '#A9741F'},
  tisch: {label: 'Der Stammtisch',  farbe: '#A9794F', tief: '#7A5233', x: 50, y: 54, w: 37.9, h: 32.6}
};

/* Acht Plätze rund um den ovalen Tisch, jeder Stuhl in einer eigenen Farbe.
   Mehr als acht Leute? Dann einfach weitere Zeilen ergänzen. */
export const STUEHLE = [
  {id: 'tisch-1', zone: 'tisch', x: 27.0, y: 43.9, farbe: '#5BA39A'},
  {id: 'tisch-2', zone: 'tisch', x: 40.5, y: 29.5, farbe: '#E0A93B'},
  {id: 'tisch-3', zone: 'tisch', x: 59.5, y: 29.5, farbe: '#D9808A'},
  {id: 'tisch-4', zone: 'tisch', x: 73.0, y: 43.9, farbe: '#8DB36B'},
  {id: 'tisch-5', zone: 'tisch', x: 73.0, y: 63.9, farbe: '#C8683F'},
  {id: 'tisch-6', zone: 'tisch', x: 59.5, y: 78.4, farbe: '#6C8EBF'},
  {id: 'tisch-7', zone: 'tisch', x: 40.5, y: 78.4, farbe: '#B58AC4'},
  {id: 'tisch-8', zone: 'tisch', x: 27.0, y: 63.9, farbe: '#E08A3C'}
];

export const GETRAENKE = [
  {id: 'helles',    name: 'Helles',        farbe: '#E6B84A', gruppe: 'Bier'},
  {id: 'weissbier', name: 'Weißbier',      farbe: '#EFD27A', gruppe: 'Bier'},
  {id: 'radler',    name: 'Radler',        farbe: '#E8D86A', gruppe: 'Bier'},

  {id: 'weisswein', name: 'Weißwein',      farbe: '#E9E08B', gruppe: 'Wein und Sekt'},
  {id: 'rotwein',   name: 'Rotwein',       farbe: '#8A2B3F', gruppe: 'Wein und Sekt'},
  {id: 'gespritzt', name: 'Gespritzter',   farbe: '#EFEBB5', gruppe: 'Wein und Sekt'},
  {id: 'sekt',      name: 'Sekt',          farbe: '#F4EAB0', gruppe: 'Wein und Sekt'},
  {id: 'aperol',    name: 'Aperol Spritz', farbe: '#F07A3A', gruppe: 'Wein und Sekt'},

  {id: 'melange',   name: 'Melange',       farbe: '#C9A27A', gruppe: 'Warm'},
  {id: 'kaffee',    name: 'Kaffee',        farbe: '#43291A', gruppe: 'Warm'},
  {id: 'tee',       name: 'Tee',           farbe: '#C07A2E', gruppe: 'Warm'},

  {id: 'wasser',    name: 'Wasser',        farbe: '#7FB4C8', gruppe: 'Ohne Alkohol'},
  {id: 'spezi',     name: 'Spezi',         farbe: '#5A3620', gruppe: 'Ohne Alkohol'},
  {id: 'schorle',   name: 'Saftschorle',   farbe: '#D2C14A', gruppe: 'Ohne Alkohol'},

  {id: 'eierlikoer', name: 'Eierlikör',    farbe: '#F2C94C', gruppe: 'Zum Schluss'}
];

export const STANDARD_GETRAENK = 'wasser';

/* Die Speisekarte steht nur zum Anschauen da — gewählt wird nur das Getränk. */
export const SPEISEKARTE = [
  {titel: 'Zum Essen', eintraege: ['Wiener Schnitzel', 'Stück Kuchen']}
];
