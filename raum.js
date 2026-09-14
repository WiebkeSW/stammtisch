/* ============================================================================
   Stammtisch — Behelfslösung ohne eigenen Server.

   Warum das ohne Server geht:
   Die Leute verbinden sich direkt miteinander (WebRTC, „peer to peer").
   Ein Server wird nur gebraucht, damit sich zwei Browser überhaupt erst mal
   finden — dafür nutzen wir öffentliche Nostr-Relais über die Bibliothek
   Trystero. Danach läuft der Ton direkt von Laptop zu Laptop, ohne Umweg.

   Und warum das für 15 Leute reicht:
   Weil Ton hier PRO TISCH gilt. Jeder verbindet sich nur mit den vier anderen
   an seinem Tisch, nicht mit allen vierzehn. Genau die Idee, die den Abend wie
   eine Kneipe anfühlen lässt, macht ihn technisch billig.

   Was später mit eigenem Server dazukommt:
   - eigenes Finden statt fremder Relais (verlässlicher, niemand sonst im Spiel)
   - Bierdeckel, die den Abend überdauern (jetzt: nur solange jemand da ist)
   - größere Tische als fünf Leute
   Die Oberfläche bleibt dabei wie sie ist — es wird nur unten drunter getauscht.
   ========================================================================== */

import {joinRoom, selfId} from 'https://cdn.jsdelivr.net/npm/@trystero-p2p/nostr@0.25.4/+esm';
import {RUNDEN, STANDARD_RUNDE, PROBIERRAUM, TISCHE, STUEHLE, GETRAENKE} from './runden.js';

/* ---------- Welche Runde, welcher Raum? ---------- */
const params = new URLSearchParams(location.search);
const rundenSchluessel = RUNDEN[params.get('runde')] ? params.get('runde') : STANDARD_RUNDE;
const RUNDE = RUNDEN[rundenSchluessel];
const ZONEN = ['tresen', 'rot', 'blau', 'gruen'];

/* Der Raumschlüssel kommt aus dem Link, nicht aus dem Code — dieser Code liegt
   öffentlich. Alle mit demselben ?raum= landen im selben Lokal. */
const raumSchluessel = (params.get('raum') || '').trim().slice(0, 60) || PROBIERRAUM;
const istProbierraum = raumSchluessel === PROBIERRAUM;

/* ---------- Zustand ---------- */
const ich = {name: '', rolle: '', zone: 'tresen', stuhl: null, getraenk: 'helles', seit: Date.now()};
const gaeste = new Map();      // peerId -> Zustand
const pegel = new Map();       // peerId -> 0..1
const toene = new Map();       // peerId -> <audio>
let deckel = new Map();        // eintragId -> {id, zeit, wer, text, zone}
let raum = null;
let sendeZustand = null, sendeDeckel = null, sendePegel = null;
let meinStream = null;
let letzteZiele = '';

/* ---------- Kurze Helfer ---------- */
const $ = id => document.getElementById(id);
const farbeVon = id => (GETRAENKE.find(g => g.id === id) || GETRAENKE[0]).farbe;
const stuhlVon = id => STUEHLE.find(s => s.id === id);
const uhrzeit = () => new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'});

function glasSVG(farbe){
  return '<path d="M7 3 L17 3 L15.6 25 A3.8 3.8 0 0 1 8.4 25 Z" fill="#fff" stroke="rgba(38,34,30,.45)" stroke-width="1.2"/>' +
         '<path d="M7.9 11.5 L16.1 11.5 L15.1 24.5 A3.3 3.3 0 0 1 8.9 24.5 Z" fill="' + farbe + '"/>';
}
function aufzaehlen(a){
  if(!a.length) return '';
  if(a.length === 1) return a[0];
  return a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
}
function zonenName(z){
  if(z === 'tresen') return 'am Tresen';
  return 'am ' + (RUNDE.tische[z].label || TISCHE[z].label).toLowerCase().replace('er tisch', 'en Tisch');
}
function escape(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

/* ===========================================================================
   Garderobe
   =========================================================================== */
$('garderobe-titel').textContent = RUNDE.titel;
document.title = RUNDE.titel;

let gewaehlterName = '';
const schilder = $('namensschilder');
RUNDE.gaeste.forEach(g => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'namenschild';
  b.textContent = g.name;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => {
    gewaehlterName = g.name;
    if(g.rolle) $('rolle').value = g.rolle;
    $('name').value = g.name;
    [...schilder.children].forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    pruefeGarderobe();
  });
  schilder.appendChild(b);
});
if(!RUNDE.gaeste.length) schilder.hidden = true;

$('name').addEventListener('input', () => {
  gewaehlterName = $('name').value.trim();
  [...schilder.children].forEach(x => x.setAttribute('aria-pressed', x.textContent === gewaehlterName ? 'true' : 'false'));
  pruefeGarderobe();
});

function pruefeGarderobe(){
  $('reinkommen').disabled = gewaehlterName.length < 2;
}

function baueGetraenke(behaelter){
  behaelter.innerHTML = '';
  GETRAENKE.forEach(g => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'getraenk';
    b.dataset.getraenk = g.id;
    b.setAttribute('aria-pressed', g.id === ich.getraenk ? 'true' : 'false');
    b.innerHTML = '<svg viewBox="0 0 24 32" aria-hidden="true">' + glasSVG(g.farbe) + '</svg>' + g.name;
    b.addEventListener('click', () => {
      ich.getraenk = g.id;
      document.querySelectorAll('.getraenk').forEach(x =>
        x.setAttribute('aria-pressed', x.dataset.getraenk === g.id ? 'true' : 'false'));
      if(sendeZustand) sendeZustand(ich);
      zeichneRaum();
    });
    behaelter.appendChild(b);
  });
}
baueGetraenke($('getraenke-garderobe'));

$('garderobe-hinweis').innerHTML =
  'Der Raum läuft direkt zwischen den Browsern — kein Konto, keine Installation. ' +
  'Alle mit demselben Link landen im selben Lokal.';

$('reinkommen').addEventListener('click', () => {
  ich.name = gewaehlterName.slice(0, 18);
  ich.rolle = $('rolle').value.trim().slice(0, 22);
  $('garderobe').hidden = true;
  $('lokal').hidden = false;
  starteTonanlage();     // braucht eine Nutzergeste — dieser Klick ist sie
  betreteRaum();
});
$('name').addEventListener('keydown', e => {
  if(e.key === 'Enter' && !$('reinkommen').disabled) $('reinkommen').click();
});

/* ===========================================================================
   Tonanlage: Gemurmel wird LOKAL erzeugt, nicht übertragen.
   Von fernen Tischen kommt nur eine Zahl („wie laut redet ihr gerade"),
   daraus baut jeder Browser selbst ein Rauschen. Man hört, DASS geredet wird,
   nie WAS — das spart Bandbreite und ist nebenbei die saubere Lösung.
   =========================================================================== */
let tonCtx = null, murmelGain = null;

function starteTonanlage(){
  try{
    tonCtx = new (window.AudioContext || window.webkitAudioContext)();
    const laenge = tonCtx.sampleRate * 2;
    const puffer = tonCtx.createBuffer(1, laenge, tonCtx.sampleRate);
    const daten = puffer.getChannelData(0);
    let letzt = 0;
    for(let i = 0; i < laenge; i++){
      const weiss = Math.random() * 2 - 1;
      letzt = (letzt + 0.02 * weiss) / 1.02;
      daten[i] = letzt * 3.2;
    }
    const quelle = tonCtx.createBufferSource();
    quelle.buffer = puffer;
    quelle.loop = true;
    const filter = tonCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.7;
    murmelGain = tonCtx.createGain();
    murmelGain.gain.value = 0;
    quelle.connect(filter).connect(murmelGain).connect(tonCtx.destination);
    quelle.start();
  }catch(e){
    tonCtx = null;   // ohne Gemurmel funktioniert der Rest trotzdem
  }
}

function stelleGemurmel(){
  let fern = 0;
  gaeste.forEach((g, id) => { if(g.zone !== ich.zone) fern += (pegel.get(id) || 0); });
  if(murmelGain && tonCtx){
    const ziel = Math.min(0.26, fern * 0.1);
    murmelGain.gain.setTargetAtTime(ziel, tonCtx.currentTime, 0.35);
  }
  ZONEN.forEach(z => {
    const ring = $('ring-' + z);
    if(!ring) return;
    let laut = 0;
    gaeste.forEach((g, id) => { if(g.zone === z) laut = Math.max(laut, pegel.get(id) || 0); });
    const fremd = z !== ich.zone;
    ring.style.opacity = fremd && laut > 0.06 ? String(Math.min(0.55, laut)) : '0';
    ring.style.scale = String(1 + Math.min(0.09, laut * 0.12));
  });
}

/* ===========================================================================
   Mikrofon — Ton geht nur an den eigenen Tisch
   =========================================================================== */
$('mikro').addEventListener('click', async () => {
  if(meinStream){
    meinStream.getTracks().forEach(t => t.stop());
    try{ raum.removeStream(meinStream); }catch(e){}
    meinStream = null;
    letzteZiele = '';
    $('mikro').classList.remove('an');
    $('mikro').textContent = 'Mikrofon einschalten';
    if(sendePegel) sendePegel(0);
    return;
  }
  try{
    meinStream = await navigator.mediaDevices.getUserMedia({
      audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}
    });
    $('mikro').classList.add('an');
    $('mikro').textContent = 'Mikrofon aus';
    setzeAudioZiele(true);
    messePegel(meinStream);
  }catch(e){
    $('mikro').textContent = 'Mikrofon blockiert';
    setTimeout(() => { $('mikro').textContent = 'Mikrofon einschalten'; }, 2500);
  }
});

function setzeAudioZiele(erzwingen){
  if(!meinStream || !raum) return;
  const ziele = [...gaeste.entries()].filter(([, g]) => g.zone === ich.zone).map(([id]) => id);
  const signatur = ziele.slice().sort().join('|');
  if(!erzwingen && signatur === letzteZiele) return;
  letzteZiele = signatur;
  try{ raum.removeStream(meinStream); }catch(e){}
  if(ziele.length) raum.addStream(meinStream, {target: ziele});
}

function messePegel(stream){
  if(!tonCtx) return;
  const quelle = tonCtx.createMediaStreamSource(stream);
  const analyse = tonCtx.createAnalyser();
  analyse.fftSize = 512;
  quelle.connect(analyse);
  const daten = new Uint8Array(analyse.fftSize);
  let zuletzt = -1;
  setInterval(() => {
    if(!meinStream) return;
    analyse.getByteTimeDomainData(daten);
    let summe = 0;
    for(let i = 0; i < daten.length; i++){
      const v = (daten[i] - 128) / 128;
      summe += v * v;
    }
    const wert = Math.min(1, Math.round(Math.sqrt(summe / daten.length) * 4 * 20) / 20);
    if(Math.abs(wert - zuletzt) < 0.05) return;
    zuletzt = wert;
    if(sendePegel) sendePegel(wert);
    zeichneRaum();
  }, 180);
}

/* ===========================================================================
   Raum betreten
   =========================================================================== */
function betreteRaum(){
  $('lokal-titel').textContent = RUNDE.titel;

  ZONEN.forEach(z => {
    if(z === 'tresen') return;
    const frage = RUNDE.tische[z].frage;
    if(frage) deckel.set('start-' + z, {id: 'start-' + z, zone: z, zeit: 'vorher', wer: '', text: frage});
  });

  baueRaum();
  baueGetraenke($('getraenke-pult'));

  raum = joinRoom({appId: 'skillsprinters-stammtisch'}, raumSchluessel);

  const aZustand = raum.makeAction('zustand');
  const aDeckel  = raum.makeAction('deckel');
  const aPegel   = raum.makeAction('pegel');
  sendeZustand = (z, ziel) => aZustand.send(z, ziel ? {target: ziel} : undefined);
  sendeDeckel  = (d, ziel) => aDeckel.send(d, ziel ? {target: ziel} : undefined);
  sendePegel   = p => aPegel.send(p);

  aZustand.onMessage = (zustand, {peerId}) => {
    gaeste.set(peerId, zustand);
    loeseKonflikt(peerId, zustand);
    setzeAudioZiele(false);
    zeichneRaum();
    zeichneAnwesend();
  };

  aDeckel.onMessage = (liste, {peerId}) => {
    (Array.isArray(liste) ? liste : [liste]).forEach(e => {
      if(e && e.id && !deckel.has(e.id)) deckel.set(e.id, e);
    });
    zeichneDeckel();
  };

  aPegel.onMessage = (wert, {peerId}) => {
    pegel.set(peerId, typeof wert === 'number' ? wert : 0);
    stelleGemurmel();
    zeichneRaum();
  };

  raum.onPeerJoin = peerId => {
    sendeZustand(ich, peerId);
    sendeDeckel([...deckel.values()], peerId);
    setzeStatus();
  };

  raum.onPeerLeave = peerId => {
    gaeste.delete(peerId);
    pegel.delete(peerId);
    const t = toene.get(peerId);
    if(t){ t.remove(); toene.delete(peerId); }
    setzeAudioZiele(true);
    zeichneRaum();
    zeichneAnwesend();
    setzeStatus();
  };

  raum.onPeerStream = (stream, peerId) => {
    let el = toene.get(peerId);
    if(!el){
      el = document.createElement('audio');
      el.autoplay = true;
      $('toene').appendChild(el);
      toene.set(peerId, el);
    }
    el.srcObject = stream;
    const g = gaeste.get(peerId);
    el.muted = !!(g && g.zone !== ich.zone);
    el.play().catch(() => {});
  };

  sendeZustand(ich);
  zeichneRaum();
  zeichneAnwesend();
  zeichneDeckel();
  setzeStatus();
  setInterval(setzeStatus, 4000);

  $('fusszeile').innerHTML =
    (istProbierraum
      ? '<strong>Offener Probierraum.</strong> Für den echten Stammtisch einen eigenen Schlüssel in den ' +
        'Link hängen — <code>?raum=euer-schluessel</code> — und nur diesen Link teilen. '
      : 'Ihr seid im Raum <code>' + escape(raumSchluessel) + '</code>. ') +
    'Diesen Link teilen, dann sind alle im selben Lokal:<br><code>' + escape(location.href.split('#')[0]) + '</code><br><br>' +
    'Behelfslösung ohne eigenen Server: die Bierdeckel leben, solange jemand im Raum ist. ' +
    'Wer als Letzter geht, kopiert sie am besten raus.';
}

function setzeStatus(){
  const n = gaeste.size;
  const pille = $('status');
  if(n === 0){
    pille.className = 'status-pille suchend';
    $('status-text').textContent = 'noch niemand da';
  }else{
    pille.className = 'status-pille verbunden';
    $('status-text').textContent = (n + 1) + ' im Lokal';
  }
}

/* ---------- Stuhl-Streit: wer zuerst saß, sitzt ---------- */
function loeseKonflikt(peerId, zustand){
  if(!ich.stuhl || zustand.stuhl !== ich.stuhl) return;
  const fremdFrueher = zustand.seit < ich.seit || (zustand.seit === ich.seit && peerId < selfId);
  if(!fremdFrueher) return;
  const frei = STUEHLE.filter(s => s.zone === ich.zone && !belegt(s.id));
  if(frei.length) setzePlatz(ich.zone, frei[0].id);
  else setzePlatz('tresen', null);
}

function belegt(stuhlId){
  let ja = false;
  gaeste.forEach(g => { if(g.stuhl === stuhlId) ja = true; });
  return ja;
}

function setzePlatz(zone, stuhlId){
  ich.zone = zone;
  ich.stuhl = stuhlId;
  ich.seit = Date.now();
  if(sendeZustand) sendeZustand(ich);
  setzeAudioZiele(true);
  toene.forEach((el, id) => {
    const g = gaeste.get(id);
    el.muted = !!(g && g.zone !== ich.zone);
  });
  zeichneRaum();
  zeichneAnwesend();
  zeichneDeckel();
  stelleGemurmel();
}

/* ===========================================================================
   Zeichnen
   =========================================================================== */
function baueRaum(){
  const tische = $('tische');
  const ringe = $('murmelringe');
  tische.innerHTML = '';
  ringe.innerHTML = '';
  ['rot', 'blau', 'gruen'].forEach(z => {
    const t = TISCHE[z];

    const ring = document.createElement('div');
    ring.className = 'murmelring';
    ring.id = 'ring-' + z;
    ring.style.left = t.x + '%';
    ring.style.top = t.y + '%';
    ring.style.setProperty('--tf', t.farbe);
    ringe.appendChild(ring);

    const d = document.createElement('div');
    d.className = 'tisch';
    d.id = 'zone-' + z;
    d.style.left = t.x + '%';
    d.style.top = t.y + '%';
    d.style.setProperty('--tf', t.farbe);
    d.style.setProperty('--tf-tief', t.tief);
    d.innerHTML = '<span class="tisch-name">' + escape(RUNDE.tische[z].label).replace(' ', '<br>') + '</span>';
    tische.appendChild(d);
  });
  $('zone-tresen').style.setProperty('--tf', TISCHE.tresen.farbe);
  $('zone-tresen').addEventListener('click', () => setzePlatz('tresen', null));
}

/* Am Tresen gibt es keine Stühle — dort wird gestanden, also rechnen wir die
   Positionen aus der Anzahl aus. Wie in echt: es wird enger, nicht voller. */
function tresenPositionen(anzahl){
  const aus = [];
  const reihen = Math.ceil(anzahl / 6) || 1;
  let index = 0;
  for(let r = 0; r < reihen; r++){
    const inReihe = Math.min(6, anzahl - index);
    const schritt = 34 / inReihe;
    for(let s = 0; s < inReihe; s++){
      aus.push({x: 7 + schritt * (s + 0.5), y: reihen === 1 ? 26 : 23.5 + r * 8.5});
      index++;
    }
  }
  return aus;
}

function alleLeute(){
  const liste = [{id: selfId, z: ich}];
  gaeste.forEach((g, id) => liste.push({id, z: g}));
  liste.sort((a, b) => a.id < b.id ? -1 : 1);   // stabile Reihenfolge für alle
  return liste;
}

function zeichneRaum(){
  const leute = alleLeute();
  const amTresen = leute.filter(l => l.z.zone === 'tresen');
  const tresenPlaetze = tresenPositionen(amTresen.length);

  /* Gäste */
  const behaelter = $('gaeste');
  const gesehen = new Set();
  leute.forEach(l => {
    let pos;
    if(l.z.zone === 'tresen'){
      pos = tresenPlaetze[amTresen.indexOf(l)] || {x: 24, y: 26};
    }else{
      const s = stuhlVon(l.z.stuhl);
      if(!s) return;
      pos = {x: s.x, y: s.y};
    }
    gesehen.add(l.id);

    let el = behaelter.querySelector('[data-peer="' + l.id + '"]');
    if(!el){
      el = document.createElement('div');
      el.className = 'platz gast';
      el.dataset.peer = l.id;
      el.innerHTML = '<div class="kreis"></div><div class="name"></div>';
      behaelter.appendChild(el);
    }
    const farbe = TISCHE[l.z.zone].farbe;
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
    el.style.setProperty('--tf', farbe);
    el.classList.toggle('ich', l.id === selfId);
    el.classList.toggle('steht', l.z.zone === 'tresen');
    el.classList.toggle('fern', l.z.zone !== ich.zone);
    el.classList.toggle('redet', (l.id === selfId ? 0 : (pegel.get(l.id) || 0)) > 0.12);
    el.title = l.z.name + (l.z.rolle ? ' · ' + l.z.rolle : '');
    el.querySelector('.kreis').innerHTML = escape(l.z.name.slice(0, 2)) +
      '<svg class="glas" viewBox="0 0 24 32" aria-hidden="true">' + glasSVG(farbeVon(l.z.getraenk)) + '</svg>';
    el.querySelector('.name').textContent = l.z.name;
  });
  [...behaelter.children].forEach(el => { if(!gesehen.has(el.dataset.peer)) el.remove(); });

  /* Freie Stühle */
  const stuehle = $('stuehle');
  stuehle.innerHTML = '';
  STUEHLE.forEach(s => {
    if(leute.some(l => l.z.stuhl === s.id)) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'platz stuhl';
    b.style.left = s.x + '%';
    b.style.top = s.y + '%';
    b.style.setProperty('--tf', TISCHE[s.zone].farbe);
    b.setAttribute('aria-label', 'Freier Platz ' + zonenName(s.zone) + ', hier hinsetzen');
    b.innerHTML = '<div class="kreis">frei</div><div class="name">&nbsp;</div>';
    b.addEventListener('click', () => setzePlatz(s.zone, s.id));
    stuehle.appendChild(b);
  });

  /* Ferne Zonen dämpfen */
  ZONEN.forEach(z => {
    const el = $('zone-' + z);
    if(el) el.classList.toggle('fern', z !== ich.zone);
  });

  zeichneHoerweite();
}

function zeichneHoerweite(){
  const nachbarn = [];
  gaeste.forEach(g => { if(g.zone === ich.zone) nachbarn.push(g.name); });
  const el = $('hoerweite');
  el.style.setProperty('--tf-aktiv', TISCHE[ich.zone].farbe);

  let txt;
  if(!nachbarn.length){
    txt = ich.zone === 'tresen'
      ? 'Du stehst allein am Tresen. Sobald jemand reinkommt, landet er auch hier.'
      : 'Du sitzt allein ' + zonenName(ich.zone) + '. Wer sich dazusetzt, bestimmt das Thema.';
  }else if(ich.zone === 'tresen'){
    txt = 'Du stehst am Tresen, mit ' + aufzaehlen(nachbarn) + '. Von den Tischen kommt nur Gemurmel.';
  }else{
    txt = 'Du sitzt ' + zonenName(ich.zone) + ', bei ' + aufzaehlen(nachbarn) +
          '. Nur diese Runde hört dich — die anderen Tische bleiben Hintergrundgeräusch.';
  }
  if(!meinStream) txt += ' <strong>Dein Mikrofon ist aus</strong> — du hörst mit, sagst aber nichts.';
  el.innerHTML = txt;
}

function zeichneAnwesend(){
  const behaelter = $('anwesend');
  behaelter.innerHTML = '';
  const leute = alleLeute();
  ZONEN.forEach(z => {
    const hier = leute.filter(l => l.z.zone === z);
    const box = document.createElement('div');
    box.className = 'tischgruppe';
    box.style.setProperty('--tf', TISCHE[z].farbe);
    box.style.setProperty('--tf-tief', TISCHE[z].tief);
    const titel = z === 'tresen' ? 'Tresen' : RUNDE.tische[z].label;
    box.innerHTML = '<h3>' + escape(titel) + '</h3>' + (hier.length
      ? '<ul>' + hier.map(l => '<li>' + escape(l.z.name) +
          (l.id === selfId ? ' <span class="rolle">du</span>' : '') +
          (l.z.rolle ? ' <span class="rolle">' + escape(l.z.rolle) + '</span>' : '') + '</li>').join('') + '</ul>'
      : '<p class="niemand">' + (z === 'tresen' ? 'Niemand am Tresen.' : 'Noch frei — Platz für fünf.') + '</p>');
    behaelter.appendChild(box);
  });
}

/* ===========================================================================
   Bierdeckel
   =========================================================================== */
function zeichneDeckel(){
  const zone = ich.zone;
  const liste = $('deckel-liste');
  const amTisch = zone !== 'tresen';

  $('deckel-titel').textContent = amTisch ? 'Bierdeckel · ' + RUNDE.tische[zone].label : 'Bierdeckel';
  $('deckel-unter').textContent = amTisch
    ? 'Worüber redet ihr gerade? Wenn sich das Thema dreht, schreib eine Zeile — der Deckel sammelt mit.'
    : 'Am Tresen liegt kein Deckel. Setz dich an einen Tisch, dann siehst du seinen.';
  $('deckel-eingabe').disabled = !amTisch;
  $('deckel-knopf').disabled = !amTisch;
  $('hoerweite').style.setProperty('--tf-aktiv', TISCHE[zone].farbe);
  liste.style.setProperty('--tf-aktiv', TISCHE[zone].farbe);

  const eintraege = [...deckel.values()].filter(e => e.zone === zone);
  liste.innerHTML = !amTisch ? '' : (eintraege.length
    ? eintraege.map(e =>
        '<li><span class="z">' + escape(e.zeit) + '</span><span>' +
        (e.wer ? '<b>' + escape(e.wer) + ':</b> ' : '') + '„' + escape(e.text) + '"</span></li>').join('')
    : '<li><span class="z">—</span><span>Noch nichts drauf. Wer die erste Zeile schreibt, gibt das Thema vor.</span></li>');
}

function neuerDeckelEintrag(){
  const feld = $('deckel-eingabe');
  const text = feld.value.trim();
  if(!text || ich.zone === 'tresen') return;
  const eintrag = {
    id: selfId + '-' + Date.now(),
    zone: ich.zone,
    zeit: uhrzeit(),
    wer: ich.name,
    text: text.slice(0, 120)
  };
  deckel.set(eintrag.id, eintrag);
  if(sendeDeckel) sendeDeckel([eintrag]);
  feld.value = '';
  zeichneDeckel();
}
$('deckel-knopf').addEventListener('click', neuerDeckelEintrag);
$('deckel-eingabe').addEventListener('keydown', e => { if(e.key === 'Enter') neuerDeckelEintrag(); });

/* ---------- Gehen ---------- */
$('gehen').addEventListener('click', () => {
  if(meinStream) meinStream.getTracks().forEach(t => t.stop());
  if(raum) raum.leave();
  location.reload();
});
window.addEventListener('beforeunload', () => { if(raum) raum.leave(); });
