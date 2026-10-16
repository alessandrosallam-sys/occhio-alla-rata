// Scheda «Previsioni»: la serie storica dell'indice dal 1999 e le proiezioni con i modelli di modelli.js
// (media delle variazioni, ARIMA, VAR, GARCH, Vasicek). Da qui si sceglie anche quale proiezione usa il piano
// per stimare l'indice delle rate future (M.perPiano, letto da app.js a ogni ricalcolo).
(function () {
  'use strict';
  const M = window.Mutuo;
  const { stato, $, crea, esegui, avvisa, data, perc, MESI } = M;
  const Mod = window.Modelli, Internet = window.TassiInternet;
  const modulo = $('#form-previsioni');
  const scaricate = new Map();   // codice → valori giornalieri scaricati in questa sessione (serie senza precaricati)
  let ultimo = null;             // l'ultima proiezione calcolata, per il grafico e il pulsante "usa"
  let calcoloAutomaticoFatto = false;   // la proiezione delle scelte salvate è già stata calcolata da sola

  const ORIZZONTI = [['12', '1 anno'], ['24', '2 anni'], ['60', '5 anni'], ['120', '10 anni'], ['fine', 'fino alla fine del mutuo']];
  // Durata in anni di ciascun Euribor, nell'ordine di TassiInternet.SERIE (1 settimana, 1, 3, 6, 12 mesi): serve alla curva.
  const TAU = Internet.SERIE.map(s => ({ W01: 7 / 360, M01: 1 / 12, M03: 0.25, M06: 0.5, M12: 1 })[s.codice]);
  const punti = (v, decimali = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + (Math.abs(v) * 100).toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali }) + ' punti';
  const numero = (v, decimali = 2) => v.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
  const ampiezza = (v, decimali = 3) => numero(Math.abs(v) * 100, decimali) + ' punti';   // una variabilità, senza segno
  const inGiorni = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;

  // ---------- Serie disponibili ----------
  // Valori giornalieri di un Euribor: precaricati + scaricati in sessione + (se è l'indice del contratto) quelli inseriti.
  function valoriSerie(codice, dati) {
    const serie = Internet.perCodice(codice);
    const perGiorno = new Map(Archivio.precaricati(serie.nome).map(t => [t.giorno, t.tasso_360]));
    for (const t of scaricate.get(codice) || []) perGiorno.set(t.giorno, t.tasso_360);
    const propria = Internet.riconosci(dati.parametri.indice_nome);
    if (propria && propria.codice === codice) for (const t of dati.euribor) perGiorno.set(t.giorno, t.tasso_360);
    return [...perGiorno].map(([giorno, tasso_360]) => ({ giorno, tasso_360 }));
  }
  const valoriContratto = dati => dati.euribor.map(t => ({ giorno: t.giorno, tasso_360: t.tasso_360 }));
  const valoriScelti = (codice, dati) => (codice === 'contratto' ? valoriContratto(dati) : valoriSerie(codice, dati));
  const nomeSerie = codice => (codice === 'contratto' ? `${M.indice()} (valori inseriti)` : Internet.perCodice(codice).nome);
  // Mesi dall'ultimo mese noto alla fine del mutuo (più uno di margine).
  function mesiFinoAllaFine(dati, ultimoMese) {
    const p = dati.parametri, [a, m] = p.data_prima_rata.split('-').map(Number), [ua, um] = ultimoMese.split('-').map(Number);
    return Math.max(1, (a * 12 + m - 1 + p.numero_rate) - (ua * 12 + um - 1) + 1);
  }
  // Scarica da internet tutto lo storico di una serie che non è nel programma (una volta per sessione).
  async function assicuraSerie(codice) {
    if (codice === 'contratto' || Mod.mensile(valoriSerie(codice, stato.dati)).length >= 36) return;
    const serie = Internet.perCodice(codice);
    avvisa(`Scarico lo storico di ${serie.nome} dalla ${Internet.FONTE}…`);
    const { valori } = await Internet.scarica(serie, '1999-01-01', stato.oggi);
    scaricate.set(codice, valori);
  }

  // ---------- Calcolo ----------
  // Prepara serie e opzioni e lancia il modello. "dati" sono i dati del mutuo (stato.dati o quelli passati dal piano).
  function calcola(modello, codice, opzioni, dati) {
    const serie = Mod.mensile(valoriScelti(codice, dati));
    if (!serie.length) throw new Error('Non ci sono valori per questa serie.');
    const o = { ...opzioni };
    if (modello === 'var' || modello === 'curva') {
      if (codice === 'contratto') throw new Error(modello === 'var' ? 'Il VAR mette insieme i cinque Euribor: scegli una delle serie Euribor.' : 'Le attese del mercato si leggono dalla curva dei cinque Euribor: scegli una delle serie Euribor.');
      o.altre = Internet.SERIE.map(s => Mod.mensile(valoriSerie(s.codice, dati)));
      o.indice = Internet.SERIE.findIndex(s => s.codice === codice);
      o.tau = TAU;
      const vuote = Internet.SERIE.filter((s, i) => o.altre[i].length < 36).map(s => s.nome);
      if (vuote.length) throw new Error(`Servono anche: ${vuote.join(', ')}. Scegli una di queste serie e premi «Calcola»: lo storico viene scaricato.`);
    }
    if (o.h === 'fine') o.h = mesiFinoAllaFine(dati, serie[serie.length - 1].mese);
    return { risultato: Mod.stima(modello, serie, o), serie };
  }

  // Per il piano (app.js): funzione giorno → indice stimato secondo il modello salvato nei parametri, oppure null
  // (media delle variazioni, il metodo del piano). Il risultato resta in memoria finché i dati non cambiano.
  // Scenari: quale valore della proiezione usare ("campo" di Modelli.perGiorno) e come chiamarlo.
  const SCENARI = { atteso: { campo: 'valore', nome: 'valore atteso' }, alto80: { campo: 'alto80', nome: 'fascia alta 80% (prudente)' }, basso80: { campo: 'basso80', nome: 'fascia bassa 80% (ottimista)' } };
  const scenarioDi = dati => SCENARI[dati.parametri.previsione_scenario] ? dati.parametri.previsione_scenario : 'atteso';
  // Una proiezione per ogni prestito (la scheda «Prestiti» calcola il piano di tutti): le ultime otto restano in memoria.
  const cachePiano = new Map();
  M.perPiano = function perPiano(dati) {
    const modello = dati.parametri.previsione_modello || 'media';
    if (modello === 'media' || !Mod.MODELLI[modello] || (dati.parametri.tipo_prestito || 'variabile') !== 'variabile') return null;
    let opzioni = {};
    try { opzioni = JSON.parse(dati.parametri.previsione_opzioni || '{}'); } catch { opzioni = {}; }
    const propria = Internet.riconosci(dati.parametri.indice_nome), codice = propria ? propria.codice : 'contratto', scenario = scenarioDi(dati);
    const serie = Mod.mensile(valoriScelti(codice, dati));
    if (!serie.length) return null;
    const u = serie[serie.length - 1];
    const chiave = JSON.stringify([modello, opzioni, scenario, codice, serie.length, u.giorno, u.y, dati.parametri.numero_rate, dati.parametri.data_prima_rata]);
    if (cachePiano.has(chiave)) return cachePiano.get(chiave);
    let funzione = null;
    try { funzione = Mod.perGiorno(calcola(modello, codice, { ...opzioni, h: 'fine' }, dati).risultato, SCENARI[scenario].campo); }
    catch { funzione = null; }   // dati insufficienti: il piano torna alla media delle variazioni
    cachePiano.set(chiave, funzione);
    if (cachePiano.size > 8) cachePiano.delete(cachePiano.keys().next().value);
    return funzione;
  };
  // Per le offerte (offerte.js): dove potrebbe andare un Euribor nei prossimi "mesi" secondo un modello, con i valori
  // nel programma (e quelli scaricati in questa sessione). Restituisce l'ultimo valore noto e, per ogni scenario
  // (atteso, alto80, basso80), una funzione giorno → indice; null se l'indice non è un Euribor o mancano i dati.
  const cacheOfferte = new Map();
  M.proiezioneIndice = function proiezioneIndice(nomeIndice, mesi, modello) {
    const propria = Internet.riconosci(nomeIndice);
    if (!propria || !Mod.MODELLI[modello]) return null;
    const dati = { parametri: { indice_nome: nomeIndice }, euribor: [] };
    const serie = Mod.mensile(valoriSerie(propria.codice, dati));
    if (serie.length < 36) return null;
    const u = serie[serie.length - 1], chiave = JSON.stringify([modello, propria.codice, mesi, serie.length, u.giorno, u.y]);
    if (!cacheOfferte.has(chiave)) {
      let esito = null;
      try {
        const { risultato } = calcola(modello, propria.codice, { h: mesi }, dati);
        const ultimo = { giorno: u.giorno, valore: u.y };
        // Prima della partenza della proiezione (o se manca un valore) vale l'ultimo valore noto.
        const scenario = campo => { const f = Mod.perGiorno(risultato, campo); return giorno => { const v = f(giorno); return v == null ? ultimo.valore : v; }; };
        esito = { ultimo, nomeSerie: propria.nome, scenari: { atteso: scenario('valore'), alto80: scenario('alto80'), basso80: scenario('basso80') } };
      } catch { esito = null; }   // dati insufficienti per il modello
      cacheOfferte.set(chiave, esito);
      if (cacheOfferte.size > 20) cacheOfferte.delete(cacheOfferte.keys().next().value);
    }
    return cacheOfferte.get(chiave);
  };
  M.nomeModelloPiano = dati => {
    const modello = dati.parametri.previsione_modello || 'media', scenario = scenarioDi(dati);
    return modello !== 'media' && Mod.MODELLI[modello] ? Mod.MODELLI[modello].breve + (scenario !== 'atteso' ? `, ${SCENARI[scenario].nome}` : '') : null;
  };

  // ---------- Cosa vorrebbe dire per le rate ----------
  // Il piano ricalcolato con la proiezione (fino alla fine del mutuo) nei tre scenari: fascia bassa, atteso, fascia alta.
  function scenariRate() {
    const propria = Internet.riconosci(M.indice());
    if (!ultimo || ultimo.modello === 'media' || (propria ? ultimo.codice !== propria.codice : ultimo.codice !== 'contratto')) return null;
    let risultato;
    try { risultato = calcola(ultimo.modello, ultimo.codice, { ...ultimo.opzioni, h: 'fine' }, stato.dati).risultato; } catch { return null; }
    const colonne = [['basso80', 'Fascia bassa 80%'], ['valore', 'Valore atteso'], ['alto80', 'Fascia alta 80%']].map(([campo, titolo]) => {
      const righe = Calcolo.calcolaPiano(stato.dati, { previsione: Mod.perGiorno(risultato, campo) }).righe;
      const future = righe.filter(r => r.rataVera == null && r.fine >= stato.oggi);
      if (!future.length) return null;
      const somma = (lista, f) => lista.reduce((s, r) => s + f(r), 0);
      return { titolo, prossima: future[0], fraUnAnno: future[Math.min(11, future.length - 1)], massima: future.reduce((m, r) => (r.rataCalcolata > m.rataCalcolata ? r : m)), interessi: somma(future, r => r.interessi), totale: somma(future, r => r.rataCalcolata), indiceMassimo: Math.max(...future.map(r => r.euribor)) };
    });
    return colonne.every(Boolean) ? colonne : null;
  }
  function tabellaScenari() {
    const scenari = scenariRate();
    if (!scenari) return [];
    const { euro, meseAnno } = M;
    const riga = (titolo, f) => crea('tr', {}, crea('th', {}, titolo), ...scenari.map(s => crea('td', {}, f(s))));
    return [crea('h3', {}, 'Cosa vorrebbe dire per le tue rate'),
      crea('p', { className: 'nota' }, 'Il piano ricalcolato con questa proiezione fino alla fine del mutuo, in tre scenari. Gli importi delle rate future sono stime; «interessi ancora da pagare» somma gli interessi di tutte le rate non ancora addebitate.'),
      crea('div', { className: 'contenitore-tabella semplice' }, crea('table', { className: 'tabella-previsione scenari' },
        crea('thead', {}, crea('tr', {}, crea('th', {}), ...scenari.map(s => crea('th', {}, s.titolo)))),
        crea('tbody', {},
          riga(`Prossima rata (${meseAnno(scenari[1].prossima.inizio)})`, s => euro(s.prossima.rataCalcolata)),
          riga(`Rata fra un anno (${meseAnno(scenari[1].fraUnAnno.inizio)})`, s => euro(s.fraUnAnno.rataCalcolata)),
          riga('Rata più alta', s => `${euro(s.massima.rataCalcolata)} (${meseAnno(s.massima.inizio)})`),
          riga('Indice più alto', s => perc(s.indiceMassimo, 2)),
          riga('Interessi ancora da pagare', s => euro(s.interessi)),
          riga('Totale ancora da pagare', s => euro(s.totale)))))];
  }

  // ---------- Modulo ----------
  const DESCRIZIONI = {
    media: 'Il metodo semplice: ogni mese l\'indice cambia della variazione media vista nel passato, e l\'incertezza cresce con il passare del tempo. È quello che il piano usa all\'inizio.',
    costante: 'L\'indice resta dov\'è oggi; solo l\'incertezza cresce, come le variazioni passate insegnano. È il confronto minimo: un modello che non fa meglio di questo non serve.',
    arima: 'ARIMA guarda come la serie dipende dai suoi valori passati (parte «AR») e dagli errori passati (parte «MA»), eventualmente sulle variazioni mensili invece che sui livelli («d = 1»). Con «scegli da solo» prova diverse combinazioni e tiene quella che spiega meglio i dati senza troppi parametri.',
    var: 'Il VAR mette insieme i cinque Euribor: ognuno viene spiegato dai valori passati di tutti. Serve lo storico di tutte le serie (è nel programma, o si scarica). La proiezione mostrata è quella della serie scelta.',
    garch: 'GARCH non cerca la direzione ma la variabilità: dice se siamo in un periodo agitato o calmo e quanto a lungo l\'agitazione tende a durare. La linea centrale è quasi piatta; sono le fasce a cambiare.',
    vasicek: 'Vasicek è il modello classico dei tassi: il tasso tende a tornare verso un livello di lungo periodo, con una certa velocità e una certa variabilità. La proiezione parte dal valore di oggi e si avvicina a quel livello.',
    curva: 'Non guarda il passato ma il mercato di oggi: i cinque Euribor (1 settimana, 1, 3, 6 e 12 mesi) formano una curva, e se il 12 mesi è più alto del 6 mesi vuol dire che il mercato si aspetta un 6 mesi più alto fra sei mesi (tasso «a termine»). Copre al massimo i prossimi 12 mesi; oltre, la proiezione resta ferma. Le fasce sono quelle dell\'incertezza storica, non del mercato.',
  };
  function disegnaSerie() {
    const propria = Internet.riconosci(M.indice());
    const voci = Internet.SERIE.map(s => { const n = Mod.mensile(valoriSerie(s.codice, stato.dati)).length; return crea('option', { value: s.codice }, `${s.nome}${n ? ` (${n} mesi)` : ' (da scaricare)'}`); });
    if (!propria) voci.unshift(crea('option', { value: 'contratto' }, `${M.indice()} (${Mod.mensile(valoriContratto(stato.dati)).length} mesi inseriti)`));
    const attuale = modulo.serie.value;
    modulo.serie.replaceChildren(...voci);
    const valida = v => v && [...modulo.serie.options].some(o => o.value === v);
    modulo.serie.value = valida(attuale) ? attuale : valida(scelte.serie) ? scelte.serie : propria ? propria.codice : 'contratto';
  }
  function disegnaParametri() {
    const modello = modulo.modello.value, blocco = $('#parametri-previsione');
    const scelta = (nome, etichetta, valori, iniziale) => crea('label', {}, etichetta, crea('select', { name: nome }, ...valori.map(v => crea('option', { value: String(v), selected: String(v) === String(iniziale) }, String(v)))));
    if (modello === 'arima') blocco.replaceChildren(
      crea('label', { className: 'spunta' }, crea('input', { type: 'checkbox', name: 'auto', checked: true }), crea('span', {}, 'Scegli da solo p e q (criterio AIC)')),
      scelta('p', 'p (termini AR)', [0, 1, 2, 3], 1), scelta('d', 'd (differenze)', [0, 1], 1), scelta('q', 'q (termini MA)', [0, 1, 2], 0));
    else if (modello === 'var') blocco.replaceChildren(scelta('p', 'p (mesi di ritardo)', [1, 2, 3], 1));
    else blocco.replaceChildren();
    $('#descrizione-modello').textContent = DESCRIZIONI[modello];
  }
  function opzioniScelte() {
    const modello = modulo.modello.value, o = {};
    if (modello === 'arima') { o.auto = modulo.auto.checked; o.p = +modulo.p.value; o.d = +modulo.d.value; o.q = +modulo.q.value; }
    if (modello === 'var') o.p = +modulo.p.value;
    return o;
  }
  function disegnaStatoPiano() {
    const nome = M.nomeModelloPiano(stato.dati), el = $('#stato-previsione');
    el.textContent = nome ? `Oggi il piano stima l'indice delle rate future con il modello ${nome}. Per cambiare, calcola un'altra proiezione e premi «Usa …», oppure torna al metodo semplice.`
      : 'Oggi il piano stima l\'indice delle rate future con il metodo semplice: la media delle variazioni passate. Calcola una proiezione qui sopra e premi «Usa …» per adottarla nel piano: le rate future (colonna «Rata calcolata») verranno ricalcolate con quei tassi.';
    $('#togli-previsione').hidden = !nome;
    const usa = $('#usa-previsione');
    usa.hidden = !ultimo || ultimo.modello === 'media' || ultimo.codice === 'contratto' && Internet.riconosci(M.indice());
    if (!usa.hidden) usa.textContent = `Usa ${Mod.MODELLI[ultimo.modello].breve} per le rate future del piano`;
    $('#scelta-scenario').hidden = usa.hidden;
    if (!$('#scelta-scenario').hidden && !modulo.scenario.dataset.toccato) modulo.scenario.value = scenarioDi(stato.dati);
    disegnaRiassunto();
  }
  // La riga sempre visibile sotto il grafico: che proiezione è disegnata e che cosa usa il piano.
  function disegnaRiassunto() {
    const el = $('#riassunto-proiezione');
    if (!el || !stato.dati) return;
    const scelto = select => (select.options[select.selectedIndex] || {}).textContent || '';
    const modello = Mod.MODELLI[modulo.modello.value], fine = ultimo && ultimo.risultato.proiezione[ultimo.risultato.proiezione.length - 1];
    const voce = (titolo, testo) => crea('span', { className: 'voce-riassunto' }, crea('b', {}, titolo + ' '), testo);
    el.replaceChildren(
      voce('Grafico:', [modello ? modello.breve : '', scelto(modulo.orizzonte), SCENARI[modulo.scenario.value] ? SCENARI[modulo.scenario.value].nome : ''].filter(Boolean).join(', ')
        + (fine ? ` → ${perc(fine.valore, 2)} a ${MESI[+fine.mese.slice(5, 7) - 1].slice(0, 3)} ${fine.mese.slice(0, 4)}` : '')),
      voce('Il piano usa:', M.nomeModelloPiano(stato.dati) || 'media delle variazioni'));
  }
  modulo.scenario.replaceChildren(...Object.entries(SCENARI).map(([codice, s]) => crea('option', { value: codice }, s.nome)));
  modulo.scenario.addEventListener('change', () => { modulo.scenario.dataset.toccato = '1'; });
  function disegna() {
    if (!stato.dati) return;
    applicaScelteDeiDati();
    disegnaSerie();
    disegnaStatoPiano();
  }
  modulo.modello.replaceChildren(...Object.entries(Mod.MODELLI).map(([codice, m]) => crea('option', { value: codice }, m.nome)));
  modulo.orizzonte.replaceChildren(...ORIZZONTI.map(([v, t]) => crea('option', { value: v, selected: v === '24' }, t)));
  // Le scelte del modulo stanno con i dati del mutuo (parametro nascosto previsione_modulo): a ogni riapertura si
  // ritrovano, anche in un altro browser o caricando il file, e la proiezione si ricalcola da sola.
  // Prima stavano nella memoria del browser (chiave «previsioni»), diversa in ogni browser: non si leggono più.
  let scelte = {}, applicate;   // applicate = il testo delle scelte già messo nel modulo
  function leggiScelte() {
    try { return JSON.parse((stato.dati && stato.dati.parametri.previsione_modulo) || '{}') || {}; } catch { return {}; }
  }
  function salvaScelte() {
    scelte = { serie: modulo.serie.value, modello: modulo.modello.value, orizzonte: modulo.orizzonte.value, scenario: modulo.scenario.value, ...opzioniScelte() };
    const testo = JSON.stringify(scelte);
    if (!stato.dati || testo === stato.dati.parametri.previsione_modulo) return;
    applicate = testo;
    esegui('PUT', 'parametri', { previsione_modulo: testo });
  }
  const vale = (select, v) => v != null && [...select.options].some(o => o.value === String(v));
  function ripristinaScelte() {
    if (vale(modulo.serie, scelte.serie)) modulo.serie.value = scelte.serie;
    // Senza scelte ricordate: il modello che il piano sta usando, altrimenti Vasicek.
    const delPiano = stato.dati && Mod.MODELLI[stato.dati.parametri.previsione_modello] && stato.dati.parametri.previsione_modello !== 'media' ? stato.dati.parametri.previsione_modello : null;
    modulo.modello.value = vale(modulo.modello, scelte.modello) ? scelte.modello : delPiano || 'vasicek';
    if (vale(modulo.orizzonte, scelte.orizzonte)) modulo.orizzonte.value = scelte.orizzonte;
    disegnaParametri();
    if (modulo.modello.value === 'arima' && scelte.p != null) { modulo.auto.checked = !!scelte.auto; modulo.p.value = scelte.p; modulo.d.value = scelte.d; modulo.q.value = scelte.q; }
    else if (modulo.modello.value === 'arima' && delPiano === 'arima') { try { const o = JSON.parse(stato.dati.parametri.previsione_opzioni || '{}'); if (o.p != null) { modulo.auto.checked = !!o.auto; modulo.p.value = o.p; modulo.d.value = o.d; modulo.q.value = o.q; } } catch { /* opzioni non leggibili */ } }
    if (modulo.modello.value === 'var' && scelte.p != null) modulo.p.value = scelte.p;
    else if (modulo.modello.value === 'var' && delPiano === 'var') { try { const o = JSON.parse(stato.dati.parametri.previsione_opzioni || '{}'); if (vale(modulo.p, o.p)) modulo.p.value = o.p; } catch { /* opzioni non leggibili */ } }
    if (vale(modulo.scenario, scelte.scenario)) { modulo.scenario.value = scelte.scenario; modulo.scenario.dataset.toccato = '1'; }
  }
  ripristinaScelte();
  // Dati nuovi (avvio, file caricato, file collegato ripreso): se le scelte salvate sono cambiate si rimettono nel
  // modulo, e la proiezione già calcolata con le scelte di prima si rifà.
  function applicaScelteDeiDati() {
    const testo = stato.dati.parametri.previsione_modulo || '';
    if (testo === applicate) return;
    const prima = applicate;
    applicate = testo;
    scelte = leggiScelte();
    ripristinaScelte();
    if (prima === undefined || !calcoloAutomaticoFatto) return;
    ultimo = null;
    $('#esito-previsione').replaceChildren();
    if ($('#scheda-tassi').hidden) calcoloAutomaticoFatto = false;   // si ricalcola alla prossima apertura della scheda
    else eseguiCalcolo();
  }
  modulo.modello.addEventListener('change', disegnaParametri);
  modulo.addEventListener('change', salvaScelte);
  modulo.addEventListener('change', disegnaRiassunto);
  // Il pannello della proiezione resta aperto o chiuso come l'ha lasciato l'utente.
  const pannello = $('#dettagli-proiezione');
  if (pannello) {
    pannello.open = M.ricordo.leggi('proiezione-aperta') === 'si';
    pannello.addEventListener('toggle', () => M.ricordo.scrivi('proiezione-aperta', pannello.open ? 'si' : 'no'));
  }
  // Calcolo della proiezione con le scelte del modulo (dal pulsante, o da solo all'apertura della scheda).
  async function eseguiCalcolo() {
    const pulsante = $('button[type="submit"]', modulo), codice = modulo.serie.value, modello = modulo.modello.value;
    const avviso = $('#avviso-previsione');
    avviso.hidden = true;
    pulsante.disabled = true;
    try {
      await assicuraSerie(codice);
      if (modello === 'var') for (const s of Internet.SERIE) await assicuraSerie(s.codice);
      const h = modulo.orizzonte.value === 'fine' ? 'fine' : +modulo.orizzonte.value;
      const { risultato, serie } = calcola(modello, codice, { ...opzioniScelte(), h }, stato.dati);
      ultimo = { risultato, serie, codice, modello, opzioni: opzioniScelte() };
      disegnaSerie();
      disegnaEsito();
      disegnaStatoPiano();
      disegnaRiassunto();
      ridisegna();
    } catch (errore) {
      avviso.textContent = errore.message;
      avviso.hidden = false;
    } finally {
      pulsante.disabled = false;
    }
  }
  modulo.addEventListener('submit', evento => { evento.preventDefault(); salvaScelte(); eseguiCalcolo(); });
  $('#usa-previsione').addEventListener('click', () => {
    if (!ultimo) return;
    const scenario = SCENARI[modulo.scenario.value] ? modulo.scenario.value : 'atteso';
    esegui('PUT', 'parametri', { previsione_modello: ultimo.modello, previsione_opzioni: JSON.stringify(ultimo.opzioni), previsione_scenario: scenario },
      `Da ora il piano stima le rate future con il modello ${Mod.MODELLI[ultimo.modello].breve}${scenario !== 'atteso' ? ` (${SCENARI[scenario].nome})` : ''}`);
  });
  $('#togli-previsione').addEventListener('click', () => esegui('PUT', 'parametri', { previsione_modello: 'media', previsione_opzioni: '', previsione_scenario: 'atteso' }, 'Il piano torna alla media delle variazioni'));

  // ---------- Confronto all'indietro: quale modello ha funzionato meglio ----------
  // Per ogni modello (con le opzioni predefinite; ARIMA con gli ordini scelti una volta sull'intera serie) si rifanno
  // le proiezioni dal passato e si misurano gli errori a 1 e 2 anni. Il migliore è quello con l'errore quadratico
  // medio più basso all'orizzonte scelto, a parità di storico.
  const moduloConfronto = $('#form-confronto');
  const ORDINE_CONFRONTO = ['costante', 'media', 'curva', 'arima', 'var', 'garch', 'vasicek'];
  let confronto = null;
  function opzioniPredefinite(modello, codice, dati) {
    if (modello === 'arima') return { auto: true, d: 1 };
    if (modello === 'var') return { p: 1 };
    return {};
  }
  async function eseguiConfronto() {
    const codice = modulo.serie.value, anni = +moduloConfronto.anni.value, orizzonte = +moduloConfronto.orizzonte.value;
    const pulsante = $('button[type="submit"]', moduloConfronto), avviso = $('#avviso-confronto');
    avviso.hidden = true;
    pulsante.disabled = true;
    pulsante.textContent = 'Confronto in corso…';
    await new Promise(r => setTimeout(r, 30));   // lascia disegnare il pulsante
    try {
      await assicuraSerie(codice);
      const serie = Mod.mensile(valoriScelti(codice, stato.dati));
      const righe = [];
      for (const modello of ORDINE_CONFRONTO) {
        let opzioni = opzioniPredefinite(modello, codice, stato.dati);
        try {
          if (modello === 'var' || modello === 'curva') {
            if (codice === 'contratto') continue;
            opzioni = { ...opzioni, altre: Internet.SERIE.map(s => Mod.mensile(valoriSerie(s.codice, stato.dati))), indice: Internet.SERIE.findIndex(s => s.codice === codice), tau: TAU };
            if (opzioni.altre.some(l => l.length < 36)) continue;
          }
          if (modello === 'arima') { const r = Mod.stima('arima', serie, { ...opzioni, h: 1 }); opzioni = { auto: false, p: r.parametri.p, d: r.parametri.d, q: r.parametri.q }; }
          righe.push({ ...Mod.confronta(modello, serie, opzioni, { anni, orizzonti: [12, 24] }), opzioni });
        } catch (errore) {
          righe.push({ modello, errore: errore.message, opzioni });
        }
        await new Promise(r => setTimeout(r, 0));
      }
      confronto = { codice, anni, orizzonte, righe };
      disegnaConfronto();
    } catch (errore) {
      avviso.textContent = errore.message;
      avviso.hidden = false;
    } finally {
      pulsante.disabled = false;
      pulsante.textContent = 'Confronta i modelli';
    }
  }
  function disegnaConfronto() {
    const blocco = $('#esito-confronto');
    if (!confronto) { blocco.replaceChildren(); return; }
    const colonna = confronto.orizzonte === 12 ? 0 : 1;
    const validi = confronto.righe.filter(r => !r.errore && r.perOrizzonte[colonna].quanti);
    const migliore = validi.reduce((m, r) => (!m || r.perOrizzonte[colonna].rmse < m.perOrizzonte[colonna].rmse ? r : m), null);
    const cella = (r, i) => { const o = r.perOrizzonte[i]; return o.quanti ? `${ampiezza(o.rmse, 2)} · ${Math.round(o.copertura80 * 100)}%` : '–'; };
    const tabella = crea('table', { className: 'tabella-previsione' },
      crea('thead', {}, crea('tr', {}, ...['Modello', 'Errore a 1 anno · fascia 80%', 'Errore a 2 anni · fascia 80%', ''].map(t => crea('th', {}, t)))),
      crea('tbody', {}, ...confronto.righe.map(r => crea('tr', { className: r === migliore ? 'migliore' : '' },
        crea('td', {}, Mod.MODELLI[r.modello].nome + (r.modello === 'arima' && !r.errore ? ` (${r.opzioni.p},${r.opzioni.d},${r.opzioni.q})` : '') + (r === migliore ? ' ★' : '')),
        ...(r.errore ? [crea('td', { colSpan: 2, className: 'testo' }, r.errore)] : [crea('td', {}, cella(r, 0)), crea('td', {}, cella(r, 1))]),
        crea('td', { className: 'azione' }, ...(r.errore || r.modello === 'media' && false ? [] : [crea('button', { type: 'button', className: 'secondario piccolo', 'data-modello': r.modello }, 'Vedi')]))))));
    const primo = validi[0];
    blocco.replaceChildren(
      crea('p', { className: 'nota' }, `${nomeSerie(confronto.codice)}: proiezioni rifatte da ${primo ? primo.tagli : 0} date fra ${primo ? primo.dal : '?'} e ${primo ? primo.al : '?'}, una ogni 6 mesi. «Errore» è l'errore quadratico medio fra proiezione e valore vero; la percentuale è quante volte il valore vero è caduto nella fascia 80% (se il modello è onesto, circa 80).`),
      tabella,
      crea('p', { className: 'nota' }, migliore ? `Il modello con l'errore più basso a ${confronto.orizzonte === 12 ? 'un anno' : 'due anni'} è ${Mod.MODELLI[migliore.modello].nome}${migliore.modello === 'costante' ? ': nessun modello ha fatto meglio del «resta com\'è», che è una lezione in sé.' : '.'} «Vedi» lo porta nel modulo qui sopra e calcola la proiezione.` : 'Nessun modello è stato confrontabile.'));
  }
  moduloConfronto.addEventListener('submit', evento => { evento.preventDefault(); eseguiConfronto(); });
  $('#esito-confronto').addEventListener('click', evento => {
    const pulsante = evento.target.closest('button[data-modello]');
    if (!pulsante || !confronto) return;
    const riga = confronto.righe.find(r => r.modello === pulsante.dataset.modello);
    modulo.serie.value = confronto.codice;
    modulo.modello.value = riga.modello;
    disegnaParametri();
    if (riga.modello === 'arima') { modulo.auto.checked = false; modulo.p.value = riga.opzioni.p; modulo.d.value = riga.opzioni.d; modulo.q.value = riga.opzioni.q; }
    if (riga.modello === 'var') modulo.p.value = riga.opzioni.p;
    if (pannello) pannello.open = true;
    modulo.requestSubmit();
    modulo.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  // ---------- Esito in parole ----------
  function frasi(r) {
    const p = r.parametri, fine = r.proiezione[r.proiezione.length - 1], anni = r.h / 12;
    const quando = r.h % 12 === 0 ? (anni === 1 ? 'fra un anno' : `fra ${anni} anni`) : `fra ${r.h} mesi`;
    const righe = [`Serie usata: ${r.mesiStorico} mesi, fino al ${data(r.partenza.giorno)} (ultimo valore ${perc(r.partenza.valore, 3)}).`,
      `Valore atteso ${quando}: ${perc(fine.valore, 2)}; nell'80% dei casi fra ${perc(fine.basso80, 2)} e ${perc(fine.alto80, 2)}, nel 95% fra ${perc(fine.basso95, 2)} e ${perc(fine.alto95, 2)}.`];
    if (r.modello === 'media') righe.push(`Variazione media mensile ${punti(p.variazioneMedia, 3)}, con una variabilità tipica di ${ampiezza(p.deviazione)} al mese.`);
    if (r.modello === 'costante') righe.push(`L'indice resta a ${perc(r.partenza.valore, 3)}; le fasce vengono dalla variabilità tipica delle variazioni mensili, ${ampiezza(p.deviazione)} al mese.`);
    if (r.modello === 'arima') {
      righe.push(`Modello ARIMA(${p.p},${p.d},${p.q})${p.auto ? ', scelto fra 12 combinazioni con il criterio AIC' : ''}; lavora ${p.d ? 'sulle variazioni mensili' : 'sui livelli'}.`);
      if (p.phi.length) righe.push(`Coefficienti AR: ${p.phi.map(v => numero(v, 3)).join(', ')}${p.theta.length ? `; MA: ${p.theta.map(v => numero(v, 3)).join(', ')}` : ''}; costante ${punti(p.c, 4)}.`);
      else if (p.theta.length) righe.push(`Coefficienti MA: ${p.theta.map(v => numero(v, 3)).join(', ')}; costante ${punti(p.c, 4)}.`);
      if (p.mediaLungo != null) righe.push(`Livello di lungo periodo implicito: ${perc(p.mediaLungo, 2)}.`);
      righe.push(`Errore tipico di un mese: ${ampiezza(p.sigma)}.`);
    }
    if (r.modello === 'var') {
      righe.push(`VAR(${p.p}) stimato su ${p.k} serie e ${p.mesi} mesi in comune. A fine orizzonte le altre serie: ${Internet.SERIE.map((s, i) => `${s.nome.replace('Euribor ', '')} ${perc(p.altre[i].fine, 2)}`).join(', ')}.`);
    }
    if (r.modello === 'garch') {
      righe.push(`Variabilità attuale: ${ampiezza(p.volatilitaAttuale)} al mese, contro una media storica di ${ampiezza(p.volatilitaMedia)}${p.volatilitaLungo != null ? ` e un livello di lungo periodo di ${ampiezza(p.volatilitaLungo)}` : ''}.`);
      righe.push(`Persistenza α+β = ${numero(p.persistenza, 3)}: ${p.persistenza >= 0.995 ? 'la variabilità non torna a un livello fisso (modello al limite della stazionarietà): la proiezione usa quella di oggi' : p.persistenza > 0.9 ? 'i periodi agitati e quelli calmi durano a lungo' : 'la variabilità torna in fretta al suo livello normale'}. Variazione media mensile ${punti(p.mu, 4)}.`);
    }
    if (r.modello === 'curva') {
      righe.push(`Curva Euribor del mese di partenza: ${Internet.SERIE.map((s, i) => `${s.nome.replace('Euribor ', '')} ${perc(p.oggi[i], 2)}`).join(', ')}.`);
      righe.push(p.mesiCoperti > 0 ? `Il mercato prezza questo Euribor a ${perc(p.aTermine, 2)} fra ${p.mesiCoperti} mesi (tasso a termine implicito); oltre, la curva non dice niente e la proiezione resta ferma lì. I tassi a termine contengono anche un premio per il rischio: tendono a sovrastimare un po'.`
        : 'Per l\'Euribor 12 mesi la curva non arriva oltre oggi: la proiezione resta ferma al valore attuale.');
      righe.push(`Fasce dalla variabilità storica delle variazioni mensili, ${ampiezza(p.deviazione)} al mese.`);
    }
    if (r.modello === 'vasicek') {
      if (p.ritornoMedio) righe.push(`Livello di lungo periodo ${perc(p.b, 2)}; velocità di ritorno ${numero(p.a, 2)} l'anno, cioè metà della distanza si copre in circa ${Math.round(p.semivita)} mesi. Variabilità annua ${ampiezza(p.sigma, 2)}.`);
      else righe.push('Nei dati non c\'è ritorno verso una media (la stima della velocità è nulla o negativa): la proiezione è una semplice tendenza con incertezza crescente.');
    }
    return righe;
  }
  function disegnaEsito() {
    const r = ultimo.risultato, blocco = $('#esito-previsione');
    const tabella = crea('table', { className: 'tabella-previsione' }, crea('thead', {}, crea('tr', {}, ...['Mese', 'Atteso', 'Fascia 80%', 'Fascia 95%'].map(t => crea('th', {}, t)))),
      crea('tbody', {}, ...r.proiezione.filter((p, i) => i < 12 || (i + 1) % 12 === 0 || i === r.proiezione.length - 1).map(p => crea('tr', {},
        crea('td', {}, `${MESI[+p.mese.slice(5, 7) - 1]} ${p.mese.slice(0, 4)}`), crea('td', {}, perc(p.valore, 2)),
        crea('td', {}, `${perc(p.basso80, 2)} – ${perc(p.alto80, 2)}`), crea('td', {}, `${perc(p.basso95, 2)} – ${perc(p.alto95, 2)}`)))));
    blocco.replaceChildren(crea('h3', {}, `${nomeSerie(ultimo.codice)}: proiezione ${Mod.MODELLI[r.modello].breve}`), crea('ul', { className: 'frasi' }, ...frasi(r).map(f => crea('li', {}, f))),
      crea('details', {}, crea('summary', {}, 'Tabella della proiezione (primi 12 mesi, poi un valore all\'anno)'), crea('div', { className: 'contenitore-tabella semplice' }, tabella)),
      ...tabellaScenari());
  }

  // ---------- Serie e proiezione per il grafico della scheda Tassi (tassi.js) ----------
  // Il grafico mostra la serie scelta nel modulo (tutta la storia) e, a destra, la proiezione: quella calcolata
  // dall'utente, oppure quella del modello che il piano sta usando (o della media, il metodo semplice).
  const codiceCorrente = () => {
    const propria = Internet.riconosci(M.indice()), predefinito = propria ? propria.codice : 'contratto';
    const scelto = modulo.serie.value;
    return scelto && (scelto === 'contratto' ? !propria : Internet.perCodice(scelto)) ? scelto : predefinito;
  };
  M.serieGrafico = () => {
    const codice = codiceCorrente(), propria = Internet.riconosci(M.indice());
    return { nome: nomeSerie(codice), valori: valoriScelti(codice, stato.dati), delContratto: codice === (propria ? propria.codice : 'contratto') };
  };
  const cacheGrafico = { chiave: null, risultato: null };
  M.proiezionePerGrafico = () => {
    const campo = SCENARI[modulo.scenario.value] ? SCENARI[modulo.scenario.value].campo : 'valore';
    if (ultimo) return { risultato: ultimo.risultato, campo, nome: Mod.MODELLI[ultimo.modello].breve };
    // Senza una proiezione calcolata a mano: quella che usa il piano (o la media), sulla serie del contratto.
    const codice = codiceCorrente(), propria = Internet.riconosci(M.indice());
    if (codice !== (propria ? propria.codice : 'contratto')) return null;
    const modello = Mod.MODELLI[stato.dati.parametri.previsione_modello] ? stato.dati.parametri.previsione_modello : 'media';
    let opzioni = {};
    try { opzioni = JSON.parse(stato.dati.parametri.previsione_opzioni || '{}'); } catch { opzioni = {}; }
    const h = modulo.orizzonte.value === 'fine' ? 'fine' : +modulo.orizzonte.value || 24;
    const chiave = JSON.stringify([modello, opzioni, codice, h, stato.dati.euribor.length, stato.dati.parametri.data_prima_rata]);
    if (cacheGrafico.chiave !== chiave) {
      cacheGrafico.chiave = chiave;
      try { cacheGrafico.risultato = calcola(modello, codice, { ...opzioni, h }, stato.dati).risultato; } catch { cacheGrafico.risultato = null; }
    }
    return cacheGrafico.risultato ? { risultato: cacheGrafico.risultato, campo: modello === 'media' ? 'valore' : campo, nome: Mod.MODELLI[modello].breve + (modello === 'media' ? ' (metodo del piano)' : ' (in uso nel piano)') } : null;
  };
  const ridisegna = () => { if (M.ridisegnaTassi) M.ridisegnaTassi(); };
  modulo.serie.addEventListener('change', () => { ultimo = null; $('#esito-previsione').replaceChildren(); disegnaStatoPiano(); ridisegna(); });
  modulo.orizzonte.addEventListener('change', () => { if (!ultimo) ridisegna(); });
  modulo.scenario.addEventListener('change', ridisegna);

  // ---------- Agganci ----------
  // Le carte stanno in fondo alla scheda Tassi: all'apertura della scheda, dopo il grafico dei tassi (tassi.js), si
  // ridisegnano stato e proiezione.
  M.viste.unshift(disegna);
  // Aperto un altro prestito: la proiezione calcolata era sulla serie del precedente; le scelte si rileggono dai suoi dati.
  M.cambioPrestito.push(() => {
    ultimo = null;
    applicate = undefined;
    calcoloAutomaticoFatto = false;
    $('#esito-previsione').replaceChildren();
  });
  // previsioni.js si carica dopo tassi.js: all'apertura della scheda prima si aggiornano modulo e stato, poi il grafico.
  const aperturaTassi = M.allApertura.tassi;

  M.allApertura.tassi = () => {
    disegna();
    if (aperturaTassi) aperturaTassi();
    if (!calcoloAutomaticoFatto && stato.dati && !ultimo) {
      calcoloAutomaticoFatto = true;
      if (!scelte.modello) ripristinaScelte();   // il modello del piano, noto solo ora che i dati ci sono
      const codice = modulo.serie.value;
      if (codice === 'contratto' || Mod.mensile(valoriSerie(codice, stato.dati)).length >= 36) eseguiCalcolo();
    }
  };
})();
