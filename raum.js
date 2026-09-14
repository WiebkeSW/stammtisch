/* ============================================================================
   Stammtisch — Behelfslösung ohne eigenen Server.

   Warum das ohne Server geht:
   Die Leute verbinden sich direkt miteinander (WebRTC, „peer to peer").
   Ein Server wird nur gebraucht, damit sich zwei Browser überhaupt erst mal
   finden — dafür nutzen wir öffentliche Nostr-Relais über die Bibliothek
   Trystero. Danach läuft der Ton direkt von Laptop zu Laptop, ohne Umweg.

   WICHTIGE LEKTION AUS DEM ERSTEN TEST (2026-09-14):
   Die erste Fassung hat den Ton bei jedem Tischwechsel neu ausgehandelt
   (nur an den eigenen Tisch senden). Genau bei dieser Neuaushandlung ist es
   manchmal nur in eine Richtung durchgelaufen — man wurde gehört, hörte aber
   selbst nichts, oder umgekehrt.

   Jetzt läuft es wie bei Gather.town oder SpatialChat: Ton geht IMMER an
   ALLE im Raum, ein einziges Mal verbunden, nie neu verhandelt. Wie nah man
   an jemandem "sitzt" bestimmt nur noch die Lautstärke beim Zuhören — nicht
   mehr, ob überhaupt eine Verbindung existiert. Das macht es robust UND
   ehrlicher: das Gemurmel vom Nachbartisch ist jetzt echter Ton (leise,
   dumpf gefiltert), kein nachgemachtes Rauschen mehr.
   ========================================================================== */

import {joinRoom, selfId} from 'https://cdn.jsdelivr.net/npm/@trystero-p2p/nostr@0.25.4/+esm';
import {RUNDEN, STANDARD_RUNDE, PROBIERRAUM, TISCHE, STUEHLE, GETRAENKE} from './runden.js';

/* ---------- Welche Runde, welcher Raum? ---------- */
const params = new URLSearchParams(location.search);
const rundenSchluessel = RUNDEN[params.get('runde')] ? params.get('runde') : STANDARD_RUNDE;
const RUNDE = RUNDEN[rundenSchluessel];
const ZONEN = ['tresen', 'rot', 'blau', 'gruen'];
const TISCHZONEN = ['rot', 'blau', 'gruen'];

/* Der Raumschlüssel kommt aus dem Link, nicht aus dem Code — dieser Code liegt
   öffentlich. Alle mit demselben ?raum= landen im selben Lokal. */
const raumSchluessel = (params.get('raum') || '').trim().slice(0, 60) || PROBIERRAUM;
const istProbierraum = raumSchluessel === PROBIERRAUM;

/* ---------- Zustand ---------- */
const ich = {name: '', rolle: '', zone: 'tresen', stuhl: null, getraenk: 'helles', seit: Date.now(), mikroAn: false};
const gaeste = new Map();              // peerId -> Zustand
const pegel = new Map();               // peerId -> 0..1 (selbst gemessen, gesendet)
const audioGraph = new Map();          // peerId -> {quelle, filter, gain}
const audioEmpfangenVon = new Set();   // peerId -> wir haben schon Ton von ihnen bekommen
const deckel = new Map();              // eintragId -> {id, zeit, wer, text, zone}
const redesteine = new Map();          // zone -> {inhaber, seit, warteliste}
TISCHZONEN.forEach(z => redesteine.set(z, {inhaber: null, seit: 0, warteliste: []}));

let raum = null;
let sendeZustand = null, sendeDeckel = null, sendePegel = null, sendeRedestein = null;
let meinStream = null;
let tonCtx = null;

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
function tischLabel(z){
  return z === 'tresen' ? 'Tresen' : RUNDE.tische[z].label;
}
function zonenName(z){
  if(z === 'tresen') return 'am Tresen';
  return 'am ' + tischLabel(z).toLowerCase().replace('er tisch', 'en Tisch');
}
function escape(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function namenVon(peerId){
  if(peerId === selfId) return ich.name;
  const g = gaeste.get(peerId);
  return g ? g.name : '?';
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
  'Beim Reinkommen fragen wir gleich nach dem Mikrofon; ohne geht es auch, dann schreibst du.';

$('reinkommen').addEventListener('click', async () => {
  ich.name = gewaehlterName.slice(0, 18);
  ich.rolle = $('rolle').value.trim().slice(0, 22);
  $('garderobe').hidden = true;
  $('lokal').hidden = false;

  starteTonanlage();     // braucht eine Nutzergeste — dieser Klick ist sie
  betreteRaum();
  await mikroEinschalten();   // automatisch versuchen; klappt es nicht, bleibt man im Schreibmodus
  zeigeTourFallsNeu();
});
$('name').addEventListener('keydown', e => {
  if(e.key === 'Enter' && !$('reinkommen').disabled) $('reinkommen').click();
});

/* ===========================================================================
   Tonanlage: EIN AudioContext für alles — eigene Lautstärkemessung UND die
   Mischung des Tons, den wir von anderen bekommen (echtes Gemurmel statt
   nachgemachtem Rauschen).
   =========================================================================== */
function starteTonanlage(){
  try{
    tonCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(tonCtx.state === 'suspended') tonCtx.resume();
  }catch(e){
    tonCtx = null;   // sehr alter Browser — Ton läuft dann über die Fallback-<audio>-Elemente
  }
}

/* ===========================================================================
   Mikrofon — geht jetzt IMMER an alle im Raum. Nah/fern regelt nur noch die
   Lautstärke beim Zuhören (siehe stelleAudioMix), nie mehr die Verbindung
   selbst. Kein Neuaushandeln beim Tischwechsel mehr nötig.
   =========================================================================== */
async function mikroEinschalten(){
  try{
    meinStream = await navigator.mediaDevices.getUserMedia({
      audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}
    });
  }catch(e){
    ich.mikroAn = false;
    zeigeMikroStatus('blockiert');
    $('schreib-hinweis').hidden = false;
    return false;
  }
  ich.mikroAn = true;
  if(raum) raum.addStream(meinStream);   // an alle, die schon da sind
  messePegel(meinStream);
  zeigeMikroStatus('an');
  $('schreib-hinweis').hidden = true;
  if(sendeZustand) sendeZustand(ich);
  return true;
}

function mikroAusschalten(){
  if(meinStream){
    meinStream.getTracks().forEach(t => t.stop());
    if(raum) try{ raum.removeStream(meinStream); }catch(e){}
  }
  meinStream = null;
  ich.mikroAn = false;
  if(sendePegel) sendePegel(0);
  zeigeMikroStatus('aus');
  $('schreib-hinweis').hidden = false;
  if(sendeZustand) sendeZustand(ich);
}

$('mikro-pille').addEventListener('click', () => {
  if(meinStream) mikroAusschalten();
  else mikroEinschalten();
});

function zeigeMikroStatus(stand){
  const el = $('mikro-pille');
  const txt = $('mikro-text');
  el.className = 'mikro-leiste ' + stand;
  if(stand === 'an') txt.textContent = 'Du wirst gehört — Mikrofon an (hier ausschalten)';
  else if(stand === 'aus') txt.textContent = 'Mikrofon aus — du hörst nur mit (hier wieder anschalten)';
  else if(stand === 'blockiert') txt.textContent = 'Kein Zugriff aufs Mikrofon — klick hier, um es erneut zu versuchen';
  else txt.textContent = 'Mikrofon wird angefragt …';
}
zeigeMikroStatus('wartet');

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
    stelleAudioMix();
    zeichneRaum();
  }, 180);
}

/* ===========================================================================
   Audio-Mischung beim Zuhören: hier passiert die "Entfernung".
   - eigener Tisch: klar und laut
   - andere Tische: leise UND dumpf gefiltert — echtes Gemurmel, keine Worte
   - sanftes Ducken: redet gerade jemand am eigenen Tisch deutlich lauter,
     wird die leisere Stimme etwas zurückgenommen (wie im echten Gespräch)
   - Redestein aktiv: wer nicht dran ist, wird deutlicher gedämpft
   =========================================================================== */
function stelleAudioMix(){
  if(!tonCtx || !audioGraph.size) return;

  let lautesterHier = 0;
  gaeste.forEach((g, id) => { if(g.zone === ich.zone) lautesterHier = Math.max(lautesterHier, pegel.get(id) || 0); });

  const rs = redesteine.get(ich.zone);
  const redeAktiv = rs && rs.inhaber !== null;

  audioGraph.forEach((kette, id) => {
    const g = gaeste.get(id);
    const hierbei = g && g.zone === ich.zone;
    let zielGain, zielFreq;

    if(hierbei){
      zielFreq = 15000;
      if(redeAktiv && rs.inhaber !== id){
        zielGain = 0.32;
      }else{
        const meinPegel = pegel.get(id) || 0;
        const geduckt = lautesterHier > 0.2 && meinPegel < lautesterHier - 0.16;
        zielGain = geduckt ? 0.45 : 1;
      }
    }else{
      zielFreq = 650;
      zielGain = 0.15;
    }

    const jetzt = tonCtx.currentTime;
    kette.gain.gain.setTargetAtTime(zielGain, jetzt, 0.3);
    kette.filter.frequency.setTargetAtTime(zielFreq, jetzt, 0.3);
  });

  TISCHZONEN.forEach(z => {
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
   Raum betreten
   =========================================================================== */
function betreteRaum(){
  $('lokal-titel').textContent = RUNDE.titel;

  TISCHZONEN.forEach(z => {
    const frage = RUNDE.tische[z].frage;
    if(frage) deckel.set('start-' + z, {id: 'start-' + z, zone: z, zeit: 'vorher', wer: '', text: frage, frage: true});
  });

  baueRaum();
  baueGetraenke($('getraenke-pult'));

  raum = joinRoom({appId: 'skillsprinters-stammtisch'}, raumSchluessel);

  const aZustand   = raum.makeAction('zustand');
  const aDeckel    = raum.makeAction('deckel');
  const aPegel     = raum.makeAction('pegel');
  const aRedestein = raum.makeAction('redestein');
  sendeZustand   = (z, ziel) => aZustand.send(z, ziel ? {target: ziel} : undefined);
  sendeDeckel    = (d, ziel) => aDeckel.send(d, ziel ? {target: ziel} : undefined);
  sendePegel     = p => aPegel.send(p);
  sendeRedestein = (zone, ziel) => aRedestein.send({zone, ...redesteine.get(zone)}, ziel ? {target: ziel} : undefined);

  aZustand.onMessage = (zustand, {peerId}) => {
    gaeste.set(peerId, zustand);
    loeseSitzKonflikt(peerId, zustand);
    stelleAudioMix();
    zeichneRaum();
    zeichneAnwesend();
    zeichneDeckel();
  };

  aDeckel.onMessage = (liste, {peerId}) => {
    (Array.isArray(liste) ? liste : [liste]).forEach(e => {
      if(e && e.id && !deckel.has(e.id)) deckel.set(e.id, e);
    });
    zeichneDeckel();
  };

  aPegel.onMessage = (wert, {peerId}) => {
    pegel.set(peerId, typeof wert === 'number' ? wert : 0);
    stelleAudioMix();
    zeichneRaum();
  };

  aRedestein.onMessage = (nachricht, {peerId}) => {
    if(!nachricht || !TISCHZONEN.includes(nachricht.zone)) return;
    const lokal = redesteine.get(nachricht.zone);
    /* Gleiches Prinzip wie beim Stuhl-Streit: wer zuerst dran war, gewinnt. */
    const fremdFrueher = nachricht.seit < lokal.seit || (nachricht.seit === lokal.seit && peerId < selfId);
    if(nachricht.inhaber === null || fremdFrueher || lokal.inhaber === null){
      redesteine.set(nachricht.zone, {inhaber: nachricht.inhaber, seit: nachricht.seit, warteliste: nachricht.warteliste || []});
      stelleAudioMix();
      zeichneRedestein();
    }
  };

  raum.onPeerJoin = peerId => {
    sendeZustand(ich, peerId);
    sendeDeckel([...deckel.values()], peerId);
    TISCHZONEN.forEach(z => sendeRedestein(z, peerId));
    if(meinStream) raum.addStream(meinStream, {target: peerId});
    setzeStatus();
  };

  raum.onPeerLeave = peerId => {
    gaeste.delete(peerId);
    pegel.delete(peerId);
    audioEmpfangenVon.delete(peerId);
    const kette = audioGraph.get(peerId);
    if(kette){
      try{ kette.quelle.disconnect(); kette.filter.disconnect(); kette.gain.disconnect(); }catch(e){}
      audioGraph.delete(peerId);
    }
    TISCHZONEN.forEach(z => {
      const rs = redesteine.get(z);
      if(rs.inhaber === peerId) redesteine.set(z, {inhaber: null, seit: Date.now(), warteliste: rs.warteliste.filter(id => id !== peerId)});
      else if(rs.warteliste.includes(peerId)) rs.warteliste = rs.warteliste.filter(id => id !== peerId);
    });
    zeichneRaum();
    zeichneAnwesend();
    zeichneDeckel();
    zeichneRedestein();
    setzeStatus();
  };

  raum.onPeerStream = (stream, peerId) => {
    audioEmpfangenVon.add(peerId);

    if(!tonCtx){
      /* Fallback ohne WebAudio (sehr alte Browser): normales <audio autoplay> */
      let el = document.querySelector('audio[data-peer="' + peerId + '"]');
      if(!el){
        el = document.createElement('audio');
        el.autoplay = true;
        el.dataset.peer = peerId;
        $('toene').appendChild(el);
      }
      el.srcObject = stream;
      el.play().catch(() => {});
      zeichneRaum();
      return;
    }

    let kette = audioGraph.get(peerId);
    if(!kette){
      const quelle = tonCtx.createMediaStreamSource(stream);
      const filter = tonCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 15000;
      const gain = tonCtx.createGain();
      gain.gain.value = 0;
      quelle.connect(filter).connect(gain).connect(tonCtx.destination);
      kette = {quelle, filter, gain};
      audioGraph.set(peerId, kette);
    }
    stelleAudioMix();
    zeichneRaum();
  };

  sendeZustand(ich);
  zeichneRaum();
  zeichneAnwesend();
  zeichneDeckel();
  zeichneRedestein();
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
function loeseSitzKonflikt(peerId, zustand){
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
  stelleAudioMix();   // nur Lautstärke neu mischen — keine Verbindung wird angefasst
  zeichneRaum();
  zeichneAnwesend();
  zeichneDeckel();
  zeichneRedestein();
}

/* ===========================================================================
   Zeichnen: Raum
   =========================================================================== */
function baueRaum(){
  const tische = $('tische');
  const ringe = $('murmelringe');
  tische.innerHTML = '';
  ringe.innerHTML = '';
  TISCHZONEN.forEach(z => {
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

    let tonBadge = '';
    if(l.id !== selfId && l.z.mikroAn){
      const angekommen = audioEmpfangenVon.has(l.id);
      tonBadge = angekommen
        ? '<span class="ton-status ok" title="Ton kommt an">🔊</span>'
        : '<span class="ton-status warnung" title="Sendet Mikrofon, aber wir hören noch nichts">⚠</span>';
    }
    el.querySelector('.kreis').innerHTML = escape(l.z.name.slice(0, 2)) +
      '<svg class="glas" viewBox="0 0 24 32" aria-hidden="true">' + glasSVG(farbeVon(l.z.getraenk)) + '</svg>' + tonBadge;
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
          '. Nur diese Runde hört dich klar — die anderen Tische bleiben Hintergrundgeräusch.';
  }
  if(!meinStream) txt += ' <strong>Dein Mikrofon ist aus</strong> — du hörst mit, sagst aber nichts. Schreib unten, wenn du was loswerden willst.';
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
    box.innerHTML = '<h3>' + escape(tischLabel(z)) + '</h3>' + (hier.length
      ? '<ul>' + hier.map(l => '<li>' + escape(l.z.name) +
          (l.id === selfId ? ' <span class="rolle">du</span>' : '') +
          (l.z.rolle ? ' <span class="rolle">' + escape(l.z.rolle) + '</span>' : '') +
          (l.id !== selfId && !l.z.mikroAn ? ' <span class="rolle">schreibt nur</span>' : '') + '</li>').join('') + '</ul>'
      : '<p class="niemand">' + (z === 'tresen' ? 'Niemand am Tresen.' : 'Noch frei — Platz für fünf.') + '</p>');
    behaelter.appendChild(box);
  });
}

/* ===========================================================================
   Bierdeckel — jetzt ein lebendiger Chat direkt am Tisch, nicht mehr nur
   gelegentliche Notizen. Was hier getippt wird, ist bewusst geschrieben —
   anders als gesprochene Worte darf das mitgeschrieben werden.
   =========================================================================== */
function zeichneDeckel(){
  const zone = ich.zone;
  const liste = $('deckel-liste');
  const amTisch = zone !== 'tresen';

  $('deckel-titel').textContent = amTisch ? 'Bierdeckel · ' + tischLabel(zone) : 'Am Tresen';
  $('deckel-unter').textContent = amTisch
    ? 'Für alle an diesem Tisch sichtbar — auch wenn bei jemandem der Ton mal nicht geht.'
    : 'Sag Hallo, oder schreib, falls dein Mikrofon nicht mitmacht.';
  $('deckel-eingabe').placeholder = amTisch ? 'Schreib etwas — alle an deinem Tisch sehen es' : 'Schreib etwas an den Tresen';
  $('hoerweite').style.setProperty('--tf-aktiv', TISCHE[zone].farbe);
  liste.style.setProperty('--tf-aktiv', TISCHE[zone].farbe);
  $('dein-tisch').style.setProperty('--tf-aktiv', TISCHE[zone].farbe);

  const nachbarn = [];
  gaeste.forEach(g => { if(g.zone === zone) nachbarn.push(g.name); });
  $('tisch-wer').innerHTML = nachbarn.length
    ? 'Hier: <b>' + escape(aufzaehlen(nachbarn)) + '</b>'
    : 'Du bist gerade allein hier.';

  const eintraege = [...deckel.values()].filter(e => e.zone === zone);
  liste.innerHTML = eintraege.length
    ? eintraege.map(e =>
        '<li' + (e.frage ? ' class="frage"' : '') + '><span class="z">' + escape(e.zeit) + '</span><span>' +
        (e.wer ? '<b>' + escape(e.wer) + ':</b> ' : '') + (e.frage ? '„' + escape(e.text) + '"' : escape(e.text)) + '</span></li>').join('')
    : '<li><span class="z">—</span><span>Noch nichts geschrieben. Der erste Satz gehört dir.</span></li>';
  liste.scrollTop = liste.scrollHeight;

  zeichneRedestein();
}

function neuerDeckelEintrag(){
  const feld = $('deckel-eingabe');
  const text = feld.value.trim();
  if(!text) return;
  const eintrag = {
    id: selfId + '-' + Date.now(),
    zone: ich.zone,
    zeit: uhrzeit(),
    wer: ich.name,
    text: text.slice(0, 140)
  };
  deckel.set(eintrag.id, eintrag);
  if(sendeDeckel) sendeDeckel([eintrag]);
  feld.value = '';
  zeichneDeckel();
}
$('deckel-knopf').addEventListener('click', neuerDeckelEintrag);
$('deckel-eingabe').addEventListener('keydown', e => { if(e.key === 'Enter') neuerDeckelEintrag(); });

/* ===========================================================================
   Redestein — optionale Gesprächsordnung für einen Tisch, der es chaotisch
   findet. Niemand wird stummgeschaltet, nur deutlich leiser, solange
   jemand anders den Stein hält. Am Tresen gibt es keinen (steht ja eh).
   =========================================================================== */
function zeichneRedestein(){
  const leiste = $('redestein-leiste');
  const zone = ich.zone;
  if(zone === 'tresen'){ leiste.hidden = true; return; }
  leiste.hidden = false;

  const rs = redesteine.get(zone);
  const nameVonHalter = rs.inhaber ? namenVon(rs.inhaber) : null;
  const warteNamen = rs.warteliste.filter(id => id !== rs.inhaber).map(namenVon);

  let status, knopf;
  if(!rs.inhaber){
    status = 'Kein Redestein aktiv — jeder normal zu hören.';
    knopf = '<button class="rs-knopf" id="rs-nehmen">🗣 Redestein nehmen</button>';
  }else if(rs.inhaber === selfId){
    status = '<strong>Du hast den Redestein.</strong> Die anderen hören dich klar, du sie leiser.';
    knopf = '<button class="rs-knopf aktiv" id="rs-weitergeben">Weitergeben</button>';
  }else{
    status = '<strong>' + escape(nameVonHalter) + '</strong> hat gerade den Redestein.' +
      (warteNamen.length ? '<span class="warteliste">Als Nächstes: ' + escape(aufzaehlen(warteNamen)) + '</span>' : '');
    const schonInWarteliste = rs.warteliste.includes(selfId);
    knopf = schonInWarteliste
      ? '<span class="warteliste">Du wartest schon.</span>'
      : '<button class="rs-knopf" id="rs-melden">Ich möchte auch reden</button>';
  }

  leiste.innerHTML = '<span class="rs-status">' + status + '</span>' + knopf;

  const nehmen = $('rs-nehmen');
  if(nehmen) nehmen.addEventListener('click', () => {
    redesteine.set(zone, {inhaber: selfId, seit: Date.now(), warteliste: []});
    if(sendeRedestein) sendeRedestein(zone);
    stelleAudioMix(); zeichneRedestein();
  });
  const weitergeben = $('rs-weitergeben');
  if(weitergeben) weitergeben.addEventListener('click', () => {
    const naechster = rs.warteliste.find(id => id !== selfId) || null;
    redesteine.set(zone, {inhaber: naechster, seit: Date.now(), warteliste: rs.warteliste.filter(id => id !== naechster)});
    if(sendeRedestein) sendeRedestein(zone);
    stelleAudioMix(); zeichneRedestein();
  });
  const melden = $('rs-melden');
  if(melden) melden.addEventListener('click', () => {
    if(!rs.warteliste.includes(selfId)) rs.warteliste.push(selfId);
    redesteine.set(zone, {inhaber: rs.inhaber, seit: rs.seit, warteliste: rs.warteliste});
    if(sendeRedestein) sendeRedestein(zone);
    zeichneRedestein();
  });
}

/* ===========================================================================
   Einführungstour — einmalig, vier Schritte, überspringbar.
   =========================================================================== */
function zeigeTourFallsNeu(){
  let gesehen = false;
  try{ gesehen = localStorage.getItem('stammtisch-tour-v1') === '1'; }catch(e){}
  if(gesehen) return;

  const schritte = [
    {icon: '👀', titel: 'Das bist du', text: 'Der dunkle Kreis mit deinem Namen im Raum oben. Du stehst gerade am Tresen — dem Eingang.'},
    {icon: '🎙️', titel: 'Diese Zeile zeigt: wirst du gehört?', text: 'Grün heißt, dein Mikrofon läuft und alle können dich hören. Klick drauf, um es aus- oder wieder anzuschalten.'},
    {icon: '💬', titel: 'Falls der Ton mal nicht geht', text: 'Direkt unter dem Raum kannst du mit allen an deinem Tisch schreiben — auch ohne Mikrofon bist du voll dabei.'},
    {icon: '🪑', titel: 'Tischwechsel', text: 'Klick auf einen freien Stuhl, um rüberzugehen. An deinem Tisch hörst du alles klar, die anderen Tische werden zu leisem Gemurmel.'}
  ];

  let schritt = 0;
  const tour = $('tour');
  const punkte = $('tour-punkte');
  punkte.innerHTML = schritte.map(() => '<span></span>').join('');

  function zeichneSchritt(){
    const s = schritte[schritt];
    $('tour-icon').textContent = s.icon;
    $('tour-titel').textContent = s.titel;
    $('tour-text').textContent = s.text;
    [...punkte.children].forEach((p, i) => p.classList.toggle('aktiv', i === schritt));
    $('tour-weiter').textContent = schritt === schritte.length - 1 ? 'Los geht\'s' : 'Weiter';
  }

  function schliessen(){
    tour.hidden = true;
    try{ localStorage.setItem('stammtisch-tour-v1', '1'); }catch(e){}
  }

  $('tour-weiter').onclick = () => {
    schritt++;
    if(schritt >= schritte.length) schliessen();
    else zeichneSchritt();
  };
  $('tour-ueberspringen').onclick = schliessen;

  zeichneSchritt();
  tour.hidden = false;
}

/* ---------- Gehen ---------- */
$('gehen').addEventListener('click', () => {
  if(meinStream) meinStream.getTracks().forEach(t => t.stop());
  if(raum) raum.leave();
  location.reload();
});
window.addEventListener('beforeunload', () => { if(raum) raum.leave(); });
